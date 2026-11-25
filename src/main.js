import { ASPECT_PRESETS, COLORS, PHASES } from "./config.js";
import { Utils } from "./utils.js";
import { state, spawnParticles, resetWorldEntities } from "./state.js";
import { ensureAudioContext, generateDemoTrack, analyzeAudioBuffer } from "./audio/analyzer.js";
import { buildChoreographySchedule, spawnSetpieceEvent } from "./combat/choreography.js";
import { updateCyanAI } from "./combat/cyanAI.js";
import { renderFrame, drawTimeline } from "./render/renderer.js";
import { initStudioControls } from "./ui/controls.js";

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
  barBass: document.getElementById("barBass"),
  barMid: document.getElementById("barMid"),
  barHigh: document.getElementById("barHigh"),
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

function stopAudioSource() {
  if (state.sourceNode) {
    try { state.sourceNode.stop(); } catch {}
    try { state.sourceNode.disconnect(); } catch {}
    state.sourceNode = null;
  }
  if (state.mediaEl) {
    state.mediaEl.pause();
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
  state.schedule = buildChoreographySchedule();
  state.nextEventIdx = 0;
  resetWorldEntities();

  dom.emptyOverlay.classList.add("hidden");
  dom.trackName.textContent = title;
  dom.trackStatus.textContent = "Sincronizado";
  dom.trackStatus.className = "text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300";
  dom.statBpm.textContent = state.analysis.bpm;
  dom.statDuration.textContent = Utils.formatTime(state.duration);
  dom.statEvents.textContent = state.schedule.length;
  dom.statArchetype.textContent = state.analysis.archetype.label;
  dom.timeTotal.textContent = Utils.formatTime(state.duration);
  dom.btnPlayPause.disabled = false;
  dom.btnRestart.disabled = false;
  dom.btnRecord.disabled = false;

  drawTimeline(tCtx, dom.timelineCanvas);
  showToast(`${state.analysis.bpm} BPM • Arquetipo: ${state.analysis.archetype.label}`, "success");
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

function startRecordingFullTrack() {
  if ((!state.audioBuffer && !state.mediaEl) || state.isRecording) return;
  const stream = dom.canvas.captureStream(60);
  if (state.mediaDest) state.mediaDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";

  state.recordedChunks = [];
  state.mediaRecorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
  state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.recordedChunks.push(e.data); };
  state.mediaRecorder.onstop = () => {
    const blob = new Blob(state.recordedChunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jsab_v2_${state.aspect.replace(":", "x")}_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Video exportado correctamente", "success");
  };

  state.isRecording = true;
  dom.recIcon.classList.add("rec-dot");
  dom.recBtnText.textContent = "Grabando... (Detener)";
  state.pauseOffset = 0;
  state.nextEventIdx = 0;
  resetWorldEntities();
  state.mediaRecorder.start();
  startPlayback(0);
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
    bass = avg(0, 8);
    mid = avg(8, 36);
    high = avg(36, 96);
    dom.barBass.style.width = `${Math.min(100, bass * 115)}%`;
    dom.barMid.style.width = `${Math.min(100, mid * 115)}%`;
    dom.barHigh.style.width = `${Math.min(100, high * 115)}%`;
    if (bass > 0.62) {
      state.zoomPunch = Math.max(state.zoomPunch, 0.024);
      state.bgPulse = Math.max(state.bgPulse, 0.7);
    }
  } else if (state.analysis) {
    const idx = Utils.clamp(Math.floor(t * state.analysis.fps), 0, state.analysis.frames.length - 1);
    const fr = state.analysis.frames[idx];
    bass = fr.bass; mid = fr.mid; high = fr.high;
    dom.barBass.style.width = `${Math.min(100, bass * 90)}%`;
    dom.barMid.style.width = `${Math.min(100, mid * 90)}%`;
    dom.barHigh.style.width = `${Math.min(100, high * 90)}%`;

    if (fr.kickOnset > 0.45) {
      state.zoomPunch = Math.max(state.zoomPunch, 0.022);
      state.bgPulse = Math.max(state.bgPulse, 0.65);
    }

    const sec = state.analysis.sections.find(s => t >= s.start && t < s.end);
    if (sec) dom.statSection.textContent = sec.type;
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

  while (state.nextEventIdx < state.schedule.length && state.schedule[state.nextEventIdx].spawnTime <= t) {
    spawnSetpieceEvent(state.schedule[state.nextEventIdx], dom.statSetpiece);
    state.nextEventIdx++;
  }

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
  const headbang = Math.sin(t * (state.analysis ? (state.analysis.bpm / 60) * Math.PI : 6.5)) * (b.mood === "frenzy" ? 0.14 : 0.06);
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
  b.x = Utils.lerp(b.x, tx + Math.sin(t * 2.2) * 26, dt * 9.5);
  b.y = Utils.lerp(b.y, ty + Math.cos(t * 2.8) * 16, dt * 9.5);

  if (Math.hypot(b.x - prevX, b.y - prevY) > 4) {
    b.trail.push({ x: b.x, y: b.y, r: b.r, alpha: 0.55 });
    if (b.trail.length > 6) b.trail.shift();
  }
  for (const tr of b.trail) tr.alpha -= dt * 3.0;
  b.trail = b.trail.filter(tr => tr.alpha > 0);

  const handSpread = b.mood === "tense" ? 1.55 : (b.mood === "frenzy" ? 2.45 : 2.05);
  const handBounce = Math.sin(t * 6) * (b.mood === "frenzy" ? 32 : 16);
  b.leftHand.x = Utils.lerp(b.leftHand.x, b.x - b.r * handSpread, dt * 8);
  b.leftHand.y = Utils.lerp(b.leftHand.y, b.y + 24 + handBounce, dt * 8);
  b.rightHand.x = Utils.lerp(b.rightHand.x, b.x + b.r * handSpread, dt * 8);
  b.rightHand.y = Utils.lerp(b.rightHand.y, b.y + 24 - handBounce, dt * 8);

  for (const ent of state.entities) ent.update(dt, W, H);
  state.entities = state.entities.filter(e => !e.dead);

  updateCyanAI(dt);

  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  state.particles = state.particles.filter(p => p.life > 0);

  state.shake = Math.max(0, state.shake - dt * 30);
  state.zoomPunch = Utils.lerp(state.zoomPunch, 0, dt * 12);
  state.flashAlpha = Math.max(0, state.flashAlpha - dt * 2.2);
  state.bgPulse = Math.max(0, state.bgPulse - dt * 2.6);
}

// Event Listeners
dom.audioInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  dom.trackStatus.textContent = "Analizando...";
  try {
    const ac = ensureAudioContext();
    const buf = await file.arrayBuffer();
    const decoded = await ac.decodeAudioData(buf.slice(0));
    loadAudioBuffer(decoded, file.name);
  } catch {
    try {
      await loadMediaElementFallback(file);
    } catch {
      dom.trackStatus.textContent = "Error";
      showToast("No se pudo decodificar este formato de archivo", "error");
    }
  }
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
  else startPlayback(state.pauseOffset);
});

dom.btnRestart.addEventListener("click", () => {
  state.pauseOffset = 0;
  state.nextEventIdx = 0;
  resetWorldEntities();
  startPlayback(0);
});

dom.btnRecord.addEventListener("click", () => {
  if (state.isRecording) { pausePlayback(); stopRecordingAndDownload(); }
  else startRecordingFullTrack();
});

dom.toggleHud.addEventListener("change", (e) => { state.showHud = e.target.checked; });

dom.aspectBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const aspect = btn.dataset.aspect;
    const preset = ASPECT_PRESETS[aspect];
    state.aspect = aspect;
    state.width = preset.w;
    state.height = preset.h;
    dom.canvas.width = preset.w;
    dom.canvas.height = preset.h;
    dom.resolutionLabel.textContent = preset.label;

    dom.aspectBtns.forEach(b => {
      const active = b.dataset.aspect === aspect;
      b.classList.toggle("border-[#00F0FF]", active);
      b.classList.toggle("bg-[#00F0FF]/15", active);
      b.classList.toggle("text-[#00F0FF]", active);
      b.classList.toggle("border-slate-700", !active);
      b.classList.toggle("bg-[#090b1a]", !active);
      b.classList.toggle("text-slate-300", !active);
    });
    resetWorldEntities();
  });
});

dom.timelineWrapper.addEventListener("click", (e) => {
  if (!state.audioBuffer && !state.mediaEl) return;
  const rect = dom.timelineWrapper.getBoundingClientRect();
  const target = Utils.clamp((e.clientX - rect.left) / rect.width, 0, 1) * state.duration;
  state.pauseOffset = target;
  state.currentTime = target;
  state.nextEventIdx = state.schedule.findIndex(ev => ev.spawnTime >= target);
  if (state.nextEventIdx === -1) state.nextEventIdx = state.schedule.length;
  resetWorldEntities();
  if (state.isPlaying) startPlayback(target);
  drawTimeline(tCtx, dom.timelineCanvas);
});

let lastNow = performance.now();
function mainLoop(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (state.isPlaying && state.audioCtx) {
    state.currentTime = state.mediaEl ? state.mediaEl.currentTime : (state.audioCtx.currentTime - state.startTime);
    dom.timeCurrent.textContent = Utils.formatTime(state.currentTime);
    updateSimulation(dt);
    drawTimeline(tCtx, dom.timelineCanvas);
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

initStudioControls(showToast);

const resizeTimeline = () => {
  dom.timelineCanvas.width = dom.timelineWrapper.clientWidth || 400;
  dom.timelineCanvas.height = dom.timelineWrapper.clientHeight || 40;
  drawTimeline(tCtx, dom.timelineCanvas);
};
window.addEventListener("resize", resizeTimeline);
resizeTimeline();
requestAnimationFrame(mainLoop);
