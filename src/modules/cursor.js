import { isTouch, lerp } from './utils.js';

/** Ring + dot cursor with hover / label / drag states and magnetic buttons. */
export function initCursor() {
  if (isTouch()) return null;
  const root = document.documentElement;
  const el = document.querySelector('[data-cursor]');
  if (!el) return null;
  root.classList.add('has-cursor');
  const ring = el.querySelector('.cursor__ring');
  const dot = el.querySelector('.cursor__dot');
  const label = el.querySelector('[data-cursor-label]');

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ringPos = { ...pos };
  let visible = false;

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!visible) {
        visible = true;
        ringPos.x = pos.x;
        ringPos.y = pos.y;
        el.classList.remove('is-hidden');
      }
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => {
    visible = false;
    el.classList.add('is-hidden');
  });

  const setState = (target) => {
    const textEl = target.closest('[data-cursor-text]');
    const hoverEl = target.closest('a, button, [data-magnetic], .swatch, .chip, select, label');
    const dragEl = target.closest('[data-studio-canvas]');
    el.classList.toggle('is-text', !!textEl);
    el.classList.toggle('is-hover', !textEl && !!hoverEl);
    el.classList.toggle('is-drag', !textEl && !hoverEl && !!dragEl);
    label.textContent = textEl ? textEl.getAttribute('data-cursor-text') : '';
  };
  document.addEventListener('pointerover', (e) => setState(e.target), { passive: true });

  // Magnetic elements
  document.querySelectorAll('[data-magnetic]').forEach((m) => {
    m.addEventListener('pointermove', (e) => {
      const r = m.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      m.style.transform = `translate(${mx * 0.22}px, ${my * 0.3}px)`;
    });
    m.addEventListener('pointerleave', () => {
      m.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)';
      m.style.transform = '';
      setTimeout(() => (m.style.transition = ''), 600);
    });
  });

  return {
    tick() {
      ringPos.x = lerp(ringPos.x, pos.x, 0.2);
      ringPos.y = lerp(ringPos.y, pos.y, 0.2);
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    },
  };
}
