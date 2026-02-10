/**
 * Auth Routes
 */

import { FastifyPluginAsync } from 'fastify';
import { register, login, changePassword, logout } from '../services/auth.service.js';
import { z } from 'zod';

const authSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(12),
    name: z.string().min(2).max(100).optional(),
    firm: z.string().optional(),
  }),
};

const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
};

const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(12).regex(/[A-Z]/).regex(/[0-9]/),
  }),
};

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Mock user DB for development
  const users = new Map();
  
  fastify.post('/register', { schema: authSchema }, async (request, reply) => {
    const { email, password, name, firm } = request.body as any;
    
    // Check if user exists (mock)
    if (users.has(email)) {
      return reply.status(400).send({ success: false, error: 'User already exists' });
    }
    
    // Create user
    const user = await register(
      email,
      password,
      name || email.split('@')[0],
      firm,
      async (data: any) => {
        users.set(data.email, data);
        return data;
      }
    );
    
    if (!user.success) {
      return reply.status(400).send({ success: false, error: user.error });
    }
    
    return {
      success: true,
      user: user.user,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    };
  });
  
  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = request.body as any;
    
    const result = await login(email, password, async (email: string) => {
      return users.get(email) || null;
    });
    
    if (!result.success) {
      return reply.status(401).send({ success: false, error: result.error });
    }
    
    return {
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  });
  
  fastify.post('/change-password', {
    preHandler: [fastify.authenticate],
    schema: changePasswordSchema,
  }, async (request: any, reply) => {
    const { currentPassword, newPassword } = request.body as any;
    const userId = request.user.userId;
    
    const result = await changePassword(
      userId,
      currentPassword,
      newPassword,
      async (id: string) => {
        for (const user of users.values()) {
          if (user.id === id) return user;
        }
        return null;
      },
      async (id: string, hash: string) => {
        for (const user of users.values()) {
          if (user.id === id) {
            user.passwordHash = hash;
            break;
          }
        }
      }
    );
    
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error });
    }
    
    return { success: true, message: 'Password changed' };
  });
  
  fastify.post('/logout', async (request, reply) => {
    return { success: true, message: 'Logged out' };
  });
  
  // Get current user
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request: any) => {
    return { user: request.user };
  });
};

export default authRoutes;
