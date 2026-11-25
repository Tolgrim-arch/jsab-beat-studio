import { ARCHETYPES } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";
import { generateSongDNA } from "./songDNA.js";

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
  const fps = 60;
  const totalFrames = Math.ceil(duration * fps);
  const hop = Math.floor(sr / fps);

  const frames = new Array(totalFrames);
  let lp1 = 0, lp2 = 0, bp1 = 0, bp2 = 0;
  let prevBass = 0, prevMid = 0, prevHigh = 0;

  for (let f = 0; f < totalFrames; f++) {
    const start = f * hop;
    const end = Math.min(start + hop, ch0.length);
    let sumSq = 0, bassSq = 0, midSq = 0, highSq = 0;
    const count = Math.max(1, end - start);

    for (let i = start; i < end; i += 2) {
      const s = 0.5 * (ch0[i] + ch1[i]);
      lp1 += 0.042 * (s - lp1);
      lp2 += 0.042 * (lp1 - lp2);
      bp1 += 0.24 * (s - bp1);
      bp2 += 0.24 * (bp1 - bp2);
      const low = lp2;
      const mid = bp2 - lp2;
      const high = s - bp2;
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

    prevBass = bass * 0.58 + prevBass * 0.42;
    prevMid = mid * 0.58 + prevMid * 0.42;
    prevHigh = high * 0.58 + prevHigh * 0.42;

    frames[f] = { t: f / fps, rms, bass, mid, high, kickOnset, snareOnset, highOnset, onset: kickOnset * 1.25 + snareOnset * 0.7 };
  }

  const normBand = (key) => {
    const sorted = frames.map(fr => fr[key]).sort((a, b) => a - b);
    const p97 = sorted[Math.floor(sorted.length * 0.97)] || 0.001;
    for (const fr of frames) fr[key] = Utils.clamp(fr[key] / p97, 0, 1.4);
  };
  ["rms", "bass", "mid", "high", "kickOnset", "snareOnset", "highOnset", "onset"].forEach(normBand);

  // Adaptive Local Thresholding for sharp real peak detection
  const winHalf = Math.floor(fps * 0.25);
  const realPeaks = [];
  for (let f = 2; f < frames.length - 2; f++) {
    let sum = 0, cnt = 0;
    for (let k = Math.max(0, f - winHalf); k <= Math.min(frames.length - 1, f + winHalf); k++) {
      sum += frames[k].onset;
      cnt++;
    }
    const localMean = sum / cnt;
    const cur = frames[f].onset;
    if (cur > localMean * 1.45 && cur > 0.16 && cur >= frames[f - 1].onset && cur >= frames[f + 1].onset) {
      realPeaks.push(frames[f].t);
    }
  }

  // BPM via autocorrelation
  const onsets = frames.map(fr => fr.onset);
  let bestLag = Math.floor(fps * 0.46), bestCorr = -1;
  const minLag = Math.floor((fps * 60) / 185);
  const maxLag = Math.floor((fps * 60) / 72);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < onsets.length - lag; i++) corr += onsets[i] * onsets[i + lag];
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  const bpm = Math.round((60 * fps) / bestLag);
  const beatDur = 60 / bpm;

  // Exact Beat Phase Alignment
  let bestOffset = 0, bestPhaseScore = -1;
  const phaseSteps = 24;
  for (let p = 0; p < phaseSteps; p++) {
    const off = (p / phaseSteps) * beatDur;
    let score = 0;
    for (let t = off; t < duration; t += beatDur) {
      const fIdx = Utils.clamp(Math.floor(t * fps), 0, frames.length - 1);
      score += frames[fIdx].onset + frames[fIdx].kickOnset * 0.6;
    }
    if (score > bestPhaseScore) { bestPhaseScore = score; bestOffset = off; }
  }

  // Build phase-aligned beat grid, snapping each beat to nearest real audio peak within ±75ms
  const beats = [];
  let peakPtr = 0;
  for (let t = bestOffset; t < duration - 0.25; t += beatDur) {
    if (t < 0.2) continue;
    while (peakPtr < realPeaks.length && realPeaks[peakPtr] < t - 0.075) peakPtr++;
    let snappedT = t;
    if (peakPtr < realPeaks.length && Math.abs(realPeaks[peakPtr] - t) <= 0.075) {
      snappedT = realPeaks[peakPtr];
    }

    const fIdx = Utils.clamp(Math.floor(snappedT * fps), 0, frames.length - 1);
    const fr = frames[fIdx];
    beats.push({
      t: snappedT, bass: fr.bass, mid: fr.mid, high: fr.high, rms: fr.rms,
      isSilent: fr.rms < 0.08,
      isKick: fr.kickOnset > 0.22 || fr.bass > 0.5,
      isSnare: fr.snareOnset > 0.24,
      isSyncopated: false
    });

    const halfT = snappedT + beatDur * 0.5;
    if (halfT < duration - 0.25) {
      const hIdx = Utils.clamp(Math.floor(halfT * fps), 0, frames.length - 1);
      const hFr = frames[hIdx];
      if (hFr.rms > 0.2 && (hFr.snareOnset > 0.52 || hFr.highOnset > 0.62)) {
        beats.push({
          t: halfT, bass: hFr.bass, mid: hFr.mid, high: hFr.high, rms: hFr.rms,
          isSilent: false, isKick: false, isSnare: true, isSyncopated: true
        });
      }
    }
  }
  beats.sort((a, b) => a.t - b.t);

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
    if (energy < 0.09) type = "SILENCE";
    else if (prog < 0.1) type = "INTRO";
    else if (prog > 0.88) type = "OUTRO";
    else if (energy > avgRms * 1.18) type = "DROP";
    else if (energy > prevEnergy * 1.12 && energy < avgRms * 1.18) type = "BUILDUP";
    else if (energy < avgRms * 0.72) type = "BREAKDOWN";

    sections.push({ start: s, end: e, energy, type });
  }

  const baseAnalysis = { frames, fps, bpm, beatDur, bestOffset, beats, sections, archetype, profile: { avgBass, avgHigh, avgRms } };
  baseAnalysis.dna = generateSongDNA(baseAnalysis, duration);
  return baseAnalysis;
}
