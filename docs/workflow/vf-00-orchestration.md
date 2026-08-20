# VF-00 Orchestration Flow

## Sequence Diagram
```text
User Browser              Web Server & DB              n8n Orchestrator
    |                           |                            |
    |-- POST /create video ---->|                            |
    |                           |-- Save video & job (DB)    |
    |                           |-- Trigger Webhook -------->|
    |<-- Redirect /jobs/:id ----|                            |
    |                           |                            |-- (Async start)
    |                           |<-- Callback: PROCESSING ---|
    |                           |-- Update status = PROC     |
    |-- Poll GET /api/jobs/:id->|                            |
    |<-- Returns 25% PROC ------|                            |
    |                           |                            |-- Deterministic test
    |                           |<-- Callback: CORE_TEST ----|
    |                           |-- Update progress = 70%    |
    |-- Poll GET /api/jobs/:id->|                            |
    |<-- Returns 70% PROC ------|                            |
    |                           |                            |-- Finalizing
    |                           |<-- Callback: COMPLETED ----|
    |                           |-- Update status = COMPLETED|
    |-- Poll GET /api/jobs/:id->|                            |
    |<-- Returns 100% COMPLETED-|                            |
    |   (Polling stops)         |                            |
```
