# SIGNAL / N0-0ONE

A portfolio built like a radio broadcast. Scrolling turns a tuning dial, every
section is a station, and the whole page is drawn by hand-written shaders.

**Live:** https://n0-0one.github.io/Portfolio/

| CH | Station | What happens |
|----|---------|--------------|
| 00 | Loader | Frequency counter searches for a signal, waveform settles, "Signal locked". |
| 01 | Signal | Static that resolves into the wordmark around your cursor (1-bit dither shader, tearing, curved test-card grid). Idles on autopilot on touch screens. |
| 02 | Static | Manifesto that tunes in word by word, with tiny live screens inside the sentence. |
| 03 | Transmissions | Pinned horizontal run of curved CRT screens, each one a live GLSL study. Glitches on hover, cards lean with scroll speed. |
| 04 | Noise | "MAKE NOISE" made of particles. Drag through it, click to detonate. |
| 05 | Frequency | Process steps and a marquee that leans with scroll velocity. |
| 06 | Transmit | Letters that squeeze around the cursor over radiating waves. |

Always on: tuning dial with station markers, live clock in your timezone,
channel HUD with decode effect, custom cursor, film grain, optional generated
sound (static that rises when you scroll fast).

## Edit your content

Everything lives in **`src/content.js`**: name, role, manifesto, projects,
services, process, links, email, timezone. The HTML is generated from it at
build time, so the site is readable without JavaScript and indexable by search
engines.

- `*word*` makes a serif italic accent.
- `[[contour]]` inside the manifesto drops in a live mini screen
  (`contour`, `bodies`, `interference`, `drift`).
- Projects can use a live shader (`media: { type: 'shader', preset: 'drift' }`)
  or your own screenshot (`media: { type: 'image', src: './work/shot.jpg' }`,
  file goes in `public/work/`). Images get a dithered look that clears on hover.
- Add `url` to a project to make the card clickable.
- Set `contact.email` to enable the mail button.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
npm run preview  # serve the build
```

## Deploy

Pushing to `main` (or a `claude/**` branch) runs `.github/workflows/deploy.yml`,
which builds the site and publishes `dist/` to GitHub Pages.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## How it's built

- **Vite** + vanilla JS. No framework, ~65 kB gzipped JS.
- **One WebGL2 context** for the whole page (`src/gl/renderer.js`). Every visual
  is a fragment shader drawn into a scissored region of a single fixed canvas,
  positioned from its DOM element each frame. Off-screen views cost nothing.
- Shaders in `src/gl/shaders.js`: ordered (Bayer) dithering, fBm noise,
  ray marching with smooth unions, domain warping, wave interference.
- **GSAP ScrollTrigger** for pinning and scrubbing, **Lenis** for smooth scroll.
- Self-hosted variable fonts via Fontsource: Archivo (width axis), Doto (dot
  matrix), Newsreader (italic), Martian Mono. All SIL Open Font License.
- Accessible fallbacks: `prefers-reduced-motion` gets a calm vertical layout,
  no WebGL gets a static version, everything has real markup and focus states.

## Structure

```
index.html              shell, filled at build time
vite.config.js          injects the generated markup
src/content.js          ← your content
src/template.js         markup generator
src/main.js             boot, loader, scroll choreography, HUD, menu
src/gl/renderer.js      shared-canvas multi-view WebGL renderer
src/gl/shaders.js       all GLSL
src/modules/            cursor, particles, sound, text scramble
src/styles/main.css     all styles
public/                 favicon, social preview image
```
