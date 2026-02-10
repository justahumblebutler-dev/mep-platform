# Technical Architecture

**Status:** In Progress  
**Last Updated:** 2026-02-09

---

## Technology Stack

### Backend

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| **Runtime** | Node.js 22 LTS | Matches OpenClaw environment, excellent PDF libraries |
| **Framework** | Fastify | Fast, low overhead, great TypeScript support |
| **Database** | PostgreSQL 16 | Robust, row-level security for multi-tenancy |
| **ORM** | Drizzle | Lightweight, type-safe, fast migrations |
| **PDF Processing** | PyMuPDF + pdfplumber | Best Python libraries for extraction |
| **Auth** | JWT + refresh tokens | Stateless, industry standard |
| **Container** | Docker | Sandboxed PDF processing |

### Frontend

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| **Framework** | React 19 + Vite | Modern, fast dev, great ecosystem |
| **UI** | Tailwind CSS + shadcn/ui | Clean, accessible, rapid development |
| **State** | TanStack Query | Server state management |
| **Forms** | React Hook Form + Zod | Validation, type safety |
| **Charts** | Recharts | For delta visualization |

### Infrastructure

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| **Hosting** | Railway / Render (MVP) | Simple deploy, reasonable pricing |
| **File Storage** | S3 (encrypted) | Scalable, built-in encryption |
| **CI/CD** | GitHub Actions | Free tier, integrated |
| **Monitoring** | UptimeRobot (MVP) | Free tier, simple alerts |

---

## Project Structure

```
mep-platform/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── pdf.service.ts          # PDF processing orchestration
│   │   │   ├── extraction.service.ts   # Pattern matching
│   │   │   ├── delta.service.ts        # Comparison engine
│   │   │   └── storage.service.ts       # S3 operations
│   │   ├── models/
│   │   │   ├── users.ts
│   │   │   ├── projects.ts
│   │   │   ├── takeoffs.ts
│   │   │   └── equipment.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rate-limit.middleware.ts
│   │   │   ├── security.headers.ts
│   │   │   └── validation.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── upload.routes.ts
│   │   │   ├── takeoff.routes.ts
│   │   │   └── project.routes.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── errors.ts
│   │   │   └── constants.ts
│   │   ├── app.ts                       # Fastify entry
│   │   └── server.ts
│   ├── migrations/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Data Models

### Users
```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  firm?: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}
```

### Projects
```typescript
interface Project {
  id: string;
  userId: string;           // Owner
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### TakeOffs
```typescript
interface TakeOff {
  id: string;
  projectId: string;
  version: number;
  fileHash: string;         // For delta detection
  extractedData: Equipment[];
  metadata: {
    fileName: string;
    pageCount: number;
    processedAt: Date;
    confidence: number;
  };
  createdBy: string;
}
```

### Equipment
```typescript
interface Equipment {
  tag: string;              // "AHU-1", "RTU-2A", "P-101"
  type: string;             // "Air Handling Unit", "Roof Top Unit", "Pump"
  location?: string;        // "Roof", "Basement", "Zone A"
  size?: string;            // "5000 CFM", "10 HP", "400 gal"
  manufacturer?: string;
  model?: string;
  voltage?: string;
  reference?: string;       // "See spec 23 64 00"
  rawText: string;          // Original extracted text for debugging
  confidence: number;       // 0-1 extraction confidence
  pageNumber: number;
}
```

---

## API Design

### Authentication

```
POST /auth/register
  Input: { email, password, name, firm? }
  Output: { user, accessToken, refreshToken }

POST /auth/login
  Input: { email, password }
  Output: { accessToken, refreshToken }

POST /auth/refresh
  Input: { refreshToken }
  Output: { accessToken }

POST /auth/logout
  Input: { refreshToken }
  Output: { success: true }
```

### Projects

```
GET /projects
  Output: { projects: Project[] }

POST /projects
  Input: { name, description? }
  Output: { project: Project }

GET /projects/:id
  Output: { project: Project }

DELETE /projects/:id
  Output: { success: true }
```

### Uploads & Take-Offs

```
POST /upload
  Input: multipart/form-data (files)
  Output: { uploadId, files: [{ name, size, pages }] }

POST /takeoff/extract
  Input: { uploadId, patterns?: string[] }
  Output: { takeoff: TakeOff, equipment: Equipment[] }

POST /takeoff/compare
  Input: { takeoffId1, takeoffId2 }
  Output: { delta: DeltaResult }

GET /takeoff/:id/export
  Output: CSV/Excel file download
```

---

## Security Implementation

### Authentication Flow

```
1. User logs in → receives JWT (15 min) + refresh token (7 days)
2. JWT includes: userId, email, role
3. Refresh token stored in httpOnly cookie
4. All API requests require Bearer JWT
5. Expired JWT → 401 → refresh token flow
```

### Rate Limiting

```typescript
// Per-user limits
const limits = {
  upload: { points: 10, duration: '1 minute' },
  takeoff: { points: 30, duration: '1 minute' },
  export: { points: 10, duration: '1 minute' },
  auth: { points: 5, duration: '1 minute' }, // Login attempts
};
```

### Input Validation (Zod Schemas)

```typescript
const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(12).regex(/[A-Z]/).regex(/[0-9]/),
  name: z.string().min(2).max(100),
  firm: z.string().optional(),
});

const uploadSchema = z.object({
  projectId: z.string().uuid(),
  files: z.array(z.object({
    name: z.string().max(255).regex(/\.(pdf|docx?)$/i),
    size: z.number().max(50 * 1024 * 1024), // 50MB max
  })),
});
```

### Security Headers (Helmet)

```typescript
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ['self'],
    },
  },
  crossOriginEmbedderPolicy: false,
});
```

---

## PDF Processing Pipeline

### Stage 1: Receipt & Validation
```
Upload → Malware Scan → File Type Check → Size Check → Queue
```

### Stage 2: Extraction (Sandboxed)
```
PDF → PyMuPDF (text) → pdfplumber (tables) → Combine Results
```

### Stage 3: Pattern Matching
```
Raw Text → Regex Patterns → Equipment Candidates → Confidence Scoring
```

### Stage 4: Structured Output
```
Candidates → Deduplication → Type Classification → JSON Output
```

### Sandboxing Strategy

```dockerfile
# PDF Processor Container
FROM python:3.11-slim

# No network access
RUN echo 'NetworkDisabled=true' > /etc/NetworkDisabled

# Memory limit
USER nobody
MEMORY_LIMIT=512m
```

---

## Delta Comparison Engine

### Comparison Logic

```typescript
interface DeltaResult {
  added: Equipment[];      // In B, not A
  removed: Equipment[];    // In A, not B
  changed: {               // Same tag, different specs
    tag: string;
    old: Equipment;
    new: Equipment;
    differences: string[];
  }[];
  unchanged: Equipment[];
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
  };
}
```

### Confidence Scoring

| Scenario | Confidence |
|----------|------------|
| Exact tag match + size match | 1.0 |
| Exact tag + size differs | 0.9 |
| Fuzzy tag match (AHU-1 vs AHU-01) | 0.7 |
| Type match, no tag | 0.3 |
| Uncertain extraction | <0.3 (flag for review) |

---

## Next Steps

1. [ ] Initialize backend with Fastify + TypeScript
2. [ ] Set up PostgreSQL schema with Drizzle
3. [ ] Build auth service with JWT
4. [ ] Implement PDF extraction service (Python subprocess)
5. [ ] Create pattern matching rules for MEP equipment
6. [ ] Build delta comparison engine
7. [ ] Set up frontend scaffolding
8. [ ] Integrate WAF + rate limiting
9. [ ] Security audit before beta

---

## Open Questions

- [ ] S3 or local storage for MVP? (S3 preferred for production)
- [ ] Email verification on signup? (Add for V1)
- [ ] Password reset flow? (Add for V1)
- [ ] Multi-language support? (No, English only V1)
