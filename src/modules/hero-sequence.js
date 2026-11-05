import { clamp, loadImage } from './utils.js';

/**
 * Scroll-scrubbed image sequence drawn on a <canvas> with "cover" fitting.
 * Adjacent frames are cross-faded so 100 path-traced frames feel like a film.
 */
export class FrameSequence {
  constructor(canvas, { count, src, focusX = 0.5, focusY = 0.5 }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.count = count;
    this.src = src; // (index:number) => url
    this.focusX = focusX;
    this.focusY = focusY;
    this.frames = new Array(count).fill(null);
    this.progress = 0;
    this.alpha = 1;
    this.dirty = true;
    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize);
    this.resize();
  }

  /** Load the first `eager` frames (resolves when they are ready), then the rest in the background. */
  load({ eager = 12, concurrency = 6, onProgress } = {}) {
    let done = 0;
    const loadOne = (i) =>
      loadImage(this.src(i))
        .then((img) => {
          this.frames[i] = img;
          this.dirty = true;
        })
        .catch(() => {})
        .finally(() => {
          done++;
          onProgress && onProgress(done / this.count, i);
        });

    // Priority order: first frames first, then a coarse pass (every 4th) so scrubbing early still works, then the rest.
    const order = [];
    const seen = new Set();
    const push = (i) => {
      if (i >= 0 && i < this.count && !seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    };
    for (let i = 0; i < eager; i++) push(i);
    for (let i = 0; i < this.count; i += 4) push(i);
    for (let i = 0; i < this.count; i++) push(i);

    const eagerSet = order.slice(0, eager);
    const rest = order.slice(eager);
    const eagerPromise = Promise.all(eagerSet.map(loadOne));

    eagerPromise.then(() => {
      let cursor = 0;
      const next = () => {
        if (cursor >= rest.length) return;
        const i = rest[cursor++];
        loadOne(i).then(next);
      };
      for (let k = 0; k < concurrency; k++) next();
    });
    return eagerPromise;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (w && h && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }
  }

  setProgress(p) {
    p = clamp(p);
    if (Math.abs(p - this.progress) > 1e-5) {
      this.progress = p;
      this.dirty = true;
    }
  }

  nearestLoaded(i) {
    if (this.frames[i]) return this.frames[i];
    for (let d = 1; d < this.count; d++) {
      if (this.frames[i - d]) return this.frames[i - d];
      if (this.frames[i + d]) return this.frames[i + d];
    }
    return null;
  }

  drawCover(img, alpha) {
    const { width: cw, height: ch } = this.canvas;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) * this.focusX;
    const dy = (ch - dh) * this.focusY;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, dx, dy, dw, dh);
  }

  render() {
    if (!this.dirty) return;
    this.dirty = false;
    const f = this.progress * (this.count - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, this.count - 1);
    const t = f - i0;
    const a = this.nearestLoaded(i0);
    const b = this.frames[i1];
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!a) return;
    this.drawCover(a, 1);
    if (b && b !== a && t > 0.001) this.drawCover(b, t);
    ctx.globalAlpha = 1;
  }

  destroy() {
    window.removeEventListener('resize', this._resize);
  }
}
