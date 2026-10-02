import {
  N8nStartPayloadSchema,
  type N8nStartPayload,
} from '@video-factory/contracts';
import { appendDiagnosticJobEvent } from '@video-factory/database';
import { getEnv } from './env';

export interface TriggerN8nResult {
  success: boolean;
  status?: number;
  message?: string;
  error?: string;
}

/**
 * Server-only n8n trigger integration
 */
export async function triggerN8nJob(
  payload: N8nStartPayload
): Promise<TriggerN8nResult> {
  const env = getEnv();
  const webhookUrl = env.N8N_VIDEO_FACTORY_WEBHOOK_URL;
  const webhookSecret = env.N8N_VIDEO_FACTORY_WEBHOOK_SECRET;

  // Validate payload before sending
  const validation = N8nStartPayloadSchema.safeParse(payload);
  if (!validation.success) {
    const errMsg = `Invalid start payload: ${validation.error.message}`;
    console.error(`[N8N_CLIENT_ERROR] job_id=${payload.job_id} ${errMsg}`);
    await appendDiagnosticJobEvent({
      jobId: payload.job_id,
      eventType: 'N8N_TRIGGER_FAILED',
      stage: 'VALIDATING',
      progress: 0,
      message: 'فشل التحقق من صيغة بيانات المهمة قبل الإرسال إلى سير العمل',
      metadata: { error: errMsg },
    });
    return { success: false, error: errMsg };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const statusText = response.statusText || `HTTP ${response.status}`;
      console.error(
        `[N8N_HTTP_ERROR] job_id=${payload.job_id} status=${response.status} url=${webhookUrl.replace(/\/\/[^@]+@/, '//***@')}`
      );

      await appendDiagnosticJobEvent({
        jobId: payload.job_id,
        eventType: 'N8N_TRIGGER_FAILED',
        stage: 'RECEIVED',
        progress: 0,
        message: 'استجابت خدمة n8n برمز خطأ غير متوقع',
        metadata: { httpStatus: response.status, statusText },
      });

      return {
        success: false,
        status: response.status,
        error: `n8n webhook responded with status ${response.status}`,
      };
    }

    // Success response from n8n
    await appendDiagnosticJobEvent({
      jobId: payload.job_id,
      eventType: 'N8N_TRIGGERED',
      stage: 'INITIALIZING',
      progress: 10,
      message: 'تم إرسال الطلب بنجاح إلى سير عمل n8n وبدأت المعالجة',
    });

    return {
      success: true,
      status: response.status,
      message: 'Workflow triggered successfully',
    };
  } catch (error: unknown) {
    const err = error as Error;
    const isAbort = err.name === 'AbortError';
    const errorDescription = isAbort
      ? 'انتهت مهلة الاتصال بخدمة n8n (Timeout)'
      : 'تعذر الاتصال بعنوان سير عمل n8n (Service Offline or Unreachable)';

    console.warn(
      `[N8N_CONNECTION_WARNING] job_id=${payload.job_id} error="${err.message}"`
    );

    // Gracefully preserve the job and register a diagnostic event
    await appendDiagnosticJobEvent({
      jobId: payload.job_id,
      eventType: 'N8N_TRIGGER_FAILED',
      stage: 'RECEIVED',
      progress: 0,
      message: errorDescription,
      metadata: { error: err.message, isTimeout: isAbort },
    });

    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Triggers an arbitrary downstream n8n workflow webhook (VF-04 media pipeline,
 * VF-12 distribution coordinator, ...). The base URL is derived from
 * N8N_VIDEO_FACTORY_WEBHOOK_URL or N8N_WEBHOOK_BASE_URL; the shared webhook
 * secret travels in the `x-webhook-secret` header AND `webhook_secret` body
 * field so receiving workflows can authenticate the caller in either position.
 * Fire-and-forget: failures are logged and diagnostically recorded, never
 * thrown into the caller's request path.
 */
export async function triggerN8nWorkflow(
  webhookPath: string,
  payload: Record<string, unknown>,
  options?: { jobId?: string; timeoutMs?: number }
): Promise<TriggerN8nResult> {
  const env = getEnv();

  let baseUrl: string;
  try {
    baseUrl = new URL(env.N8N_VIDEO_FACTORY_WEBHOOK_URL).origin;
  } catch {
    baseUrl = 'http://localhost:5678';
  }
  const configuredBase = process.env.N8N_WEBHOOK_BASE_URL;
  const url = `${(configuredBase || baseUrl).replace(/\/$/, '')}/webhook/${webhookPath.replace(/^\//, '')}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': env.N8N_VIDEO_FACTORY_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        ...payload,
        webhook_secret: env.N8N_VIDEO_FACTORY_WEBHOOK_SECRET,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[N8N_WORKFLOW_HTTP_ERROR] path=${webhookPath} status=${response.status}`
      );
      if (options?.jobId) {
        await appendDiagnosticJobEvent({
          jobId: options.jobId,
          eventType: 'N8N_WORKFLOW_TRIGGER_FAILED',
          stage: 'ORCHESTRATING',
          progress: 0,
          message: `فشل تشغيل سير العمل ${webhookPath} (HTTP ${response.status})`,
          metadata: { webhookPath, httpStatus: response.status },
        });
      }
      return {
        success: false,
        status: response.status,
        error: `n8n workflow ${webhookPath} responded with status ${response.status}`,
      };
    }

    return { success: true, status: response.status };
  } catch (error: unknown) {
    const err = error as Error;
    console.warn(
      `[N8N_WORKFLOW_CONNECTION_WARNING] path=${webhookPath} error="${err.message}"`
    );
    if (options?.jobId) {
      await appendDiagnosticJobEvent({
        jobId: options.jobId,
        eventType: 'N8N_WORKFLOW_TRIGGER_FAILED',
        stage: 'ORCHESTRATING',
        progress: 0,
        message: `تعذر الاتصال بسير العمل ${webhookPath}`,
        metadata: { webhookPath, error: err.message },
      });
    }
    return { success: false, error: err.message };
  }
}
