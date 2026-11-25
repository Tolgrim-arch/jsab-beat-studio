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
  const fps = 100; // 10ms precision for ultra-tight beat sync
  const totalFrames = Math.ceil(duration * fps);
  const hop = Math.floor(sr / fps);

  const frames = new Array(totalFrames);
  let lpSub = 0, lp1 = 0, lp2 = 0, bpLowMid = 0, bp1 = 0, bp2 = 0, hp1 = 0;
  let prevBass = 0, prevMid = 0, prevHigh = 0;

  for (let f = 0; f < totalFrames; f++) {
    const start = f * hop;
    const end = Math.min(start + hop, ch0.length);
    let sumSq = 0, subSq = 0, bassSq = 0, lowMidSq = 0, midSq = 0, highSq = 0;
    let zc = 0, prevS = 0;
    const count = Math.max(1, end - start);

    for (let i = start; i < end; i++) {
      const s = 0.5 * (ch0[i] + ch1[i]);
      if (i > start && ((s >= 0 && prevS < 0) || (s < 0 && prevS >= 0))) zc++;
      prevS = s;

      lpSub += 0.012 * (s - lpSub);
      lp1 += 0.036 * (s - lp1);
      lp2 += 0.036 * (lp1 - lp2);
      bpLowMid += 0.11 * (s - bpLowMid);
      bp1 += 0.24 * (s - bp1);
      bp2 += 0.24 * (bp1 - bp2);
      hp1 += 0.55 * (s - hp1);

      const sub = lpSub;
      const low = lp2;
      const lowMid = bpLowMid - lp2;
      const mid = bp2 - bpLowMid;
      const high = s - hp1;

      sumSq += s * s;
      subSq += sub * sub;
      bassSq += low * low;
      lowMidSq += lowMid * lowMid;
      midSq += mid * mid;
      highSq += high * high;
    }

    const rms = Math.sqrt(sumSq / count);
    const sub = Math.sqrt(subSq / count);
    const bass = Math.sqrt(bassSq / count);
    const lowMid = Math.sqrt(lowMidSq / count);
    const mid = Math.sqrt(midSq / count);
    const high = Math.sqrt(highSq / count);
    const zcr = zc / count;

    // Multi-band spectral flux (half-wave rectified positive energy derivatives)
    const kickOnset = Math.max(0, bass - prevBass);
    const snareOnset = Math.max(0, mid - prevMid);
    const highOnset = Math.max(0, high - prevHigh);

    prevBass = bass * 0.52 + prevBass * 0.48;
    prevMid = mid * 0.52 + prevMid * 0.48;
    prevHigh = high * 0.52 + prevHigh * 0.48;

    const flux = kickOnset * 1.45 + snareOnset * 0.9 + highOnset * 0.45;
    frames[f] = { t: f / fps, rms, sub, bass, lowMid, mid, high, zcr, kickOnset, snareOnset, highOnset, onset: flux };
  }

  const normBand = (key) => {
    const sorted = frames.map(fr => fr[key]).sort((a, b) => a - b);
    const p97 = sorted[Math.floor(sorted.length * 0.97)] || 0.001;
    for (const fr of frames) fr[key] = Utils.clamp(fr[key] / p97, 0, 1.4);
  };
  ["rms", "sub", "bass", "lowMid", "mid", "high", "zcr", "kickOnset", "snareOnset", "highOnset", "onset"].forEach(normBand);

  // Adaptive Local Thresholding (detect EVERY real musical impact peak)
  const winHalf = Math.floor(fps * 0.22);
  const realPeaks = [];
  let lastPeakT = -1;
  for (let f = 2; f < frames.length - 2; f++) {
    let sum = 0, cnt = 0;
    for (let k = Math.max(0, f - winHalf); k <= Math.min(frames.length - 1, f + winHalf); k++) {
      sum += frames[k].onset;
      cnt++;
    }
    const localMean = sum / cnt;
    const cur = frames[f].onset;
    if (
      cur > localMean * 1.35 &&
      cur > 0.13 &&
      cur >= frames[f - 1].onset &&
      cur >= frames[f + 1].onset &&
      frames[f].t - lastPeakT >= 0.14
    ) {
      realPeaks.push({ t: frames[f].t, strength: cur, frame: frames[f] });
      lastPeakT = frames[f].t;
    }
  }

  // BPM via autocorrelation on 100fps onset flux
  const onsets = frames.map(fr => fr.onset);
  let bestLag = Math.floor(fps * 0.46), bestCorr = -1;
  const minLag = Math.floor((fps * 60) / 185);
  const maxLag = Math.floor((fps * 60) / 72);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < onsets.length - lag; i += 2) corr += onsets[i] * onsets[i + lag];
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  const bpm = Math.round((60 * fps) / bestLag);
  const beatDur = 60 / bpm;

  // Exact Beat Phase Alignment (32 phase steps)
  let bestOffset = 0, bestPhaseScore = -1;
  const phaseSteps = 32;
  for (let p = 0; p < phaseSteps; p++) {
    const off = (p / phaseSteps) * beatDur;
    let score = 0;
    for (let t = off; t < duration; t += beatDur) {
      const fIdx = Utils.clamp(Math.floor(t * fps), 0, frames.length - 1);
      score += frames[fIdx].onset + frames[fIdx].kickOnset * 0.7;
    }
    if (score > bestPhaseScore) { bestPhaseScore = score; bestOffset = off; }
  }

  // Merge phase-aligned grid (snapped to real peaks within ±85ms) + extra strong real peaks
  const beats = [];
  const usedPeakIdx = new Set();
  for (let t = bestOffset; t < duration - 0.2; t += beatDur) {
    if (t < 0.15) continue;
    let bestP = -1, bestDist = 0.085;
    for (let p = 0; p < realPeaks.length; p++) {
      const d = Math.abs(realPeaks[p].t - t);
      if (d < bestDist) { bestDist = d; bestP = p; }
    }
    const snappedT = bestP !== -1 ? realPeaks[bestP].t : t;
    if (bestP !== -1) usedPeakIdx.add(bestP);

    const fIdx = Utils.clamp(Math.floor(snappedT * fps), 0, frames.length - 1);
    const fr = frames[fIdx];
    beats.push({
      t: snappedT, bass: fr.bass, mid: fr.mid, high: fr.high, rms: fr.rms,
      isSilent: fr.rms < 0.07,
      isKick: fr.kickOnset > 0.2 || fr.bass > 0.48,
      isSnare: fr.snareOnset > 0.22,
      isSyncopated: false
    });
  }

  // Add any remaining strong real musical impacts (fills, drops, syncopated kicks) so NO beat is missed!
  for (let p = 0; p < realPeaks.length; p++) {
    if (usedPeakIdx.has(p)) continue;
    const pk = realPeaks[p];
    if (pk.strength > 0.52 && pk.frame.rms > 0.16) {
      beats.push({
        t: pk.t, bass: pk.frame.bass, mid: pk.frame.mid, high: pk.frame.high, rms: pk.frame.rms,
        isSilent: false, isKick: pk.frame.kickOnset > 0.28, isSnare: true, isSyncopated: true
      });
    }
  }
  beats.sort((a, b) => a.t - b.t);

  const avgBass = frames.reduce((s, f) => s + f.bass, 0) / frames.length;
  const avgHigh = frames.reduce((s, f) => s + f.high, 0) / frames.length;
  const avgRms = frames.reduce((s, f) => s + f.rms, 0) / frames.length;
  const avgPeakRate = realPeaks.length / Math.max(1, duration);

  let archetype = ARCHETYPES.CLOCKWORK_SYNTH;
  if (bpm >= 140 && avgHigh >= avgBass * 0.7) archetype = ARCHETYPES.HYPER_BARRAGE;
  else if (avgBass > avgHigh * 1.18) archetype = ARCHETYPES.TITAN_CRUSHER;
  else if (bpm < 108) archetype = ARCHETYPES.ABYSSAL_ECLIPSE;

  // Fine-grained 4-beat section windows for fast instrument & rhythm change detection
  const secWin = beatDur * 4;
  const sections = [];
  for (let s = 0; s < duration; s += secWin) {
    const e = Math.min(duration, s + secWin);
    const fStart = Math.floor(s * fps);
    const fEnd = Math.min(frames.length, Math.floor(e * fps));
    const slice = frames.slice(fStart, Math.max(fStart + 1, fEnd));
    const lenS = Math.max(1, slice.length);

    const energy = slice.reduce((acc, x) => acc + x.rms, 0) / lenS;
    const sSub = slice.reduce((acc, x) => acc + x.sub, 0) / lenS;
    const sBass = slice.reduce((acc, x) => acc + x.bass, 0) / lenS;
    const sLowMid = slice.reduce((acc, x) => acc + x.lowMid, 0) / lenS;
    const sMid = slice.reduce((acc, x) => acc + x.mid, 0) / lenS;
    const sHigh = slice.reduce((acc, x) => acc + x.high, 0) / lenS;
    const sZcr = slice.reduce((acc, x) => acc + x.zcr, 0) / lenS;

    const localPeaks = realPeaks.filter(p => p.t >= s && p.t < e).length;
    const localRate = localPeaks / Math.max(0.25, e - s);
    const rhythmRatio = localRate / Math.max(0.1, avgPeakRate);
    const rhythm = rhythmRatio > 1.32 ? "DOUBLE_TIME" : rhythmRatio < 0.68 ? "HALF_TIME" : "NORMAL";

    // Dominant instrument / timbre classification
    let instrument = "SYNTH_LEAD";
    if (sSub > 0.55 && sBass > sMid * 1.08 && sBass > sHigh * 1.1) instrument = "SUB_BASS";
    else if (sHigh > sBass * 1.05 && rhythm === "DOUBLE_TIME") instrument = "ARP_HYPER";
    else if (sZcr > 0.52 && (sMid > 0.38 || sHigh > 0.38)) instrument = "PERCUSSION";
    else if (sLowMid >= sMid * 0.92 && sLowMid >= sHigh && sZcr < 0.45) instrument = "MELODIC_PAD";

    const prevEnergy = sections.length > 0 ? sections[sections.length - 1].energy : energy;
    const prog = s / duration;

    let type = "VERSE";
    if (energy < 0.08) type = "SILENCE";
    else if (prog < 0.08) type = "INTRO";
    else if (prog > 0.90) type = "OUTRO";
    else if (energy > avgRms * 1.15) type = "DROP";
    else if (energy > prevEnergy * 1.12 && energy < avgRms * 1.15) type = "BUILDUP";
    else if (energy < avgRms * 0.72) type = "BREAKDOWN";

    sections.push({ start: s, end: e, energy, type, instrument, rhythm });
  }

  const baseAnalysis = { frames, fps, bpm, beatDur, bestOffset, beats, sections, archetype, profile: { avgBass, avgHigh, avgRms } };
  baseAnalysis.dna = generateSongDNA(baseAnalysis, duration);
  return baseAnalysis;
}
