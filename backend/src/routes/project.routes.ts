/**
 * Project Routes
 */

import { FastifyPluginAsync } from 'fastify';

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // Mock projects store
  const projects = new Map();
  
  // List projects
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request: any) => {
    return {
      success: true,
      data: {
        projects: Array.from(projects.values()).filter(
          (p: any) => p.userId === request.user.userId
        ),
      },
    };
  });
  
  // Create project
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { name, description } = request.body as any;
    const projectId = crypto.randomUUID();
    
    const project = {
      id: projectId,
      userId: request.user.userId,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    projects.set(projectId, project);
    
    return {
      success: true,
      data: project,
    };
  });
  
  // Get project
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { id } = request.params;
    const project = projects.get(id);
    
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    
    if (project.userId !== request.user.userId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    
    return { success: true, data: project };
  });
  
  // Update project
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { id } = request.params;
    const project = projects.get(id);
    
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    
    if (project.userId !== request.user.userId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    
    const { name, description } = request.body as any;
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    project.updatedAt = new Date().toISOString();
    
    return { success: true, data: project };
  });
  
  // Delete project
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { id } = request.params;
    const project = projects.get(id);
    
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    
    if (project.userId !== request.user.userId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    
    projects.delete(id);
    
    return { success: true, message: 'Project deleted' };
  });
};

export default projectRoutes;
