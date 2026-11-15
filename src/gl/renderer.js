import { VERT, fragmentFor } from './shaders.js';

/**
 * One WebGL2 context for the whole page.
 * Each "view" is bound to a DOM element; every frame we read its rect and
 * draw its fragment shader into that region of a fixed, full-viewport canvas
 * (viewport + scissor). Off-screen views cost nothing.
 */
export class Stage {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.canvas = canvas;
    this.gl = gl;
    this.views = [];
    this.programs = new Map();
    this.timeScale = 1;
    this.time = 0;
    this.mouse = { x: -9999, y: -9999, vx: 0, vy: 0, lastMove: -1e9, inside: false };

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.blank = this.texture();
    this.resize();
  }

  compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(log);
    }
    return s;
  }

  program(name) {
    if (this.programs.has(name)) return this.programs.get(name);
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fragmentFor(name)));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const prog = { p, loc: new Map() };
    this.programs.set(name, prog);
    return prog;
  }

  loc(prog, name) {
    if (!prog.loc.has(name)) prog.loc.set(name, this.gl.getUniformLocation(prog.p, name));
    return prog.loc.get(name);
  }

  texture(source) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source) this.upload(t, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  }

  upload(t, source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /**
   * view = { el, name, uniforms?(set), textures?: {uText: tex}, auto?: fn(t)->{x,y}, fullscreen?, seed?, thumb? }
   */
  add(view) {
    this.program(view.name); // compile eagerly so errors surface at boot
    Object.assign(view, { hover: 0, mx: 0.5, my: 0.5, seed: view.seed ?? Math.random() * 10 });
    this.views.push(view);
    return view;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
  }

  pointer(x, y) {
    const m = this.mouse;
    if (m.x > -9000) {
      m.vx = m.vx * 0.6 + (x - m.x) * 0.4;
      m.vy = m.vy * 0.6 + (y - m.y) * 0.4;
    }
    m.x = x;
    m.y = y;
    m.lastMove = performance.now();
    m.inside = true;
  }

  render(dt) {
    const { gl, dpr, vw, vh, mouse } = this;
    this.time += dt * this.timeScale;
    mouse.vx *= 0.9;
    mouse.vy *= 0.9;

    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.bindVertexArray(this.vao);

    const now = performance.now();
    const idle = now - mouse.lastMove > 2600 || !mouse.inside;

    for (const v of this.views) {
      if (v.enabled === false) continue;
      const r = v.fullscreen ? { left: 0, top: 0, right: vw, bottom: vh, width: vw, height: vh } : v.el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw || r.width < 2 || r.height < 2) {
        v.visible = false;
        continue;
      }
      if (v.skip && v.skip()) continue;
      v.visible = true;

      const x = Math.round(r.left * dpr);
      const y = Math.round((vh - r.bottom) * dpr);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);

      // pointer → view-local
      const hr = v.hoverEl ? v.hoverEl.getBoundingClientRect() : r;
      const inside = mouse.inside && mouse.x >= hr.left && mouse.x <= hr.right && mouse.y >= hr.top && mouse.y <= hr.bottom;
      let tx = (mouse.x - r.left) / r.width;
      let ty = 1 - (mouse.y - r.top) / r.height;
      if (v.auto && (idle || !inside)) {
        const a = v.auto(this.time);
        tx = a.x;
        ty = a.y;
      }
      const follow = inside || v.auto ? 0.12 : 0.02;
      v.mx += (tx - v.mx) * follow;
      v.my += (ty - v.my) * follow;
      v.hover += ((inside ? 1 : 0) - v.hover) * 0.08;

      const prog = this.program(v.name);
      gl.useProgram(prog.p);
      gl.viewport(x, y, w, h);
      gl.scissor(x, y, w, h);

      const L = (n) => this.loc(prog, n);
      gl.uniform2f(L('uRes'), w, h);
      gl.uniform2f(L('uOrigin'), x, y);
      gl.uniform1f(L('uTime'), this.time + v.seed * 3);
      gl.uniform2f(L('uMouse'), v.mx, v.my);
      gl.uniform1f(L('uHover'), v.forceHover ?? v.hover);
      gl.uniform1f(L('uDpr'), dpr);
      gl.uniform1f(L('uSeed'), v.seed);
      gl.uniform1f(L('uThumb'), v.thumb ? 1 : 0);
      gl.uniform2f(L('uVel'), mouse.vx / 40, mouse.vy / 40);

      let unit = 0;
      if (v.textures) {
        for (const [name, tex] of Object.entries(v.textures)) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, tex || this.blank);
          gl.uniform1i(L(name), unit++);
        }
      }
      if (v.uniforms) v.uniforms((name, ...vals) => gl[`uniform${vals.length}f`](L(name), ...vals));

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
}
