import gsap from 'gsap';

/**
 * Cursor image trail: while the pointer moves over the section, photographs
 * are dropped along its path, glide toward the pointer, then shrink & fade.
 * On touch devices / when idle, an automatic path keeps the effect alive.
 */
export class ImageTrail {
  constructor(container, sources, { area, threshold = 58, poolSize = 22 } = {}) {
    this.container = container;
    this.area = area || container.parentElement;
    this.sources = sources;
    this.threshold = threshold;
    this.pool = [];
    this.poolIndex = 0;
    this.srcIndex = 0;
    this.z = 1;
    this.last = null;
    this.pointer = { x: 0, y: 0 };
    this.active = false;
    this.lastMove = 0;
    this.autoT = Math.random() * 10;

    for (let i = 0; i < poolSize; i++) {
      const img = document.createElement('img');
      img.className = 'trail-img';
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      container.appendChild(img);
      this.pool.push(img);
    }
    // Warm the cache so images pop instantly.
    this.preloaded = sources.map((s) => {
      const im = new Image();
      im.decoding = 'async';
      im.src = s.src;
      return im;
    });

    this.onMove = this.onMove.bind(this);
    this.area.addEventListener('pointermove', this.onMove, { passive: true });
    this.area.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) this.onMove({ clientX: t.clientX, clientY: t.clientY, pointerType: 'touch' });
    }, { passive: true });
  }

  setActive(v) {
    this.active = v;
    if (!v) this.last = null;
  }

  onMove(e) {
    if (!this.active) return;
    const rect = this.container.getBoundingClientRect();
    this.lastMove = performance.now();
    this.handlePoint(e.clientX - rect.left, e.clientY - rect.top);
  }

  handlePoint(x, y) {
    if (!this.last) {
      this.last = { x, y };
      this.pointer = { x, y };
      return;
    }
    const dx = x - this.last.x;
    const dy = y - this.last.y;
    const dist = Math.hypot(dx, dy);
    const scale = Math.min(1.4, Math.max(0.7, window.innerWidth / 1440));
    if (dist > this.threshold * scale) {
      this.spawn(this.last.x, this.last.y, x, y);
      this.last = { x, y };
    }
  }

  spawn(fromX, fromY, x, y) {
    const img = this.pool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.pool.length;
    const s = this.sources[this.srcIndex];
    this.srcIndex = (this.srcIndex + 1) % this.sources.length;
    img.src = s.src;
    img.classList.toggle('is-tall', !!s.tall);
    img.style.zIndex = String(this.z++);

    const w = img.offsetWidth || 110;
    const h = img.offsetHeight || 82;
    gsap.killTweensOf(img);
    const rot = gsap.utils.random(-5, 5);
    gsap.set(img, {
      x: fromX - w / 2,
      y: fromY - h / 2,
      scale: 0.55,
      opacity: 0,
      rotate: rot * 1.6,
      filter: 'blur(0px) brightness(0.9)',
    });
    const tl = gsap.timeline();
    tl.to(img, { opacity: 1, scale: 1, duration: 0.32, ease: 'power2.out' }, 0)
      .to(img, { x: x - w / 2, y: y - h / 2, rotate: rot, duration: 1.1, ease: 'expo.out' }, 0)
      .to(
        img,
        {
          opacity: 0,
          scale: 0.35,
          filter: 'blur(4px) brightness(0.6)',
          duration: 0.75,
          ease: 'power2.in',
        },
        0.62,
      );
  }

  /** Called every frame by the main ticker. Drives an automatic path when idle. */
  tick(dt) {
    if (!this.active) return;
    const idle = performance.now() - this.lastMove > 2200;
    if (!idle) return;
    const rect = this.container.getBoundingClientRect();
    this.autoT += dt * 0.9;
    const t = this.autoT;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = cx + Math.sin(t * 0.9) * rect.width * 0.26 + Math.sin(t * 2.3) * rect.width * 0.04;
    const y = cy + Math.sin(t * 1.7 + 1.2) * rect.height * 0.17;
    this.handlePoint(x, y);
  }
}
