import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderManifest, RenderErrorCode } from '@video-factory/contracts';

const execFileAsync = promisify(execFile);

/**
 * Render engine seam: RenderService delegates actual frame rendering to an
 * engine implementation. Tests inject explicit doubles; production must use
 * a real engine — synthetic/simulated output is never acceptable there.
 */
export interface RenderEngine {
  readonly name: string;
  /**
   * Renders the manifest composition into a real MP4 file at outputPath.
   * Must throw on failure — RenderService treats any throw as a failed render.
   */
  render(manifest: RenderManifest, outputPath: string): Promise<void>;
}

export class RenderEngineNotConfiguredError extends Error {
  public readonly code: RenderErrorCode = 'RENDER_ENGINE_NOT_CONFIGURED';

  constructor(message?: string) {
    super(
      message ||
      'محرك الإخراج الحقيقي غير مكوّن — يلزم تثبيت حزم Remotion (@remotion/bundler و @remotion/renderer) ونقطة دخول تجميع صالحة'
    );
    this.name = 'RenderEngineNotConfiguredError';
  }
}

/**
 * Thrown when the engine produced a file that fails artifact validation
 * (missing, empty, not an MP4 container, or failing ffprobe checks).
 */
export class RenderArtifactValidationError extends Error {
  public readonly code: RenderErrorCode = 'RENDER_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'RenderArtifactValidationError';
  }
}

function moduleDirname(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    try {
      // eslint-disable-next-line no-undef
      return __dirname;
    } catch {
      return process.cwd();
    }
  }
}

export interface RemotionEngineOptions {
  /**
   * Pre-bundled Remotion serve URL (local dir path or URL). When set,
   * bundling is skipped and only @remotion/renderer is exercised.
   * Env: REMOTION_SERVE_URL
   */
  serveUrl?: string;
  /** Path to a Remotion entry file that calls registerRoot(). Env: REMOTION_ENTRY_POINT */
  entryPoint?: string;
  /** Remotion public dir copied into the bundle (fonts/assets). Env: REMOTION_PUBLIC_DIR */
  publicDir?: string;
  /** Composition id to select inside the bundle. Env: REMOTION_COMPOSITION_ID */
  compositionId?: string;
  /** Chrome/Chromium executable path. Env: REMOTION_BROWSER_EXECUTABLE */
  browserExecutable?: string;
  /**
   * Browser binary flavor — 'headless-shell' (Remotion's auto-downloaded
   * shell) or 'chrome-for-testing' (a real Chrome/Chromium binary, e.g.
   * system chromium in Docker). Env: REMOTION_CHROME_MODE
   */
  chromeMode?: 'chrome-for-testing' | 'headless-shell';
  /** Per-frame render timeout in ms. Env: REMOTION_FRAME_TIMEOUT_MS */
  frameTimeoutMs?: number;
}

const DEFAULT_COMPOSITION_ID = 'MainVideoComposition';

/**
 * Validates a rendered video artifact: exists, non-empty, real MP4 container
 * (ftyp box), and — when ffprobe is available on PATH — contains a video
 * stream with an acceptable codec and positive duration.
 */
async function validateRenderedArtifact(outputPath: string): Promise<void> {
  const stats = await fs.promises.stat(outputPath).catch(() => null);
  if (!stats) {
    throw new RenderArtifactValidationError(`Render output file does not exist: ${outputPath}`);
  }
  if (stats.size === 0) {
    throw new RenderArtifactValidationError(`Render output file is empty: ${outputPath}`);
  }

  const fd = await fs.promises.open(outputPath, 'r');
  try {
    const header = Buffer.alloc(16);
    await fd.read(header, 0, 16, 0);
    // ISO-BMFF: bytes 4-7 hold the 'ftyp' major-brand box type
    if (header.length < 12 || header.subarray(4, 8).toString('ascii') !== 'ftyp') {
      throw new RenderArtifactValidationError(
        `Render output is not an MP4/ISO-BMFF container (missing ftyp box): ${outputPath}`
      );
    }
  } finally {
    await fd.close();
  }

  // Optional deeper probe — only when ffprobe exists in the environment.
  let probed: string | null = null;
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        outputPath,
      ],
      { timeout: 15000 }
    );
    probed = stdout;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return; // ffprobe unavailable → basic checks already passed
    throw new RenderArtifactValidationError(
      `ffprobe failed to parse render output: ${(err as Error).message}`
    );
  }

  let meta: { streams?: { codec_type?: string; codec_name?: string }[]; format?: { duration?: string } };
  try {
    meta = JSON.parse(probed!);
  } catch {
    throw new RenderArtifactValidationError('ffprobe returned unparseable metadata for render output');
  }

  const videoStream = (meta.streams || []).find((s) => s.codec_type === 'video');
  if (!videoStream) {
    throw new RenderArtifactValidationError('ffprobe: render output has no video stream');
  }
  if (videoStream.codec_name !== 'h264') {
    throw new RenderArtifactValidationError(
      `ffprobe: unexpected video codec "${videoStream.codec_name}" (expected h264)`
    );
  }
  const duration = Number(meta.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RenderArtifactValidationError(
      `ffprobe: render output has invalid duration "${meta.format?.duration}"`
    );
  }
}

/**
 * Real Remotion programmatic render engine.
 *
 * Performs a genuine render through the official Remotion toolchain:
 *   @remotion/bundler  → bundle entry point into a serve URL (or reuse
 *                        a configured REMOTION_SERVE_URL)
 *   @remotion/renderer → selectComposition + renderMedia → real H.264/AAC MP4
 *
 * Fails closed with RenderEngineNotConfiguredError when the entry point or
 * serve URL is unavailable — it never fabricates output.
 */
export class RemotionRenderEngine implements RenderEngine {
  public readonly name = 'remotion';
  private readonly serveUrl?: string;
  private readonly entryPoint?: string;
  private readonly publicDir?: string;
  private readonly compositionId: string;
  private readonly browserExecutable?: string;
  private readonly chromeMode?: 'chrome-for-testing' | 'headless-shell';
  private readonly frameTimeoutMs?: number;
  private bundlePromise?: Promise<string>;

  constructor(options?: RemotionEngineOptions) {
    this.serveUrl = options?.serveUrl || process.env.REMOTION_SERVE_URL || undefined;
    this.entryPoint = options?.entryPoint || process.env.REMOTION_ENTRY_POINT || undefined;
    this.publicDir = options?.publicDir || process.env.REMOTION_PUBLIC_DIR || undefined;
    this.compositionId =
      options?.compositionId || process.env.REMOTION_COMPOSITION_ID || DEFAULT_COMPOSITION_ID;
    this.browserExecutable =
      options?.browserExecutable || process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
    const envMode = process.env.REMOTION_CHROME_MODE;
    this.chromeMode =
      options?.chromeMode ||
      (envMode === 'chrome-for-testing' || envMode === 'headless-shell'
        ? envMode
        : this.browserExecutable
          ? 'chrome-for-testing'
          : undefined);
    const timeoutEnv = Number(process.env.REMOTION_FRAME_TIMEOUT_MS);
    this.frameTimeoutMs =
      options?.frameTimeoutMs ?? (Number.isFinite(timeoutEnv) && timeoutEnv > 0 ? timeoutEnv : undefined);
  }

  private resolveEntryPoint(): string {
    if (this.entryPoint) {
      if (!fs.existsSync(this.entryPoint)) {
        throw new RenderEngineNotConfiguredError(
          `Configured REMOTION_ENTRY_POINT does not exist: ${this.entryPoint}`
        );
      }
      return this.entryPoint;
    }

    const candidates = [
      path.resolve(moduleDirname(), '..', 'remotion-entry.tsx'),
      path.resolve(process.cwd(), 'apps/render-worker/src/remotion-entry.tsx'),
    ];

    try {
      const pkgJson = require.resolve('@video-factory/render-worker/package.json');
      candidates.push(path.resolve(path.dirname(pkgJson), 'src/remotion-entry.tsx'));
    } catch {
      // package not resolvable from this context — other candidates may still hit
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }

    throw new RenderEngineNotConfiguredError(
      `No Remotion entry point found. Tried: ${candidates.join(', ')}. ` +
      'Set REMOTION_ENTRY_POINT or REMOTION_SERVE_URL.'
    );
  }

  /**
   * Returns a usable serve URL — the configured one, or a freshly bundled
   * build of the entry point. The bundle is cached per engine instance so
   * consecutive renders reuse it.
   */
  private async getServeUrl(): Promise<string> {
    if (this.serveUrl) return this.serveUrl;
    if (!this.bundlePromise) {
      const entryPoint = this.resolveEntryPoint();
      const publicDir =
        this.publicDir || path.resolve(path.dirname(entryPoint), '..', 'public');
      this.bundlePromise = bundle({
        entryPoint,
        publicDir: fs.existsSync(publicDir) ? publicDir : null,
        // Workspace packages ship ESM dist with extensionless specifiers;
        // relax webpack's fullySpecified rule for them only.
        webpackOverride: (config) => {
          config.module = config.module || { rules: [] };
          config.module.rules = [
            ...(config.module.rules || []),
            {
              test: /\.js$/,
              include: /packages[\\/](contracts|database|providers)[\\/]dist[\\/]/,
              resolve: { fullySpecified: false },
            },
          ];
          return config;
        },
      });
    }
    return this.bundlePromise;
  }

  public async render(manifest: RenderManifest, outputPath: string): Promise<void> {
    const serveUrl = await this.getServeUrl();
    const inputProps = { manifest };

    const composition = await selectComposition({
      serveUrl,
      id: this.compositionId,
      inputProps,
      browserExecutable: this.browserExecutable ?? null,
      chromeMode: this.chromeMode,
      chromiumOptions: { enableMultiProcessOnLinux: true },
      timeoutInMilliseconds: this.frameTimeoutMs,
      logLevel: 'warn',
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      audioCodec: 'aac',
      outputLocation: outputPath,
      inputProps,
      crf: manifest.output?.crf ?? 20,
      browserExecutable: this.browserExecutable ?? null,
      chromeMode: this.chromeMode,
      chromiumOptions: { enableMultiProcessOnLinux: true },
      timeoutInMilliseconds: this.frameTimeoutMs,
      logLevel: 'warn',
      overwrite: true,
    });

    await validateRenderedArtifact(outputPath);
  }
}

let sharedEngine: RemotionRenderEngine | undefined;

/**
 * Shared default engine so the expensive bundle is cached across renders
 * within a process. RenderService falls back to this when no explicit
 * engine is injected.
 */
export function getDefaultRenderEngine(): RenderEngine {
  if (!sharedEngine) {
    sharedEngine = new RemotionRenderEngine();
  }
  return sharedEngine;
}
