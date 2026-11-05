import './styles/fonts.css';
import 'lenis/dist/lenis.css';
import './styles/main.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { BRAND, CONTACT, HERO, TRAIL } from './config.js';
import { FrameSequence } from './modules/hero-sequence.js';
import { ImageTrail } from './modules/image-trail.js';
import { initCursor } from './modules/cursor.js';
import { splitChars } from './modules/split-text.js';
import {
  asset,
  clamp,
  mapRange,
  isMobileViewport,
  prefersReducedMotion,
  seededRandom,
  smoothstep,
} from './modules/utils.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduced = prefersReducedMotion();

/* ------------------------------------------------------------------ brand */
$$('[data-brand]').forEach((el) => (el.textContent = BRAND.name));
$$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

/* --------------------------------------------------------- smooth scroll */
const lenis = new Lenis({
  lerp: reduced ? 1 : 0.085,
  smoothWheel: !reduced,
  wheelMultiplier: 0.95,
  touchMultiplier: 1.3,
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
window.scrollTo(0, 0);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

$$('[data-scroll-to]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || !id.startsWith('#')) return;
    e.preventDefault();
    document.documentElement.classList.remove('menu-open');
    const target = id === '#top' ? 0 : $(id);
    lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  }),
);

/* ------------------------------------------------------------------ menu */
const menuBtn = $('[data-menu-toggle]');
menuBtn?.addEventListener('click', () => {
  const open = document.documentElement.classList.toggle('menu-open');
  menuBtn.setAttribute('aria-expanded', String(open));
  $('[data-menu]').setAttribute('aria-hidden', String(!open));
  open ? lenis.stop() : lenis.start();
});
$$('[data-menu] a').forEach((a) =>
  a.addEventListener('click', () => {
    menuBtn?.setAttribute('aria-expanded', 'false');
    lenis.start();
  }),
);

/* ---------------------------------------------------------------- cursor */
const cursor = initCursor();

/* ------------------------------------------------------------------ hero */
const heroSection = $('[data-hero]');
const heroCanvas = $('[data-hero-canvas]');
const heroTitle = $('[data-hero-title]');
const heroTagline = $('[data-hero-tagline]');
const heroShaft = $('[data-hero-shaft]');
const heroBlackout = $('[data-hero-blackout]');
const heroScroll = $('[data-hero-scroll]');

const portrait = () => window.innerWidth / window.innerHeight < 0.95;
const variant = portrait() ? 'mobile' : 'desktop';
const sequence = new FrameSequence(heroCanvas, {
  count: HERO.frames,
  src: (i) => asset(HERO.path(variant, i)),
});

const heroChars = splitChars(heroTitle);
const rnd = seededRandom(7);
heroChars.forEach((c) => {
  c._r = rnd();
  c._in = c.firstElementChild;
});
gsap.set(heroChars, { opacity: 0, filter: 'blur(16px)', yPercent: 14 });
gsap.set([heroTagline, heroScroll], { opacity: 0 });

let heroP = 0;
ScrollTrigger.create({
  trigger: heroSection,
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => (heroP = self.progress),
});

let lastHeroP = -1;
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener(
  'pointermove',
  (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  },
  { passive: true },
);

function updateHero() {
  mouse.sx += (mouse.x - mouse.sx) * 0.05;
  mouse.sy += (mouse.y - mouse.sy) * 0.05;
  const p = heroP;
  const par = 1 - smoothstep(0.1, 0.5, p);
  heroCanvas.style.translate = `${(-mouse.sx * 16 * par).toFixed(2)}px ${(-mouse.sy * 10 * par).toFixed(2)}px`;
  sequence.setProgress(mapRange(p, 0, 0.86));
  sequence.render();
  if (Math.abs(p - lastHeroP) < 0.0002) return;
  lastHeroP = p;

  // headline: letters dissolve into blur in a random order
  for (const c of heroChars) {
    const o = clamp((p - 0.012 - c._r * 0.12) / 0.07);
    c._in.style.opacity = (1 - o).toFixed(3);
    c._in.style.filter = o > 0.001 ? `blur(${(o * 18).toFixed(2)}px)` : 'none';
    c._in.style.transform = `translate3d(0, ${(-o * 18).toFixed(2)}px, 0) scale(${(1 + o * 0.12).toFixed(3)})`;
  }
  heroShaft.style.opacity = (1 - smoothstep(0.04, 0.34, p)).toFixed(3);
  heroTagline.style.transform = `translate3d(0, ${(-smoothstep(0.42, 0.6, p) * 30).toFixed(1)}px, 0)`;
  heroTagline.firstElementChild.style.opacity = (1 - smoothstep(0.42, 0.58, p)).toFixed(3);
  heroTagline.lastElementChild.style.opacity = (1 - smoothstep(0.42, 0.58, p)).toFixed(3);
  const hint = String(1 - smoothstep(0.0, 0.04, p));
  for (const el of heroScroll.children) el.style.opacity = hint;
  heroBlackout.style.opacity = smoothstep(0.82, 0.97, p).toFixed(3);
}

/* ------------------------------------------------------------- manifesto */
const manifesto = $('[data-manifesto]');
const manifestoTitle = $('[data-blur-text]', manifesto);
const mChars = splitChars(manifestoTitle);
const rnd2 = seededRandom(21);
mChars.forEach((c) => {
  c._r = rnd2();
  c._in = c.firstElementChild;
});
const trail = new ImageTrail(
  $('[data-trail]', manifesto),
  TRAIL.map((t) => ({ ...t, src: asset(t.src) })),
  { area: manifesto },
);
const trailHint = $('[data-trail-hint]', manifesto);
let mP = 0;
ScrollTrigger.create({
  trigger: manifesto,
  start: 'top bottom',
  end: 'bottom top',
  onUpdate: (self) => (mP = self.progress),
});
let lastMP = -1;
function updateManifesto(dt) {
  const p = mP;
  trail.setActive(p > 0.3 && p < 0.72);
  if (!reduced) trail.tick(dt);
  if (Math.abs(p - lastMP) < 0.0002) return;
  lastMP = p;
  for (const c of mChars) {
    const i = clamp((p - 0.16 - c._r * 0.14) / 0.1); // in
    const o = clamp((p - 0.66 - c._r * 0.12) / 0.08); // out
    const v = i * (1 - o);
    c._in.style.opacity = v.toFixed(3);
    c._in.style.filter = v < 0.999 ? `blur(${((1 - v) * 14).toFixed(2)}px)` : 'none';
    c._in.style.transform = `translate3d(0, ${((1 - i) * 22 - o * 16).toFixed(2)}px, 0)`;
  }
  trailHint.style.opacity = (smoothstep(0.34, 0.42, p) * (1 - smoothstep(0.6, 0.66, p)) * 0.9).toFixed(3);
}

/* -------------------------------------------------------------- approach */
const approach = $('[data-approach]');
const approachMedia = $('[data-approach-media]', approach);
const arcPath = $('[data-arc]', approach);
const arcLen = arcPath.getTotalLength();
arcPath.style.strokeDasharray = `${arcLen}`;
arcPath.style.strokeDashoffset = `${arcLen}`;

const approachTl = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: { trigger: approach, start: 'top 35%', end: 'bottom bottom', scrub: 0.8 },
});
approachTl
  .fromTo(
    approachMedia,
    { xPercent: 34, yPercent: 62, scale: 0.62, rotate: -7, opacity: 0, transformOrigin: '100% 100%' },
    { xPercent: 0, yPercent: 0, scale: 1, rotate: 0, opacity: 1, duration: 0.42, ease: 'power2.out' },
    0,
  )
  .fromTo(
    $$('.approach__title .line > span', approach),
    { yPercent: 115 },
    { yPercent: 0, duration: 0.16, stagger: 0.05, ease: 'power3.out' },
    0.3,
  )
  .to(arcPath, { strokeDashoffset: 0, duration: 0.24, ease: 'power2.inOut' }, 0.34)
  .fromTo($('[data-fade-up]', approach), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.14, ease: 'power2.out' }, 0.48)
  .fromTo(
    $$('[data-marques] li', approach),
    { opacity: 0, y: 24 },
    { opacity: 0.9, y: 0, duration: 0.12, stagger: 0.035, ease: 'power2.out' },
    0.52,
  )
  .to(approachMedia, { scale: 1.07, duration: 0.36 }, 0.64)
  .to({}, { duration: 0.1 });

/* ------------------------------------------------------------------- hud */
const hud = $('.hud');
const progressBar = $('[data-progress]');
ScrollTrigger.create({
  trigger: approach,
  start: 'top 30%',
  endTrigger: 'html',
  end: 'bottom bottom',
  onToggle: (self) => hud.classList.toggle('is-visible', self.isActive),
});
ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => (progressBar.style.transform = `scaleX(${self.progress.toFixed(4)})`),
});

/* ---------------------------------------------------------- reveal lines */
$$('[data-reveal-lines]').forEach((el) => {
  if (el.closest('[data-approach]')) return;
  gsap.fromTo(
    $$('.line > span', el),
    { yPercent: 115 },
    {
      yPercent: 0,
      duration: 1.35,
      ease: 'expo.out',
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 86%' },
    },
  );
});

/* ---------------------------------------------------------------- builds */
const mm = gsap.matchMedia();
mm.add('(min-width: 861px)', () => {
  const pin = $('[data-builds-pin]');
  const track = $('[data-builds-track]');
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
  const horizontal = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: true,
      scrub: 0.7,
      invalidateOnRefresh: true,
      anticipatePin: 1,
      refreshPriority: 1,
    },
  });
  $$('.build', track).forEach((card) => {
    const img = $('img', card);
    gsap.fromTo(
      img,
      { xPercent: -6 },
      {
        xPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: horizontal, start: 'left right', end: 'right left', scrub: true },
      },
    );
    gsap.fromTo(
      $('.build__media', card),
      { clipPath: 'inset(12% 0% 12% 0%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'power2.out',
        scrollTrigger: { trigger: card, containerAnimation: horizontal, start: 'left 95%', end: 'left 45%', scrub: true },
      },
    );
  });
});
mm.add('(max-width: 860px)', () => {
  $$('.build').forEach((card) => {
    gsap.fromTo(
      $('.build__media img', card),
      { scale: 1.3 },
      { scale: 1.08, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
    gsap.fromTo(
      $('.build__media', card),
      { clipPath: 'inset(10% 6% 10% 6%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 90%', end: 'top 45%', scrub: true } },
    );
  });
});

/* ---------------------------------------------------------------- studio */
const studioSection = $('[data-studio]');
let studio = null;
const studioIO = new IntersectionObserver(
  async ([entry]) => {
    if (!entry.isIntersecting || studio) return;
    studioIO.disconnect();
    try {
      const { createStudio } = await import('./modules/studio.js');
      studio = createStudio({
        section: studioSection,
        canvas: $('[data-studio-canvas]'),
        stage: $('[data-studio-stage]'),
      });
      if (import.meta.env.DEV) window.__studio = studio;
    } catch (err) {
      console.error(err);
    }
  },
  { rootMargin: '120% 0px' },
);
// `?nostudio` (dev only) skips the WebGL studio so automated layout checks stay fast.
if (!(import.meta.env.DEV && location.search.includes('nostudio'))) studioIO.observe(studioSection);

/* --------------------------------------------------------------- process */
const stepImgs = $$('[data-step-img]');
const stepCount = $('[data-step-count]');
const steps = $$('[data-step]');
const activateStep = (step) => {
  const i = Number(step.dataset.step);
  steps.forEach((s) => s.classList.toggle('is-active', s === step));
  stepImgs.forEach((img) => img.classList.toggle('is-active', Number(img.dataset.stepImg) === i));
  stepCount.textContent = String(i + 1).padStart(2, '0');
};
steps.forEach((step, i) => {
  ScrollTrigger.create({
    trigger: step,
    start: 'top 62%',
    end: 'bottom 62%',
    // onEnter/onEnterBack also fire when a fast scroll jumps over a step, so the last step always activates
    onEnter: () => activateStep(step),
    onEnterBack: () => activateStep(step),
    onLeaveBack: () => i > 0 && activateStep(steps[i - 1]),
  });
});
$('[data-step="0"]')?.classList.add('is-active');

/* ----------------------------------------------------------------- stats */
$$('[data-count]').forEach((el) => {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const o = { v: 0 };
  ScrollTrigger.create({
    trigger: el,
    start: 'top 88%',
    once: true,
    onEnter: () =>
      gsap.to(o, {
        v: target,
        duration: 2.2,
        ease: 'power3.out',
        onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString('en-US') + suffix),
      }),
  });
});

/* ---------------------------------------------------------------- footer */
gsap.fromTo(
  '[data-footer-word] span',
  { yPercent: 40, opacity: 0.2 },
  {
    yPercent: 0,
    opacity: 1,
    ease: 'power2.out',
    scrollTrigger: { trigger: '[data-footer-word]', start: 'top bottom', end: 'bottom bottom', scrub: 0.8 },
  },
);

/* ---------------------------------------------------------- contact form */
const form = $('[data-contact-form]');
const status = $('[data-form-status]');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  let ok = true;
  $$('[required]', form).forEach((f) => {
    const valid = f.type === 'email' ? /.+@.+\..+/.test(f.value) : !!f.value.trim();
    f.closest('.field').classList.toggle('is-invalid', !valid);
    ok = ok && valid;
  });
  if (!ok) {
    status.textContent = 'Please complete the highlighted fields.';
    return;
  }
  const data = new FormData(form);
  const name = (data.get('name') || '').toString().split(' ')[0];
  const hi = name ? `, ${name}` : '';
  if (!CONTACT.endpoint) {
    status.textContent = `Thanks${hi}. This form isn't connected to an inbox yet, so nothing was sent.`;
    return;
  }
  status.textContent = 'Sending…';
  try {
    const res = await fetch(CONTACT.endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    status.textContent = `Thank you${hi}. Our atelier will be in touch within 48 hours.`;
    form.reset();
  } catch {
    status.textContent = "Your enquiry couldn't be sent. Check your connection and try again.";
  }
});

/* ------------------------------------------------------------ main loop */
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.05);
  cursor?.tick();
  updateHero();
  updateManifesto(dt);
  studio?.tick();
});

/* ------------------------------------------------------------- preloader */
const pre = $('[data-preloader]');
const preBar = $('[data-preloader-bar]');
const preCount = $('[data-preloader-count]');
const shown = { v: 0 };
let target = 0;
let preDone = false;
const setPre = () => {
  if (preDone) return;
  preBar.style.transform = `scaleX(${shown.v / 100})`;
  preCount.textContent = String(Math.round(shown.v)).padStart(3, '0');
};
const EAGER = 14;
let eagerLoaded = 0;
const eager = sequence.load({
  eager: EAGER,
  onProgress: () => {
    eagerLoaded = Math.min(EAGER, eagerLoaded + 1);
    target = (eagerLoaded / EAGER) * 92;
    gsap.to(shown, { v: target, duration: 0.6, ease: 'power2.out', onUpdate: setPre, overwrite: true });
  },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

Promise.race([Promise.all([eager, document.fonts ? document.fonts.ready : null, wait(900)]), wait(9000)]).then(() => {
  sequence.render();
  const tl = gsap.timeline();
  tl.to(shown, { v: 100, duration: 0.5, ease: 'power2.out', onUpdate: setPre })
    .to(pre.querySelector('.preloader__inner'), { opacity: 0, y: -16, duration: 0.6, ease: 'power2.in' }, '+=0.1')
    .to(pre, { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, '-=0.15')
    .add(() => {
      preDone = true;
      pre.remove();
      document.body.classList.remove('is-loading');
      lenis.start();
      ScrollTrigger.refresh();
    })
    .fromTo(heroCanvas, { scale: 1.08, filter: 'brightness(0)' }, { scale: 1, filter: 'brightness(1)', duration: 2.4, ease: 'power3.out', clearProps: 'filter,scale' }, '-=0.9')
    .to(heroChars, { opacity: 1, filter: 'blur(0px)', yPercent: 0, duration: 1.7, ease: 'power3.out', clearProps: 'filter', stagger: { each: 0.035, from: 'random' } }, '-=1.9')
    .fromTo('[data-nav]', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, '-=1.4')
    .to([heroTagline, heroScroll], { opacity: 1, duration: 1.2, ease: 'power2.out' }, '-=1.0');
});

window.addEventListener('load', () => ScrollTrigger.refresh());
