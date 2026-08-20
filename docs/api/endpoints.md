# API Specification

## Public Application Endpoints

### 1. Create Video
- **URL**: `POST /api/videos`
- **Body**: `CreateVideoInput` (JSON)
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "video": { ... },
    "job": { ... },
    "redirectUrl": "/jobs/job_xxx"
  }
  ```

### 2. List Videos
- **URL**: `GET /api/videos`
- **Response**: `200 OK` (Array of videos with job status)

### 3. Get Video
- **URL**: `GET /api/videos/:id`
- **Response**: `200 OK`

### 4. Get Job Status & Events
- **URL**: `GET /api/jobs/:id`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "job": { ... },
    "video": { ... },
    "events": [ ... ]
  }
  ```

## Internal Webhook Callbacks

### 5. n8n Orchestrator Callback
- **URL**: `POST /api/internal/n8n/events`
- **Header**: `x-callback-secret: <SECRET>`
- **Body**: `N8nCallbackPayload`
- **Response**: `200 OK`
