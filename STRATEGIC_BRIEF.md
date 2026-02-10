# MEP Platform: PDF Take-Off Analyzer MVP

**Status:** Strategic Planning Phase  
**Owner:** Colton  
**Last Updated:** 2026-02-09

---

## Executive Summary

**The Problem:** MEP engineers spend hours manually extracting equipment data from PDFs (plans + specs) to create take-offs. Current tools (Bluebeam, PlanSwift) are generic — they don't understand MEP patterns, correlate plans with specs, or flag code compliance issues.

**The Solution:** A specialized PDF take-off analyzer that:
1. Parses equipment tags from plans (AHU-, RTU-, CHW-, P-1, etc.)
2. Correlates with spec sections for sizing/compliance
3. Generates structured take-offs with delta tracking
4. Flags code compliance gaps (CEC, ASHRAE, etc.)

**The Market:** MEP is underserved by construction software. Most tools target general contractors. MEP-specific workflows are manual, repetitive, and ripe for automation.

---

## Market Validation Framework

### Buyer Personas (by willingness to pay)

| Persona | Pain Level | Budget Authority | Entry Point |
|---------|------------|-------------------|-------------|
| **MEP Project Engineers** | High (do the work) | Low (need approval) | Power user, champion internally |
| **MEP Firm Principals/Owners** | Medium (hear complaints) | High ($2-10k/yr) | ROI from billable hour savings |
| **Manufacturer Reps** | High (quote from specs) | Medium ($500-2k/yr) | Speed advantage for quotes |
| **General Contractors** | Low (subcontractor responsibility) | Low | Not initial target |
| **Facility Owners** | N/A | N/A | Future upsell |

### Validation Questions (for network interviews)

**Problem Validation:**
1. "On a typical project, how many hours does your team spend on take-offs from PDFs?"
2. "What's the most frustrating part of the take-off process?"
3. "What tools do you use today? What do you hate about them?"

**Willingness to Pay:**
4. "If a tool could cut your take-off time in half, what would it be worth to your firm per month?"
5. "Would you pay per project, per month, or per take-off?"

**Feature Prioritization:**
6. "Which matters more: (a) faster extraction, (b) spec correlation, (c) code compliance checking?"
7. "Do you need real-time collaboration on take-offs?"

**Competitive Intelligence:**
8. "What would make you switch from Bluebeam/PlanSwift?"

### Initial Outreach Targets (Priority Order)

1. **2-3 MEP Firm Principals** — Budget authority, pain awareness
2. **1 Manufacturer Rep** — High pain on quoting, faster iteration feedback
3. **1 Junior Engineer** — Will actually use it daily, usability insights
4. **ASHRAE/ASPE contact** — Validation of compliance angle

---

## MVP Scope Definition

### V1: Minimum Viable Wedge (8-12 weeks)

**In Scope:**
- [ ] PDF upload (single or multiple files)
- [ ] Text extraction (plans + specs)
- [ ] Pattern matching for equipment tags (AHU, RTU, CHW, P-, etc.)
- [ ] Structured output: JSON with equipment list, tags, implied sizing
- [ ] Basic delta: compare two uploads, show added/removed/changed
- [ ] Export to CSV/Excel
- [ ] Simple auth (email + password)
- [ ] Single tenant (isolated data per user)

**Out of Scope (V2):**
- [ ] Real-time collaboration
- [ ] Code compliance checking engine
- [ ] Quote generation
- [ ] Vendor/contractor portal
- [ ] Mobile app
- [ ] API access

### Technical Risks (Flagged Early)

| Risk | Mitigation |
|------|------------|
| PDF parsing edge cases (scans, bad encoding) | Use multiple parsers (PyMuPDF + pdfplumber), fallback to OCR |
| Layout variability (different firms, formats) | Training data, configurable patterns |
| Performance on large PDFs | Async processing, progress feedback |
| Data extraction accuracy | Confidence scores, user correction UI |

---

## Security Architecture

### Core Principles

1. **Zero-Trust File Input** — PDFs are hostile. Never trust content.
2. **Isolation by Design** — PDF processing in separate sandboxed service
3. **Encryption Everywhere** — At rest (AES-256) + transit (TLS 1.3)
4. **Minimal Permissions** — Principle of least privilege
5. **Audit Logging** — Every action logged, immutable
6. **Client Confidentiality** — Zero data reuse for training

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Auth UI     │  │ Upload UI   │  │ Results/Dashboard      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (TLS 1.3)
┌────────────────────────────┴────────────────────────────────────┐
│                         API GATEWAY                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Auth (JWT)  │  │ Rate Limit  │  │ WAF / Input Sanitize   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Auth Service│    │ PDF Processor   │    │ Data Service    │
│ (PostgreSQL)│    │ (Sandboxed)     │    │ (PostgreSQL)    │
│             │    │ - PyMuPDF       │    │                 │
│ - Users     │    │ - pdfplumber    │    │ - Projects     │
│ - Sessions  │    │ - Text extraction│    │ - Take-offs    │
│ - API Keys  │    │ - Pattern match │    │ - Deltas       │
└─────────────┘    └─────────────────┘    └─────────────────┘
                             │
                    ┌────────┴────────┐
                    │ File Storage     │
                    │ (Encrypted S3)   │
                    │ - Raw PDFs       │
                    │ - Extracted data │
                    └──────────────────┘
```

### Security Controls by Layer

**Frontend:**
- CSP (Content Security Policy) headers
- No XSS vectors (React escapes by default)
- Secure session storage

**API Gateway:**
- Rate limiting (100 req/min per user)
- Input validation (Zod schemas)
- WAF for common attacks
- JWT with short expiry (15 min) + refresh token

**PDF Processor (Critical):**
- Runs in Docker container with no network access
- Timeout (60s max per file)
- File size limit (50MB)
- Malware scanning before processing
- Memory limits (512MB cap)
- No filesystem persistence beyond processing

**Data Layer:**
- PostgreSQL with encrypted columns for sensitive fields
- Row-level security (RLS) for multi-tenant isolation
- No plaintext storage of uploaded files
- Automatic backups (encrypted)

**Compliance Baseline:**
- SOC2 Type II ready (audit logs, access controls)
- GDPR compliant (data export, deletion)
- Zero PII in logs

---

## Revenue Model (MVP)

### Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 3 take-offs/month, single file only |
| **Pro** | $49/mo | Unlimited take-offs, multi-file, delta compare |
| **Team** | $149/mo | 5 seats, shared projects, export to CSV |
| **Enterprise** | Custom | SSO, API access, dedicated support |

### Unit Economics

- **CAC Target:** < $500 (via network introductions)
- **LTV Target:** $2,000+ (3+ years at $49-149/mo)
- **Gross Margin Target:** 80%+ (mostly hosting costs)

---

## Go-to-Market First Moves

### Week 1-2: Strategic Validation

1. [ ] Colton interviews 5-10 network contacts
2. [ ] Refine pricing based on feedback
3. [ ] Identify 3 beta candidates (firms willing to test)

### Week 3-4: Build Phase (Parallel)

1. [ ] Architecture finalized
2. [ ] Core extraction pipeline built
3. [ ] Beta UI functional

### Week 5-6: Beta

1. [ ] 2-3 beta users test on real projects
2. [ ] Collect feedback, fix bugs
3. [ ] Iterate on extraction patterns

### Week 7-8: Launch Prep

1. [ ] Security audit (internal)
2. [ ] Documentation
3. [ ] Pricing page, simple marketing site

---

## Next Steps

1. **Colton:** Schedule 5 network interviews this week
2. **Alfred:** Complete architecture documentation, start build
3. **Checkpoint:** End of Week 2 — review interview findings, finalize MVP scope

---

## Appendix: Sample Data

**Test PDFs for development:**
- `/Users/alfredgold/Downloads/exampleproblem/`
  - CNU CUP BC3 Plumbing Water Diagram.pdf
  - Pages from CNU CUP HCAi-BCK3 P_08-21-24.pdf
  - Technical Specification .docx files

**Expected extraction patterns:**
- Equipment tags: AHU-*, RTU-*, CHW-*, P-*, VAV-*
- Plumbing fixtures: WC-*, Lav-*, Hose Bib-*
- Spec sections: Division 22 (Plumbing), Division 23 (HVAC)
