/**
 * Take-Off Routes
 */

import { FastifyPluginAsync } from 'fastify';
import { extractFromPDF, compareTakeoffs } from '../services/pdf.service.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/mep-uploads';

const takeoffRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });
  
  // Upload PDF
  fastify.post('/upload', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }
      
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      
      // Validate file size
      if (fileBuffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({ success: false, error: 'File exceeds 50MB' });
      }
      
      // Validate PDF magic bytes
      if (fileBuffer.length >= 5 && fileBuffer.toString('ascii', 0, 4) !== '%PDF') {
        return reply.status(400).send({ success: false, error: 'Invalid PDF format' });
      }
      
      // Generate unique filename
      const fileId = uuidv4();
      const ext = data.filename?.split('.').pop() || 'pdf';
      const filename = `${fileId}.${ext}`;
      const filePath = join(UPLOAD_DIR, filename);
      
      await writeFile(filePath, fileBuffer);
      
      const fileHash = createHash('md5').update(fileBuffer).digest('hex');
      
      fastify.log.info({ event: 'file_uploaded', fileId, filename, size: fileBuffer.length });
      
      return {
        success: true,
        data: {
          fileId,
          filename: data.filename,
          size: fileBuffer.length,
          fileHash,
        },
      };
    } catch (error) {
      fastify.log.error({ event: 'upload_error', error });
      return reply.status(500).send({ success: false, error: 'Upload failed' });
    }
  });
  
  // Extract equipment from uploaded file
  fastify.post('/extract', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { fileId, projectId } = request.body as any;
    const filePath = join(UPLOAD_DIR, `${fileId}.pdf`);
    
    const result = await extractFromPDF(filePath);
    
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error });
    }
    
    return {
      success: true,
      data: {
        projectId,
        fileId,
        equipment: result.data.equipment,
        stats: result.data.stats,
        specSections: result.data.spec_sections,
        versionInfo: result.data.version_info,
        fileHash: result.data.file_hash,
      },
    };
  });
  
  // Compare two take-offs
  fastify.post('/compare', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { takeoffId1, takeoffId2 } = request.body as any;
    
    return {
      success: true,
      data: {
        message: 'Comparison ready - connect to database',
        takeoffId1,
        takeoffId2,
      },
    };
  });
  
  // Get take-off details
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { id } = request.params;
    
    return {
      success: true,
      data: {
        id,
        message: 'Take-off details - connect to database',
      },
    };
  });
  
  // Export take-off
  fastify.get('/:id/export', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { format = 'csv' } = request.query;
    
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="takeoff-${id}.csv"`);
    
    return 'tag,type,category,confidence,page_number\n';
  });
};

export default takeoffRoutes;
