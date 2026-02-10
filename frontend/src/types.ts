// Frontend Types
export interface User {
  id: string;
  email: string;
  name: string;
  firm?: string;
  role: 'admin' | 'user';
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  tag: string;
  type: string;
  category: string;
  sizes: string[];
  specs_references: string[];
  raw_text: string;
  confidence: number;
  page_number: number;
}

export interface Takeoff {
  id: string;
  projectId: string;
  version: number;
  fileName: string;
  fileHash: string;
  equipment: Equipment[];
  stats: {
    pages: number;
    equipment_count: number;
    unique_tags: number;
    by_category: Record<string, number>;
  };
  metadata: {
    page_count: number;
    title?: string;
    author?: string;
    created?: string;
  };
  version_info?: {
    drawing_date?: string;
    revision?: string;
  };
  createdAt: string;
}

export interface DeltaResult {
  added: Equipment[];
  removed: Equipment[];
  changed: Array<{
    tag: string;
    old: Equipment;
    new: Equipment;
    differences: string[];
  }>;
  unchanged: Equipment[];
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
