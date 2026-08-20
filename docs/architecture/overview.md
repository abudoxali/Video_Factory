# Video Factory — Architecture Overview

Video Factory is an Arabic-first AI-driven video production platform integrated with n8n orchestration.

## High-Level Topology (Phase 01)
```
+-------------------------------------------------------------+
|                     Next.js 15+ Web App                     |
|           (Arabic-first, RTL, App Router, Tailwind)         |
+-------------------------------------------------------------+
             |                                 ^
             | Create Video (POST /api/videos) | Poll Status (GET /api/jobs/:id)
             v                                 |
+-------------------------------------------------------------+
|                      PostgreSQL Database                    |
|       (users, projects, videos, video_jobs, job_events)      |
+-------------------------------------------------------------+
             |                                 ^
             | Trigger Webhook                 | Authenticated Callbacks
             v                                 | (POST /api/internal/n8n/events)
+-------------------------------------------------------------+
|             External n8n Orchestrator (VF-00)               |
+-------------------------------------------------------------+
```

## Security & Reliability Guardrails
1. **Idempotency**: All webhook callbacks provide a unique `event_id` checked against the database before state updates.
2. **State Machine**: Transitions are enforced (e.g. `COMPLETED` cannot regress to `PROCESSING`).
3. **Secret Protection**: Secrets are stored strictly server-side and never leaked in client bundles or log outputs.
