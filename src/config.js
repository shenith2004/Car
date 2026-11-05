// Central place to rebrand the site.
export const BRAND = {
  name: 'NOIRVAL',
};

// Path-traced hero fly-through (rendered in Blender Cycles).
export const HERO = {
  frames: 100,
  // desktop: 1600×900 · mobile: 720×900 centre crop
  path: (variant, i) => `media/hero/${variant}/f_${String(i + 1).padStart(3, '0')}.webp`,
};

// Images dropped by the cursor trail in the manifesto section.
export const TRAIL = [
  { src: 'media/trail/01.webp' },
  { src: 'media/trail/02.webp' },
  { src: 'media/trail/03.webp', tall: true },
  { src: 'media/trail/04.webp' },
  { src: 'media/trail/05.webp' },
  { src: 'media/trail/06.webp', tall: true },
  { src: 'media/trail/07.webp' },
  { src: 'media/trail/08.webp' },
  { src: 'media/trail/09.webp', tall: true },
  { src: 'media/trail/10.webp' },
  { src: 'media/trail/11.webp' },
  { src: 'media/trail/12.webp', tall: true },
  { src: 'media/trail/13.webp' },
  { src: 'media/trail/14.webp' },
];
