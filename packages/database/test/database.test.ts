import { describe, it, expect } from 'vitest';
import { createId } from '../src/ids';
import {
  users,
  projects,
  videos,
  videoJobs,
  jobEvents,
  videoBriefs,
  videoScripts,
  videoChapters,
  scenes,
  aiRuns,
} from '../src/schema/index';

describe('Database Schema and Entity ID Tests', () => {
  it('generates prefixed IDs with proper structure', () => {
    const userId = createId('usr');
    const prjId = createId('prj');
    const vidId = createId('vid');
    const jobId = createId('job');
    const evtId = createId('evt');

    expect(userId.startsWith('usr_')).toBe(true);
    expect(prjId.startsWith('prj_')).toBe(true);
    expect(vidId.startsWith('vid_')).toBe(true);
    expect(jobId.startsWith('job_')).toBe(true);
    expect(evtId.startsWith('evt_')).toBe(true);

    expect(userId.length).toBeGreaterThan(10);
  });

  it('defines all required Phase 01 and Phase 02 tables with proper columns', () => {
    expect(users).toBeDefined();
    expect(projects).toBeDefined();
    expect(videos).toBeDefined();
    expect(videoJobs).toBeDefined();
    expect(jobEvents).toBeDefined();
    expect(videoBriefs).toBeDefined();
    expect(videoScripts).toBeDefined();
    expect(videoChapters).toBeDefined();
    expect(scenes).toBeDefined();
    expect(aiRuns).toBeDefined();

    expect(jobEvents.eventId).toBeDefined();
    expect(videoJobs.status).toBeDefined();
    expect(videos.planStatus).toBeDefined();
    expect(videoBriefs.workingTitle).toBeDefined();
    expect(videoScripts.fullNarration).toBeDefined();
    expect(scenes.mediaStrategy).toBeDefined();
    expect(aiRuns.promptVersion).toBeDefined();
  });
});
