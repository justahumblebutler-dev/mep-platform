#!/usr/bin/env python3
"""
MEP PDF Take-Off Extractor v2.0
Extracts equipment tags, specifications, and patterns from MEP drawings.
Improved size extraction and pattern matching.
"""

import sys
import json
import re
import hashlib
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Import PDF libraries
try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed"}))
    sys.exit(1)

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


# Size extraction patterns (improved)
SIZE_PATTERNS = {
    "cfm": r'(\d[\d,]*(?:\.\d+)?\s*(?:CFM|cfm|L/s|LS))\b',
    "gpm": r'(\d+(?:\.\d+)?\s*(?:GPM|gpm|LPM|lpm|L\/m))\b',
    "ton": r'(\d+(?:\.\d+)?\s*(?:TON|ton|TONS|tons|TR|tr))\b',
    "mbh": r'(\d+(?:,\d{3})*(?:\.\d+)?\s*(?:MBH|mbh|MMBH|mmbh|BTU\/hr|btu\/hr|kBtu))\b',
    "hp": r'(\d+(?:\.\d+)?\s*(?:HP|hp|kW|kW|KW))\b',
    "voltage": r'(\d{3}[-/]?\d{3}[vV]?)\b|(?:(\d{3}[vV]))',
    "size_inches": r'(\d+(?:\.\d+)?\s*(?:"|in|inch|IN|IPS|NPS)\b)',
    "size_mm": r'(\d+(?:\.\d+)?\s*(?:mm|MM))\b',
    "gallons": r'(\d{1,6}(?:,\d{3})?\s*(?:GAL|gal|gallons?| liters?))\b',
    "temp": r'([+-]?\d+(?:\.\d+)?\s*°?[FfFCc])\b',
    "pressure": r'(\d+(?:\.\d+)?\s*(?:PSI|psi|kPa|kPA|psig|PSIG|bar))\b',
    "rpm": r'(\d+(?:\.\d+)?\s*(?:RPM|rpm))\b',
    "flow": r'(\d+(?:\.\d+)?\s*(?:GPM|gpm|CFM|cfm|L\/s|LS))\b',
}

# MEP Equipment Patterns
MEP_PATTERNS = {
    "ahu": {
        # Air Handling Units
        "patterns": [
            r'\bAHU[- ]?(\d+[A-Z]?)\b',
            r'\bAIR HANDLING UNIT[- ]?(\d+[A-Z]?)\b',
            r'\bMAU[- ]?(\d+[A-Z]?)\b',  # Make-up Air Unit
            r'\bDOAS[- ]?(\d+[A-Z]?)\b',  # Dedicated Outdoor Air System
        ],
        "type": "Air Handling Unit",
        "size_indicators": [
            r'(\d{1,3}(?:,\d{3})?\s*(?:CFM|cfm|L/s|LS))\s*(?:@|-)?\s*([+-]?\d+(?:\.\d+)?\s*°F)?',
            r'(\d+(?:,\d{3})*\s*(?:MBH|mbh|BTU\/hr|btu\/hr))',
            r'(\d+(?:\.\d+)?\s*(?:HP|hp|kW|KW))',
        ],
    },
    "rtu": {
        # Roof Top Units
        "patterns": [
            r'\bRTU[- ]?(\d+[A-Z]?)\b',
            r'\bROOFTOP\s*UNIT[- ]?(\d+[A-Z]?)\b',
            r'\bRTU\'s?\s*[-]?(\d+[A-Z]?)\b',
        ],
        "type": "Roof Top Unit",
        "size_indicators": [
            r'(\d{1,3}(?:,\d{3})?\s*(?:CFM|cfm|L/s|LS))',
            r'(\d+(?:,\d{3})*\s*(?:MBH|mbh|TON|ton|TONS|tons))',
        ],
    },
    "chiller": {
        # Chillers
        "patterns": [
            r'\bCHILL?ER[- ]?(\d+[A-Z]?)\b',
            r'\bCHW[- ]?(\d+[A-Z]?)\b',  # Chilled Water
            r'\bCHWP[- ]?(\d+[A-Z]?)\b',  # Chilled Water Pump
        ],
        "type": "Chiller",
        "size_indicators": [
            r'(\d+(?:\.\d+)?\s*(?:TON|ton|TONS|tons|TR|tr))',
            r'(\d+(?:,\d{3})*\s*(?:MBH|mbh|kW|KW))',
        ],
    },
    "ahu_components": {
        # Components within AHU
        "patterns": [
            r'\b(?:HV|AV|SA|EA|RA|OA)\s*DAMPER[- ]?(\d+[A-Z]?)\b',
            r'\b(?:HV|AV|SA|EA|RA|OA)\s*FAN[- ]?(\d+[A-Z]?)\b',
            r'\b(?:HX|COIL|HEATER)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:FILTER|FILTERS)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:FF|FINAL FILTER)[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "AHU Component",
    },
    "vav": {
        # VAV Boxes
        "patterns": [
            r'\bVAV[- ]?(\d+[A-Z]?)\b',
            r'\bVAVs?[- ]?(\d+[A-Z]?)\b',
            r'\bTERMINAL\s*UNIT[- ]?(\d+[A-Z]?)\b',
            r'\bTU[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "VAV Box",
        "size_indicators": [
            r'(\d+(?:,\d{3})?\s*(?:CFM|cfm|L/s|LS))',
        ],
    },
    "fan": {
        # Fans
        "patterns": [
            r'\b(?:SF|EF|DF|SF-EX|OF|POF|REF|FANS?)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:SUPPLY|EXHAUST|RETURN|DOOR|RELIEF)\s*FAN[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Fan",
        "size_indicators": [
            r'(\d+(?:,\d{3})?\s*(?:CFM|cfm|L/s|LS|CM|cm))',
            r'(\d+(?:\.\d+)?\s*(?:HP|hp|kW|KW))',
        ],
    },
    "pump": {
        # Pumps
        "patterns": [
            r'\b(?:PUMP|PUMPS)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:CP|CP-|CHWP|HWP|SUMP|P)-(\d+[A-Z]?)\b',
            r'\b(?:BP|BFP)[- ]?(\d+[A-Z]?)\b',  # Boiler Feed, BFP
        ],
        "type": "Pump",
        "size_indicators": [
            r'(\d+(?:\.\d+)?\s*(?:HP|hp|kW|KW))',
            r'(\d+(?:,\d{3})?\s*(?:GPM|gpm|LPM|lpm))',
            r'(\d+(?:\.\d+)?\s*(?:FT|ft|PSI|psi|m|mH|mWC))',
        ],
    },
    "boiler": {
        # Boilers
        "patterns": [
            r'\b(?:BLR|BOILER)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:HWB|HW BOILER)[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Boiler",
        "size_indicators": [
            r'(\d+(?:,\d{3})*\s*(?:MBH|mbh|BTU\/hr|btu\/hr|MMBH|mmbh))',
            r'(\d+(?:\.\d+)?\s*(?:HP|hp))',
        ],
    },
    "cooling_tower": {
        # Cooling Towers
        "patterns": [
            r'\b(?:CT|Cooling Tower|CT[- ]?)\s*(\d+[A-Z]?)\b',
            r'\b(?:CT[- ]?(\d+))\b',
        ],
        "type": "Cooling Tower",
        "size_indicators": [
            r'(\d+(?:\.\d+)?\s*(?:TON|ton|TONS|tons|TR|tr))',
        ],
    },
    "heat_exchanger": {
        # Heat Exchangers
        "patterns": [
            r'\b(?:HX|HEAT EXCHANGER|HEATER)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:PHE|PLATE HX)[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Heat Exchanger",
    },
    "tank": {
        # Tanks
        "patterns": [
            r'\b(?:TANK|TK|TANK[- ]?)\s*(\d+[A-Z]?)\b',
            r'\b(?:DHW|HW|CW|HWT|CWT|HTR)[- ]?TANK[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Tank",
        "size_indicators": [
            r'(\d+(?:,\d{3})?\s*(?:GAL|gal|L| liters?| gallons?))\b',
            r'(\d+(?:\.\d+)?\s*(?:PSI|psi|kPa|kPA))',
        ],
    },
    "valve": {
        # Valves
        "patterns": [
            r'\b(?:CV|FCV|GCV|MCV|TCV|GLV)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:VALVE)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:BFP|BYPASS|FEED)[- ]?VALVE[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Valve",
        "size_indicators": [
            r'(\d+(?:\.\d+)?\s*(?:in|"|inch|IN|IPS|NPS))\b',
            r'(?:size|sz)[. ]*(\d+(?:\.\d+)?\s*(?:in|"|inch|IN|IPS|NPS))',
        ],
    },
    "plumbing_fixtures": {
        # Plumbing Fixtures
        "patterns": [
            r'\b(?:WC|WC-|WATER CLOSET)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:LAV|LAV-|LAVATORY)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:UR|UR-|URINAL)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:DH|DH-|DRINKING FOUNTAIN)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:SH|SH-|SHOWER)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:SS|SINK|SS-|SERVICE SINK)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:HB|HB-|HOSE BIB)[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Plumbing Fixture",
    },
    "water_heater": {
        # Water Heaters
        "patterns": [
            r'\b(?:WH|WH-|WATER HEATER)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:DHW)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:STORAGE\s*HEATER|HEATER\s*STORAGE)[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Water Heater",
        "size_indicators": [
            r'(\d+(?:,\d{3})?\s*(?:GAL|gal|kBtu|kBTU))',
            r'(\d+(?:\.\d+)?\s*(?:kW|KW|BTU\/hr|btu\/hr))',
        ],
    },
    "motor": {
        # Motors
        "patterns": [
            r'\b(?:M(?:OTOR)?[- ]?(\d+[A-Z]?))\b',
            r'\b(?:M[/-]?(\d+[A-Z]?))\b',
        ],
        "type": "Motor",
        "size_indicators": [
            r'(\d+(?:\.\d+)?\s*(?:HP|hp|kW|KW))',
            r'(\d+(?:\.\d+)?\s*(?:RPM|rpm))',
            r'(\d+(?:\.\d+)?\s*(?:VOLTS|V|volts|v))',
        ],
    },
    "equipment": {
        # General equipment catch-all
        "patterns": [
            r'\b(?:EQ|EQUIPMENT)[- ]?(\d+[A-Z]?)\b',
            r'\b(?:EU|Equipment\s*Unit)[- ]?(\d+[A-Z]?)\b',
        ],
        "type": "Equipment",
    },
}

# Specification Reference Patterns
SPEC_PATTERNS = [
    r'(?:section|sect|div)\s*[\d\s,\-–]+\s*[–-]?\s*([\d]{2}\s*[\d]{2}\s*[\d]{2,4})',
    r'(?:see|refer\s*to|shown\s*on|detail)\s*(?:page|sheet|section|dwg|dwg\.|draw\.|fig\.|figure)\s*[:.]?\s*([A-Z]?[\d]+(?:[-/][\d]+)?)',
]

# Size extraction patterns
SIZE_PATTERNS = {
    "cfm": r'(\d{1,3}(?:,\d{3})?(?:\.\d+)?\s*(?:CFM|cfm|L\/s|LS))',
    "gpm": r'(\d+(?:\.\d+)?\s*(?:GPM|gpm|LPM|lpm))',
    "ton": r'(\d+(?:\.\d+)?\s*(?:TON|ton|TONS|tons|TR|tr))',
    "mbh": r'(\d+(?:,\d{3})*\s*(?:MBH|mbh|MMBH|mmbh|BTU\/hr|btu\/hr))',
    "hp": r'(\d+(?:\.\d+)?\s*(?:HP|hp|kW|KW))',
    "voltage": r'(\d{3}[-/]?\d{3}[vV]?)',
    "size_inches": r'(\d+(?:\.\d+)?\s*(?:"|in|inch|IN|IPS|NPS)\b)',
    "size_mm": r'(\d+(?:\.\d+)?\s*(?:mm|MM))',
    "gallons": r'(\d{1,6}(?:,\d{3})?\s*(?:GAL|gal|gallons?))',
    "temp": r'([+-]?\d+(?:\.\d+)?\s*°?[FfFCc])',
    "pressure": r'(\d+(?:\.\d+)?\s*(?:PSI|psi|kPa|kPA|psig|PSIG))',
    "rpm": r'(\d+(?:\.\d+)?\s*(?:RPM|rpm))',
}


def extract_text_from_pdf(pdf_path: str) -> dict:
    """Extract all text from a PDF using PyMuPDF."""
    text_data = {
        "pages": [],
        "metadata": {},
        "text_hash": None,
    }
    
    try:
        doc = fitz.open(pdf_path)
        text_data["metadata"] = {
            "page_count": len(doc),
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "created": doc.metadata.get("creationDate", ""),
        }
        
        all_text = []
        for page_num, page in enumerate(doc):
            text = page.get_text()
            all_text.append(text)
            text_data["pages"].append({
                "page": page_num + 1,
                "text": text,
                "text_length": len(text),
            })
        
        doc.close()
        
        # Create hash for delta detection
        combined_text = "\n".join(all_text)
        text_data["text_hash"] = hashlib.md5(combined_text.encode()).hexdigest()
        text_data["total_length"] = len(combined_text)
        
        return {"success": True, "data": text_data}
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def extract_tables_from_pdf(pdf_path: str) -> dict:
    """Extract tables from PDF using pdfplumber."""
    if pdfplumber is None:
        return {"success": False, "error": "pdfplumber not available", "tables": []}
    
    tables_data = {"tables": []}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                extracted_tables = page.extract_tables()
                if extracted_tables:
                    tables_data["tables"].append({
                        "page": page_num + 1,
                        "tables": extracted_tables,
                    })
        
        return {"success": True, "data": tables_data}
        
    except Exception as e:
        return {"success": False, "error": str(e), "tables": []}


def extract_sizes_from_context(context: str) -> list:
    """Extract size values from context string using all size patterns."""
    sizes = []
    for size_type, pattern in SIZE_PATTERNS.items():
        matches = re.findall(pattern, context, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                # Handle tuple results (like voltage)
                match = next((m for m in match if m), None)
            if match:
                sizes.append({
                    "type": size_type,
                    "value": match.strip(),
                })
    return sizes


def extract_equipment(text: str, page_num: int = 1) -> list:
    """Extract equipment tags and specifications from text."""
    equipment = []
    seen_tags = set()
    
    # Normalize text
    normalized_text = text.replace('\n', ' ').replace('\r', ' ')
    
    # Search for each equipment type
    for category, config in MEP_PATTERNS.items():
        patterns = config.get("patterns", [])
        equip_type = config.get("type", category.title())
        
        for pattern in patterns:
            try:
                matches = list(re.finditer(pattern, normalized_text, re.IGNORECASE))
                
                for match in matches:
                    tag_prefix = match.group(0).split(match.group(1))[0].strip()
                    tag_number = match.group(1) if match.groups() else ""
                    full_tag = f"{tag_prefix}{tag_number}".strip()
                    
                    # Skip duplicates
                    if full_tag in seen_tags:
                        continue
                    
                    # Extract context (surrounding text)
                    start = max(0, match.start() - 50)
                    end = min(len(normalized_text), match.end() + 150)
                    raw_context = normalized_text[start:end]
                    
                    # Extract sizes using new function
                    sizes = extract_sizes_from_context(raw_context)
                    
                    # Extract spec references
                    specs = []
                    for spec_pattern in SPEC_PATTERNS:
                        spec_matches = re.findall(spec_pattern, raw_context, re.IGNORECASE)
                        specs.extend([s for s in spec_matches if s])
                    
                    # Calculate confidence based on context
                    confidence = calculate_confidence(raw_context, full_tag, sizes)
                    
                    equipment.append({
                        "tag": full_tag,
                        "type": equip_type,
                        "category": category,
                        "sizes": [{"type": s["type"], "value": s["value"]} for s in sizes],
                        "specs_references": list(set(specs)),
                        "raw_text": raw_context.strip(),
                        "confidence": confidence,
                        "page_number": page_num,
                    })
                    
                    seen_tags.add(full_tag)
                    
            except re.error as e:
                continue  # Skip malformed patterns
    
    return equipment


def calculate_confidence(context: str, tag: str, sizes: list) -> float:
    """Calculate confidence score for extracted equipment."""
    base_confidence = 0.5
    
    # Boost for size indicators
    if sizes:
        base_confidence += 0.2
    
    # Boost for spec references
    if any(x in context.lower() for x in ['see', 'refer', 'spec', 'section', 'detail']):
        base_confidence += 0.1
    
    # Boost for equipment-related context
    equipment_keywords = ['supply', 'return', 'exhaust', 'fan', 'motor', 'filter', 'coil', 
                          ' damper', 'heating', 'cooling', 'filter', 'motor', 'pump']
    keyword_count = sum(1 for kw in equipment_keywords if kw in context.lower())
    base_confidence += min(0.2, keyword_count * 0.05)
    
    # Cap at 1.0
    return min(1.0, base_confidence)


def find_spec_sections(text: str) -> list:
    """Find specification sections in the text."""
    spec_sections = []
    
    # Common spec section patterns
    spec_patterns = [
        (r'(?:section|sect|div)[\s.]*(\d{2}\s*[\d\-\.]*\s*[\d]{2,4})[:\s.]*(.+?)(?=(?:section|sect|div)|\n\n|\Z)', 2),
        (r'(?:23\s*\d{4}|22\s*\d{4}|26\s*\d{4}|27\s*\d{4})[-–]?\s*([A-Za-z0-9\s\-,]+?)(?=\n\n|\d{2}\s*\d{4}|$)', 1),
    ]
    
    for pattern, contentGroup in spec_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE | re.DOTALL)
        for match in matches:
            spec_sections.append({
                "reference": match.group(1),
                "content": match.group(contentGroup)[:500] if match.group(contentGroup) else "",
            })
    
    return spec_sections


def find_version_info(text: str) -> dict:
    """Find version/revision information."""
    version_info = {
        "drawing_date": None,
        "revision": None,
        "project_name": None,
    }
    
    # Drawing date patterns
    date_patterns = [
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        r'(?:dated?|date)[:\s.]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            version_info["drawing_date"] = match.group(1)
            break
    
    # Revision patterns
    revision_patterns = [
        r'(?:rev(?:ision)?[\s.]*#?(\d+)|#(\d+))',
        r'(?:revision|rev)[:\s.]*(.+?)(?:\n|$)',
    ]
    
    for pattern in revision_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            version_info["revision"] = match.group(1) if match.group(1) else match.group(2)
            break
    
    return version_info


def process_pdf(pdf_path: str) -> dict:
    """Process a PDF and extract all relevant information."""
    result = {
        "file_path": pdf_path,
        "file_name": Path(pdf_path).name,
        "processed_at": datetime.now().isoformat(),
        "equipment": [],
        "spec_sections": [],
        "version_info": {},
        "stats": {
            "pages": 0,
            "equipment_count": 0,
            "unique_tags": 0,
        },
    }
    
    # Extract text
    text_result = extract_text_from_pdf(pdf_path)
    if not text_result.get("success"):
        return {"success": False, "error": text_result.get("error", "Unknown error")}
    
    result["metadata"] = text_result["data"]["metadata"]
    result["text_hash"] = text_result["data"]["text_hash"]
    result["stats"]["pages"] = text_result["data"]["metadata"].get("page_count", 0)
    
    # Extract equipment from each page
    for page_data in text_result["data"]["pages"]:
        page_equipment = extract_equipment(page_data["text"], page_data["page"])
        result["equipment"].extend(page_equipment)
    
    # Extract tables if available
    table_result = extract_tables_from_pdf(pdf_path)
    if table_result.get("success"):
        result["has_tables"] = True
        result["table_count"] = len(table_result.get("data", {}).get("tables", []))
    
    # Find spec sections (search in full text)
    full_text = "\n".join([p["text"] for p in text_result["data"]["pages"]])
    result["spec_sections"] = find_spec_sections(full_text)
    result["version_info"] = find_version_info(full_text)
    
    # Stats
    result["stats"]["equipment_count"] = len(result["equipment"])
    result["stats"]["unique_tags"] = len(set(e["tag"] for e in result["equipment"]))
    
    # By category
    result["stats"]["by_category"] = {}
    for equip in result["equipment"]:
        cat = equip["category"]
        result["stats"]["by_category"][cat] = result["stats"]["by_category"].get(cat, 0) + 1
    
    return {"success": True, "data": result}


def main():
    """Main entry point for command-line usage."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python extract.py <pdf_path> [pdf_path ...]"}))
        sys.exit(1)
    
    results = []
    for pdf_path in sys.argv[1:]:
        if Path(pdf_path).exists():
            result = process_pdf(pdf_path)
            results.append(result)
        else:
            results.append({"success": False, "error": f"File not found: {pdf_path}"})
    
    # Output as JSON
    print(json.dumps({"results": results}, indent=2))


if __name__ == "__main__":
    main()
