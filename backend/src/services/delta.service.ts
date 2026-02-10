/**
 * Delta Comparison Service
 * Compares two take-offs to find added/removed/changed equipment
 */

import { Equipment } from '../types';

export interface DeltaResult {
  added: Equipment[];
  removed: Equipment[];
  changed: DeltaChange[];
  unchanged: Equipment[];
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
    totalChangePercent: number;
  };
}

export interface DeltaChange {
  tag: string;
  old: Equipment;
  new: Equipment;
  differences: string[];
}

export function compareTakeoffs(
  equipment1: Equipment[],
  equipment2: Equipment[]
): DeltaResult {
  // Create lookup maps by tag
  const map1 = new Map(equipment1.map(e => [e.tag.toUpperCase(), e]));
  const map2 = new Map(equipment2.map(e => [e.tag.toUpperCase(), e]));
  
  const allTags = new Set([
    ...equipment1.map(e => e.tag.toUpperCase()),
    ...equipment2.map(e => e.tag.toUpperCase())
  ]);
  
  const result: DeltaResult = {
    added: [],
    removed: [],
    changed: [],
    unchanged: [],
    summary: {
      addedCount: 0,
      removedCount: 0,
      changedCount: 0,
      unchangedCount: 0,
      totalChangePercent: 0,
    },
  };
  
  // Find differences
  for (const tag of allTags) {
    const eq1 = map1.get(tag);
    const eq2 = map2.get(tag);
    
    if (!eq1 && eq2) {
      // Added
      result.added.push(eq2);
      result.summary.addedCount++;
    } else if (eq1 && !eq2) {
      // Removed
      result.removed.push(eq1);
      result.summary.removedCount++;
    } else if (eq1 && eq2) {
      // Check if changed
      const differences = findDifferences(eq1, eq2);
      if (differences.length > 0) {
        result.changed.push({
          tag,
          old: eq1,
          new: eq2,
          differences,
        });
        result.summary.changedCount++;
      } else {
        result.unchanged.push(eq1);
        result.summary.unchangedCount++;
      }
    }
  }
  
  // Calculate total change percentage
  const total = equipment1.length || 1;
  const changedItems = result.added.length + result.removed.length + result.changed.length;
  result.summary.totalChangePercent = Math.round((changedItems / total) * 100);
  
  return result;
}

function findDifferences(eq1: Equipment, eq2: Equipment): string[] {
  const differences: string[] = [];
  
  // Compare sizes
  const sizes1 = new Set(eq1.sizes.map(s => `${s.type}:${s.value}`));
  const sizes2 = new Set(eq2.sizes.map(s => `${s.type}:${s.value}`));
  
  const addedSizes = [...sizes2].filter(s => !sizes1.has(s));
  const removedSizes = [...sizes1].filter(s => !sizes2.has(s));
  
  for (const size of addedSizes) {
    differences.push(`Size added: ${size}`);
  }
  for (const size of removedSizes) {
    differences.push(`Size removed: ${size}`);
  }
  
  // Compare confidence
  if (Math.abs(eq1.confidence - eq2.confidence) > 0.2) {
    differences.push(
      `Confidence changed: ${(eq1.confidence * 100).toFixed(0)}% → ${(eq2.confidence * 100).toFixed(0)}%`
    );
  }
  
  // Compare page numbers
  if (eq1.page_number !== eq2.page_number) {
    differences.push(`Page changed: ${eq1.page_number} → ${eq2.page_number}`);
  }
  
  // Compare type (if category changed)
  if (eq1.type !== eq2.type) {
    differences.push(`Type changed: ${eq1.type} → ${eq2.type}`);
  }
  
  return differences;
}

/**
 * Generate a summary report of changes
 */
export function generateDeltaReport(delta: DeltaResult): string {
  const lines: string[] = [];
  
  lines.push(`## Take-off Comparison Report\n`);
  
  lines.push(`### Summary`);
  lines.push(`- **Total Changes:** ${delta.summary.addedCount + delta.summary.removedCount + delta.summary.changedCount}`);
  lines.push(`- **Added:** +${delta.summary.addedCount}`);
  lines.push(`- **Removed:** -${delta.summary.removedCount}`);
  lines.push(`- **Modified:** ~${delta.summary.changedCount}`);
  lines.push(`- **Unchanged:** ${delta.summary.unchangedCount}`);
  lines.push(`- **Change Rate:** ${delta.summary.totalChangePercent}%\n`);
  
  if (delta.added.length > 0) {
    lines.push(`### Added Equipment (+${delta.added.length})`);
    for (const eq of delta.added.slice(0, 10)) {
      lines.push(`- **${eq.tag}** (${eq.type}) - Page ${eq.page_number}`);
    }
    if (delta.added.length > 10) {
      lines.push(`- ... and ${delta.added.length - 10} more`);
    }
    lines.push('');
  }
  
  if (delta.removed.length > 0) {
    lines.push(`### Removed Equipment (-${delta.removed.length})`);
    for (const eq of delta.removed.slice(0, 10)) {
      lines.push(`- ~~${eq.tag}~~ (${eq.type})`);
    }
    if (delta.removed.length > 10) {
      lines.push(`- ... and ${delta.removed.length - 10} more`);
    }
    lines.push('');
  }
  
  if (delta.changed.length > 0) {
    lines.push(`### Modified Equipment (~${delta.changed.length})`);
    for (const change of delta.changed.slice(0, 10)) {
      lines.push(`- **${change.tag}**`);
      for (const diff of change.differences) {
        lines.push(`  - ${diff}`);
      }
    }
    if (delta.changed.length > 10) {
      lines.push(`- ... and ${delta.changed.length - 10} more`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}
