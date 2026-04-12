export type SfxName =
  | "hover"
  | "click"
  | "type"
  | "modal-open"
  | "tick"
  | "tick-metallic"
  | "tick-data"
  | "tick-buzz"
  | "cursor-blink";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) {
    if (ctx.state === "suspended" && !muted) void ctx.resume().catch(() => {});
    return ctx;
  }
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(ctx.destination);

  return ctx;
}

function masterOut(): AudioNode {
  return masterGain || getCtx()!.destination;
}

function tone(
  freq: number,
  durMs: number,
  type: OscillatorType,
  gain: number,
): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  osc.connect(g).connect(masterOut());
  osc.start(now);
  osc.stop(now + durMs / 1000 + 0.02);
}

function noiseBurst(durMs: number, gain: number, highpass = 1800): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const frames = Math.floor((ac.sampleRate * durMs) / 1000);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = highpass;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  src.connect(hp).connect(g).connect(masterOut());
  src.start(now);
  src.stop(now + durMs / 1000 + 0.02);
}

export function playSfx(name: SfxName): void {
  if (typeof window === "undefined") return;
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;

  switch (name) {
    case "hover":
      tone(880, 60, "triangle", 0.05);
      return;
    case "click":
      tone(440, 90, "square", 0.08);
      return;
    case "type":
      noiseBurst(6, 0.05, 6000);
      tone(4000, 4, "sine", 0.02);
      return;
    case "tick":
      noiseBurst(22, 0.06, 2400);
      tone(1600, 28, "square", 0.03);
      return;
    case "modal-open":
      tone(220, 120, "sawtooth", 0.06);
      window.setTimeout(() => tone(330, 140, "sawtooth", 0.05), 60);
      return;
    case "tick-metallic": {
      // Morse code — dit-dah pattern, 800Hz CW tone
      tone(800, 40, "sine", 0.09);
      window.setTimeout(() => tone(800, 100, "sine", 0.09), 60);
      return;
    }
    case "tick-data": {
      // Radar sweep ping — sine that drops with long tail
      const ac2 = getCtx()!;
      const now2 = ac2.currentTime;
      const osc2 = ac2.createOscillator();
      const g2 = ac2.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(3000, now2);
      osc2.frequency.exponentialRampToValueAtTime(600, now2 + 0.25);
      g2.gain.setValueAtTime(0.1, now2);
      g2.gain.exponentialRampToValueAtTime(0.0001, now2 + 0.3);
      osc2.connect(g2).connect(masterOut());
      osc2.start(now2);
      osc2.stop(now2 + 0.35);
      return;
    }
    case "tick-buzz":
      // Hacker terminal — fast noisy keypress + CRT blip
      noiseBurst(10, 0.08, 4000);
      tone(3200, 8, "square", 0.04);
      window.setTimeout(() => noiseBurst(6, 0.04, 5000), 15);
      return;
    case "cursor-blink":
      // Soft sonar ping — gentle sine blip
      tone(600, 80, "sine", 0.04);
      return;
  }
}

/** Retro terminal — steady square wave beep-stream, C64 loading feel. Returns stop fn. */
export function startDecryptSound(): (() => void) | null {
  if (typeof window === "undefined") return null;
  if (muted) return null;
  const ac = getCtx();
  if (!ac) return null;
  if (ac.state === "suspended") void ac.resume().catch(() => {});

  const now = ac.currentTime;
  const dur = 3;

  // Primary square wave — steady pulsing tone like a C64 tape loader
  const osc = ac.createOscillator();
  osc.type = "square";
  // Alternates between two pitches at ~12Hz — the classic loading warble
  const pulseRate = 0.08;
  for (let t = 0; t < dur; t += pulseRate) {
    osc.frequency.setValueAtTime(1200, now + t);
    osc.frequency.setValueAtTime(2400, now + t + pulseRate / 2);
  }

  // Second square at lower freq — the bass pulse underneath
  const osc2 = ac.createOscillator();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(150, now);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.015, now);

  // Rhythmic gating — on/off pattern to create the "data burst" cadence
  const gate = ac.createGain();
  const burstLen = 0.04;
  for (let t = 0; t < dur; t += burstLen) {
    // ~85% on, short silent gaps
    gate.gain.setValueAtTime(Math.random() > 0.15 ? 1 : 0, now + t);
  }

  const master = ac.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.035, now + 0.03);

  osc.connect(gate).connect(master).connect(masterOut());
  osc2.connect(g2).connect(master);
  osc.start(now);
  osc2.start(now);

  return () => {
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(0, t);
    try { osc.stop(t + 0.02); } catch { /* already stopped */ }
    try { osc2.stop(t + 0.02); } catch { /* already stopped */ }
  };
}

/** GBA-style glitch — tiny looping buffers with stutter gating. Returns stop fn. */
export function startGlitchSound(): (() => void) | null {
  if (typeof window === "undefined") return null;
  if (muted) return null;
  const ac = getCtx();
  if (!ac) return null;
  if (ac.state === "suspended") void ac.resume().catch(() => {});

  const now = ac.currentTime;

  // Tiny looping buffer — simulates GBA crashed audio channel
  const bufLen1 = 128; // loops at ~344 Hz
  const buf1 = ac.createBuffer(1, bufLen1, ac.sampleRate);
  const d1 = buf1.getChannelData(0);
  for (let i = 0; i < bufLen1; i++) {
    d1[i] = i < bufLen1 / 2 ? 0.8 : -0.8;
    if (Math.random() < 0.15) d1[i] *= Math.random(); // corruption
  }
  const src1 = ac.createBufferSource();
  src1.buffer = buf1;
  src1.loop = true;

  // Second tiny buffer at different pitch — dual-channel GBA feel
  const bufLen2 = 96; // loops at ~459 Hz
  const buf2 = ac.createBuffer(1, bufLen2, ac.sampleRate);
  const d2 = buf2.getChannelData(0);
  for (let i = 0; i < bufLen2; i++) {
    d2[i] = i < bufLen2 / 3 ? 0.6 : -0.6;
    if (Math.random() < 0.2) d2[i] = 0;
  }
  const src2 = ac.createBufferSource();
  src2.buffer = buf2;
  src2.loop = true;
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.5, now);

  // Hard-clip waveshaper — crunchy digital character
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 128 - 1;
    curve[i] = Math.max(-0.7, Math.min(0.7, x * 4));
  }
  shaper.curve = curve;

  // Electronic fuzz layer — highpassed noise through distortion
  const fuzzLen = Math.floor(ac.sampleRate * 0.8);
  const fuzzBuf = ac.createBuffer(1, fuzzLen, ac.sampleRate);
  const fuzzData = fuzzBuf.getChannelData(0);
  for (let i = 0; i < fuzzLen; i++) fuzzData[i] = Math.random() * 2 - 1;
  const fuzzSrc = ac.createBufferSource();
  fuzzSrc.buffer = fuzzBuf;
  fuzzSrc.loop = true;
  const fuzzHp = ac.createBiquadFilter();
  fuzzHp.type = "highpass";
  fuzzHp.frequency.setValueAtTime(1200, now);
  const fuzzShaper = ac.createWaveShaper();
  const fuzzCurve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 128 - 1;
    fuzzCurve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.3);
  }
  fuzzShaper.curve = fuzzCurve;
  const fuzzGain = ac.createGain();
  fuzzGain.gain.setValueAtTime(0.03, now);

  // Stutter gate — rapid on/off for that GBA buffer-repeat feel
  const gate = ac.createGain();
  for (let t = 0; t < 1; t += 0.03) {
    gate.gain.setValueAtTime(Math.random() > 0.2 ? 1 : 0, now + t);
  }

  const master = ac.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.05, now + 0.02);

  src1.connect(shaper);
  src2.connect(g2).connect(shaper);
  shaper.connect(gate).connect(master).connect(masterOut());
  fuzzSrc.connect(fuzzHp).connect(fuzzShaper).connect(fuzzGain).connect(master);
  src1.start(now);
  src2.start(now);
  fuzzSrc.start(now);

  return () => {
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    try { src1.stop(t + 0.1); } catch { /* already stopped */ }
    try { src2.stop(t + 0.1); } catch { /* already stopped */ }
    try { fuzzSrc.stop(t + 0.1); } catch { /* already stopped */ }
  };
}

/** Direct mute sync — call with current mute state for immediate effect. */
export function syncMuteState(isMuted: boolean): void {
  muted = isMuted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  if (ctx && muted) void ctx.suspend();
}

export function preloadSfx(): void {
  getCtx();
}
