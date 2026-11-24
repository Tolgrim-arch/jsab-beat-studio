import { ARCHETYPES } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";

export function ensureAudioContext() {
  if (!state.audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AC();
    state.mediaDest = state.audioCtx.createMediaStreamDestination();
  }
  if (state.audioCtx.state === "suspended") state.audioCtx.resume();
  return state.audioCtx;
}

export function generateDemoTrack(presetKey) {
  const ac = ensureAudioContext();
  const presets = {
    titan:     { bpm: 128, duration: 56, bassWeight: 1.0, highWeight: 0.28, title: "Annihilate — Titan Crusher (128 BPM)" },
    barracuda: { bpm: 168, duration: 52, bassWeight: 0.55, highWeight: 0.95, title: "Barracuda — Hyper Rush (168 BPM)" },
    closetome: { bpm: 116, duration: 56, bassWeight: 0.65, highWeight: 0.65, title: "Close To Me — Clockwork Synth (116 BPM)" }
  };
  const cfg = presets[presetKey] || presets.titan;
  const sr = ac.sampleRate;
  const len = Math.floor(sr * cfg.duration);
  const buffer = ac.createBuffer(2, len, sr);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);

  const beatDur = 60 / cfg.bpm;
  let seed = 4242;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 1073741823.5) - 1;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const prog = t / cfg.duration;
    const beatPos = (t % beatDur) / beatDur;
    const barIdx = Math.floor(t / (beatDur * 4));

    const isBuildup = (prog > 0.18 && prog <= 0.25) || (prog > 0.58 && prog <= 0.65);
    const isDrop = (prog > 0.25 && prog <= 0.48) || (prog > 0.65 && prog <= 0.90);
    const isBreak = (prog > 0.48 && prog <= 0.58);

    let kick = 0;
    if (!isBreak && prog > 0.04 && prog < 0.95) {
      const kickEnv = Math.exp(-beatPos * (isDrop ? 11 : 16));
      const kFreq = 44 + 125 * Math.exp(-beatPos * 28);
      kick = Math.sin(2 * Math.PI * kFreq * t) * kickEnv * (isDrop ? 1.0 : 0.65) * cfg.bassWeight;
    }

    let mid = 0;
    if (isDrop && (Math.floor(t / beatDur) % 2 === 1)) {
      mid = (Math.sin(2 * Math.PI * 185 * t) + noise() * 0.7) * Math.exp(-beatPos * 14) * 0.45;
    }
    if (isBuildup) {
      const accel = Math.floor(t / (beatDur / (prog > 0.62 ? 4 : 2)));
      const subPos = (t % (beatDur / 2)) / (beatDur / 2);
      mid += noise() * Math.exp(-subPos * 16) * 0.35 * ((accel % 2) + 0.5);
    }

    const scale = presetKey === "closetome" ? [261.6, 311.1, 392, 466.2, 523.2] : [220, 261.6, 329.6, 392, 440, 587.3];
    const step = Math.floor(t / (beatDur / (presetKey === "barracuda" ? 4 : 2)));
    const fLead = scale[(step * 3 + barIdx) % scale.length] * (isDrop ? 2 : 1);
    const leadEnv = Math.exp(-((t % (beatDur / 2)) / (beatDur / 2)) * 4.0);
    const lead = (Math.sin(2 * Math.PI * fLead * t) + 0.5 * Math.sin(4 * Math.PI * fLead * t)) * leadEnv * cfg.highWeight * (isDrop ? 0.38 : 0.22);

    const mix = (kick + mid + lead) * 0.62;
    L[i] = Utils.clamp(mix, -0.95, 0.95);
    R[i] = Utils.clamp(mix * 0.97 + lead * 0.08, -0.95, 0.95);
  }

  return { buffer, title: cfg.title };
}

export function analyzeAudioBuffer(audioBuffer) {
  const sr = audioBuffer.sampleRate;
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
  const duration = audioBuffer.duration;
  const fps = 30;
  const totalFrames = Math.ceil(duration * fps);
  const hop = Math.floor(sr / fps);

  const frames = new Array(totalFrames);
  let lp = 0, bp = 0;
  let prevBass = 0, prevMid = 0, prevHigh = 0;

  for (let f = 0; f < totalFrames; f++) {
    const start = f * hop;
    const end = Math.min(start + hop, ch0.length);
    let sumSq = 0, bassSq = 0, midSq = 0, highSq = 0;
    const count = Math.max(1, end - start);

    for (let i = start; i < end; i += 2) {
      const s = 0.5 * (ch0[i] + ch1[i]);
      lp += 0.038 * (s - lp);
      bp += 0.22 * (s - bp);
      const low = lp;
      const mid = bp - lp;
      const high = s - bp;
      sumSq += s * s;
      bassSq += low * low;
      midSq += mid * mid;
      highSq += high * high;
    }

    const n = Math.max(1, count / 2);
    const rms = Math.sqrt(sumSq / n);
    const bass = Math.sqrt(bassSq / n);
    const mid = Math.sqrt(midSq / n);
    const high = Math.sqrt(highSq / n);

    const kickOnset = Math.max(0, bass - prevBass);
    const snareOnset = Math.max(0, mid - prevMid);
    const highOnset = Math.max(0, high - prevHigh);

    prevBass = bass * 0.65 + prevBass * 0.35;
    prevMid = mid * 0.65 + prevMid * 0.35;
    prevHigh = high * 0.65 + prevHigh * 0.35;

    frames[f] = { t: f / fps, rms, bass, mid, high, kickOnset, snareOnset, highOnset, onset: kickOnset + snareOnset * 0.6 };
  }

  const normBand = (key) => {
    const sorted = frames.map(fr => fr[key]).sort((a, b) => a - b);
    const p97 = sorted[Math.floor(sorted.length * 0.97)] || 0.001;
    for (const fr of frames) fr[key] = Utils.clamp(fr[key] / p97, 0, 1.4);
  };
  ["rms", "bass", "mid", "high", "kickOnset", "snareOnset", "highOnset", "onset"].forEach(normBand);

  const onsets = frames.map(fr => fr.onset);
  let bestLag = 14, bestCorr = -1;
  const minLag = Math.floor((fps * 60) / 185);
  const maxLag = Math.floor((fps * 60) / 72);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < onsets.length - lag; i++) corr += onsets[i] * onsets[i + lag];
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  const bpm = Math.round((60 * fps) / bestLag);
  const beatDur = 60 / bpm;

  const beats = [];
  for (let t = 0.4; t < duration - 0.3; t += beatDur) {
    const fIdx = Utils.clamp(Math.floor(t * fps), 0, frames.length - 1);
    const fr = frames[fIdx];
    beats.push({
      t, bass: fr.bass, mid: fr.mid, high: fr.high, rms: fr.rms,
      isKick: fr.kickOnset > 0.25 || fr.bass > 0.55,
      isSnare: fr.snareOnset > 0.28
    });
  }

  const avgBass = frames.reduce((s, f) => s + f.bass, 0) / frames.length;
  const avgHigh = frames.reduce((s, f) => s + f.high, 0) / frames.length;
  const avgRms = frames.reduce((s, f) => s + f.rms, 0) / frames.length;

  let archetype = ARCHETYPES.CLOCKWORK_SYNTH;
  if (bpm >= 140 && avgHigh >= avgBass * 0.7) archetype = ARCHETYPES.HYPER_BARRAGE;
  else if (avgBass > avgHigh * 1.18) archetype = ARCHETYPES.TITAN_CRUSHER;
  else if (bpm < 108) archetype = ARCHETYPES.ABYSSAL_ECLIPSE;

  const secWin = beatDur * 8;
  const sections = [];
  for (let s = 0; s < duration; s += secWin) {
    const e = Math.min(duration, s + secWin);
    const fStart = Math.floor(s * fps);
    const fEnd = Math.min(frames.length, Math.floor(e * fps));
    const slice = frames.slice(fStart, Math.max(fStart + 1, fEnd));
    const energy = slice.reduce((acc, x) => acc + x.rms, 0) / slice.length;
    const prevEnergy = sections.length > 0 ? sections[sections.length - 1].energy : energy;
    const prog = s / duration;

    let type = "VERSE";
    if (prog < 0.1) type = "INTRO";
    else if (prog > 0.88) type = "OUTRO";
    else if (energy > avgRms * 1.18) type = "DROP";
    else if (energy > prevEnergy * 1.12 && energy < avgRms * 1.18) type = "BUILDUP";
    else if (energy < avgRms * 0.72) type = "BREAKDOWN";

    sections.push({ start: s, end: e, energy, type });
  }

  return { frames, fps, bpm, beatDur, beats, sections, archetype, profile: { avgBass, avgHigh, avgRms } };
}
