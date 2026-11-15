/**
 * Optional sound, generated live with WebAudio (no audio files).
 * Off by default. Static rises when you scroll fast, a soft hum underneath,
 * bursts of noise between stations and tiny blips on hover.
 */
export class Radio {
  constructor() {
    this.on = false;
    this.ctx = null;
  }

  setup() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // pinkish noise loop
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 0.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 1800;
    this.filter.Q.value = 0.8;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.015;
    src.connect(this.filter).connect(this.noiseGain).connect(this.master);
    src.start();

    // hum
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 55;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.05;
    hum.connect(humGain).connect(this.master);
    hum.start();
    return true;
  }

  toggle() {
    if (!this.ctx && !this.setup()) return false;
    this.on = !this.on;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, t, 0.15);
    return this.on;
  }

  velocity(v) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const a = Math.min(1, Math.abs(v) / 40);
    this.noiseGain.gain.setTargetAtTime(0.015 + a * 0.12, t, 0.08);
    this.filter.frequency.setTargetAtTime(1200 + a * 2600, t, 0.1);
  }

  burst() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const g = this.noiseGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.22, t);
    g.exponentialRampToValueAtTime(0.015, t + 0.4);
  }

  blip(freq = 1320) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.08);
  }
}
