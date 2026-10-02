import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as planningExecute } from '../src/app/api/internal/planning/execute/route';
import { POST as mediaExecute } from '../src/app/api/internal/media/execute/route';
import { GET as mediaStatus } from '../src/app/api/internal/media/status/route';
import { POST as renderExecute } from '../src/app/api/internal/render/execute/route';
import { GET as renderStatus } from '../src/app/api/internal/render/status/route';
import { POST as publishingExecute } from '../src/app/api/internal/publishing/execute/route';

/**
 * Part 4: the internal execute/status endpoints must stay authenticated —
 * n8n calls them with x-callback-secret and nothing unauthenticated may pass.
 */

const post = (path: string, body: unknown, secret?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret !== undefined ? { 'x-callback-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });

const get = (path: string, secret?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: secret !== undefined ? { 'x-callback-secret': secret } : {},
  });

describe('Internal orchestration endpoints — authentication gate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VIDEO_FACTORY_N8N_CALLBACK_SECRET: 'test_orchestration_secret_42',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const postRoutes = [
    ['planning/execute', planningExecute, { video_id: 'vid_1' }],
    ['media/execute', mediaExecute, { video_id: 'vid_1' }],
    ['render/execute', renderExecute, { video_id: 'vid_1' }],
    ['publishing/execute', publishingExecute, { video_id: 'vid_1' }],
  ] as const;

  for (const [pathName, handler, body] of postRoutes) {
    it(`POST /api/internal/${pathName} rejects missing secret (401)`, async () => {
      const res = await handler(post(`/api/internal/${pathName}`, body));
      expect(res.status).toBe(401);
    });

    it(`POST /api/internal/${pathName} rejects wrong secret (401)`, async () => {
      const res = await handler(
        post(`/api/internal/${pathName}`, body, 'definitely_wrong')
      );
      expect(res.status).toBe(401);
    });

    it(`POST /api/internal/${pathName} rejects malformed body (400)`, async () => {
      const res = await handler(
        post(`/api/internal/${pathName}`, { bogus: true }, 'test_orchestration_secret_42')
      );
      expect(res.status).toBe(400);
    });
  }

  it('GET /api/internal/media/status rejects missing secret (401)', async () => {
    const res = await mediaStatus(get('/api/internal/media/status?video_id=vid_1'));
    expect(res.status).toBe(401);
  });

  it('GET /api/internal/render/status rejects missing secret (401)', async () => {
    const res = await renderStatus(get('/api/internal/render/status?video_id=vid_1'));
    expect(res.status).toBe(401);
  });

  it('GET /api/internal/media/status validates query params (400)', async () => {
    const res = await mediaStatus(
      get('/api/internal/media/status', 'test_orchestration_secret_42')
    );
    expect(res.status).toBe(400);
  });

  it('GET /api/internal/render/status validates query params (400)', async () => {
    const res = await renderStatus(
      get('/api/internal/render/status', 'test_orchestration_secret_42')
    );
    expect(res.status).toBe(400);
  });
});
