const GLYPHS = '!<>-_\\/[]{}=+*^?#░▒▓01';

/** Decode-style text swap. Returns a promise that resolves when done. */
export function scramble(el, to = el.textContent, { duration = 520 } = {}) {
  if (el._scr) cancelAnimationFrame(el._scr);
  const from = el.textContent;
  const len = Math.max(from.length, to.length);
  const start = performance.now();
  const queue = Array.from({ length: len }, (_, i) => {
    const s = Math.random() * 0.4;
    return { from: from[i] || '', to: to[i] || '', start: s, end: s + 0.35 + Math.random() * 0.25 };
  });
  return new Promise((resolve) => {
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      let out = '';
      for (const q of queue) {
        if (p >= q.end) out += q.to;
        else if (p >= q.start) out += q.to === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        else out += q.from;
      }
      el.textContent = out;
      if (p < 1) el._scr = requestAnimationFrame(tick);
      else {
        el.textContent = to;
        el._scr = null;
        resolve();
      }
    };
    el._scr = requestAnimationFrame(tick);
  });
}

/** Scramble on hover for every [data-scramble] element. */
export function bindScrambleHovers(root = document) {
  root.querySelectorAll('[data-scramble]').forEach((el) => {
    const text = el.textContent;
    const host = el.closest('a, button, summary') || el;
    host.addEventListener('pointerenter', () => scramble(el, text, { duration: 420 }));
  });
}
