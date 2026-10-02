import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('n8n Workflows Validation (VF-00 through VF-17)', () => {
  const workflowsDir = path.resolve(__dirname, '../../../n8n/workflows');

  const expectedWorkflows = [
    'VF-00-core-job-orchestrator.json',
    'VF-01-ai-director.json',
    'VF-02-script-generator.json',
    'VF-03-scene-planner.json',
    'VF-04-media-generation-coordinator.json',
    'VF-05-image-generator.json',
    'VF-06-video-generator.json',
    'VF-07-voice-generator.json',
    'VF-08-asset-storage-finalization.json',
    'VF-09-render-coordinator.json',
    'VF-10-final-render-upload.json',
    'VF-11-final-video-qa.json',
    'VF-12-distribution-coordinator.json',
    'VF-13-youtube-publisher.json',
    'VF-14-instagram-publisher.json',
    'VF-15-tiktok-publisher.json',
    'VF-16-publication-reconciler.json',
    'VF-17-analytics-sync.json',
  ];

  it('contains all 18 canonical workflow JSON files', () => {
    expect(fs.existsSync(workflowsDir)).toBe(true);
    for (const filename of expectedWorkflows) {
      const filePath = path.join(workflowsDir, filename);
      expect(fs.existsSync(filePath), `Workflow file missing: ${filename}`).toBe(true);
    }
  });

  it('validates that each workflow is valid JSON and free of hardcoded credentials', () => {
    for (const filename of expectedWorkflows) {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Valid JSON parse
      let parsed: any;
      expect(() => {
        parsed = JSON.parse(content);
      }, `Invalid JSON in ${filename}`).not.toThrow();

      expect(parsed.name).toBeDefined();
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(parsed.nodes.length).toBeGreaterThan(0);

      // Verify no hardcoded credentials or API keys in workflow JSON
      expect(content).not.toMatch(/AIzaSy[A-Za-z0-9_-]{33}/);
      expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{32,}/);
      expect(content).not.toMatch(/ghp_[A-Za-z0-9_-]{36}/);
    }
  });

  it('contains no fabricated business output in Code nodes (Part 4)', () => {
    // n8n must orchestrate — Code nodes may only validate/authenticate inputs,
    // never fabricate briefs, scripts, scenes, media, renders, or publications.
    const fabricationPatterns = [
      /fullNarration/, // fabricated script narration
      /visualPrompt\s*:/, // fabricated scene visual prompts
      /const brief\s*=\s*\{/, // fabricated creative brief objects
      /const scenes\s*=\s*\[/, // fabricated scene arrays
      /const script\s*=\s*\{/, // fabricated script objects
      /mediaState\s*[:=]\s*['"]READY/, // READY state asserted without provider result
      /status\s*[:=]\s*['"]PUBLISHED/, // PUBLISHED asserted without provider confirmation
    ];

    for (const filename of expectedWorkflows) {
      const filePath = path.join(workflowsDir, filename);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const codeNodes = parsed.nodes.filter(
        (n: any) => n.type === 'n8n-nodes-base.code'
      );
      for (const node of codeNodes) {
        const code = node.parameters?.jsCode || '';
        for (const pattern of fabricationPatterns) {
          expect(
            pattern.test(code),
            `${filename}:${node.name} contains fabricated output matching ${pattern}`
          ).toBe(false);
        }
      }
    }
  });

  it('authenticates inbound webhooks and calls authenticated internal APIs', () => {
    for (const filename of expectedWorkflows) {
      const filePath = path.join(workflowsDir, filename);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const content = JSON.stringify(parsed);

      const hasWebhook = parsed.nodes.some(
        (n: any) => n.type === 'n8n-nodes-base.webhook'
      );
      if (hasWebhook) {
        expect(
          content.includes('N8N_VIDEO_FACTORY_WEBHOOK_SECRET'),
          `${filename} webhook must validate the shared webhook secret`
        ).toBe(true);
      }

      const httpToApp = parsed.nodes.filter(
        (n: any) =>
          n.type === 'n8n-nodes-base.httpRequest' &&
          JSON.stringify(n.parameters?.url || '').includes('/api/internal/')
      );
      for (const node of httpToApp) {
        const headers = JSON.stringify(node.parameters?.headerParameters || {});
        expect(
          headers.includes('x-callback-secret'),
          `${filename}:${node.name} must send x-callback-secret to internal APIs`
        ).toBe(true);
      }
    }
  });

  it('never trusts caller-supplied planning payloads — planning executes via /planning/execute', () => {
    // VF-00..VF-03 must invoke the real provider-backed planning boundary, not
    // the legacy ingest endpoint that persisted caller-supplied briefs/scripts.
    for (const filename of [
      'VF-00-core-job-orchestrator.json',
      'VF-01-ai-director.json',
      'VF-02-script-generator.json',
      'VF-03-scene-planner.json',
    ]) {
      const content = fs.readFileSync(path.join(workflowsDir, filename), 'utf-8');
      expect(content).toContain('/api/internal/planning/execute');
      expect(content).not.toContain('/api/internal/n8n/planning');
    }
  });

  it('media/render/publishing workflows drive real execute or status APIs', () => {
    const expectations: Record<string, string> = {
      'VF-04-media-generation-coordinator.json': '/api/internal/media/execute',
      'VF-05-image-generator.json': '/api/internal/media/execute',
      'VF-06-video-generator.json': '/api/internal/media/execute',
      'VF-07-voice-generator.json': '/api/internal/media/execute',
      'VF-08-asset-storage-finalization.json': '/api/internal/media/status',
      'VF-09-render-coordinator.json': '/api/internal/render/execute',
      'VF-10-final-render-upload.json': '/api/internal/render/status',
      'VF-11-final-video-qa.json': '/api/internal/render/status',
      'VF-12-distribution-coordinator.json': '/api/internal/publishing/execute',
      'VF-13-youtube-publisher.json': '/api/internal/publishing/execute',
      'VF-14-instagram-publisher.json': '/api/internal/publishing/execute',
      'VF-15-tiktok-publisher.json': '/api/internal/publishing/execute',
      'VF-16-publication-reconciler.json': '/api/internal/publishing/reconcile',
      'VF-17-analytics-sync.json': '/api/internal/analytics/sync',
    };

    for (const [filename, endpoint] of Object.entries(expectations)) {
      const content = fs.readFileSync(path.join(workflowsDir, filename), 'utf-8');
      expect(content, `${filename} must call ${endpoint}`).toContain(endpoint);
    }
  });
});
