/**
 * Security Middleware
 * Comprehensive security headers and input validation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

// Request types for type safety
interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Security headers configuration
 */
export async function setupSecurityHeaders(app: any): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

/**
 * Rate limiting configuration
 */
export async function setupRateLimiting(app: any): Promise<void> {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (request: FastifyRequest, context: any) => {
      return {
        success: false,
        error: 'Too many requests',
        retryAfter: context.after,
      };
    },
    keyGenerator: (request: FastifyRequest) => {
      return request.headers['x-forwarded-for'] as string || 
             request.headers['x-real-ip'] as string || 
             request.ip || 
             'unknown';
    },
  });
}

/**
 * CORS configuration
 */
export async function setupCORS(app: any): Promise<void> {
  await app.register(fastifyCors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
    ],
  });
}

/**
 * JWT authentication decorator
 */
export async function setupAuth(app: any): Promise<void> {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    sign: {
      expiresIn: '15m',
      algorithm: 'HS256',
    },
  });
  
  app.decorate('authenticate', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const token = await request.jwtVerify();
      request.user = token as AuthenticatedRequest['user'];
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_TOKEN',
      });
    }
  });
}

/**
 * Input validation middleware
 */
export function validateInput(schema: any) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (request.body && typeof request.body === 'object') {
        schema.body?.parse(request.body);
      }
      if (request.params && typeof request.params === 'object') {
        schema.params?.parse(request.params);
      }
      if (request.query && typeof request.query === 'object') {
        schema.query?.parse(request.query);
      }
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw err;
    }
  };
}

/**
 * Request logging middleware
 */
export async function requestLogger(app: any): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const requestId = request.headers['x-request-id'] || 
                      crypto.randomUUID?.() || 
                      Date.now().toString();
    
    request.headers['x-request-id'] = requestId;
    
    logger.info({
      event: 'request',
      method: request.method,
      url: request.url,
      requestId,
      ip: request.ip,
    });
  });
}

/**
 * Error handling middleware
 */
export async function setupErrorHandling(app: any): Promise<void> {
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    logger.error({
      event: 'error',
      error: error.message,
      url: request.url,
    });
    
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    
    return reply.status(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });
  
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      success: false,
      error: 'Resource not found',
      code: 'NOT_FOUND',
    });
  });
}
