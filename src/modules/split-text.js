/**
 * Splits the text of an element (or of its `.line` children) into
 * <span class="word"><span class="char"><span class="char__in">x</span></span></span>.
 * The outer `.char` and inner `.char__in` can be animated independently
 * (e.g. intro animation on one, scroll-driven animation on the other).
 */
export function splitChars(el) {
  if (el.__chars) return el.__chars;
  const label = el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', label);
  const chars = [];
  const lines = el.querySelectorAll('.line');
  const targets = lines.length ? Array.from(lines) : [el];

  targets.forEach((line) => {
    const words = line.textContent.trim().split(/\s+/);
    line.textContent = '';
    line.setAttribute('aria-hidden', 'true');
    words.forEach((w, wi) => {
      const word = document.createElement('span');
      word.className = 'word';
      for (const ch of w) {
        const c = document.createElement('span');
        c.className = 'char';
        const inner = document.createElement('span');
        inner.className = 'char__in';
        inner.textContent = ch;
        c.appendChild(inner);
        word.appendChild(c);
        chars.push(c);
      }
      line.appendChild(word);
      if (wi < words.length - 1) line.appendChild(document.createTextNode(' '));
    });
  });

  el.__chars = chars;
  return chars;
}
