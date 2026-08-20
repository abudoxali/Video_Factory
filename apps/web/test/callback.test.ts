import { describe, it, expect } from 'vitest';
import { N8nCallbackPayloadSchema } from '@video-factory/contracts';

describe('Callback Payload & State Logic Tests', () => {
  it('validates a correct PROCESSING progress callback', () => {
    const payload = {
      version: '1.0',
      event_id: 'evt_job_100_proc_1',
      job_id: 'job_100',
      event: 'job.progress',
      status: 'PROCESSING',
      stage: 'INITIALIZING',
      progress: 25,
      message: 'Workflow started',
    };

    const res = N8nCallbackPayloadSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });

  it('validates a correct COMPLETED callback', () => {
    const payload = {
      version: '1.0',
      event_id: 'evt_job_100_comp_1',
      job_id: 'job_100',
      event: 'job.completed',
      status: 'COMPLETED',
      stage: 'FINISHED',
      progress: 100,
      message: 'Workflow completed successfully',
    };

    const res = N8nCallbackPayloadSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });

  it('rejects callback with invalid progress percentage (> 100)', () => {
    const payload = {
      version: '1.0',
      event_id: 'evt_job_100_invalid',
      job_id: 'job_100',
      event: 'job.progress',
      status: 'PROCESSING',
      stage: 'INITIALIZING',
      progress: 105,
    };

    const res = N8nCallbackPayloadSchema.safeParse(payload);
    expect(res.success).toBe(false);
  });

  it('rejects callback with missing event_id', () => {
    const payload = {
      version: '1.0',
      job_id: 'job_100',
      event: 'job.progress',
      status: 'PROCESSING',
      stage: 'INITIALIZING',
      progress: 25,
    };

    const res = N8nCallbackPayloadSchema.safeParse(payload);
    expect(res.success).toBe(false);
  });
});
