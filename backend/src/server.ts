/**
 * Main Application Entry Point
 * MEP PDF Take-Off Analyzer Backend
 */

import Fastify from 'fastify';
import { setupSecurityHeaders, setupRateLimiting, setupCORS, setupAuth, requestLogger, setupErrorHandling } from './middleware/security.middleware.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import takeoffRoutes from './routes/takeoff.routes.js';
import projectRoutes from './routes/project.routes.js';
import equivalencyRoutes from './routes/equivalency.routes.js';

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create Fastify instance
const app = Fastify({
  logger: false, // We use our own logger
  trustProxy: true,
  requestIdHeader: 'x-request-id',
  genReqId: () => crypto.randomUUID?.() || Date.now().toString(),
});

// Setup security and middleware
async function setupApp(): Promise<void> {
  // Security headers
  await setupSecurityHeaders(app);
  
  // CORS
  await setupCORS(app);
  
  // Rate limiting
  await setupRateLimiting(app);
  
  // Authentication
  await setupAuth(app);
  
  // Request logging
  await requestLogger(app);
  
  // Error handling
  await setupErrorHandling(app);
  
  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(takeoffRoutes, { prefix: '/api/takeoff' });
  await app.register(projectRoutes, { prefix: '/api/projects' });
  await app.register(equivalencyRoutes, { prefix: '/api/equivalency' });
  
  // Health check
  app.get('/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });
  
  // Readiness check
  app.get('/ready', async () => {
    return { status: 'ready', timestamp: new Date().toISOString() };
  });
}

// Start server
async function start(): Promise<void> {
  try {
    await setupApp();
    
    await app.listen({ port: PORT, host: HOST });
    
    logger.info({
      event: 'server_started',
      host: HOST,
      port: PORT,
      env: process.env.NODE_ENV || 'development',
    });
    
    console.log(`🚀 MEP Platform API running on http://${HOST}:${PORT}`);
    console.log(`   Health check: http://${HOST}:${PORT}/health`);
    
  } catch (err) {
    logger.error({ event: 'server_start_failed', error: err });
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = (signal: string): void => {
  logger.info({ event: 'shutdown', signal });
  app.close().then(() => {
    logger.info({ event: 'shutdown_complete' });
    process.exit(0);
  }).catch((err) => {
    logger.error({ event: 'shutdown_error', error: err });
    process.exit(1);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ event: 'uncaught_exception', error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ event: 'unhandled_rejection', reason });
  process.exit(1);
});

// Export for testing
export { app, setupApp };

// Start if running directly
start();
