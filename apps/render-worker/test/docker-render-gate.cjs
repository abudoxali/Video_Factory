/**
 * Docker runtime-gate script — runs INSIDE the production container.
 * Mirrors RemotionRenderEngine.render() exactly: selectComposition +
 * renderMedia against the pre-bundled serve URL, then the same artifact
 * validation (exists, >0 bytes, ftyp box, ffprobe h264/duration).
 * Deterministic Arabic manifest — no external providers involved.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');
const { selectComposition, renderMedia } = require('@remotion/renderer');

const SERVE_URL = process.env.REMOTION_SERVE_URL || '/app/render-bundle';
const OUTPUT = process.env.RENDER_GATE_OUTPUT || '/tmp/render-gate.mp4';
const COMPOSITION_ID = 'MainVideoComposition';

const manifest = {
  version: '1.0',
  renderId: 'rnd_docker_gate',
  videoId: 'vid_docker_gate',
  title: 'اختبار إخراج داخل الحاوية',
  language: 'ar',
  composition: {
    width: 540,
    height: 960,
    fps: 30,
    durationInFrames: 60,
    durationSeconds: 2,
    aspectRatio: '9:16',
  },
  scenes: [
    {
      sceneId: 'scn_ar_1',
      position: 1,
      startFrame: 0,
      durationFrames: 60,
      durationSeconds: 2,
      mediaStrategy: 'TEXT',
      onScreenText: 'مرحباً من Video Factory',
      visualDescription: 'مشهد نصي عربي تجريبي',
      purpose: 'افتتاحية',
      transition: { type: 'FADE', durationFrames: 10 },
      layout: { template: 'default', theme: 'dark', backgroundColor: '#0b0f19' },
      captions: [
        {
          id: 'cap_ar_1',
          text: 'مرحباً من مصنع الفيديو',
          sceneId: 'scn_ar_1',
          startFrame: 0,
          endFrame: 60,
          durationFrames: 60,
          startTime: 0,
          endTime: 2,
          isRtl: true,
        },
      ],
    },
  ],
  // Schema defaults — RenderManifestSchema.parse() fills these in the real
  // path; the gate replicates the parsed shape since contracts/zod aren't
  // guaranteed importable inside the standalone container.
  audio: {
    narrationTracks: [],
    musicTracks: [],
    sfxTracks: [],
    ducking: { enabled: true, duckedVolume: 0.15, normalVolume: 0.6, fadeFrames: 15 },
  },
  captions: {
    enabled: true,
    style: 'SOCIAL',
    safeAreaMarginPercent: 18,
    primaryColor: '#ffffff',
    highlightColor: '#38bdf8',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    fontSize: 48,
    maxLines: 2,
    rtl: true,
    fontFamily: 'Cairo, sans-serif',
  },
  branding: {
    watermark: { enabled: false, opacity: 0.5, position: 'TOP_RIGHT' },
    introCard: { enabled: false, durationFrames: 60 },
    outroCard: { enabled: false, durationFrames: 90 },
  },
  output: { format: 'mp4', codec: 'h264', audioCodec: 'aac', crf: 20 },
};

(async () => {
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || '/usr/bin/chromium';
  const inputProps = { manifest };

  const composition = await selectComposition({
    serveUrl: SERVE_URL,
    id: COMPOSITION_ID,
    inputProps,
    browserExecutable,
    chromeMode: 'chrome-for-testing',
    chromiumOptions: { enableMultiProcessOnLinux: true },
    logLevel: 'warn',
  });
  console.log(
    `[render-gate] composition: ${composition.id} ${composition.width}x${composition.height} @${composition.fps}fps, ${composition.durationInFrames} frames`
  );

  await renderMedia({
    composition,
    serveUrl: SERVE_URL,
    codec: 'h264',
    audioCodec: 'aac',
    outputLocation: OUTPUT,
    inputProps,
    crf: 20,
    browserExecutable,
    chromeMode: 'chrome-for-testing',
    chromiumOptions: { enableMultiProcessOnLinux: true },
    logLevel: 'warn',
    overwrite: true,
  });

  // Same validation as validateRenderedArtifact()
  const stats = fs.statSync(OUTPUT);
  if (!stats.size) throw new Error('render output empty');
  const fd = fs.openSync(OUTPUT, 'r');
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);
  if (header.subarray(4, 8).toString('ascii') !== 'ftyp') {
    throw new Error('render output missing ftyp MP4 box');
  }

  const probe = JSON.parse(
    execFileSync('ffprobe', [
      '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', OUTPUT,
    ]).toString()
  );
  const video = probe.streams.find((s) => s.codec_type === 'video');
  if (!video || video.codec_name !== 'h264') throw new Error('no h264 video stream');
  const duration = Number(probe.format.duration);
  if (!(duration > 0)) throw new Error('duration <= 0');

  console.log(
    `[render-gate] SUCCESS ${OUTPUT} — ${stats.size} bytes, codec=${video.codec_name}, ` +
    `${video.width}x${video.height} @${eval(video.r_frame_rate)}fps, frames=${video.nb_frames}, duration=${duration}s`
  );
})().catch((err) => {
  console.error('[render-gate] FAILED:', err.stack || err.message || err);
  process.exit(1);
});
