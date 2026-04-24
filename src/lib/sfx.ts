"use client";

export type SfxName =
  | "hover"
  | "click"
  | "type"
  | "modal-open"
  | "menu-open"
  | "tick"
  | "tick-metallic"
  | "tick-data"
  | "tick-data-9"
  | "tick-buzz"
  | "cursor-blink";

// Client-side singletons — one AudioContext shared across all sfx callers
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

function masterOut(ac: AudioContext): AudioNode {
  return masterGain || ac.destination;
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
  osc.connect(g).connect(masterOut(ac));
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
  src.connect(hp).connect(g).connect(masterOut(ac));
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
    case "menu-open": {
      // Cyber hover echo: soft sine ping + harmonic shimmer + two decaying echoes.
      tone(1400, 90, "sine", 0.045);
      tone(2400, 55, "triangle", 0.022);
      window.setTimeout(() => tone(1400, 90, "sine", 0.022), 180);
      window.setTimeout(() => tone(1400, 90, "sine", 0.01), 360);
      return;
    }
    case "tick-metallic": {
      tone(800, 40, "sine", 0.09);
      window.setTimeout(() => tone(800, 100, "sine", 0.09), 60);
      return;
    }
    case "tick-data": {
      const now2 = ac.currentTime;
      const osc2 = ac.createOscillator();
      const g2 = ac.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(3000, now2);
      osc2.frequency.exponentialRampToValueAtTime(600, now2 + 0.25);
      g2.gain.setValueAtTime(0.1, now2);
      g2.gain.exponentialRampToValueAtTime(0.0001, now2 + 0.3);
      osc2.connect(g2).connect(masterOut(ac));
      osc2.start(now2);
      osc2.stop(now2 + 0.35);
      return;
    }
    case "tick-data-9": {
      const now2 = ac.currentTime;
      const osc2 = ac.createOscillator();
      const g2 = ac.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(300, now2);
      osc2.frequency.exponentialRampToValueAtTime(2800, now2 + 0.22);
      g2.gain.setValueAtTime(0.08, now2);
      g2.gain.exponentialRampToValueAtTime(0.0001, now2 + 0.28);
      osc2.connect(g2).connect(masterOut(ac));
      osc2.start(now2);
      osc2.stop(now2 + 0.32);
      return;
    }
    case "tick-buzz":
      noiseBurst(10, 0.08, 4000);
      tone(3200, 8, "square", 0.04);
      window.setTimeout(() => noiseBurst(6, 0.04, 5000), 15);
      return;
    case "cursor-blink":
      tone(600, 80, "sine", 0.04);
      return;
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

/** Direct mute sync — call with current mute state for immediate effect. */
export function syncMuteState(isMuted: boolean): void {
  muted = isMuted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  if (ctx) {
    if (muted) void ctx.suspend();
    else void ctx.resume();
  }
}
