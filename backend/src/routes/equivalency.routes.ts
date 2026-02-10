/**
 * Equivalency Routes
 * Find equivalent/replacement equipment from different manufacturers
 */

import { FastifyPluginAsync } from 'fastify';
import { EquivalencyService, MANUFACTURER_DATABASE } from '../services/equivalency.service.js';

const equivalencyRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new EquivalencyService(["Daikin", "IEC"]);
  
  // Get all available manufacturers
  fastify.get('/manufacturers', async () => {
    const manufacturers = [...new Set(
      MANUFACTURER_DATABASE.map(eq => eq.manufacturer)
    )];
    
    const categories = [...new Set(
      MANUFACTURER_DATABASE.map(eq => eq.category)
    )];
    
    return {
      success: true,
      data: {
        manufacturers,
        categories,
        myCompany: ["Daikin", "IEC"], // Your represented manufacturers
      },
    };
  });
  
  // Search for equivalencies
  fastify.post('/search', {
    schema: {
      body: {
        type: 'object',
        required: ['equipment'],
        properties: {
          equipment: {
            type: 'object',
            properties: {
              tag: { type: 'string' },
              type: { type: 'string' },
              category: { type: 'string' },
              sizes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    value: { type: 'string' },
                  },
                },
              },
              confidence: { type: 'number' },
              page_number: { type: 'number' },
              raw_text: { type: 'string' },
            },
          },
          targetManufacturers: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  }, async (request: any) => {
    const { equipment, targetManufacturers } = request.body;
    
    const result = service.findEquivalencies(equipment, targetManufacturers);
    
    return {
      success: true,
      data: result,
    };
  });
  
  // Generate comparison report
  fastify.post('/compare', {
    schema: {
      body: {
        type: 'object',
        required: ['equipment', 'targetManufacturer'],
        properties: {
          equipment: { type: 'object' },
          targetManufacturer: { type: 'string' },
        },
      },
    },
  }, async (request: any) => {
    const { equipment, targetManufacturer } = request.body;
    
    const comparison = service.generateComparison(equipment, targetManufacturer);
    
    return {
      success: true,
      data: {
        comparison,
      },
    };
  });
  
  // Get highlighted diffs for UI
  fastify.post('/highlights', async (request: any) => {
    const { equipment, matches } = request.body;
    
    const highlighted = service.generateHighlightedDiffs(matches);
    
    return {
      success: true,
      data: highlighted,
    };
  });
  
  // Get equipment by manufacturer/category
  fastify.get('/database', async (request: any) => {
    const { manufacturer, category } = request.query;
    
    let database = MANUFACTURER_DATABASE;
    
    if (manufacturer) {
      database = database.filter(
        eq => eq.manufacturer.toLowerCase() === manufacturer.toLowerCase()
      );
    }
    
    if (category) {
      database = database.filter(
        eq => eq.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    return {
      success: true,
      data: database,
      count: database.length,
    };
  });
};

export default equivalencyRoutes;
