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
});
