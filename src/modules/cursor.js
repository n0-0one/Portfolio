/** Crosshair cursor with a ring that grows and labels interactive things. */
export function initCursor() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const el = document.querySelector('.cursor');
  if (!fine || !el) return { tick() {} };
  document.documentElement.classList.add('has-cursor');

  const ring = el.querySelector('.cursor__ring');
  const dot = el.querySelector('.cursor__dot');
  const label = el.querySelector('.cursor__label');
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...pos };
  let current = null;
  let visible = false;
  let frame = 0;
  const setTarget = (node) => {
    const target = node?.closest?.('[data-cursor]') || null;
    if (target === current) return;
    current = target;
    const text = target?.dataset.cursor || '';
    label.textContent = text;
    el.classList.toggle('is-active', !!text);
  };

  addEventListener(
    'pointermove',
    (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!visible) {
        visible = true;
        el.classList.add('is-visible');
        ringPos.x = pos.x;
        ringPos.y = pos.y;
      }
      setTarget(e.target);
    },
    { passive: true }
  );
  document.addEventListener('pointerleave', () => {
    visible = false;
    el.classList.remove('is-visible');
  });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));

  return {
    tick() {
      // content scrolls under a still mouse: re-check what we're over
      if (visible && ++frame % 8 === 0) setTarget(document.elementFromPoint(pos.x, pos.y));
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    },
  };
}
