/**
 * Security Middleware
 * Comprehensive security headers and input validation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { rateLimit } from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
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
      reportOnly: false,
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: 'nosniff',
    xFrameOptions: { allowFrom: undefined }, // 'DENY' or { allowFrom: 'https://example.com' }
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
      },
    },
  });
}

/**
 * Rate limiting configuration
 */
export async function setupRateLimiting(app: any): Promise<void> {
  await app.register(rateLimit, {
    global: true,
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
      // Use X-Forwarded-For in production behind proxy
      return request.headers['x-forwarded-for'] as string || 
             request.headers['x-real-ip'] as string || 
             request.socket.remoteAddress || 
             'unknown';
    },
    // Different limits for different endpoints
    namespace: 'mep-platform',
    continueExceeding: true,
    enableDraftSpec: true, // Use draft-7 headers
  });
  
  // Stricter limits for auth endpoints
  app.register(rateLimit, {
    max: 5,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => {
      return request.body && typeof request.body === 'object' 
        ? (request.body as any).email || request.ip
        : request.ip;
    },
  });
}

/**
 * CORS configuration
 */
export async function setupCORS(app: any): Promise<void> {
  await app.register(require('@fastify/cors'), {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173', // Vite dev
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
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  });
}

/**
 * JWT authentication decorator
 */
export async function setupAuth(app: any): Promise<void> {
  await app.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    sign: {
      expiresIn: '15m',
      algorithm: 'HS256',
    },
    verify: {
      algorithms: ['HS256'],
    },
  });
  
  // Decorate request with user
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
  
  // Optional auth (doesn't fail if no token)
  app.decorate('optionalAuth', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const token = await request.jwtVerify();
      request.user = token as AuthenticatedRequest['user'];
    } catch {
      // No token, continue as unauthenticated
    }
  });
}

/**
 * Input validation middleware
 */
export function validateInput(schema: any) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate body
      if (request.body && typeof request.body === 'object') {
        schema.body?.parse(request.body);
      }
      // Validate params
      if (request.params && typeof request.params === 'object') {
        schema.params?.parse(request.params);
      }
      // Validate query
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
      userAgent: request.headers['user-agent'],
    });
  });
  
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info({
      event: 'response',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
      requestId: request.headers['x-request-id'],
    });
  });
}

/**
 * Error handling middleware
 */
export async function setupErrorHandling(app: any): Promise<void> {
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    // Log error
    logger.error({
      event: 'error',
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      requestId: request.headers['x-request-id'],
    });
    
    // Don't expose internal errors
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    
    // Generic error for 5xx
    return reply.status(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });
  
  // Not found handler
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      success: false,
      error: 'Resource not found',
      code: 'NOT_FOUND',
    });
  });
}

/**
 * File upload security
 */
export function setupFileUploadSecurity(app: any): void {
  // Enforce file type validation is done at the route level
  // This is a reminder to check:
  // - Content-Type header matches actual file type
  // - Magic bytes validation
  // - File size limits
  // - Virus scanning in production
}
