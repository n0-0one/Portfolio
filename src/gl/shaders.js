/**
 * GLSL ES 3.00 sources. Every view on the page is a fragment shader drawn
 * into a scissored region of ONE shared canvas (see renderer.js).
 */

export const VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = /* glsl */ `#version 300 es
precision highp float;
uniform vec2  uRes;     // view size, device px
uniform vec2  uOrigin;  // view bottom-left on the canvas, device px
uniform float uTime;
uniform vec2  uMouse;   // view-local, 0..1, y up
uniform float uHover;   // 0..1 smoothed
uniform float uDpr;
uniform float uSeed;
out vec4 outColor;

const vec3 INK  = vec3(0.043, 0.043, 0.039);
const vec3 BONE = vec3(0.925, 0.910, 0.875);
const vec3 SIG  = vec3(1.000, 0.239, 0.000);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
vec2 localFrag() { return gl_FragCoord.xy - uOrigin; }
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
`;

/* ───────────────────────── HERO: static that resolves into the wordmark ── */
const HERO = /* glsl */ `
uniform sampler2D uText;
uniform float uLock;    // 0 → 1 when the loader finishes
uniform float uScroll;  // 0 → 1 as the hero leaves
uniform vec2  uVel;

void main() {
  vec2 frag = localFrag();
  float cs = max(2.0, floor(2.6 * uDpr + 0.5));
  vec2 cell = floor(frag / cs);
  vec2 uv = (cell * cs + 0.5 * cs) / uRes;
  float asp = uRes.x / uRes.y;
  float t = uTime;

  // barrel warp grows as you scroll away: the station drifts off
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float k = 0.06 + uScroll * 1.1;
  vec2 q = p * (1.0 + k * dot(p, p));
  vec2 wuv = q / vec2(asp, 1.0) + 0.5;

  // signal strength: strong around the cursor, weak elsewhere
  float d = length((uv - uMouse) * vec2(asp, 1.0));
  float beam = smoothstep(0.40, 0.0, d);
  float sig = uLock * (1.0 - uScroll * 0.9) * (0.24 + 0.76 * beam);

  // horizontal tearing
  float row = floor(wuv.y * 96.0);
  float jitter = noise(vec2(row * 0.37, t * 3.1)) - 0.5;
  float burst = step(0.968, hash(vec2(floor(t * 7.0), row * 0.13)));
  float tear = (jitter * 0.035 + burst * 0.07 * sign(jitter)) * (1.0 - sig) + uVel.x * 0.025 * beam;
  tear += uScroll * jitter * 0.2;
  vec2 tuv = wuv + vec2(tear, 0.0);

  float txt = 0.0;
  if (tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) txt = texture(uText, tuv).r;

  // static + rolling bar
  float stat = hash(cell + fract(t * 13.0) * vec2(91.7, 37.3));
  float rb = fract(uv.y * 0.55 - t * 0.11);
  float roll = smoothstep(0.0, 0.06, rb) * smoothstep(0.22, 0.08, rb);
  float bg = stat * (0.34 + 0.3 * roll) * (0.55 + 0.45 * uLock);

  // curved grid, the "test card" behind the signal
  vec2 gd = abs(fract(q * 5.0) - 0.5);
  float grid = smoothstep(0.465, 0.5, max(gd.x, gd.y)) * (0.25 + 0.5 * uScroll);

  float lum = bg * (1.0 - sig * 0.92) + txt * (0.2 + 0.8 * sig) + grid * 0.5;
  float on = step(bayer8(cell) + 0.001, lum);

  // round phosphor dots
  vec2 f = fract(frag / cs) - 0.5;
  float dotm = step(length(f), 0.46);

  // reticle ring + sparks in the accent colour
  float ring = smoothstep(cs / uRes.y * 1.2, 0.0, abs(d - 0.40)) * uHover * step(0.5, fract(atan(uv.y - uMouse.y, (uv.x - uMouse.x) * asp) * 9.549));
  float spark = step(0.985, hash(cell + floor(t * 9.0))) * txt * beam;

  vec3 dotCol = mix(BONE, SIG, clamp(spark + ring, 0.0, 1.0));
  vec3 col = mix(INK, dotCol, max(on * dotm, ring * dotm));

  col *= 0.93 + 0.07 * sin(frag.y * 1.7);
  col *= 1.0 - 0.38 * dot(p, p);
  outColor = vec4(col, 1.0);
}`;

/* ───────────────────────── CRT wrapper for project screens + thumbs ── */
const CRT_MAIN = /* glsl */ `
uniform float uThumb;
void main() {
  vec2 frag = localFrag();
  vec2 uv = frag / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = uv * 2.0 - 1.0;

  // curved glass
  float bend = 1.0 - uThumb;
  vec2 bp = p * (1.0 + vec2(0.05 * p.y * p.y, 0.07 * p.x * p.x) * bend);
  vec2 suv = bp * 0.5 + 0.5;

  // hover glitch: line displacement
  float row = floor(suv.y * 48.0);
  float g = step(0.86, hash(vec2(row, floor(uTime * 14.0)))) * uHover;
  suv.x += g * (hash(vec2(row, 3.7)) - 0.5) * 0.09;

  vec3 col = scene(suv, asp);

  col *= 0.84 + 0.16 * sin(frag.y * 3.14159 / max(1.0, uDpr * 1.5));
  col *= 1.0 - 0.5 * pow(length(p * 0.72), 2.6) * bend;
  col *= 0.965 + 0.035 * noise(vec2(uTime * 40.0, uSeed));
  col += g * 0.06 * SIG;

  float inside = step(abs(bp.x), 1.0) * step(abs(bp.y), 1.0);
  col = mix(INK * 0.6, col, inside);

  vec2 pp = (uv - 0.5) * uRes;
  float rad = mix(16.0 * uDpr, min(uRes.x, uRes.y) * 0.5, uThumb);
  float a = clamp(0.5 - sdRoundBox(pp, uRes * 0.5, rad), 0.0, 1.0);
  outColor = vec4(col * a, a);
}`;

const SCENES = {
  contour: /* glsl */ `
vec3 scene(vec2 uv, float asp) {
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * 2.2;
  float h = fbm(p + vec2(uTime * 0.04, uTime * 0.02) + uSeed * 7.0);
  h += 0.25 * fbm(p * 2.3 - uTime * 0.03);
  vec2 m = (uMouse - 0.5) * vec2(asp, 1.0) * 2.2;
  h += 0.45 * exp(-dot(p - m, p - m) * 2.5) * uHover;
  float f = h * 15.0;
  float w = fwidth(f) * 1.2;
  float e = abs(fract(f + 0.5) - 0.5);
  float line = 1.0 - smoothstep(0.0, w, e);
  float e5 = abs(fract(f / 5.0 + 0.5) - 0.5) * 5.0;
  float major = 1.0 - smoothstep(0.0, w * 1.4, e5);
  vec3 col = INK * 1.5;
  col = mix(col, BONE * 0.42, line);
  col = mix(col, BONE * 0.9, major);
  col = mix(col, SIG, major * smoothstep(0.68, 0.82, h));
  return col;
}`,

  bodies: /* glsl */ `
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float map(vec3 p) {
  float t = uTime * 0.55 + uSeed;
  float d = length(p - vec3(sin(t) * 0.75, cos(t * 1.3) * 0.32, 0.0)) - 0.52;
  d = smin(d, length(p - vec3(-cos(t * 0.8) * 0.65, sin(t * 0.9) * 0.4, sin(t) * 0.3)) - 0.4, 0.38);
  vec3 q = p;
  q.xz *= rot(t * 0.5);
  q.xy *= rot(t * 0.35);
  float tor = length(vec2(length(q.xz) - 0.82, q.y)) - 0.11;
  return smin(d, tor, 0.28);
}
vec3 scene(vec2 uv, float asp) {
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * 2.1;
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(p, -2.3));
  float t = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 70; i++) {
    float d = map(ro + rd * t);
    if (d < 0.002) { hit = 1.0; break; }
    t += d;
    if (t > 7.0) break;
  }
  float lum = 0.05 + 0.06 * (1.0 - uv.y);
  float rim = 0.0;
  if (hit > 0.5) {
    vec3 pos = ro + rd * t;
    vec2 e = vec2(0.002, 0.0);
    vec3 n = normalize(vec3(map(pos + e.xyy) - map(pos - e.xyy), map(pos + e.yxy) - map(pos - e.yxy), map(pos + e.yyx) - map(pos - e.yyx)));
    vec3 Ld = normalize(vec3(-0.6, 0.7, 0.6));
    vec3 Lm = normalize(vec3((uMouse - 0.5) * 3.0, 0.9));
    vec3 L = normalize(mix(Ld, Lm, uHover));
    float dif = max(dot(n, L), 0.0);
    rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    lum = 0.06 + 0.9 * dif + 0.25 * rim;
  }
  float cs = max(2.0, floor(2.0 * uDpr + 0.5));
  float on = step(bayer8(floor(localFrag() / cs)), lum);
  vec3 col = mix(INK, BONE, on);
  col = mix(col, SIG, on * hit * smoothstep(0.55, 0.9, rim));
  return col;
}`,

  interference: /* glsl */ `
vec3 scene(vec2 uv, float asp) {
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime + uSeed * 10.0;
  vec2 a = vec2(sin(t * 0.4) * 0.35, cos(t * 0.3) * 0.2);
  vec2 b = mix(vec2(-sin(t * 0.33) * 0.32, sin(t * 0.5) * 0.24), (uMouse - 0.5) * vec2(asp, 1.0), uHover);
  float w1 = sin(length(p - a) * 85.0 - t * 3.0);
  float w2 = sin(length(p - b) * 85.0 - t * 3.0);
  float s = w1 + w2;
  float band = smoothstep(-0.1, 0.25, s);
  float hot = smoothstep(1.55, 1.9, s);
  vec3 col = mix(INK * 1.4, BONE * 0.86, band);
  col = mix(col, SIG, hot);
  return col;
}`,

  drift: /* glsl */ `
vec3 scene(vec2 uv, float asp) {
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * 2.4 + uSeed;
  vec2 m = (uMouse - 0.5) * vec2(asp, 1.0) * 2.4 + uSeed;
  float t = uTime * 0.07;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.5), fbm(p + 3.0 * q + vec2(8.3, 2.8)));
  r += uHover * 0.35 * exp(-dot(p - m, p - m) * 1.5);
  float f = fbm(p + 3.0 * r);
  float cs = max(2.0, floor(2.0 * uDpr + 0.5));
  float lv = floor(clamp(f * 1.9 - 0.25, 0.0, 0.999) * 4.0 + (bayer8(floor(localFrag() / cs)) - 0.5) * 0.7);
  vec3 col = lv < 0.5 ? INK : lv < 1.5 ? vec3(0.21, 0.205, 0.19) : lv < 2.5 ? SIG : BONE;
  return col;
}`,

  image: /* glsl */ `
uniform sampler2D uImage;
uniform vec2 uImgRes;
vec3 scene(vec2 uv, float asp) {
  vec2 s = uRes / uImgRes;
  float sc = max(s.x, s.y);
  vec2 sz = uImgRes * sc / uRes;
  vec2 iuv = (uv - 0.5) / sz + 0.5;
  vec3 c = texture(uImage, iuv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float cs = max(2.0, floor(2.0 * uDpr + 0.5));
  float on = step(bayer8(floor(localFrag() / cs)), l);
  vec3 duo = mix(INK, BONE, on);
  return mix(duo, c, uHover);
}`,
};

/* ───────────────────────── CONTACT: waves radiating from the cursor ── */
const RINGS = /* glsl */ `
void main() {
  vec2 frag = localFrag();
  float cs = max(2.0, floor(3.0 * uDpr + 0.5));
  vec2 cell = floor(frag / cs);
  vec2 uv = (cell * cs + 0.5 * cs) / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  vec2 m = (uMouse - 0.5) * vec2(asp, 1.0);
  float d = length(p - m);
  float w = (sin(d * 42.0 - uTime * 4.0) * 0.5 + 0.5) * exp(-d * 2.4);
  vec2 c2 = vec2(0.0, -0.32);
  float d2 = length(p - c2);
  float w2 = (sin(d2 * 26.0 - uTime * 1.6) * 0.5 + 0.5) * exp(-d2 * 2.0) * 0.55;
  float lum = max(w * (0.35 + 0.65 * uHover), w2) * 0.62 + hash(cell + fract(uTime * 7.0)) * 0.07;
  float on = step(bayer8(cell) + 0.001, lum);
  vec2 f = fract(frag / cs) - 0.5;
  float dotm = step(length(f), 0.42);
  vec3 dc = mix(BONE * 0.5, SIG, smoothstep(0.62, 0.92, w * uHover));
  vec3 col = mix(INK, dc, on * dotm);
  col *= 1.0 - 0.3 * dot(p, p);
  outColor = vec4(col, 1.0);
}`;

/* ───────────────────────── Channel change: a burst of static ── */
const FLASH = /* glsl */ `
uniform float uAmt;
void main() {
  vec2 frag = localFrag();
  float cs = max(2.0, floor(2.0 * uDpr));
  vec2 cell = floor(frag / cs);
  float n = hash(cell + fract(uTime * 17.0) * vec2(13.1, 71.7));
  float band = hash(vec2(floor(frag.y / (cs * 7.0)), floor(uTime * 30.0)));
  float a = uAmt * (0.25 + 0.75 * n) * (band > 0.82 ? 1.0 : 0.45);
  vec3 c = mix(BONE, SIG, step(0.975, n));
  outColor = vec4(c * a, a);
}`;

export function fragmentFor(name) {
  if (name === 'hero') return HEAD + HERO;
  if (name === 'rings') return HEAD + RINGS;
  if (name === 'flash') return HEAD + FLASH;
  const scene = SCENES[name] || SCENES.contour;
  return HEAD + scene + CRT_MAIN;
}

export const PRESETS = Object.keys(SCENES);
