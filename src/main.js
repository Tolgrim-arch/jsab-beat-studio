import { ASPECT_PRESETS, COLORS, PHASES } from "./config.js";
import { Utils } from "./utils.js";
import { state, spawnParticles, resetWorldEntities } from "./state.js";
import { ensureAudioContext, generateDemoTrack, analyzeAudioBuffer } from "./audio/analyzer.js?v=78";
import { buildChoreographySchedule, spawnSetpieceEvent, ATTACK_CATALOG } from "./combat/choreography.js?v=78";
import { updateCyanAI } from "./combat/cyanAI.js?v=74";
import { renderFrame, drawTimeline } from "./render/renderer.js?v=78";
import { initStudioControls } from "./ui/controls.js?v=78";

const dom = {
  canvas: document.getElementById("gameCanvas"),
  timelineCanvas: document.getElementById("timelineCanvas"),
  timelineWrapper: document.getElementById("timelineWrapper"),
  audioInput: document.getElementById("audioFileInput"),
  demoBtns: document.querySelectorAll(".demo-btn"),
  emptyOverlay: document.getElementById("emptyOverlay"),
  btnPlayPause: document.getElementById("btnPlayPause"),
  btnRestart: document.getElementById("btnRestart"),
  iconPlay: document.getElementById("iconPlay"),
  iconPause: document.getElementById("iconPause"),
  btnRecord: document.getElementById("btnRecordVideo"),
  recBtnText: document.getElementById("recBtnText"),
  recIcon: document.getElementById("recIcon"),
  toggleHud: document.getElementById("toggleHud"),
  trackName: document.getElementById("trackNameDisplay"),
  trackStatus: document.getElementById("trackStatusBadge"),
  statBpm: document.getElementById("statBpm"),
  statDuration: document.getElementById("statDuration"),
  statEvents: document.getElementById("statEvents"),
  statArchetype: document.getElementById("statArchetype"),
  statSection: document.getElementById("statSection"),
  statSetpiece: document.getElementById("statSetpiece"),
  phaseBadge: document.getElementById("phaseBadge"),
  phaseName: document.getElementById("phaseName"),
  barSub: document.getElementById("barSub"),
  barBass: document.getElementById("barBass"),
  barLowMid: document.getElementById("barLowMid"),
  barMid: document.getElementById("barMid"),
  barHigh: document.getElementById("barHigh"),
  barEnergy: document.getElementById("barEnergy"),
  barPunch: document.getElementById("barPunch"),
  barNoise: document.getElementById("barNoise"),
  barCrunch: document.getElementById("barCrunch"),
  barBright: document.getElementById("barBright"),
  barTension: document.getElementById("barTension"),
  telInstrument: document.getElementById("telInstrument"),
  telRhythm: document.getElementById("telRhythm"),
  telGenre: document.getElementById("telGenre"),
  telMeter: document.getElementById("telMeter"),
  telAccent: document.getElementById("telAccent"),
  telLayers: document.getElementById("telLayers"),
  telBeatDots: document.getElementById("telBeatDots"),
  timeCurrent: document.getElementById("timeCurrent"),
  timeTotal: document.getElementById("timeTotal"),
  resolutionLabel: document.getElementById("resolutionLabel"),
  toastContainer: document.getElementById("toastContainer"),
  aspectBtns: document.querySelectorAll(".aspect-btn")
};

const ctx = dom.canvas.getContext("2d");
const tCtx = dom.timelineCanvas.getContext("2d");

function showToast(message, type = "info") {
  const colors = {
    info: "border-[#00F0FF]/50 bg-[#0c1528] text-[#00F0FF]",
    success: "border-emerald-500/50 bg-[#0b1f1a] text-emerald-300",
    error: "border-[#FF1F71]/60 bg-[#240b18] text-[#FF1F71]"
  };
  const el = document.createElement("div");
  el.className = `px-4 py-2.5 rounded-xl border text-xs font-medium shadow-xl backdrop-blur-md transition-all duration-300 ${colors[type] || colors.info}`;
  el.textContent = message;
  dom.toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function stopTabAudioCapture() {
  if (state.liveTabStream) {
    state.liveTabStream.getTracks().forEach(tr => tr.stop());
    state.liveTabStream = null;
  }
  if (state.liveTabSource) {
    try { state.liveTabSource.disconnect(); } catch {}
    state.liveTabSource = null;
  }
  state.isLiveTab = false;
}

function stopAudioSource() {
  if (state.sourceNode) {
    try { state.sourceNode.stop(); } catch {}
    try { state.sourceNode.disconnect(); } catch {}
    state.sourceNode = null;
  }
  if (state.mediaEl) {
    state.mediaEl.pause();
  }
  stopTabAudioCapture();
}

async function startTabAudioCapture() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showToast("Tu navegador no soporta captura de pestaña", "error");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      stream.getTracks().forEach(t => t.stop());
      showToast("Marca 'Compartir audio de la pestaña' para escuchar YouTube/Spotify", "error");
      return;
    }

    pausePlayback();
    const ac = ensureAudioContext();
    const audioOnlyStream = new MediaStream(audioTracks);
    const src = ac.createMediaStreamSource(audioOnlyStream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    if (state.mediaDest) analyser.connect(state.mediaDest);

    audioTracks[0].onended = () => {
      if (state.isLiveTab) {
        pausePlayback();
        showToast("Captura de pestaña finalizada", "info");
      }
    };

    state.audioBuffer = null;
    state.mediaEl = null;
    state.liveTabStream = stream;
    state.liveTabSource = src;
    state.liveAnalyser = analyser;
    state.isLiveTab = true;
    state.duration = 0;
    state.trackTitle = "Audio de Pestaña (En Vivo)";
    state.pauseOffset = 0;
    state.currentTime = 0;
    state.liveBeatCooldown = 0;
    state.livePrevBass = 0;
    state.liveStep = 0;

    const dummyBuf = ac.createBuffer(1, Math.min(ac.sampleRate * 2, 44100), ac.sampleRate);
    state.analysis = analyzeAudioBuffer(dummyBuf);
    state.schedule = [];
    state.nextEventIdx = 0;
    resetWorldEntities();

    dom.emptyOverlay.classList.add("hidden");
    dom.trackName.textContent = "YouTube / Spotify (En Vivo)";
    dom.trackStatus.textContent = "EN VIVO";
    dom.trackStatus.className = "text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-[#FF1F71]/25 text-[#FF4D8D]";
    dom.statBpm.textContent = "LIVE";
    dom.statDuration.textContent = "∞";
    dom.statEvents.textContent = "AUTO";
    dom.statArchetype.textContent = "LIVE AUDIO";
    dom.timeTotal.textContent = "LIVE";
    dom.btnPlayPause.disabled = false;
    dom.btnRestart.disabled = true;
    dom.btnRecord.disabled = false;

    state.startTime = ac.currentTime;
    state.isPlaying = true;
    updatePlayButtonUI();
    showToast("🎙️ Escuchando YouTube/Spotify en tiempo real", "success");
  } catch {
    showToast("Captura cancelada", "info");
  }
}

function updatePlayButtonUI() {
  dom.iconPlay.classList.toggle("hidden", state.isPlaying);
  dom.iconPause.classList.toggle("hidden", !state.isPlaying);
}

function startPlayback(offsetSec = state.pauseOffset) {
  if (!state.audioBuffer && !state.mediaEl) return;
  const ac = ensureAudioContext();
  stopAudioSource();

  if (state.audioBuffer) {
    const src = ac.createBufferSource();
    src.buffer = state.audioBuffer;
    src.connect(ac.destination);
    if (state.mediaDest) src.connect(state.mediaDest);

    src.onended = () => {
      if (state.isPlaying && state.currentTime >= state.duration - 0.15) {
        state.isPlaying = false;
        state.pauseOffset = 0;
        updatePlayButtonUI();
        if (state.isRecording) stopRecordingAndDownload();
      }
    };

    src.start(0, offsetSec);
    state.sourceNode = src;
    state.startTime = ac.currentTime - offsetSec;
  } else if (state.mediaEl) {
    state.mediaEl.currentTime = offsetSec;
    state.mediaEl.play();
    state.startTime = ac.currentTime - offsetSec;
  }

  state.isPlaying = true;
  updatePlayButtonUI();
}

function pausePlayback() {
  if (!state.isPlaying) return;
  state.pauseOffset = state.currentTime;
  stopAudioSource();
  state.isPlaying = false;
  updatePlayButtonUI();
}

function loadAudioBuffer(buffer, title) {
  pausePlayback();
  state.audioBuffer = buffer;
  state.mediaEl = null;
  state.liveAnalyser = null;
  state.duration = buffer.duration;
  state.trackTitle = title;
  state.pauseOffset = 0;
  state.currentTime = 0;

  state.analysis = analyzeAudioBuffer(buffer);
  state.liveBpm = state.analysis.bpm;
  state.liveBeatDur = state.analysis.beatDur;
  state.meterLabel = state.analysis.meter?.label || "4/4";
  state.beatsPerBar = state.analysis.meter?.beatsPerBar || 4;
  state.beatInBar = 0;
  state.schedule = buildChoreographySchedule();
  state.nextEventIdx = 0;
  resetWorldEntities();

  dom.emptyOverlay.classList.add("hidden");
  dom.trackName.textContent = title;
  dom.trackStatus.textContent = "Sincronizado";
  dom.trackStatus.className = "text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300";
  dom.statBpm.textContent = `${state.liveBpm} • ${state.meterLabel}`;
  if (dom.telGenre) dom.telGenre.textContent = state.analysis.profile?.genre || "ELECTRONIC";
  if (dom.telMeter) dom.telMeter.textContent = state.meterLabel;
  dom.statDuration.textContent = Utils.formatTime(state.duration);
  dom.statEvents.textContent = state.schedule.length;
  dom.statArchetype.textContent = state.analysis.archetype.label;
  dom.timeTotal.textContent = Utils.formatTime(state.duration);
  dom.btnPlayPause.disabled = false;
  dom.btnRestart.disabled = false;
  dom.btnRecord.disabled = false;

  drawTimeline(tCtx, dom.timelineCanvas);
  showToast(`${state.liveBpm} BPM (${state.meterLabel}) • ${state.analysis.archetype.label}`, "success");
}

function loadMediaElementFallback(file) {
  return new Promise((resolve, reject) => {
    const ac = ensureAudioContext();
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.src = url;
    el.preload = "auto";
    el.playsInline = true;

    el.onloadedmetadata = () => {
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 120;
      const srcNode = ac.createMediaElementSource(el);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      srcNode.connect(analyser);
      analyser.connect(ac.destination);
      if (state.mediaDest) analyser.connect(state.mediaDest);

      el.onended = () => {
        if (state.isPlaying) {
          state.isPlaying = false;
          state.pauseOffset = 0;
          updatePlayButtonUI();
          if (state.isRecording) stopRecordingAndDownload();
        }
      };

      const fps = 30;
      const totalFrames = Math.ceil(duration * fps);
      const frames = new Array(totalFrames);
      for (let f = 0; f < totalFrames; f++) {
        const t = f / fps;
        const pulse = 0.5 + 0.45 * Math.sin(t * Math.PI * 4);
        frames[f] = { t, rms: 0.55, bass: pulse, mid: 0.45, high: 0.45, kickOnset: pulse > 0.85 ? 0.6 : 0.1, snareOnset: 0.2, highOnset: 0.2, onset: 0.4 };
      }
      const bpm = 128;
      const beatDur = 60 / bpm;
      const beats = [];
      for (let t = 0.4; t < duration - 0.3; t += beatDur) {
        beats.push({ t, bass: 0.7, mid: 0.5, high: 0.5, rms: 0.6, isKick: true, isSnare: false });
      }
      const sections = [
        { start: 0, end: duration * 0.12, energy: 0.4, type: "INTRO" },
        { start: duration * 0.12, end: duration * 0.25, energy: 0.6, type: "BUILDUP" },
        { start: duration * 0.25, end: duration * 0.55, energy: 0.9, type: "DROP" },
        { start: duration * 0.55, end: duration * 0.68, energy: 0.4, type: "BREAKDOWN" },
        { start: duration * 0.68, end: duration * 0.9, energy: 0.95, type: "DROP" },
        { start: duration * 0.9, end: duration, energy: 0.4, type: "OUTRO" }
      ];

      pausePlayback();
      state.audioBuffer = null;
      state.mediaEl = el;
      state.liveAnalyser = analyser;
      state.duration = duration;
      state.trackTitle = file.name;
      state.pauseOffset = 0;
      state.currentTime = 0;

      const dummyBuf = ac.createBuffer(1, Math.min(ac.sampleRate * 2, 44100), ac.sampleRate);
      state.analysis = analyzeAudioBuffer(dummyBuf);
      state.analysis.frames = frames;
      state.analysis.beats = beats;
      state.analysis.sections = sections;
      state.analysis.bpm = bpm;
      state.analysis.beatDur = beatDur;

      state.schedule = buildChoreographySchedule();
      state.nextEventIdx = 0;
      resetWorldEntities();

      dom.emptyOverlay.classList.add("hidden");
      dom.trackName.textContent = file.name;
      dom.trackStatus.textContent = "MP4 Live Sync";
      dom.trackStatus.className = "text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300";
      dom.statBpm.textContent = bpm;
      dom.statDuration.textContent = Utils.formatTime(duration);
      dom.statEvents.textContent = state.schedule.length;
      dom.statArchetype.textContent = state.analysis.archetype.label;
      dom.timeTotal.textContent = Utils.formatTime(duration);
      dom.btnPlayPause.disabled = false;
      dom.btnRestart.disabled = false;
      dom.btnRecord.disabled = false;

      drawTimeline(tCtx, dom.timelineCanvas);
      showToast(`MP4 cargado (Live Sync) • ${state.analysis.archetype.label}`, "success");
      resolve();
    };
    el.onerror = () => reject(new Error("Media load failed"));
  });
}

let activeRecordingCallback = null;

function startRecordingFullTrack(customFileName = null, onFinished = null) {
  if ((!state.audioBuffer && !state.mediaEl) || state.isRecording) return;
  const fps = state.settings?.exportFps || 60;
  const bitrate = Math.round((state.settings?.exportBitrateMbps || 12) * 1_000_000);
  const stream = dom.canvas.captureStream(fps);
  if (state.mediaDest) state.mediaDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";

  activeRecordingCallback = onFinished;
  state.recordedChunks = [];
  state.mediaRecorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.recordedChunks.push(e.data); };
  state.mediaRecorder.onstop = () => {
    const blob = new Blob(state.recordedChunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = customFileName || `jsab_${state.aspect.replace(":", "x")}_${Date.now()}`;
    a.download = `${base.replace(/[^a-z0-9_-]/gi, "_")}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Video exportado (${state.width}×${state.height} @ ${fps}fps)`, "success");
    const cb = activeRecordingCallback;
    activeRecordingCallback = null;
    if (cb) cb();
  };

  const clip = state.studio?.clip;
  const startOffset = (clip?.enabled && clip.start > 0 && clip.start < state.duration) ? clip.start : 0;

  state.isRecording = true;
  dom.recIcon.classList.add("rec-dot");
  dom.recBtnText.textContent = "Grabando... (Detener)";
  state.pauseOffset = startOffset;
  state.currentTime = startOffset;
  state.nextEventIdx = state.schedule.findIndex(ev => ev.spawnTime >= startOffset);
  if (state.nextEventIdx === -1) state.nextEventIdx = state.schedule.length;
  resetWorldEntities();
  state.mediaRecorder.start();
  startPlayback(startOffset);
}

function stopRecordingAndDownload() {
  if (!state.isRecording) return;
  state.isRecording = false;
  dom.recIcon.classList.remove("rec-dot");
  dom.recBtnText.textContent = "Grabar Video Completo";
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") state.mediaRecorder.stop();
}

function updateSimulation(dt) {
  const W = state.width, H = state.height;
  const t = state.currentTime;

  let bass = 0, mid = 0, high = 0;
  if (state.liveAnalyser) {
    const bins = new Uint8Array(state.liveAnalyser.frequencyBinCount);
    state.liveAnalyser.getByteFrequencyData(bins);
    const avg = (s, e) => {
      let sum = 0;
      for (let i = s; i < e; i++) sum += bins[i];
      return sum / Math.max(1, (e - s) * 255);
    };
    const sub = avg(0, 3);
    bass = avg(2, 9);
    const lowMid = avg(9, 20);
    mid = avg(20, 44);
    high = avg(44, 100);
    const bright = Math.min(1, (mid * 0.45 + high * 0.95) / Math.max(0.05, sub + bass + lowMid + mid + high));
    const tension = Math.min(1, Math.abs(bass - (state.livePrevBass || 0)) * 2.8 + high * 0.65);

    const energy = Math.min(1, (sub + bass + lowMid + mid + high) / 3.4);
    const punch = Math.min(1, Math.max(0, bass - (state.livePrevBass || 0)) * 3.8 + Math.max(0, mid - (state.livePrevMid || 0)) * 2.5);
    state.livePrevMid = mid;
    let activeB = 0;
    if (sub > 0.3) activeB++; if (bass > 0.3) activeB++; if (lowMid > 0.3) activeB++; if (mid > 0.3) activeB++; if (high > 0.3) activeB++;
    const liveNoise = Utils.clamp(energy * 0.45 + (activeB / 5) * 0.35 + tension * 0.25, 0.05, 1);
    const crunch = Utils.clamp(high * 0.7 + tension * 0.45, 0, 1);

    state.audioTelemetry = { sub, bass, lowMid, mid, high, brightness: bright, tension, energy, punch, noise: liveNoise, crunch };

    if (dom.barSub) dom.barSub.style.width = `${Math.min(100, sub * 115)}%`;
    dom.barBass.style.width = `${Math.min(100, bass * 115)}%`;
    if (dom.barLowMid) dom.barLowMid.style.width = `${Math.min(100, lowMid * 115)}%`;
    dom.barMid.style.width = `${Math.min(100, mid * 115)}%`;
    dom.barHigh.style.width = `${Math.min(100, high * 115)}%`;
    if (dom.barEnergy) dom.barEnergy.style.width = `${Math.min(100, energy * 115)}%`;
    if (dom.barPunch) dom.barPunch.style.width = `${Math.min(100, punch * 115)}%`;
    if (dom.barNoise) dom.barNoise.style.width = `${Math.min(100, liveNoise * 105)}%`;
    if (dom.barCrunch) dom.barCrunch.style.width = `${Math.min(100, crunch * 110)}%`;
    if (dom.barBright) dom.barBright.style.width = `${Math.min(100, bright * 120)}%`;
    if (dom.barTension) dom.barTension.style.width = `${Math.min(100, tension * 115)}%`;
    if (dom.telInstrument) {
      dom.telInstrument.textContent = sub > bass && sub > mid ? "SUB_BASS" : high > bass ? "ARP_HYPER" : mid > bass ? "SYNTH_LEAD" : "PERCUSSION";
    }
    if (dom.telRhythm) dom.telRhythm.textContent = tension > 0.68 ? "DOUBLE_TIME" : "LIVE";
    if (bass > 0.62) {
      state.zoomPunch = Math.max(state.zoomPunch, 0.024);
      state.bgPulse = Math.max(state.bgPulse, 0.7);
    }
    if (state.isLiveTab) {
      state.liveBeatCooldown = Math.max(0, (state.liveBeatCooldown || 0) - dt);
      const flux = bass - (state.livePrevBass || 0);
      state.livePrevBass = bass;
      if (state.liveBeatCooldown <= 0 && ((bass > 0.48 && flux > 0.065) || bass > 0.72)) {
        // Continuous real-time BPM estimation from rolling inter-onset intervals (IOIs)
        const nowSec = t;
        if (!state.liveOnsetTimes) state.liveOnsetTimes = [];
        state.liveOnsetTimes.push(nowSec);
        if (state.liveOnsetTimes.length > 14) state.liveOnsetTimes.shift();

        if (state.liveOnsetTimes.length >= 4) {
          const iois = [];
          for (let k = 1; k < state.liveOnsetTimes.length; k++) {
            const d = state.liveOnsetTimes[k] - state.liveOnsetTimes[k - 1];
            if (d >= 0.28 && d <= 0.92) iois.push(d);
          }
          if (iois.length >= 3) {
            iois.sort((a, b) => a - b);
            const med = iois[Math.floor(iois.length / 2)];
            const estBpm = Utils.clamp(60 / med, 72, 188);
            state.liveBpm = Math.round((state.liveBpm || estBpm) * 0.72 + estBpm * 0.28);
            state.liveBeatDur = 60 / state.liveBpm;
            if (dom.statBpm) dom.statBpm.textContent = `${state.liveBpm} • ${state.meterLabel || "4/4"}`;
          }
        }

        const beatDurLive = state.liveBeatDur || 0.47;
        state.liveBeatCooldown = Math.max(0.22, beatDurLive * 0.62);
        const pool = ATTACK_CATALOG.filter(a => !(state.disabledAttacks && state.disabledAttacks[a.id]));
        if (pool.length) {
          const mLen = state.beatsPerBar || 4;
          const step = (state.liveStep || 0) % mLen;
          const accentLevel = step === 0 ? "DOWNBEAT" : (mLen === 4 && step === 2) || (mLen === 6 && step === 3) ? "SECONDARY" : "WEAK";
          const accentWeight = accentLevel === "DOWNBEAT" ? 1.0 : accentLevel === "SECONDARY" ? 0.8 : 0.52;
          if (step === 0 || !state.liveCurSetpiece) {
            state.liveCurSetpiece = pool[Math.floor(Math.random() * pool.length)].id;
          }
          spawnSetpieceEvent({
            setpiece: state.liveCurSetpiece,
            phase: state.phase,
            step,
            beatInBar: step,
            beatsPerBar: mLen,
            accentLevel,
            accentWeight,
            localBpm: state.liveBpm || 128,
            localBeatDur: beatDurLive,
            leadTime: Math.min(0.52, beatDurLive * (accentLevel === "DOWNBEAT" ? 0.88 : 0.68)),
            section: bass > 0.66 ? "DROP" : "VERSE",
            seed: Math.random()
          }, dom.statSetpiece);
          state.liveStep = (state.liveStep || 0) + 1;
        }
      }
    }
  } else if (state.analysis) {
    // Continuously read local BPM from tempoCurve at current playback time
    const curve = state.analysis.tempoCurve;
    if (curve && curve.length) {
      let curTempo = curve[0];
      for (let i = 1; i < curve.length; i++) {
        if (curve[i].t <= t) curTempo = curve[i];
        else break;
      }
      if (curTempo.bpm !== state.liveBpm) {
        state.liveBpm = curTempo.bpm;
        state.liveBeatDur = curTempo.beatDur;
        if (dom.statBpm) dom.statBpm.textContent = `${state.liveBpm} • ${state.meterLabel || "4/4"}`;
      }
    }

    const idx = Utils.clamp(Math.floor(t * state.analysis.fps), 0, state.analysis.frames.length - 1);
    const fr = state.analysis.frames[idx];
    bass = fr.bass; mid = fr.mid; high = fr.high;
    let activeB = 0;
    if ((fr.sub || 0) > 0.3) activeB++;
    if ((fr.bass || 0) > 0.3) activeB++;
    if ((fr.lowMid || 0) > 0.3) activeB++;
    if ((fr.mid || 0) > 0.3) activeB++;
    if ((fr.high || 0) > 0.3) activeB++;
    const noiseLive = Utils.clamp((fr.rms || 0) * 0.45 + (activeB / 5) * 0.35 + (fr.tension || 0) * 0.25, 0.05, 1);
    const punchLive = Utils.clamp((fr.onset || 0) * 0.85, 0, 1);

    state.audioTelemetry = {
      sub: fr.sub || 0,
      bass: fr.bass || 0,
      lowMid: fr.lowMid || 0,
      mid: fr.mid || 0,
      high: fr.high || 0,
      brightness: fr.brightness || 0,
      tension: fr.tension || 0,
      energy: fr.rms || 0,
      punch: punchLive,
      noise: noiseLive,
      crunch: fr.zcr || 0
    };
    if (dom.barSub) dom.barSub.style.width = `${Math.min(100, (fr.sub || 0) * 90)}%`;
    dom.barBass.style.width = `${Math.min(100, bass * 90)}%`;
    if (dom.barLowMid) dom.barLowMid.style.width = `${Math.min(100, (fr.lowMid || 0) * 90)}%`;
    dom.barMid.style.width = `${Math.min(100, mid * 90)}%`;
    dom.barHigh.style.width = `${Math.min(100, high * 90)}%`;
    if (dom.barEnergy) dom.barEnergy.style.width = `${Math.min(100, (fr.rms || 0) * 95)}%`;
    if (dom.barPunch) dom.barPunch.style.width = `${Math.min(100, punchLive * 100)}%`;
    if (dom.barNoise) dom.barNoise.style.width = `${Math.min(100, noiseLive * 100)}%`;
    if (dom.barCrunch) dom.barCrunch.style.width = `${Math.min(100, (fr.zcr || 0) * 95)}%`;
    if (dom.barBright) dom.barBright.style.width = `${Math.min(100, (fr.brightness || 0) * 90)}%`;
    if (dom.barTension) dom.barTension.style.width = `${Math.min(100, (fr.tension || 0) * 90)}%`;

    if (state.phonkCooldown > 0) state.phonkCooldown -= dt;
    if (fr.kickOnset > 0.45 && (state.phonkCooldown || 0) <= 0) {
      if (state.settings?.phonkMode) {
        state.phonkCooldown = 0.16;
        state.whipDir = -(state.whipDir || 1);
        state.camTilt = state.whipDir * 0.048;
        state.zoomPunch = Math.max(state.zoomPunch, 0.075);
        state.velocityTimer = 0.05;
        state.rgbSplit = 1.0;
        state.shake = Math.max(state.shake, 11);
      } else {
        state.zoomPunch = Math.max(state.zoomPunch, 0.022);
      }
      state.bgPulse = Math.max(state.bgPulse, 0.65);
    }

    const sec = state.analysis.sections.find(s => t >= s.start && t < s.end);
    if (sec) {
      dom.statSection.textContent = sec.instrument ? `${sec.type} • ${sec.instrument}` : sec.type;
      if (dom.telInstrument && sec.instrument) dom.telInstrument.textContent = sec.instrument;
      if (dom.telRhythm && sec.rhythm) dom.telRhythm.textContent = sec.rhythm;
    }
  }

  const prog = state.duration > 0 ? t / state.duration : 0;
  const newPhase = prog < 0.22 ? 1 : prog < 0.52 ? 2 : prog < 0.82 ? 3 : 4;
  if (newPhase !== state.phase) {
    state.phase = newPhase;
    const pInfo = PHASES[newPhase - 1];
    dom.phaseBadge.textContent = `FASE ${newPhase}`;
    dom.phaseName.textContent = pInfo.name;
    state.shake = 14;
    state.flashAlpha = 0.28;
    spawnParticles(state.blixer.x, state.blixer.y, COLORS.pink, 32, 120, 440);
  }

  const hwLatency = (state.settings?.autoLatencyComp !== false && state.audioCtx)
    ? ((state.audioCtx.baseLatency || 0) + (state.audioCtx.outputLatency || 0))
    : 0;
  const syncT = Math.max(0, t - hwLatency + ((state.settings?.syncOffsetMs || 0) / 1000));
  state.syncTime = syncT;

  // Compute exact continuous beatPhase (0..1) and barPhase (0..1) from current BPM / meter
  const beatDurNow = Math.max(0.15, state.liveBeatDur || (60 / (state.liveBpm || 128)));
  const off0 = state.analysis?.bestOffset || 0;
  const beatPosTotal = Math.max(0, (syncT - off0) / beatDurNow);
  state.beatPhase = beatPosTotal - Math.floor(beatPosTotal);
  const mLenNow = state.beatsPerBar || 4;
  const barPosTotal = beatPosTotal / mLenNow;
  state.barPhase = barPosTotal - Math.floor(barPosTotal);

  while (state.nextEventIdx < state.schedule.length && state.schedule[state.nextEventIdx].spawnTime <= syncT) {
    spawnSetpieceEvent(state.schedule[state.nextEventIdx], dom.statSetpiece);
    state.nextEventIdx++;
  }

  // Update live measure dots, accent, motif, and artifact layer badges
  if (dom.telBeatDots) {
    const mLen = state.beatsPerBar || 4;
    const curBeat = state.beatInBar || 0;
    dom.telBeatDots.textContent = Array.from({ length: mLen }, (_, i) => (i === curBeat ? "●" : "○")).join(" ");
  }
  if (dom.telAccent) {
    const accMap = { DOWNBEAT: "FUERTE", SECONDARY: "MEDIO", WEAK: "DÉBIL", SYNCOPATED: "SÍNCOPA", SUBDIVISION: state.currentSubdivision || "1/2", PRE_DROP: "PRE-DROP" };
    dom.telAccent.textContent = accMap[state.lastAccentLevel] || "FUERTE";
  }
  if (dom.telLayers) {
    const lyr = state.activeArtifactLayers || 1;
    dom.telLayers.textContent = `${lyr}x ${lyr === 1 ? "CAPA" : "CAPAS"}`;
  }
  if (dom.telMeter) dom.telMeter.textContent = `${state.meterLabel || "4/4"} • M:${state.currentMotif || "A"}`;

  const b = state.blixer;
  const pInfo = PHASES[state.phase - 1];
  const timeLeft = state.duration > 0 ? (state.duration - t) : 99;

  // CONCLUSIVE JSAB FINALE (last 2.2 seconds of the song)
  if (state.duration > 5 && timeLeft <= 2.2) {
    if (!state.finaleTriggered) {
      state.finaleTriggered = true;
      // Dissolve remaining attacks into harmless white/cyan sparks
      for (const ent of state.entities) {
        if (Number.isFinite(ent.x) && Number.isFinite(ent.y)) {
          spawnParticles(ent.x, ent.y, COLORS.white, 4, 40, 140);
        }
      }
      state.entities = [];
      b.targetX = W * 0.5;
      b.targetY = H * 0.42;
    }

    if (!state.bossDefeated && Math.random() < 0.42) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * b.r * 0.95;
      state.particles.push({
        x: b.x + Math.cos(ang) * dist,
        y: b.y + Math.sin(ang) * dist,
        vx: Math.cos(ang) * 18,
        vy: Math.sin(ang) * 18,
        r: 8 + Math.random() * 12,
        expandRate: 95 + Math.random() * 90,
        isRing: Math.random() < 0.5,
        color: COLORS.white,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6
      });
    }

    if (timeLeft <= 0.85 && !state.bossDefeated) {
      state.bossDefeated = true;
      state.flashAlpha = 0.75;
      state.shake = 22;
      state.zoomPunch = 0.06;
    }

    b.mood = "sad";
    b.jitter = state.bossDefeated ? 0 : 14;
    b.x = Utils.lerp(b.x, W * 0.5, dt * 6);
    b.y = Utils.lerp(b.y, H * 0.42, dt * 6);

    // Move Cyan triumphantly toward lower center
    state.cyan.x = Utils.lerp(state.cyan.x, W * 0.5, dt * 3);
    state.cyan.y = Utils.lerp(state.cyan.y, H * 0.68, dt * 3);
    state.cyan.vx = 0; state.cyan.vy = 0;

    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.expandRate) p.r += p.expandRate * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);
    state.shake = Math.max(0, state.shake - dt * 24);
    state.zoomPunch = Utils.lerp(state.zoomPunch, 0, dt * 8);
    state.flashAlpha = Math.max(0, state.flashAlpha - dt * 1.4);
    return;
  }

  // 1. 0.8s Audio Lookahead for Anticipation before Drops!
  let currentSecType = "VERSE";
  if (state.analysis && !state.liveAnalyser) {
    const idx = Utils.clamp(Math.floor(t * state.analysis.fps), 0, state.analysis.frames.length - 1);
    const futIdx = Utils.clamp(idx + Math.floor(0.8 * state.analysis.fps), 0, state.analysis.frames.length - 1);
    const curRms = state.analysis.frames[idx].rms;
    const futureRms = state.analysis.frames[futIdx].rms;
    const isDropComing = (futureRms - curRms) > 0.32;
    b.lookaheadCharge = Utils.lerp(b.lookaheadCharge || 0, isDropComing ? 1 : 0, dt * 6);

    const sec = state.analysis.sections.find(s => t >= s.start && t < s.end);
    if (sec) currentSecType = sec.type;
  } else {
    b.lookaheadCharge = Utils.lerp(b.lookaheadCharge || 0, 0, dt * 6);
  }

  // 2. Emotional Mood State Machine
  if (b.lookaheadCharge > 0.4 || currentSecType === "BUILDUP") b.mood = "tense";
  else if (currentSecType === "DROP" || bass > 0.65) b.mood = "frenzy";
  else if (currentSecType === "BREAKDOWN" || currentSecType === "SILENCE") b.mood = "sad";
  else b.mood = "smug";

  // 3. Band-to-Body-Part Mapping
  b.rot += dt * (0.9 + state.phase * 0.45 + high * 2.2);
  b.jitter = (b.mood === "tense" ? 5.5 : 0) + b.lookaheadCharge * 7 + high * 2.5;
  b.pulse = Math.max(0, b.pulse - dt * 4.2);
  b.mouthOpen = Utils.lerp(b.mouthOpen, mid * 1.25 + (b.mood === "frenzy" ? 0.25 : 0), dt * 18);

  if (b.lookaheadCharge > 0.45) {
    b.scaleX = Utils.lerp(b.scaleX || 1, 1.22, dt * 8);
    b.scaleY = Utils.lerp(b.scaleY || 1, 0.78, dt * 8);
  } else if (bass > 0.68 || b.pulse > 0.85) {
    b.scaleX = Utils.lerp(b.scaleX || 1, 1.26, dt * 20);
    b.scaleY = Utils.lerp(b.scaleY || 1, 0.80, dt * 20);
  } else {
    b.scaleX = Utils.lerp(b.scaleX || 1, 1.0, dt * 11);
    b.scaleY = Utils.lerp(b.scaleY || 1, 1.0, dt * 11);
  }

  const leanToCyan = Utils.clamp((state.cyan.x - b.x) / (W * 0.6), -1, 1) * 0.16;
  const beatAngle = (state.beatPhase || 0) * Math.PI * 2;
  const barAngle = (state.barPhase || 0) * Math.PI * 2;
  const headbang = Math.sin(beatAngle) * (b.mood === "frenzy" ? 0.14 : 0.06);
  b.tilt = Utils.lerp(b.tilt || 0, leanToCyan + headbang, dt * 12);

  if (b.annoyedTimer > 0) b.annoyedTimer -= dt;
  b.blinkTimer = (b.blinkTimer ?? 2.5) - dt;
  if (b.blinkTimer <= 0) {
    b.isBlinking = !b.isBlinking;
    b.blinkTimer = b.isBlinking ? 0.11 : (2.2 + Math.random() * 2.8);
  }

  b.r = Utils.clamp(b.baseR * pInfo.scale * (1 + bass * 0.22 + b.pulse * 0.18), 32, 105);

  if (!b.trail) b.trail = [];
  const tx = Number.isFinite(b.targetX) ? b.targetX : W * 0.5;
  const ty = Number.isFinite(b.targetY) ? b.targetY : H * 0.26;
  const prevX = b.x, prevY = b.y;
  b.x = Utils.lerp(b.x, tx + Math.sin(barAngle) * 26, dt * 9.5);
  b.y = Utils.lerp(b.y, ty + Math.cos(beatAngle) * 14, dt * 9.5);

  if (Math.hypot(b.x - prevX, b.y - prevY) > 4) {
    b.trail.push({ x: b.x, y: b.y, r: b.r, alpha: 0.55 });
    if (b.trail.length > 6) b.trail.shift();
  }
  for (const tr of b.trail) tr.alpha -= dt * 3.0;
  b.trail = b.trail.filter(tr => tr.alpha > 0);

  const distMul = state.customBoss?.handsDistanceMul ?? 1.0;
  const handAnim = state.customBoss?.handsAnim || "alternating";
  const handSpread = (b.mood === "tense" ? 1.55 : (b.mood === "frenzy" ? 2.45 : 2.05)) * distMul;
  const amp = b.mood === "frenzy" ? 36 : 20;
  let lx = b.x - b.r * handSpread, ly = b.y + 24;
  let rx = b.x + b.r * handSpread, ry = b.y + 24;

  if (handAnim === "alternating") {
    const hb = Math.sin(beatAngle) * amp;
    ly += hb; ry -= hb;
  } else if (handAnim === "sync") {
    const hb = Math.sin(beatAngle) * amp;
    ly += hb; ry += hb;
  } else if (handAnim === "orbit") {
    const rad = b.r * handSpread;
    lx = b.x + Math.cos(barAngle + Math.PI) * rad;
    ly = b.y + Math.sin(barAngle + Math.PI) * rad;
    rx = b.x + Math.cos(barAngle) * rad;
    ry = b.y + Math.sin(barAngle) * rad;
  } else if (handAnim === "vibe") {
    const groove = Math.abs(Math.sin(beatAngle)) * -amp * 1.15;
    const sway = Math.cos(barAngle) * 18;
    lx += sway; rx += sway;
    ly += groove; ry += groove;
  } else if (handAnim === "wave") {
    lx += Math.sin(beatAngle) * 24;
    rx -= Math.sin(beatAngle) * 24;
    ly += Math.cos(beatAngle) * amp;
    ry += Math.cos(beatAngle) * amp;
  }

  b.leftHand.x = Utils.lerp(b.leftHand.x, lx, dt * 8);
  b.leftHand.y = Utils.lerp(b.leftHand.y, ly, dt * 8);
  b.rightHand.x = Utils.lerp(b.rightHand.x, rx, dt * 8);
  b.rightHand.y = Utils.lerp(b.rightHand.y, ry, dt * 8);

  const entDt = dt * (state.settings?.attackSpeed ?? 1);
  for (const ent of state.entities) {
    if (ent.impactTime > 0 && ent.leadTime > 0 && Number.isFinite(ent.spawnClock)) {
      // Phase-locked telegraph: advance age directly from master audio clock (0-frame drift!)
      const targetAge = Math.max(0, state.syncTime - ent.spawnClock);
      const exactDt = Math.max(0, targetAge - (ent.age || 0));
      ent.update(exactDt, W, H);
    } else {
      ent.update(entDt, W, H);
    }
  }
  state.entities = state.entities.filter(e => !e.dead);

  updateCyanAI(dt);

  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  state.particles = state.particles.filter(p => p.life > 0);

  state.shake = Math.max(0, state.shake - dt * 30);
  state.zoomPunch = Utils.lerp(state.zoomPunch, 0, dt * 12);
  state.camTilt = Utils.lerp(state.camTilt || 0, 0, dt * 11);
  state.rgbSplit = Math.max(0, (state.rgbSplit || 0) - dt * 4.2);
  state.flashAlpha = Math.max(0, state.flashAlpha - dt * 2.2);
  state.bgPulse = Math.max(0, state.bgPulse - dt * 2.6);
}

async function loadAudioFile(file) {
  if (!file) return false;
  dom.trackStatus.textContent = "Analizando...";
  try {
    const ac = ensureAudioContext();
    const buf = await file.arrayBuffer();
    const decoded = await ac.decodeAudioData(buf.slice(0));
    loadAudioBuffer(decoded, file.name);
    return true;
  } catch {
    try {
      await loadMediaElementFallback(file);
      return true;
    } catch {
      dom.trackStatus.textContent = "Error";
      showToast("No se pudo decodificar este formato de archivo", "error");
      return false;
    }
  }
}

function applyAspect(aspect) {
  const preset = ASPECT_PRESETS[aspect];
  if (!preset) return;
  state.aspect = aspect;
  state.width = preset.w;
  state.height = preset.h;
  dom.canvas.width = preset.w;
  dom.canvas.height = preset.h;
  dom.resolutionLabel.textContent = preset.label;

  document.querySelectorAll(".aspect-btn").forEach(b => {
    const active = b.dataset.aspect === aspect;
    b.classList.toggle("border-[#00F0FF]", active);
    b.classList.toggle("bg-[#00F0FF]/15", active);
    b.classList.toggle("text-[#00F0FF]", active);
    b.classList.toggle("border-slate-700", !active);
    b.classList.toggle("bg-[#090b1a]", !active);
    b.classList.toggle("text-slate-300", !active);
  });
  resetWorldEntities();
}

// Event Listeners
dom.audioInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await loadAudioFile(file);
});

dom.demoBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const { buffer, title } = generateDemoTrack(btn.dataset.demo);
    loadAudioBuffer(buffer, title);
    startPlayback(0);
  });
});

dom.btnPlayPause.addEventListener("click", () => {
  if (state.isPlaying) pausePlayback();
  else {
    const clip = state.studio?.clip;
    let offset = state.pauseOffset;
    if (clip?.enabled && (offset < clip.start || offset >= clip.end)) {
      offset = clip.start;
      state.pauseOffset = offset;
      state.nextEventIdx = state.schedule.findIndex(ev => ev.spawnTime >= offset);
      if (state.nextEventIdx === -1) state.nextEventIdx = state.schedule.length;
      resetWorldEntities();
    }
    startPlayback(offset);
  }
});

dom.btnRestart.addEventListener("click", () => {
  const clip = state.studio?.clip;
  const startT = (clip?.enabled && clip.start > 0 && clip.start < state.duration) ? clip.start : 0;
  state.pauseOffset = startT;
  state.nextEventIdx = state.schedule.findIndex(ev => ev.spawnTime >= startT);
  if (state.nextEventIdx === -1) state.nextEventIdx = state.schedule.length;
  resetWorldEntities();
  startPlayback(startT);
});

dom.btnRecord.addEventListener("click", () => {
  if (state.isRecording) { pausePlayback(); stopRecordingAndDownload(); }
  else startRecordingFullTrack();
});

dom.toggleHud.addEventListener("change", (e) => { state.showHud = e.target.checked; });

dom.aspectBtns.forEach(btn => {
  btn.addEventListener("click", () => applyAspect(btn.dataset.aspect));
});

document.getElementById("btnCaptureTab")?.addEventListener("click", startTabAudioCapture);
document.getElementById("btnCaptureTabOverlay")?.addEventListener("click", startTabAudioCapture);

const scrubTimelineAt = (clientX) => {
  if (!state.audioBuffer && !state.mediaEl) return;
  const rect = dom.timelineWrapper.getBoundingClientRect();
  const target = Utils.clamp((clientX - rect.left) / rect.width, 0, 1) * state.duration;
  state.pauseOffset = target;
  state.currentTime = target;
  state.nextEventIdx = state.schedule.findIndex(ev => ev.spawnTime >= target);
  if (state.nextEventIdx === -1) state.nextEventIdx = state.schedule.length;
  resetWorldEntities();
  if (state.isPlaying) startPlayback(target);
  drawTimeline(tCtx, dom.timelineCanvas);
};
dom.timelineWrapper.addEventListener("click", (e) => scrubTimelineAt(e.clientX));
dom.timelineWrapper.addEventListener("touchstart", (e) => {
  if (e.touches?.[0]) scrubTimelineAt(e.touches[0].clientX);
}, { passive: true });

let lastNow = performance.now();
function mainLoop(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (state.isPlaying && state.audioCtx) {
    state.currentTime = state.mediaEl ? state.mediaEl.currentTime : (state.audioCtx.currentTime - state.startTime);
    dom.timeCurrent.textContent = Utils.formatTime(state.currentTime);
    updateSimulation(dt);
    drawTimeline(tCtx, dom.timelineCanvas);

    // Enforce Clip Out range when enabled
    const clip = state.studio?.clip;
    if (clip?.enabled && clip.end > clip.start && state.currentTime >= clip.end) {
      pausePlayback();
      state.pauseOffset = clip.start;
      if (state.isRecording) stopRecordingAndDownload();
    }
  } else if (state.bossDefeated) {
    // Keep victory explosion particles & flash fading smoothly after audio ends!
    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.expandRate) p.r += p.expandRate * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);
    state.shake = Math.max(0, state.shake - dt * 24);
    state.zoomPunch = Utils.lerp(state.zoomPunch, 0, dt * 8);
    state.flashAlpha = Math.max(0, state.flashAlpha - dt * 1.4);
  }
  renderFrame(ctx);
  requestAnimationFrame(mainLoop);
}

initStudioControls(showToast, {
  canvas: dom.canvas,
  setAspect: applyAspect,
  loadAudioFile,
  startRecordingFullTrack,
  stopRecordingAndDownload,
  redrawTimeline: () => drawTimeline(tCtx, dom.timelineCanvas)
});

const resizeTimeline = () => {
  dom.timelineCanvas.width = dom.timelineWrapper.clientWidth || 400;
  dom.timelineCanvas.height = dom.timelineWrapper.clientHeight || 40;
  drawTimeline(tCtx, dom.timelineCanvas);
};
window.addEventListener("resize", resizeTimeline);
resizeTimeline();
requestAnimationFrame(mainLoop);
