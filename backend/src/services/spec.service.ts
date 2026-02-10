/**
 * Spec Correlation Service
 * Links extracted equipment to specification sections
 */

import { Equipment } from '../types';

export interface SpecReference {
  sectionNumber: string;
  sectionTitle?: string;
  equipment: Equipment[];
  pageNumber?: number;
}

export interface SpecGap {
  equipmentTag: string;
  equipmentType: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  suggestion?: string;
}

export function correlateEquipmentToSpecs(
  equipment: Equipment[],
  specSections: { reference: string; content: string }[]
): SpecReference[] {
  // Build spec reference map
  const specMap = new Map<string, SpecReference>();
  
  for (const spec of specSections) {
    const sectionNum = extractSectionNumber(spec.reference);
    if (sectionNum) {
      specMap.set(sectionNum, {
        sectionNumber: sectionNum,
        sectionTitle: extractSectionTitle(spec.content),
        equipment: [],
        pageNumber: undefined,
      });
    }
  }
  
  // Correlate equipment to specs based on type keywords
  for (const eq of equipment) {
    const matchingSpecs = findMatchingSpecs(eq, specSections);
    
    for (const spec of matchingSpecs) {
      const sectionNum = extractSectionNumber(spec.reference);
      if (sectionNum && specMap.has(sectionNum)) {
        specMap.get(sectionNum)!.equipment.push(eq);
      }
    }
  }
  
  return Array.from(specMap.values())
    .filter(spec => spec.equipment.length > 0)
    .sort((a, b) => a.sectionNumber.localeCompare(b.sectionNumber));
}

function extractSectionNumber(ref: string): string | null {
  // Match patterns like "23 64 00" or "23-64-00"
  const match = ref.match(/(\d{2}[\s-]*\d{2}[\s-]*\d{4})/);
  return match ? match[1].replace(/[\s-]+/g, ' ') : null;
}

function extractSectionTitle(content: string): string {
  // First line is often the title
  const lines = content.split('\n').filter(l => l.trim());
  return lines[0]?.substring(0, 100) || '';
}

function findMatchingSpecs(
  eq: Equipment,
  specs: { reference: string; content: string }[]
): { reference: string; content: string }[] {
  const matches: { reference: string; content: string }[] = [];
  
  // Keywords that link equipment types to spec sections
  const typeKeywords: Record<string, string[]> = {
    'ahu': ['air handling unit', 'ahu', 'make-up air', 'doas', 'outdoor air'],
    'rtu': ['rooftop unit', 'rtu', 'roof top', 'packaged unit'],
    'chiller': ['chiller', 'chilled water', 'chiller plant'],
    'cooling_tower': ['cooling tower', 'ct', 'tower'],
    'boiler': ['boiler', 'heating plant', 'hot water'],
    'pump': ['pump', 'pumps', 'pumping'],
    'fan': ['fan', 'fans', 'exhaust', 'supply', 'return'],
    'vav': ['vav', 'terminal unit', 'variable air'],
    'heat_exchanger': ['heat exchanger', 'hx', 'plate heat'],
    'tank': ['tank', 'storage'],
    'valve': ['valve', 'valves', 'control valve'],
    'plumbing_fixtures': ['water closet', 'lavatory', 'fixture', 'toilet'],
    'water_heater': ['water heater', 'wh', 'domestic water'],
    'motor': ['motor', 'motors', 'drives'],
    'controller': ['controller', 'ddc', 'bacnet', 'building automation'],
    'sensor': ['sensor', 'transducer', 'measurement'],
  };
  
  const keywords = typeKeywords[eq.category] || [];
  
  for (const spec of specs) {
    const specText = `${spec.reference} ${spec.content}`.toLowerCase();
    
    for (const keyword of keywords) {
      if (specText.includes(keyword)) {
        matches.push(spec);
        break;
      }
    }
  }
  
  return matches;
}

/**
 * Find specification gaps
 */
export function findSpecGaps(
  equipment: Equipment[],
  specSections: { reference: string; content: string }[]
): SpecGap[] {
  const gaps: SpecGap[] = [];
  
  // Check for equipment without spec references
  const equipmentWithSpecs = new Set(
    equipment
      .filter(eq => eq.specs_references.length > 0)
      .map(eq => eq.tag)
  );
  
  for (const eq of equipment) {
    if (!equipmentWithSpecs.has(eq.tag)) {
      // Check if spec section exists for this equipment type
      const matchingSpecs = findMatchingSpecs(eq, specSections);
      
      if (matchingSpecs.length === 0) {
        gaps.push({
          equipmentTag: eq.tag,
          equipmentType: eq.type,
          issue: 'No matching spec section found',
          severity: eq.confidence < 0.5 ? 'medium' : 'low',
          suggestion: `Create spec section for ${eq.type}`,
        });
      }
    }
  }
  
  // Check for missing sizing information
  for (const eq of equipment) {
    if (eq.sizes.length === 0 && eq.confidence < 0.7) {
      gaps.push({
        equipmentTag: eq.tag,
        equipmentType: eq.type,
        issue: 'No sizing information extracted',
        severity: 'high',
        suggestion: 'Verify size in drawings or specs',
      });
    }
    
    // Check for low confidence extraction
    if (eq.confidence < 0.5) {
      gaps.push({
        equipmentTag: eq.tag,
        equipmentType: eq.type,
        issue: `Low confidence extraction (${(eq.confidence * 100).toFixed(0)}%)`,
        severity: 'high',
        suggestion: 'Manual review recommended',
      });
    }
  }
  
  return gaps.sort((a, b) => {
    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Generate compliance checklist
 */
export function generateComplianceChecklist(
  equipment: Equipment[],
  specSections: { reference: string; content: string }[]
): string {
  const lines: string[] = [];
  
  lines.push(`# Compliance Checklist\n`);
  lines.push(`**Generated:** ${new Date().toISOString()}\n`);
  lines.push(`**Equipment Count:** ${equipment.length}\n`);
  
  // By category
  const byCategory = new Map<string, Equipment[]>();
  for (const eq of equipment) {
    const list = byCategory.get(eq.category) || [];
    list.push(eq);
    byCategory.set(eq.category, list);
  }
  
  lines.push(`## Equipment by Category\n`);
  for (const [category, items] of byCategory) {
    lines.push(`### ${category.toUpperCase().replace('_', ' ')} (${items.length})`);
    for (const eq of items) {
      const confidenceColor = eq.confidence >= 0.8 ? '✅' : eq.confidence >= 0.5 ? '⚠️' : '❌';
      lines.push(`- ${confidenceColor} **${eq.tag}** - ${eq.type}`);
      if (eq.sizes.length > 0) {
        lines.push(`  - Sizes: ${eq.sizes.map(s => s.value).join(', ')}`);
      }
      if (eq.specs_references.length > 0) {
        lines.push(`  - Specs: ${eq.specs_references.join(', ')}`);
      }
    }
    lines.push('');
  }
  
  // Find gaps
  const gaps = findSpecGaps(equipment, specSections);
  
  if (gaps.length > 0) {
    lines.push(`## Issues Found (${gaps.length})\n`);
    
    const bySeverity = { high: gaps.filter(g => g.severity === 'high'),
                        medium: gaps.filter(g => g.severity === 'medium'),
                        low: gaps.filter(g => g.severity === 'low') };
    
    for (const severity of ['high', 'medium', 'low'] as const) {
      const items = bySeverity[severity];
      if (items.length > 0) {
        lines.push(`### ${severity.toUpperCase()} Priority (${items.length})`);
        for (const gap of items) {
          lines.push(`- **${gap.equipmentTag}** - ${gap.issue}`);
          if (gap.suggestion) {
            lines.push(`  - Suggestion: ${gap.suggestion}`);
          }
        }
        lines.push('');
      }
    }
  }
  
  return lines.join('\n');
}
