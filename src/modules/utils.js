export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (v, inMin, inMax, outMin = 0, outMax = 1) =>
  outMin + (outMax - outMin) * clamp((v - inMin) / (inMax - inMin));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const isTouch = () =>
  window.matchMedia('(hover: none), (pointer: coarse)').matches || 'ontouchstart' in window;
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobileViewport = () => window.innerWidth <= 860;

/** Deterministic pseudo random (so letter orders are stable between reloads). */
export function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resolve a path inside /public that works on any base (GitHub Pages sub-path etc.). */
export const asset = (p) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
