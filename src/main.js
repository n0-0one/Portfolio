import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/doto/index.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/martian-mono/index.css';
import './styles/main.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import content from './content.js';
import { Stage } from './gl/renderer.js';
import { scramble, bindScrambleHovers } from './modules/scramble.js';
import { initCursor } from './modules/cursor.js';
import { NoiseField } from './modules/noise-field.js';
import { Radio } from './modules/radio.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

root.classList.add('is-loading');
window.scrollTo(0, 0);

/* ─────────────────────────────── smooth scroll ── */
const lenis = reduced ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  lenis.stop();
}
gsap.ticker.lagSmoothing(0);
const scrollToTarget = (target) => {
  const el = typeof target === 'string' ? document.getElementById(target.replace('#', '')) : target;
  if (!el) return;
  const spacer = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el;
  if (lenis) lenis.scrollTo(spacer, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else spacer.scrollIntoView();
};

/* ─────────────────────────────── WebGL stage ── */
const radio = new Radio();
let stage = null;
const heroState = { lock: 0, scroll: 0 };
const flashState = { amt: 0 };
let heroView = null;

try {
  stage = new Stage($('.gl'));
  if (reduced) stage.timeScale = 0.15;
} catch (err) {
  console.warn('[signal] WebGL2 unavailable, using the static fallback.', err);
  root.classList.add('no-gl');
}

function heroTexture(el) {
  const r = el.getBoundingClientRect();
  const s = Math.min(stage.dpr, 1.5);
  const w = Math.max(2, Math.round(r.width * s));
  const h = Math.max(2, Math.round(r.height * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, w, h);
  const lines = w / h < 1.05 ? content.wordmark.tall : content.wordmark.wide;
  const setFont = (size) => {
    x.font = `900 ${size}px "Archivo Variable", "Arial Black", sans-serif`;
    if ('fontStretch' in x) x.fontStretch = 'expanded';
  };
  setFont(100);
  const widest = Math.max(...lines.map((l) => x.measureText(l).width));
  const size = Math.min((100 * w * 0.9) / widest, (h * 0.6) / (lines.length * 0.84));
  setFont(size);
  const cap = x.measureText('N0').actualBoundingBoxAscent || size * 0.72;
  const lh = size * 0.84;
  const cy = h * 0.48;
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  lines.forEach((l, i) => x.fillText(l, w / 2, cy + cap / 2 + (i - (lines.length - 1) / 2) * lh));
  return c;
}

if (stage) {
  const heroEl = $('[data-gl="hero"]');
  heroView = stage.add({
    el: heroEl,
    name: 'hero',
    seed: 0,
    textures: { uText: stage.texture() },
    auto: (t) => ({ x: 0.5 + 0.3 * Math.sin(t * 0.33), y: 0.52 + 0.16 * Math.sin(t * 0.51 + 1.2) }),
    uniforms: (set) => {
      set('uLock', heroState.lock);
      set('uScroll', heroState.scroll);
    },
  });

  $$('[data-crt]').forEach((el, i) => {
    const view = stage.add({ el, name: el.dataset.gl, seed: i * 1.7 + 0.3, hoverEl: el.closest('.card') });
    if (el.dataset.gl === 'image') {
      const tex = stage.texture();
      const size = { w: 1, h: 1 };
      view.textures = { uImage: tex };
      view.uniforms = (set) => set('uImgRes', size.w, size.h);
      const img = new Image();
      img.onload = () => {
        size.w = img.naturalWidth;
        size.h = img.naturalHeight;
        stage.upload(tex, img);
      };
      img.src = el.dataset.src;
    }
  });

  $$('[data-thumb]').forEach((el, i) => stage.add({ el, name: el.dataset.gl, thumb: true, seed: 4 + i }));

  stage.add({
    el: $('[data-gl="rings"]'),
    name: 'rings',
    hoverEl: $('.transmit'),
    auto: (t) => ({ x: 0.5 + 0.22 * Math.sin(t * 0.4), y: 0.5 + 0.14 * Math.cos(t * 0.29) }),
  });

  stage.add({
    name: 'flash',
    fullscreen: true,
    skip: () => flashState.amt < 0.004,
    uniforms: (set) => set('uAmt', flashState.amt),
  });

  addEventListener('pointermove', (e) => stage.pointer(e.clientX, e.clientY), { passive: true });
  document.addEventListener('pointerleave', () => (stage.mouse.inside = false));
}

const flash = (amt = 0.55) => {
  if (reduced || !stage) return;
  gsap.fromTo(flashState, { amt }, { amt: 0, duration: 0.42, ease: 'power2.out', overwrite: true });
};

/* ─────────────────────────────── HUD: channels + dial + clock ── */
const sections = $$('[data-channel]');
const hudCh = $('.hud__ch');
const hudName = $('.hud__name');
const freqEls = $$('.freq');
let activeSection = null;

function setChannel(sec) {
  if (activeSection === sec) return;
  const first = !activeSection;
  activeSection = sec;
  scramble(hudCh, `CH ${sec.dataset.channel}`);
  scramble(hudName, sec.dataset.name);
  $$('.menu__link').forEach((a) => a.classList.toggle('is-active', a.dataset.target === sec.id));
  if (!first) {
    flash();
    radio.burst();
  }
}

// dial
const dialTrack = $('.dial__track');
const dialSvg = $('.dial__svg');
const PX = dialSvg ? +dialSvg.dataset.px : 64;
const TOP = dialSvg ? +dialSvg.dataset.top : 87.5;
let stations = [];
let freqNow = content.channels[0].freq;

function measureStations() {
  const max = ScrollTrigger.maxScroll(window);
  const vh = innerHeight;
  stations = sections.map((s) => {
    const box = s.parentElement?.classList.contains('pin-spacer') ? s.parentElement : s;
    const top = box.getBoundingClientRect().top + scrollY;
    return { at: clamp(top - vh * 0.45, 0, max), freq: +s.dataset.freq };
  });
  stations[0].at = 0;
  stations[stations.length - 1].at = Math.min(stations[stations.length - 1].at, max);
}

function freqAt(y) {
  if (!stations.length) return freqNow;
  if (y <= stations[0].at) return stations[0].freq;
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    if (y <= b.at) {
      const t = (y - a.at) / Math.max(1, b.at - a.at);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // dwell on each station
      return a.freq + (b.freq - a.freq) * e;
    }
  }
  return stations[stations.length - 1].freq;
}

let lastFreqText = '';
function dialTick() {
  const target = freqAt(lenis ? lenis.animatedScroll : scrollY);
  freqNow += (target - freqNow) * 0.2;
  const txt = freqNow.toFixed(1);
  if (txt !== lastFreqText) {
    freqEls.forEach((el) => (el.textContent = txt));
    lastFreqText = txt;
  }
  if (dialTrack) {
    const winH = dialTrack.parentElement.clientHeight;
    dialTrack.style.transform = `translate3d(0, ${(winH / 2 - (freqNow - TOP) * PX).toFixed(2)}px, 0)`;
  }
}

// clock in the owner's timezone
function startClock() {
  const els = $$('.clock');
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: content.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  const tick = () => {
    const txt = fmt.format(new Date()).replace(',', '');
    els.forEach((el) => (el.textContent = txt));
  };
  tick();
  setInterval(tick, 1000);
  $$('.year').forEach((el) => (el.textContent = new Date().getFullYear()));
}

/* ─────────────────────────────── scroll choreography ── */
function initScroll() {
  // CH 03: horizontal broadcast (pinned) — created first so later triggers account for the pin
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    const track = $('.work__track');
    const bar = $('.work__progress span');
    const cards = $$('.card', track);
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const skewTo = gsap.quickTo(cards, 'skewX', { duration: 0.5, ease: 'power3' });
    gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.work',
        start: 'top top',
        end: () => `+=${dist()}`,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          bar.style.transform = `scaleX(${self.progress})`;
          skewTo(clamp(self.getVelocity() / -320, -5, 5));
        },
      },
    });
  });

  // paper sections flip the HUD colours
  $$('.paper').forEach((sec) => {
    const bind = (cls, edge) =>
      ScrollTrigger.create({
        trigger: sec,
        start: `top ${edge}`,
        end: `bottom ${edge}`,
        onToggle: (self) => root.classList.toggle(cls, self.isActive),
      });
    bind('hud-paper', 'top+=36');
    bind('dial-paper', 'center');
    bind('foot-paper', 'bottom-=30');
  });

  // channel detection
  sections.forEach((sec) =>
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => self.isActive && setChannel(sec),
    })
  );

  // hero drifts off-station as it leaves
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => (heroState.scroll = self.progress),
  });
  gsap.to('.hero__ui', {
    yPercent: -12,
    opacity: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '70% top', scrub: true },
  });

  if (reduced) return;

  // CH 02: words tune in
  gsap.fromTo(
    '.manifesto .w',
    { opacity: 0.1 },
    {
      opacity: 1,
      ease: 'none',
      stagger: 0.1,
      scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 50%', scrub: true },
    }
  );
  gsap.fromTo(
    '.thumb',
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: 'expo.out',
      stagger: 0.25,
      scrollTrigger: { trigger: '.manifesto__text', start: 'top 70%', end: 'bottom 55%', scrub: true },
    }
  );

  // generic reveals
  $$('.sec-head, .facts__item, .services__title, .svc, .process__title, .step, .transmit__kicker, .transmit__text, .btn-signal, .links li, .work__intro > *').forEach(
    (el) =>
      gsap.from(el, {
        y: 36,
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      })
  );
  $$('.step').forEach((el) =>
    ScrollTrigger.create({ trigger: el, start: 'top 80%', once: true, onEnter: () => el.classList.add('is-in') })
  );

  // marquee leans with scroll velocity
  const lean = gsap.quickTo('.marquee', 'skewX', { duration: 0.6, ease: 'power3' });
  ScrollTrigger.create({
    trigger: '.process',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => lean(clamp(self.getVelocity() / -260, -12, 12)),
  });

  // transmit title rises in
  gsap.from('.transmit__title .stretch', {
    yPercent: 60,
    opacity: 0,
    duration: 1.4,
    stagger: 0.12,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.transmit__title', start: 'top 85%', once: true },
  });
}

/* ─────────────────────────────── CH 06: letters that breathe ── */
function initStretch() {
  const chars = $$('.transmit__title .stretch > span');
  const section = $('.transmit');
  const ptr = { x: -1e5, y: -1e5, live: false };
  const maxS = () => (innerWidth < 641 ? 100 : 125);
  const cur = chars.map(() => ({ s: maxS(), w: 900 }));
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(section);
  section.addEventListener('pointermove', (e) => Object.assign(ptr, { x: e.clientX, y: e.clientY, live: true }), {
    passive: true,
  });
  section.addEventListener('pointerleave', () => (ptr.live = false));
  return (time) => {
    if (!visible || reduced) return;
    const rects = chars.map((c) => c.getBoundingClientRect());
    const span = rects[rects.length - 1].right - rects[0].left;
    const R = clamp(span * 0.28, 110, 380);
    let px = ptr.x;
    let py = ptr.y;
    if (!ptr.live) {
      const r0 = rects[0];
      const r1 = rects[rects.length - 1];
      px = r0.left + (r1.right - r0.left) * (0.5 + 0.5 * Math.sin(time * 0.7));
      py = (r0.top + r1.bottom) / 2 + Math.sin(time * 0.45) * (r1.bottom - r0.top) * 0.4;
    }
    chars.forEach((c, i) => {
      const r = rects[i];
      const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
      const t = clamp(1 - d / R, 0, 1);
      const e = t * t * (3 - 2 * t);
      const top = maxS();
      const tgtS = top - (top - 62) * e;
      const tgtW = 900 - 620 * e;
      cur[i].s += (tgtS - cur[i].s) * 0.14;
      cur[i].w += (tgtW - cur[i].w) * 0.14;
      c.style.fontStretch = `${cur[i].s.toFixed(1)}%`;
      c.style.fontWeight = Math.round(cur[i].w);
    });
  };
}

function initMagnet() {
  const btn = $('.btn-signal');
  if (!btn || !fine) return;
  const inner = $('.btn-signal__in', btn);
  const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  const ixTo = gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  const iyTo = gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  btn.addEventListener('pointermove', (e) => {
    const r = btn.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    xTo(dx * 0.35);
    yTo(dy * 0.35);
    ixTo(dx * 0.15);
    iyTo(dy * 0.15);
  });
  btn.addEventListener('pointerleave', () => [xTo, yTo, ixTo, iyTo].forEach((f) => f(0)));
}

/* ─────────────────────────────── menu, sound, links ── */
function initMenu() {
  const menu = $('.menu');
  const btn = $('.menu-toggle');
  const focusables = () => $$('a', menu);
  let open = false;
  const set = (v) => {
    open = v;
    menu.classList.toggle('is-open', v);
    root.classList.toggle('menu-open', v);
    menu.setAttribute('aria-hidden', String(!v));
    btn.setAttribute('aria-expanded', String(v));
    scramble(btn, v ? 'Close' : 'Menu', { duration: 300 });
    focusables().forEach((a) => (a.tabIndex = v ? 0 : -1));
    if (v) {
      lenis?.stop();
      setTimeout(() => focusables()[0]?.focus({ preventScroll: true }), 50);
    } else lenis?.start();
    radio.blip(v ? 880 : 660);
    flash(0.35);
  };
  btn.addEventListener('click', () => set(!open));
  addEventListener('keydown', (e) => e.key === 'Escape' && open && (set(false), btn.focus()));
  $$('.menu__link').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      set(false);
      scrollToTarget(a.dataset.target);
    })
  );
  // every in-page link goes through the smooth scroller
  $$('a[href^="#"]:not(.menu__link)').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      e.preventDefault();
      scrollToTarget(id);
    })
  );
}

function initSound() {
  const btn = $('.sound-toggle');
  const state = $('.sound-toggle__state');
  btn.addEventListener('click', () => {
    const on = radio.toggle();
    btn.setAttribute('aria-pressed', String(on));
    state.textContent = on ? 'On' : 'Off';
    root.classList.toggle('sound-on', on);
    if (on) radio.burst();
  });
  $$('[data-cursor], .svc summary').forEach((el) =>
    el.addEventListener('pointerenter', () => radio.blip(900 + Math.random() * 900))
  );
}

/* ─────────────────────────────── loader ── */
async function runLoader() {
  const num = $('.loader__num');
  const pct = $('.loader__pct');
  const status = $('.loader__status');
  const wave = $('.loader__wave path');
  const target = content.channels[0].freq;
  const s = { f: 0 };

  const fonts = Promise.race([
    Promise.all([
      document.fonts.load('900 100px "Archivo Variable"'),
      document.fonts.load('400 40px "Doto Variable"'),
      document.fonts.load('italic 400 40px "Newsreader Variable"'),
      document.fonts.load('400 12px "Martian Mono Variable"'),
    ]),
    wait(4000),
  ]).catch(() => {});

  let alive = true;
  const drawWave = () => {
    if (!alive) return;
    const t = performance.now() / 1000;
    const amp = 24 * (1 - s.f / target) + 2;
    let d = 'M0 30';
    for (let x = 6; x <= 600; x += 6) {
      const env = Math.sin((x / 600) * Math.PI);
      const y = 30 + Math.sin(x * 0.045 + t * 9) * amp * env + (Math.random() - 0.5) * amp * 0.7 * env;
      d += ` L${x} ${y.toFixed(1)}`;
    }
    wave.setAttribute('d', d);
    requestAnimationFrame(drawWave);
  };
  drawWave();

  const tune = gsap.to(s, {
    f: target,
    duration: reduced ? 0.3 : 2.1,
    ease: 'power2.inOut',
    onUpdate: () => {
      num.textContent = s.f.toFixed(1).padStart(5, '0');
      pct.textContent = String(Math.round((s.f / target) * 100)).padStart(2, '0');
    },
  });
  await Promise.all([fonts, tune.then()]);
  await scramble(status, 'Signal locked', { duration: 380 });
  await wait(reduced ? 50 : 260);
  alive = false;
}

function revealSite() {
  const tl = gsap.timeline();
  tl.to('.loader', { clipPath: 'inset(0% 0% 100% 0%)', duration: reduced ? 0.2 : 1.05, ease: 'expo.inOut' })
    .add(() => {
      root.classList.remove('is-loading');
      $('.loader')?.remove();
      lenis?.start();
    })
    .to(heroState, { lock: 1, duration: 1.6, ease: 'power2.out' }, 0.25)
    .to('.hero .reveal', { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out' }, 0.55)
    .from('.hud > *, .hud-bottom > *', { y: -14, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.5);
  flash(0.8);
}

/* ─────────────────────────────── boot ── */
const cursor = initCursor();
let field = null;
let stretchTick = () => {};

gsap.ticker.add((time, deltaMs) => {
  lenis?.raf(time * 1000);
  stage?.render(Math.min(deltaMs, 50) / 1000);
  cursor.tick();
  field?.tick();
  stretchTick(time);
  dialTick();
  if (lenis) radio.velocity(lenis.velocity);
});

(async function boot() {
  startClock();
  initMenu();
  initSound();
  initMagnet();
  bindScrambleHovers();
  stretchTick = initStretch();

  await runLoader();

  if (stage && heroView) stage.upload(heroView.textures.uText, heroTexture(heroView.el));
  field = new NoiseField($('.noise__canvas'), {
    reduced,
    onDetonate: () => {
      radio.burst();
      flash(0.3);
    },
  });

  initScroll();
  ScrollTrigger.addEventListener('refresh', measureStations);
  ScrollTrigger.refresh();
  setChannel(sections[0]);
  revealSite();

  let lastW = innerWidth;
  let t;
  addEventListener('resize', () => {
    stage?.resize();
    clearTimeout(t);
    t = setTimeout(() => {
      // ignore mobile URL-bar height jitter
      if (Math.abs(innerWidth - lastW) < 2 && !fine) return;
      lastW = innerWidth;
      if (stage && heroView) stage.upload(heroView.textures.uText, heroTexture(heroView.el));
      field?.build();
      ScrollTrigger.refresh();
    }, 180);
  });
})();
