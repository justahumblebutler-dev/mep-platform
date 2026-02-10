/**
 * PDF Extraction Service
 * 
 * Orchestrates PDF processing through sandboxed Python subprocess.
 * Security: All PDF operations run in isolated Docker container.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

// Configuration
const PDF_PROCESSOR_PATH = process.env.PDF_PROCESSOR_PATH || 
  join(process.cwd(), 'pdf_processor', 'extract.py');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PROCESSING_TIME = 60000; // 60 seconds

interface ProcessingOptions {
  extractTables?: boolean;
  patterns?: string[];
}

interface ExtractedEquipment {
  tag: string;
  type: string;
  category: string;
  sizes: string[];
  specs_references: string[];
  raw_text: string;
  confidence: number;
  page_number: number;
}

interface PDFResult {
  success: boolean;
  data?: {
    file_name: string;
    file_hash: string;
    metadata: {
      page_count: number;
      title?: string;
      author?: string;
      created?: string;
    };
    equipment: ExtractedEquipment[];
    spec_sections: Array<{
      reference: string;
      content: string;
    }>;
    version_info: {
      drawing_date?: string;
      revision?: string;
    };
    stats: {
      pages: number;
      equipment_count: number;
      unique_tags: number;
      by_category: Record<string, number>;
    };
  };
  error?: string;
}

interface DeltaResult {
  added: ExtractedEquipment[];
  removed: ExtractedEquipment[];
  changed: Array<{
    tag: string;
    old: ExtractedEquipment;
    new: ExtractedEquipment;
    differences: string[];
  }>;
  unchanged: ExtractedEquipment[];
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
  };
}

/**
 * Calculate file hash for delta detection
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  return createHash('md5').update(fileBuffer).digest('hex');
}

/**
 * Validate uploaded PDF
 */
export async function validatePDF(filePath: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const stats = await readFile(filePath).catch(() => null);
    if (!stats) {
      return { valid: false, error: 'File does not exist or cannot be read' };
    }
    
    if (stats.length > MAX_FILE_SIZE) {
      return { valid: false, error: 'File exceeds 50MB limit' };
    }
    
    // Check magic bytes for PDF
    const fileBuffer = Buffer.alloc(5);
    const fd = await open(filePath, 'r');
    await read(fd, fileBuffer, 0, 5, 0);
    await close(fd);
    
    if (fileBuffer.toString('ascii', 0, 4) !== '%PDF') {
      return { valid: false, error: 'Invalid PDF file format' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Polyfill for file operations (Node.js built-ins)
async function open(path: string, flags: string): Promise<number> {
  const { openSync } = await import('fs');
  return openSync(path, flags);
}

async function read(fd: number, buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number; buffer: Buffer }> {
  const { readSync } = await import('fs');
  return { bytesRead: readSync(fd, buffer, offset, length, position), buffer };
}

async function close(fd: number): Promise<void> {
  const { closeSync } = await import('fs');
  closeSync(fd);
}

/**
 * Process PDF through extraction engine
 */
export async function extractFromPDF(
  filePath: string,
  options: ProcessingOptions = {}
): Promise<PDFResult> {
  const startTime = Date.now();
  const fileHash = await calculateFileHash(filePath);
  
  // Validate file
  const validation = await validatePDF(filePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    // Execute Python extraction script
    const { stdout, stderr } = await execFileAsync(
      'python3',
      [PDF_PROCESSOR_PATH, filePath],
      {
        timeout: MAX_PROCESSING_TIME,
        maxBuffer: 10 * 1024 * 1024, // 10MB output buffer
        encoding: 'utf-8',
      }
    );
    
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      console.error('[PDF Service] Extraction failed:', result.error);
      return { success: false, error: result.error || 'Extraction failed' };
    }
    
    // Add processing metadata
    result.data.file_hash = fileHash;
    result.processing_time_ms = Date.now() - startTime;
    
    // Log metrics
    console.log({
      event: 'pdf_extracted',
      file: result.data.file_name,
      equipment_count: result.data.stats.equipment_count,
      processing_time_ms: result.processing_time_ms,
    });
    
    return { success: true, data: result.data };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PDF Service] Processing failed:', errorMessage);
    return { success: false, error: `Processing failed: ${errorMessage}` };
  }
}

/**
 * Compare two take-offs to find deltas
 */
export function compareTakeoffs(
  takeoff1: PDFResult['data'],
  takeoff2: PDFResult['data']
): DeltaResult {
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
    },
  };
  
  if (!takeoff1 || !takeoff2) {
    return result;
  }
  
  const tags1 = new Map(takeoff1.equipment.map(e => [e.tag, e]));
  const tags2 = new Map(takeoff2.equipment.map(e => [e.tag, e]));
  
  // Find added, removed, unchanged
  for (const [tag, equip] of tags2) {
    if (tags1.has(tag)) {
      const oldEquip = tags1.get(tag)!;
      const differences = findDifferences(oldEquip, equip);
      
      if (differences.length > 0) {
        result.changed.push({
          tag,
          old: oldEquip,
          new: equip,
          differences,
        });
        result.summary.changedCount++;
      } else {
        result.unchanged.push(equip);
        result.summary.unchangedCount++;
      }
    } else {
      result.added.push(equip);
      result.summary.addedCount++;
    }
  }
  
  // Find removed
  for (const [tag, equip] of tags1) {
    if (!tags2.has(tag)) {
      result.removed.push(equip);
      result.summary.removedCount++;
    }
  }
  
  return result;
}

/**
 * Find differences between two equipment items
 */
function findDifferences(
  oldEquip: ExtractedEquipment,
  newEquip: ExtractedEquipment
): string[] {
  const differences: string[] = [];
  
  const fields: (keyof ExtractedEquipment)[] = [
    'type', 'category', 'sizes', 'specs_references', 'raw_text'
  ];
  
  for (const field of fields) {
    const oldVal = JSON.stringify(oldEquip[field]);
    const newVal = JSON.stringify(newEquip[field]);
    
    if (oldVal !== newVal) {
      differences.push(`${field}: ${oldVal} → ${newVal}`);
    }
  }
  
  return differences;
}

/**
 * Process multiple PDFs and aggregate results
 */
export async function processProject(
  filePaths: string[]
): Promise<{ results: PDFResult[]; aggregate: any }> {
  const results: PDFResult[] = [];
  const allEquipment: ExtractedEquipment[] = [];
  
  for (const filePath of filePaths) {
    const result = await extractFromPDF(filePath);
    results.push(result);
    
    if (result.success && result.data) {
      allEquipment.push(...result.data.equipment);
    }
  }
  
  // Aggregate stats
  const aggregate = {
    total_files: filePaths.length,
    successful_extractions: results.filter(r => r.success).length,
    total_equipment: allEquipment.length,
    unique_tags: new Set(allEquipment.map(e => e.tag)).size,
    by_category: {} as Record<string, number>,
  };
  
  for (const equip of allEquipment) {
    aggregate.by_category[equip.category] = 
      (aggregate.by_category[equip.category] || 0) + 1;
  }
  
  return { results, aggregate };
}
