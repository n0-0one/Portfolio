/**
 * ─────────────────────────────────────────────────────────────
 *  EVERYTHING YOU NEED TO EDIT LIVES IN THIS FILE.
 *  Text, projects, links, timezone. The HTML is generated from it
 *  at build time, so the site stays readable without JavaScript.
 *
 *  Small markup helpers you can use inside any text:
 *    *word*        → serif italic emphasis
 *    [[preset]]    → tiny live screen inline (manifesto only)
 *                    presets: contour | bodies | interference | drift
 * ─────────────────────────────────────────────────────────────
 */
export default {
  handle: 'N0-0ONE',

  // Big wordmark drawn by the hero shader. `tall` is used on portrait screens.
  wordmark: { wide: ['N0-0ONE'], tall: ['N0-', '0ONE'] },

  role: 'Independent designer & creative developer',
  available: 'Open for projects',
  timezone: 'Europe/Warsaw', // shown as your local time in the HUD + footer

  seo: {
    title: 'N0-0ONE / designer & creative developer',
    description:
      'Portfolio of N0-0ONE. Independent designer and creative developer making interactive, hand-coded websites.',
    url: 'https://n0-0one.github.io/Portfolio/',
  },

  // Every section is a "station" on the dial.
  channels: [
    { id: 'signal', ch: '01', name: 'Signal', freq: 88.1 },
    { id: 'static', ch: '02', name: 'Static', freq: 92.4 },
    { id: 'transmissions', ch: '03', name: 'Transmissions', freq: 96.8 },
    { id: 'noise', ch: '04', name: 'Noise', freq: 101.3 },
    { id: 'frequency', ch: '05', name: 'Frequency', freq: 104.7 },
    { id: 'transmit', ch: '06', name: 'Transmit', freq: 107.9 },
  ],

  hero: {
    statement: 'I build websites that behave like *instruments*, not brochures.',
    hint: 'Move to tune / Scroll to change station',
  },

  manifesto:
    'Most of the web is noise. Same templates, same gradients, same polite little cards. I make *the other thing:* sites with a pulse [[contour]], a point of view, and details you only catch the second time [[bodies]]. Every project starts as static [[interference]] and gets tuned until it comes through *clear.*',

  facts: [
    { k: 'Working', v: 'Worldwide, remote first' },
    { k: 'Stack', v: 'HTML, CSS, JS, GLSL, GSAP' },
    { k: 'House rule', v: 'No templates. No page builders.' },
  ],

  /**
   * PROJECTS. These four are live generative studies that run inside this
   * site. Swap them for your real work whenever you are ready:
   *   media: { type: 'shader', preset: 'contour' }      → live visual
   *   media: { type: 'image', src: './work/shot.jpg' }  → put the file in /public/work/
   *   url: 'https://...'                                → makes the card clickable
   */
  projects: [
    {
      title: 'Contour',
      kind: 'Generative study',
      year: '2026',
      stack: ['GLSL', 'WebGL2', 'fBm noise'],
      desc: 'A landscape that never repeats. Height lines drawn from layered noise and redrawn sixty times a second. Hover to push the ground up.',
      media: { type: 'shader', preset: 'contour' },
      url: '',
    },
    {
      title: 'One-Bit Bodies',
      kind: 'Rendering study',
      year: '2026',
      stack: ['Ray marching', 'Bayer dither'],
      desc: 'Soft shapes ray-marched in real time, then squeezed through a 1-bit matrix like an old Macintosh screen. Your cursor is the lamp.',
      media: { type: 'shader', preset: 'bodies' },
      url: '',
    },
    {
      title: 'Interference',
      kind: 'Signal study',
      year: '2026',
      stack: ['GLSL', 'Wave maths'],
      desc: 'Two sources, one screen. Bring the cursor in and the second source follows you. The patterns start arguing.',
      media: { type: 'shader', preset: 'interference' },
      url: '',
    },
    {
      title: 'Driftwork',
      kind: 'Motion study',
      year: '2026',
      stack: ['Domain warping', 'Posterize'],
      desc: 'Flow fields folded into themselves three times, then flattened into four inks. Slow on purpose.',
      media: { type: 'shader', preset: 'drift' },
      url: '',
    },
  ],

  noise: {
    lines: ['MAKE', 'NOISE'],
    hint: 'Drag through it. Click to detonate.',
  },

  services: [
    {
      title: 'Art direction & web design',
      text: 'Concept, type, layout and a motion language that belongs to you. Figma when it helps, code when it matters.',
    },
    {
      title: 'Creative development',
      text: 'WebGL, GLSL shaders, GSAP and scroll choreography. Fast on real phones, not only on my laptop.',
    },
    {
      title: 'Interactive & generative',
      text: 'Real-time visuals, playful interfaces and things people want to poke twice.',
    },
    {
      title: 'Launch & care',
      text: 'Performance budgets, accessibility, analytics, and sticking around after go-live.',
    },
  ],

  marquee: ['Design', 'Code', 'Motion', 'Sound', 'Shaders', 'Type'],

  process: [
    { title: 'Listen', text: 'We talk until I can explain your project better than the brief does.' },
    { title: 'Sketch', text: 'Rough type, motion tests, ugly prototypes. Wrong fast, then right.' },
    { title: 'Build', text: 'Hand-written code. Every animation has to earn its frame budget.' },
    { title: 'Tune', text: 'Real devices, slow networks, real people. Then we go on air.' },
  ],

  contact: {
    kicker: 'Is anyone out there?',
    title: ['SAY', 'SOMETHING'],
    text: 'New projects, collaborations, strange ideas. Send a signal and I will tune in.',
    cta: 'Send a signal',
    // Add your address to enable the mail button, e.g. 'hello@yourdomain.com'
    email: '',
  },

  // Empty urls are hidden automatically.
  links: [
    { label: 'GitHub', url: 'https://github.com/n0-0one' },
    { label: 'Instagram', url: '' },
    { label: 'LinkedIn', url: '' },
    { label: 'X', url: '' },
  ],

  footer: {
    note: 'Built by hand. No templates were harmed.',
  },
};
