export type PreviewMode = 'auto' | 'fast' | 'quality';
export type PreviewStats = { fps: number; scale: number; shadows: boolean };

const TIERS = [
  { scale: 1, shadows: true },
  { scale: 0.75, shadows: false },
  { scale: 0.5, shadows: false },
] as const;

/** Measure active frames, then lower preview cost with a fresh warmup per tier.
 * Never oscillate between tiers; selecting Auto again retries full quality. */
export class PreviewQuality {
  private mode: PreviewMode = 'auto';
  private tier = 0;
  private elapsed = 0;
  private frames = 0;
  private warmup = 10;

  get settings() { return TIERS[this.tier]; }

  setMode(mode: PreviewMode) {
    this.mode = mode;
    this.tier = mode === 'fast' ? 2 : 0;
    this.resetWindow();
    this.warmup = 10;
  }

  private resetWindow() { this.elapsed = 0; this.frames = 0; }

  observe(frameMs: number, active: boolean): PreviewStats | undefined {
    if (!active) { this.resetWindow(); return; }
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    if (this.warmup > 0) { this.warmup--; return; }
    this.elapsed += frameMs;
    this.frames++;
    if (this.elapsed < 1000) return;
    const fps = Math.round(this.frames * 1000 / this.elapsed);
    this.resetWindow();
    if (this.mode === 'auto' && fps < 45 && this.tier < TIERS.length - 1) {
      this.tier++;
      this.warmup = 10;
    }
    return { fps, ...this.settings };
  }
}
