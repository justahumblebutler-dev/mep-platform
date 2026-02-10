/**
 * Manufacturer Equivalency Service
 * Matches equipment specifications to find equivalent/replacement options
 */

import { Equipment } from '../types';

export interface ManufacturerEquipment {
  id: string;
  manufacturer: string;
  model: string;
  category: string;
  specifications: EquipmentSpec[];
  listPrice?: number;
  warranty?: string;
  efficiencyRating?: string;
}

export interface EquipmentSpec {
  name: string;
  value: number;
  unit: string;
}

export interface EquivalencyMatch {
  originalEquipment: Equipment;
  matchedEquipment: ManufacturerEquipment;
  matchScore: number; // 0-1
  differences: SpecDifference[];
  isEquivalent: boolean;
}

export interface SpecDifference {
  specName: string;
  originalValue: string;
  matchedValue: string;
  isBetter: boolean; // true if matched is better
  severity: 'critical' | 'minor' | 'improvement';
  description: string;
}

export interface EquivalencyReport {
  originalTag: string;
  category: string;
  matches: EquivalencyMatch[];
  bestMatch: EquivalencyMatch;
  totalMatches: number;
  summary: string;
}

// Sample manufacturer database (in production, this would be an API)
const MANUFACTURER_DATABASE: ManufacturerEquipment[] = [
  // Fan Coils
  {
    id: "trane-fc-001",
    manufacturer: "Trane",
    model: "Climatuff FC",
    category: "fan_coil",
    specifications: [
      { name: "capacity", value: 2000, unit: "CFM" },
      { name: "cooling", value: 2, unit: "tons" },
      { name: "voltage", value: 208, unit: "V" },
      { name: "configuration", value: "vertical", unit: "type" },
    ],
    listPrice: 2500,
    efficiencyRating: "13 SEER",
  },
  {
    id: "daikin-dfcf-001",
    manufacturer: "Daikin",
    model: "Vinex II FC",
    category: "fan_coil",
    specifications: [
      { name: "capacity", value: 2000, unit: "CFM" },
      { name: "cooling", value: 2, unit: "tons" },
      { name: "voltage", value: 208, unit: "V" },
      { name: "configuration", value: "vertical", unit: "type" },
    ],
    listPrice: 2350,
    efficiencyRating: "14 SEER2",
  },
  {
    id: "carrier-fc-001",
    manufacturer: "Carrier",
    model: "AquaEdge FC",
    category: "fan_coil",
    specifications: [
      { name: "capacity", value: 2000, unit: "CFM" },
      { name: "cooling", value: 2, unit: "tons" },
      { name: "voltage", value: 230, unit: "V" },
      { name: "configuration", value: "vertical", unit: "type" },
    ],
    listPrice: 2450,
    efficiencyRating: "13 SEER",
  },
  
  // Air Handling Units
  {
    id: "trane-ahu-001",
    manufacturer: "Trane",
    model: "Trace AHU",
    category: "ahu",
    specifications: [
      { name: "capacity", value: 5000, unit: "CFM" },
      { name: "cooling", value: 50, unit: "tons" },
      { name: "heating", value: 500, unit: "MBH" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "motor", value: 15, unit: "HP" },
    ],
    listPrice: 45000,
  },
  {
    id: "daikin-ahu-001",
    manufacturer: "Daikin",
    model: "Magiksa AHU",
    category: "ahu",
    specifications: [
      { name: "capacity", value: 5000, unit: "CFM" },
      { name: "cooling", value: 48, unit: "tons" },
      { name: "heating", value: 480, unit: "MBH" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "motor", value: 15, unit: "HP" },
    ],
    listPrice: 42000,
  },
  {
    id: "iec-ahu-001",
    manufacturer: "IEC",
    model: "Innovative AHU",
    category: "ahu",
    specifications: [
      { name: "capacity", value: 5200, unit: "CFM" },
      { name: "cooling", value: 50, unit: "tons" },
      { name: "heating", value: 500, unit: "MBH" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "motor", value: 15, unit: "HP" },
    ],
    listPrice: 38000,
  },
  
  // Chillers
  {
    id: "trane-chiller-001",
    manufacturer: "Trane",
    model: "AquaGenie CVHE",
    category: "chiller",
    specifications: [
      { name: "cooling", value: 100, unit: "tons" },
      { name: "efficiency", value: 0.5, unit: "kW/ton" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "refrigerant", value: "R-1233zd", unit: "type" },
    ],
    listPrice: 120000,
  },
  {
    id: "carrier-chiller-001",
    manufacturer: "Carrier",
    model: "AquaEdge 23XRV",
    category: "chiller",
    specifications: [
      { name: "cooling", value: 100, unit: "tons" },
      { name: "efficiency", value: 0.48, unit: "kW/ton" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "refrigerant", value: "R-1233zd", unit: "type" },
    ],
    listPrice: 115000,
  },
  
  // Rooftop Units
  {
    id: "trane-rtu-001",
    manufacturer: "Trane",
    model: "IntelliPak RTU",
    category: "rtu",
    specifications: [
      { name: "cooling", value: 25, unit: "tons" },
      { name: "heating", value: 400, unit: "MBH" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "efficiency", value: 13, unit: "SEER" },
    ],
    listPrice: 35000,
  },
  {
    id: "daikin-rtu-001",
    manufacturer: "Daikin",
    model: "Pathfinder RTU",
    category: "rtu",
    specifications: [
      { name: "cooling", value: 25, unit: "tons" },
      { name: "heating", value: 400, unit: "MBH" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "efficiency", value: 14, unit: "SEER2" },
    ],
    listPrice: 33500,
  },
  {
    id: "lennox-rtu-001",
    manufacturer: "Lennox",
    model: "Strategos RTU",
    category: "rtu",
    specifications: [
      { name: "cooling", value: 25, unit: "tons" },
      { name: "heating", value: 400, unit: "MBH" },
      { name: "voltage", value: 460, unit: "V" },
      { name: "efficiency", value: 13.5, unit: "SEER2" },
    ],
    listPrice: 32000,
  },
];

// Category mappings
const CATEGORY_MAP: Record<string, string[]> = {
  "ahu": ["ahu", "air_handling_unit"],
  "rtu": ["rtu", "rooftop_unit", "rooftop"],
  "chiller": ["chiller", "chilled_water"],
  "fan_coil": ["fan_coil", "fc", "fcu"],
  "vav": ["vav", "vav_box", "terminal_unit"],
  "pump": ["pump", "pumps"],
  "boiler": ["boiler", "heating"],
  "cooling_tower": ["cooling_tower", "ct", "tower"],
};

export class EquivalencyService {
  private myManufacturers: Set<string>;
  
  constructor(myManufacturers: string[] = ["Daikin", "IEC"]) {
    this.myManufacturers = new Set(myManufacturers.map(m => m.toLowerCase()));
  }
  
  /**
   * Find equivalency matches for extracted equipment
   */
  findEquivalencies(
    equipment: Equipment,
    targetManufacturers?: string[]
  ): EquivalencyReport {
    const category = this._mapCategory(equipment.category);
    const specs = this._parseSpecs(equipment);
    
    // Find matching equipment from database
    let candidates = MANUFACTURER_DATABASE.filter(
      eq => eq.category === category
    );
    
    // Filter by target manufacturers if specified
    if (targetManufacturers && targetManufacturers.length > 0) {
      const targetSet = new Set(targetManufacturers.map(m => m.toLowerCase()));
      candidates = candidates.filter(
        eq => targetSet.has(eq.manufacturer.toLowerCase())
      );
    }
    
    // Score and rank candidates
    const matches = candidates
      .map(candidate => this._calculateMatch(equipment, candidate, specs))
      .filter(match => match.matchScore > 0.3) // Only show reasonable matches
      .sort((a, b) => b.matchScore - a.matchScore);
    
    // Calculate summary
    const summary = this._generateSummary(equipment, matches);
    
    return {
      originalTag: equipment.tag,
      category,
      matches,
      bestMatch: matches[0] || null,
      totalMatches: matches.length,
      summary,
    };
  }
  
  /**
   * Generate side-by-side comparison
   */
  generateComparison(
    original: Equipment,
    targetManufacturer: string
  ): string {
    const report = this.findEquivalencies(original, [targetManufacturer]);
    
    if (!report.bestMatch) {
      return `No matching ${targetManufacturer} equipment found for ${original.tag}`;
    }
    
    const match = report.bestMatch;
    const isMyCompany = this.myManufacturers.has(
      match.matchedEquipment.manufacturer.toLowerCase()
    );
    
    let comparison = `# Equivalency Comparison: ${original.tag}\n\n`;
    comparison += `**Original:** ${match.originalEquipment.raw_text}\n\n`;
    comparison += `**Matched:** ${match.matchedEquipment.manufacturer} ${match.matchedEquipment.model}\n\n`;
    
    comparison += `## Specifications\n\n`;
    comparison += `| Specification | Original | Matched | Status |\n`;
    comparison += `|--------------|----------|---------|--------|\n`;
    
    for (const diff of match.differences) {
      const status = this._getStatusEmoji(diff.severity, diff.isBetter);
      comparison += `| ${diff.specName} | ${diff.originalValue} | ${diff.matchedValue} | ${status} |\n`;
    }
    
    comparison += `\n## Summary\n\n`;
    comparison += `- **Match Score:** ${(match.matchScore * 100).toFixed(0)}%\n`;
    comparison += `- **Equivalent:** ${match.isEquivalent ? '✅ Yes' : '⚠️ Review Required'}\n`;
    
    if (match.matchedEquipment.listPrice) {
      comparison += `\n**Price Comparison:**\n`;
      comparison += `- Estimated Original: $${this._estimatePrice(original)}\n`;
      comparison += `- ${match.matchedEquipment.manufacturer}: $${match.matchedEquipment.listPrice.toLocaleString()}\n`;
      const savings = this._estimatePrice(original) - match.matchedEquipment.listPrice;
      if (savings > 0) {
        comparison += `- **Potential Savings: $${savings.toLocaleString()}**\n`;
      }
    }
    
    if (isMyCompany) {
      comparison += `\n🎯 **This is YOUR company's equipment!**\n`;
    }
    
    return comparison;
  }
  
  /**
   * Highlight differences for UI
   */
  generateHighlightedDiffs(matches: EquivalencyMatch[]): HighlightedDiff[] {
    return matches.map(match => ({
      original: match.originalEquipment.tag,
      matched: `${match.matchedEquipment.manufacturer} ${match.matchedEquipment.model}`,
      isEquivalent: match.isEquivalent,
      differences: match.differences.map(diff => ({
        spec: diff.specName,
        original: diff.originalValue,
        matched: diff.matchedValue,
        status: this._getStatusForUI(diff.severity, diff.isBetter),
      })),
      matchScore: match.matchScore,
    }));
  }
  
  private _mapCategory(category: string): string {
    const normalized = category.toLowerCase().replace(" ", "_");
    for (const [key, values] of Object.entries(CATEGORY_MAP)) {
      if (values.includes(normalized) || normalized.includes(key)) {
        return key;
      }
    }
    return category;
  }
  
  private _parseSpecs(equipment: Equipment): Map<string, number> {
    const specs = new Map<string, number>();
    
    for (const size of equipment.sizes) {
      const val = this._parseNumericValue(size.value);
      if (val !== null) {
        specs.set(size.type.toLowerCase(), val);
      }
    }
    
    return specs;
  }
  
  private _parseNumericValue(value: string): number | null {
    // Extract first number from string
    const match = value.match(/([\d,.]+)/);
    if (!match) return null;
    
    const cleaned = match[1].replace(/,/g, '');
    return parseFloat(cleaned);
  }
  
  private _calculateMatch(
    equipment: Equipment,
    candidate: ManufacturerEquipment,
    specs: Map<string, number>
  ): EquivalencyMatch {
    const differences: SpecDifference[] = [];
    let score = 0.5; // Base score
    let matchedCount = 0;
    
    // Compare each specification
    for (const spec of candidate.specifications) {
      const originalValue = specs.get(spec.name.toLowerCase());
      
      if (originalValue !== undefined) {
        matchedCount++;
        
        const diff = this._compareSpec(
          spec.name,
          originalValue,
          spec.value,
          spec.unit
        );
        differences.push(diff);
        
        // Calculate spec match score
        if (originalValue === spec.value) {
          score += 0.15;
        } else {
          const tolerance = this._getTolerance(spec.name);
          const percentDiff = Math.abs(originalValue - spec.value) / originalValue;
          
          if (percentDiff < tolerance) {
            score += 0.1;
            diff.isBetter = spec.value > originalValue;
          } else if (percentDiff < tolerance * 2) {
            score += 0.05;
            diff.isBetter = spec.value > originalValue;
          } else {
            score -= 0.1;
            diff.isBetter = false;
            diff.severity = "critical";
          }
        }
      }
    }
    
    // Penalize for missing critical specs
    const criticalMissing = candidate.specifications.filter(
      s => this._isCritical(s.name) && !specs.has(s.name.toLowerCase())
    ).length;
    score -= criticalMissing * 0.1;
    
    // Bonus for efficiency rating
    if (candidate.efficiencyRating && equipment.confidence > 0.7) {
      score += 0.05;
    }
    
    // Normalize score
    score = Math.max(0, Math.min(1, score));
    
    // Determine if equivalent
    const criticalDiffs = differences.filter(d => d.severity === "critical").length;
    const isEquivalent = criticalDiffs === 0 && matchedCount >= 2;
    
    return {
      originalEquipment: equipment,
      matchedEquipment: candidate,
      matchScore: score,
      differences,
      isEquivalent,
    };
  }
  
  private _compareSpec(
    name: string,
    original: number,
    matched: number,
    unit: string
  ): SpecDifference {
    const tolerance = this._getTolerance(name);
    const percentDiff = Math.abs(original - matched) / original;
    
    let severity: 'critical' | 'minor' | 'improvement' = 'minor';
    let isBetter = false;
    
    if (percentDiff > tolerance * 2) {
      severity = 'critical';
    } else if (percentDiff > tolerance) {
      severity = 'minor';
    }
    
    const descriptions: Record<string, string> = {
      capacity: `${original} → ${matched} ${unit}`,
      cooling: `${original} → ${matched} ${unit}`,
      heating: `${original} → ${matched} ${unit}`,
      motor: `${original} → ${matched} ${unit}`,
      voltage: `${original} → ${matched} ${unit}`,
      efficiency: `${original} → ${matched}`,
    };
    
    return {
      specName: name.charAt(0).toUpperCase() + name.slice(1),
      originalValue: `${original} ${unit}`,
      matchedValue: `${matched} ${unit}`,
      isBetter,
      severity,
      description: descriptions[name] || `${original} → ${matched}`,
    };
  }
  
  private _getTolerance(specName: string): number {
    const tolerances: Record<string, number> = {
      capacity: 0.1,      // 10% tolerance
      cooling: 0.1,
      heating: 0.1,
      motor: 0.15,
      voltage: 0.05,      // 5% tolerance for voltage
      efficiency: 0.05,
    };
    return tolerances[specName.toLowerCase()] || 0.1;
  }
  
  private _isCritical(specName: string): boolean {
    const critical = ['cooling', 'capacity', 'voltage', 'motor'];
    return critical.includes(specName.toLowerCase());
  }
  
  private _getStatusEmoji(
    severity: string,
    isBetter: boolean
  ): string {
    if (severity === 'critical') return '🔴';
    if (isBetter) return '🟢';
    return '🟡';
  }
  
  private _getStatusForUI(
    severity: string,
    isBetter: boolean
  ): 'critical' | 'warning' | 'good' {
    if (severity === 'critical') return 'critical';
    if (isBetter) return 'good';
    return 'warning';
  }
  
  private _estimatePrice(equipment: Equipment): number {
    // Rough estimate based on category and specs
    const category = this._mapCategory(equipment.category);
    const basePrices: Record<string, number> = {
      ahu: 40000,
      rtu: 30000,
      chiller: 100000,
      fan_coil: 2000,
      pump: 5000,
      boiler: 20000,
    };
    
    const base = basePrices[category] || 10000;
    const multiplier = equipment.confidence;
    
    return Math.round(base * multiplier);
  }
  
  private _generateSummary(
    equipment: Equipment,
    matches: EquivalencyMatch[]
  ): string {
    if (matches.length === 0) {
      return `No equivalent equipment found for ${equipment.tag}`;
    }
    
    const best = matches[0];
    const isMyCompany = this.myManufacturers.has(
      best.matchedEquipment.manufacturer.toLowerCase()
    );
    
    let summary = `Found ${matches.length} potential equivalent(s) for ${equipment.tag}. `;
    
    if (isMyCompany) {
      summary += `🎯 ${best.matchedEquipment.manufacturer} ${best.matchedEquipment.model} is your product! `;
    }
    
    if (best.isEquivalent) {
      summary += `Direct equivalent with ${(best.matchScore * 100).toFixed(0)}% match score.`;
    } else {
      summary += `Best match requires review of ${best.differences.filter(d => d.severity === 'critical').length} critical difference(s).`;
    }
    
    return summary;
  }
}

interface HighlightedDiff {
  original: string;
  matched: string;
  isEquivalent: boolean;
  differences: {
    spec: string;
    original: string;
    matched: string;
    status: 'critical' | 'warning' | 'good';
  }[];
  matchScore: number;
}

export { MANUFACTURER_DATABASE };
