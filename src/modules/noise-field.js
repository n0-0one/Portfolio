/**
 * Dot-matrix type made of particles. They spring back to their letters,
 * get shoved by the pointer and blow apart on click.
 */
export class NoiseField {
  constructor(canvas, { reduced = false, onDetonate } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lines = (canvas.dataset.lines || 'NOISE').split('|');
    this.reduced = reduced;
    this.onDetonate = onDetonate;
    this.p = { x: -1e5, y: -1e5, vx: 0, vy: 0, active: false };
    this.visible = false;
    this.n = 0;

    const host = canvas.parentElement;
    host.addEventListener('pointermove', (e) => this.move(e), { passive: true });
    host.addEventListener('pointerleave', () => (this.p.active = false));
    host.addEventListener('pointerdown', (e) => {
      this.move(e);
      this.detonate();
    });
    new IntersectionObserver(([en]) => (this.visible = en.isIntersecting), { rootMargin: '100px' }).observe(canvas);
    this.build();
  }

  move(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * this.dpr;
    const y = (e.clientY - r.top) * this.dpr;
    if (this.p.active) {
      this.p.vx = x - this.p.x;
      this.p.vy = y - this.p.y;
    }
    this.p.x = x;
    this.p.y = y;
    this.p.active = true;
  }

  build() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 10) return;
    const dpr = (this.dpr = Math.min(devicePixelRatio || 1, 2));
    const w = (this.w = this.canvas.width = Math.round(r.width * dpr));
    const h = (this.h = this.canvas.height = Math.round(r.height * dpr));

    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const o = off.getContext('2d', { willReadFrequently: true });
    const setFont = (s) => {
      o.font = `900 ${s}px "Archivo Variable", "Arial Black", sans-serif`;
      if ('fontStretch' in o) o.fontStretch = 'expanded';
    };
    setFont(100);
    const widest = Math.max(...this.lines.map((l) => o.measureText(l).width));
    const size = Math.min((100 * w * 0.96) / widest, (h * 0.98) / (this.lines.length * 0.84));
    setFont(size);
    o.fillStyle = '#fff';
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    const lh = size * 0.84;
    const top = h / 2 - ((this.lines.length - 1) * lh) / 2 + size * 0.04;
    this.lines.forEach((l, i) => o.fillText(l, w / 2, top + i * lh));

    const data = o.getImageData(0, 0, w, h).data;
    const gap = (this.gap = Math.max(4, Math.round((r.width < 700 ? 5 : 7.5) * dpr)));
    const pts = [];
    for (let y = gap / 2; y < h; y += gap)
      for (let x = gap / 2; x < w; x += gap) if (data[((y | 0) * w + (x | 0)) * 4] > 140) pts.push(x, y);

    const n = (this.n = pts.length / 2);
    this.hx = new Float32Array(n);
    this.hy = new Float32Array(n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.hx[i] = pts[i * 2];
      this.hy[i] = pts[i * 2 + 1];
      // start scattered so the word assembles the first time you see it
      this.x[i] = this.reduced ? this.hx[i] : Math.random() * w;
      this.y[i] = this.reduced ? this.hy[i] : Math.random() * h;
    }
    this.draw();
  }

  detonate() {
    const { x, y } = this.p;
    const R = 260 * this.dpr;
    for (let i = 0; i < this.n; i++) {
      const dx = this.x[i] - x;
      const dy = this.y[i] - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        const f = (1 - d / R) * 38 * this.dpr * (0.6 + Math.random() * 0.8);
        this.vx[i] += (dx / d) * f;
        this.vy[i] += (dy / d) * f;
      }
    }
    this.onDetonate?.();
  }

  tick() {
    if (!this.visible || !this.n) return;
    if (!this.reduced) this.step();
    this.draw();
  }

  step() {
    const { dpr, p } = this;
    const R = 95 * dpr;
    const R2 = R * R;
    const k = 0.05;
    const damp = 0.85;
    p.vx *= 0.8;
    p.vy *= 0.8;
    for (let i = 0; i < this.n; i++) {
      let vx = this.vx[i];
      let vy = this.vy[i];
      if (p.active) {
        const dx = this.x[i] - p.x;
        const dy = this.y[i] - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 5.5 * dpr;
          vx += (dx / d) * f + p.vx * 0.08 * (1 - d / R);
          vy += (dy / d) * f + p.vy * 0.08 * (1 - d / R);
        }
      }
      vx += (this.hx[i] - this.x[i]) * k;
      vy += (this.hy[i] - this.y[i]) * k;
      vx *= damp;
      vy *= damp;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.x[i] += vx;
      this.y[i] += vy;
    }
  }

  draw() {
    const { ctx, gap } = this;
    const s = gap * 0.6;
    const hs = s / 2;
    const hot = 2.2 * this.dpr;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.beginPath();
    for (let i = 0; i < this.n; i++) {
      if (Math.abs(this.vx[i]) + Math.abs(this.vy[i]) < hot) ctx.rect(this.x[i] - hs, this.y[i] - hs, s, s);
    }
    ctx.fillStyle = '#ece8df';
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < this.n; i++) {
      if (Math.abs(this.vx[i]) + Math.abs(this.vy[i]) >= hot) ctx.rect(this.x[i] - hs, this.y[i] - hs, s, s);
    }
    ctx.fillStyle = '#ff3d00';
    ctx.fill();
  }
}
