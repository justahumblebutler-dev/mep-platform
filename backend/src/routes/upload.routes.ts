/**
 * Upload Routes (simplified multipart handling)
 */

import { FastifyPluginAsync } from 'fastify';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/mep-uploads';

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });
  
  // Upload file
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    try {
      const body = request.body as any;
      const file = body.file;
      
      if (!file || !file.data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }
      
      const fileBuffer = Buffer.from(file.data);
      
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
      const ext = file.filename?.split('.').pop() || 'pdf';
      const filename = `${fileId}.${ext}`;
      const filePath = join(UPLOAD_DIR, filename);
      
      await writeFile(filePath, fileBuffer);
      
      const fileHash = createHash('md5').update(fileBuffer).digest('hex');
      
      fastify.log.info({ event: 'file_uploaded', fileId, filename, size: fileBuffer.length });
      
      return {
        success: true,
        data: {
          fileId,
          filename: file.filename,
          size: fileBuffer.length,
          fileHash,
        },
      };
    } catch (error) {
      fastify.log.error({ event: 'upload_error', error });
      return reply.status(500).send({ success: false, error: 'Upload failed' });
    }
  });
  
  // Get uploaded file
  fastify.get('/:fileId', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { fileId } = request.params;
    const filePath = join(UPLOAD_DIR, `${fileId}.pdf`);
    
    try {
      const fileBuffer = await readFile(filePath);
      reply.header('Content-Type', 'application/pdf');
      return reply.send(fileBuffer);
    } catch {
      return reply.status(404).send({ success: false, error: 'File not found' });
    }
  });
};

export default uploadRoutes;
