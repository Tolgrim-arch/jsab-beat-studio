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
    const totSpec = Math.max(0.0001, sub + bass + lowMid + mid + high);
    const brightness = (mid * 0.45 + high * 0.95) / totSpec;
    const melodicTot = Math.max(0.0001, lowMid + mid + high);
    const pitchHeight = Utils.clamp((lowMid * 0.15 + mid * 0.55 + high * 1.0) / melodicTot, 0, 1);
    const tension = zcr * 0.55 + (snareOnset + highOnset) * 0.45;
    frames[f] = { t: f / fps, rms, sub, bass, lowMid, mid, high, zcr, brightness, pitchHeight, tension, kickOnset, snareOnset, highOnset, onset: flux };
  }

  const normBand = (key) => {
    const sorted = frames.map(fr => fr[key]).sort((a, b) => a - b);
    const p97 = sorted[Math.floor(sorted.length * 0.97)] || 0.001;
    for (const fr of frames) fr[key] = Utils.clamp(fr[key] / p97, 0, 1.4);
  };
  ["rms", "sub", "bass", "lowMid", "mid", "high", "zcr", "brightness", "tension", "kickOnset", "snareOnset", "highOnset", "onset"].forEach(normBand);

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

  // Global BPM via autocorrelation on 100fps onset flux
  const onsets = frames.map(fr => fr.onset);
  const estimateBpmInSlice = (startIdx, endIdx, priorBpm = null) => {
    const sliceLen = endIdx - startIdx;
    if (sliceLen < fps * 2) return priorBpm || 128;
    let bestLag = Math.floor((fps * 60) / (priorBpm || 128));
    let bestCorr = -1;
    const minLag = Math.floor((fps * 60) / 188);
    const maxLag = Math.floor((fps * 60) / 72);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      const limit = endIdx - lag;
      for (let i = startIdx; i < limit; i += 2) corr += onsets[i] * onsets[i + lag];
      if (priorBpm) {
        const candBpm = (60 * fps) / lag;
        const ratio = candBpm / priorBpm;
        // Soft Gaussian prior around global BPM to avoid octave jumps while allowing real tempo shifts
        const dist = Math.abs(ratio - 1);
        corr *= Math.exp(-dist * dist * 4.5);
      }
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    return Math.round(Utils.clamp((60 * fps) / bestLag, 72, 188));
  };

  const bpm = estimateBpmInSlice(0, onsets.length, null);
  const beatDur = 60 / bpm;

  // Continuous local BPM curve (sliding 6s window every 1.5s, smoothed)
  const tempoCurve = [];
  const winFrames = Math.floor(fps * 6.0);
  const stepFrames = Math.floor(fps * 1.5);
  let smoothBpm = bpm;
  for (let start = 0; start < onsets.length; start += stepFrames) {
    const end = Math.min(onsets.length, start + winFrames);
    const rawLocal = (end - start >= fps * 2.5) ? estimateBpmInSlice(start, end, bpm) : bpm;
    smoothBpm = smoothBpm * 0.55 + rawLocal * 0.45;
    const rounded = Math.round(smoothBpm);
    tempoCurve.push({ t: start / fps, bpm: rounded, beatDur: 60 / rounded });
  }
  if (!tempoCurve.length) tempoCurve.push({ t: 0, bpm, beatDur });

  const getLocalTempoAt = (t) => {
    let best = tempoCurve[0];
    for (let i = 1; i < tempoCurve.length; i++) {
      if (tempoCurve[i].t <= t) best = tempoCurve[i];
      else break;
    }
    return best;
  };

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

  // Build adaptive beat grid following continuous local BPM + snapping to real peaks (±85ms)
  const gridBeats = [];
  const usedPeakIdx = new Set();
  for (let t = bestOffset; t < duration - 0.2; ) {
    const lt = getLocalTempoAt(t);
    if (t >= 0.15) {
      let bestP = -1, bestDist = 0.085;
      for (let p = 0; p < realPeaks.length; p++) {
        const d = Math.abs(realPeaks[p].t - t);
        if (d < bestDist) { bestDist = d; bestP = p; }
      }
      const snappedT = bestP !== -1 ? realPeaks[bestP].t : t;
      if (bestP !== -1) usedPeakIdx.add(bestP);

      const fIdx = Utils.clamp(Math.floor(snappedT * fps), 0, frames.length - 1);
      const fr = frames[fIdx];
      gridBeats.push({
        t: snappedT, bass: fr.bass, mid: fr.mid, high: fr.high, rms: fr.rms,
        kickOnset: fr.kickOnset, snareOnset: fr.snareOnset, onset: fr.onset,
        localBpm: lt.bpm, localBeatDur: lt.beatDur,
        isSilent: fr.rms < 0.07,
        isKick: fr.kickOnset > 0.2 || fr.bass > 0.48,
        isSnare: fr.snareOnset > 0.22,
        isSyncopated: false
      });
    }
    t += lt.beatDur;
  }

  // Rhythmic Meter / Time Signature Detection (4/4, 3/4, 6/8) + Downbeat Alignment
  const METER_CANDIDATES = [
    { beatsPerBar: 4, label: "4/4", template: [1.0, 0.45, 0.78, 0.48], prior: 1.06 },
    { beatsPerBar: 3, label: "3/4", template: [1.0, 0.42, 0.48],       prior: 0.96 },
    { beatsPerBar: 6, label: "6/8", template: [1.0, 0.36, 0.40, 0.78, 0.36, 0.40], prior: 0.95 }
  ];

  let bestMeter = { beatsPerBar: 4, label: "4/4", template: METER_CANDIDATES[0].template, downbeatOffset: 0 };
  if (gridBeats.length >= 8) {
    const energies = gridBeats.map(b => b.kickOnset * 1.45 + b.bass * 0.7 + b.rms * 0.55 + b.onset * 0.5);
    const meanE = energies.reduce((a, x) => a + x, 0) / Math.max(1, energies.length);
    let bestMeterScore = -Infinity;

    for (const cand of METER_CANDIDATES) {
      const m = cand.beatsPerBar;
      for (let off = 0; off < m; off++) {
        let weighted = 0, downSum = 0, downCnt = 0, otherSum = 0, otherCnt = 0;
        for (let i = 0; i < gridBeats.length; i++) {
          const pos = (i - off + m * 1000) % m;
          const e = energies[i];
          weighted += e * cand.template[pos];
          if (pos === 0) { downSum += e; downCnt++; }
          else { otherSum += e; otherCnt++; }
        }
        const downContrast = (downSum / Math.max(1, downCnt)) - (otherSum / Math.max(1, otherCnt));
        const score = ((weighted / gridBeats.length) + downContrast * 0.95) * cand.prior / Math.max(0.05, meanE);
        if (score > bestMeterScore) {
          bestMeterScore = score;
          bestMeter = { beatsPerBar: m, label: cand.label, template: cand.template, downbeatOffset: off };
        }
      }
    }
  }

  // Helper: measure note articulation (sustainDuration in seconds while energy stays > 55% of attack peak)
  const measureSustain = (tSec, maxDur) => {
    const f0 = Utils.clamp(Math.floor(tSec * fps), 0, frames.length - 1);
    const peak = Math.max(0.08, frames[f0].rms);
    const thresh = peak * 0.55;
    const maxF = Math.min(frames.length - 1, f0 + Math.floor(maxDur * fps));
    let f = f0 + 1;
    while (f <= maxF && frames[f].rms >= thresh) f++;
    return Utils.clamp((f - f0) / fps, 0.08, maxDur);
  };

  // Tag every grid beat with barIndex, beatInBar, accentWeight, accentLevel, sustainDuration, and pitchHeight
  const mLen = bestMeter.beatsPerBar;
  const beats = gridBeats.map((b, idx) => {
    const shifted = idx - bestMeter.downbeatOffset;
    const barIndex = Math.max(0, Math.floor(shifted / mLen));
    const beatInBar = ((shifted % mLen) + mLen) % mLen;
    const baseWeight = bestMeter.template[beatInBar] ?? 0.5;
    const dynamicBoost = Utils.clamp((b.kickOnset * 0.35 + b.bass * 0.2), 0, 0.35);
    const accentWeight = Utils.clamp(baseWeight * 0.8 + dynamicBoost, 0.35, 1.0);
    const accentLevel = beatInBar === 0
      ? "DOWNBEAT"
      : (baseWeight >= 0.72 ? "SECONDARY" : "WEAK");
    const fIdx = Utils.clamp(Math.floor(b.t * fps), 0, frames.length - 1);
    const sustainDuration = measureSustain(b.t, Math.min(1.6, (b.localBeatDur || beatDur) * 2.2));
    return {
      ...b,
      barIndex,
      beatInBar,
      accentWeight,
      accentLevel,
      sustainDuration,
      pitchHeight: frames[fIdx].pitchHeight ?? 0.5,
      subdivision: "1/1",
      isSubdivision: false
    };
  });

  // Detect rhythmic subdivisions (1/2 eighth, 1/3 triplet, 1/4 sixteenth) from realPeaks between grid beats
  for (let p = 0; p < realPeaks.length; p++) {
    if (usedPeakIdx.has(p)) continue;
    const pk = realPeaks[p];
    if (pk.strength <= 0.34 || pk.frame.rms <= 0.14) continue;

    // Find enclosing grid beat
    let prevIdx = -1;
    for (let i = 0; i < gridBeats.length - 1; i++) {
      if (gridBeats[i].t <= pk.t && pk.t < gridBeats[i + 1].t) { prevIdx = i; break; }
    }
    const lt = getLocalTempoAt(pk.t);
    let subType = "SYNC";
    if (prevIdx !== -1) {
      const span = Math.max(0.15, gridBeats[prevIdx + 1].t - gridBeats[prevIdx].t);
      const frac = (pk.t - gridBeats[prevIdx].t) / span;
      if (Math.abs(frac - 0.5) < 0.09) subType = "1/2";
      else if (Math.abs(frac - 0.333) < 0.07 || Math.abs(frac - 0.667) < 0.07) subType = "1/3";
      else if (Math.abs(frac - 0.25) < 0.07 || Math.abs(frac - 0.75) < 0.07) subType = "1/4";
    }

    const isSub = subType === "1/2" || subType === "1/3" || subType === "1/4";
    if (!isSub && pk.strength <= 0.52) continue;

    beats.push({
      t: pk.t, bass: pk.frame.bass, mid: pk.frame.mid, high: pk.frame.high, rms: pk.frame.rms,
      localBpm: lt.bpm, localBeatDur: lt.beatDur,
      barIndex: prevIdx !== -1 ? beats[prevIdx].barIndex : Math.floor(pk.t / (lt.beatDur * mLen)),
      beatInBar: -1,
      accentWeight: Utils.clamp(0.45 + pk.strength * 0.28, 0.45, 0.88),
      accentLevel: isSub ? "SUBDIVISION" : "SYNCOPATED",
      subdivision: isSub ? subType : "SYNC",
      isSubdivision: isSub,
      sustainDuration: measureSustain(pk.t, Math.min(0.45, lt.beatDur * 0.7)),
      pitchHeight: pk.frame.pitchHeight ?? 0.5,
      isSilent: false, isKick: pk.frame.kickOnset > 0.28, isSnare: pk.frame.snareOnset > 0.22, isSyncopated: !isSub
    });
  }
  beats.sort((a, b) => a.t - b.t);

  const avgBass = frames.reduce((s, f) => s + f.bass, 0) / frames.length;
  const avgHigh = frames.reduce((s, f) => s + f.high, 0) / frames.length;
  const avgRms = frames.reduce((s, f) => s + f.rms, 0) / frames.length;
  const avgZcr = frames.reduce((s, f) => s + f.zcr, 0) / frames.length;
  const avgBright = frames.reduce((s, f) => s + f.brightness, 0) / frames.length;
  const avgPeakRate = realPeaks.length / Math.max(1, duration);

  // Estimate dynamic range (p95 - p20 RMS) and musical genre/style tag
  const sortedRms = frames.map(f => f.rms).sort((a, b) => a - b);
  const dynamicRange = Utils.clamp((sortedRms[Math.floor(sortedRms.length * 0.95)] || 0) - (sortedRms[Math.floor(sortedRms.length * 0.20)] || 0), 0, 1);

  let genre = "ELECTRONIC / EDM";
  if (bestMeter.label === "3/4") genre = "WALTZ / 3:4";
  else if (bpm >= 158) genre = avgZcr > 0.45 ? "SPEEDCORE / BREAKCORE" : "DRUM & BASS";
  else if (bpm >= 122 && bpm <= 145 && avgBass > 0.45 && avgZcr > 0.36) genre = "PHONK / DUBSTEP";
  else if (bpm >= 115 && bpm <= 136 && avgBright > 0.46) genre = "SYNTHWAVE / HOUSE";
  else if (bpm < 105 && avgBass > avgHigh * 1.1) genre = "TRAP / HIP-HOP";
  else if (avgRms < 0.28) genre = "AMBIENT / LO-FI";

  let archetype = ARCHETYPES.CLOCKWORK_SYNTH;
  if (bpm >= 140 && avgHigh >= avgBass * 0.7) archetype = ARCHETYPES.HYPER_BARRAGE;
  else if (avgBass > avgHigh * 1.18) archetype = ARCHETYPES.TITAN_CRUSHER;
  else if (bpm < 108) archetype = ARCHETYPES.ABYSSAL_ECLIPSE;

  // Fine-grained 1-measure (beatsPerBar) section windows for fast instrument & rhythm change detection
  const secWin = beatDur * mLen;
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
    const sPitch = slice.reduce((acc, x) => acc + (x.pitchHeight ?? 0.5), 0) / lenS;

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

    const lt = getLocalTempoAt(s);
    sections.push({
      start: s, end: e, energy, type, instrument, rhythm, localBpm: lt.bpm,
      vec: [Utils.clamp(rhythmRatio * 0.5, 0, 1), sBass / Math.max(0.05, sBass + sHigh), sPitch, energy]
    });
  }

  // Leitmotif Fingerprinting: cluster 4-bar phrases by cosine similarity so recurring themes share a motifId (A, B, C...)
  const motifPrototypes = [];
  const cosSim = (a, b) => {
    let dot = 0, ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i]; }
    return dot / Math.max(0.0001, Math.sqrt(ma * mb));
  };
  for (let i = 0; i < sections.length; i += 4) {
    const chunk = sections.slice(i, i + 4);
    const avgVec = [0, 1, 2, 3].map(k => chunk.reduce((s, c) => s + c.vec[k], 0) / Math.max(1, chunk.length));
    let matchedId = null;
    for (const proto of motifPrototypes) {
      if (cosSim(avgVec, proto.vec) > 0.94) { matchedId = proto.id; break; }
    }
    if (!matchedId) {
      matchedId = String.fromCharCode(65 + Math.min(7, motifPrototypes.length)); // A..H
      motifPrototypes.push({ id: matchedId, vec: avgVec });
    }
    for (const c of chunk) c.motifId = matchedId;
  }

  // Detect Pre-Drop Dramatic Silences (0.18s - 1.2s low-RMS breath right before a DROP)
  const preDropSilences = [];
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].type === "DROP" && sections[i - 1].type !== "DROP") {
      const dropStartF = Utils.clamp(Math.floor(sections[i].start * fps), 0, frames.length - 1);
      let f = dropStartF - 1;
      let lowCount = 0;
      while (f >= Math.max(0, dropStartF - Math.floor(1.25 * fps)) && frames[f].rms < Math.max(0.14, avgRms * 0.35)) {
        lowCount++;
        f--;
      }
      if (lowCount >= Math.floor(0.18 * fps)) {
        preDropSilences.push({ start: (f + 1) / fps, end: sections[i].start });
      }
    }
  }

  const meter = { beatsPerBar: bestMeter.beatsPerBar, label: bestMeter.label, downbeatOffset: bestMeter.downbeatOffset };
  const baseAnalysis = {
    frames, fps, bpm, beatDur, tempoCurve, meter, bestOffset, beats, sections, preDropSilences, archetype,
    profile: { avgBass, avgHigh, avgRms, avgZcr, avgBright, dynamicRange, genre }
  };
  baseAnalysis.dna = generateSongDNA(baseAnalysis, duration);
  return baseAnalysis;
}
