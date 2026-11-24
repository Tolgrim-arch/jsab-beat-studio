import { ASPECT_PRESETS, COLORS, PHASES } from "./config.js";
import { Utils } from "./utils.js";
import { state, spawnParticles, resetWorldEntities } from "./state.js";
import { ensureAudioContext, generateDemoTrack, analyzeAudioBuffer } from "./audio/analyzer.js";
import { buildChoreographySchedule, spawnSetpieceEvent } from "./combat/choreography.js";
import { updateCyanAI } from "./combat/cyanAI.js";
import { renderFrame, drawTimeline } from "./render/renderer.js";

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
    state.sourceNode.disconnect();
    state.sourceNode = null;
  }
}

function updatePlayButtonUI() {
  dom.iconPlay.classList.toggle("hidden", state.isPlaying);
  dom.iconPause.classList.toggle("hidden", !state.isPlaying);
}

function startPlayback(offsetSec = state.pauseOffset) {
  if (!state.audioBuffer) return;
  const ac = ensureAudioContext();
  stopAudioSource();

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

function startRecordingFullTrack() {
  if (!state.audioBuffer || state.isRecording) return;
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
  if (state.analysis) {
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
  b.rot += dt * (0.8 + state.phase * 0.45);
  b.pulse = Math.max(0, b.pulse - dt * 3.5);
  b.mouthOpen = Utils.lerp(b.mouthOpen, mid * 0.9, dt * 16);
  b.r = b.baseR * pInfo.scale * (1 + bass * 0.22 + b.pulse * 0.14);

  const targetX = W * 0.5 + Math.sin(t * 1.15 * pInfo.speedMul) * (W * 0.24);
  const targetY = H * 0.24 + Math.cos(t * 1.65 * pInfo.speedMul) * (H * 0.06);
  b.x = Utils.lerp(b.x, targetX, dt * 4);
  b.y = Utils.lerp(b.y, targetY, dt * 4);

  b.leftHand.x = Utils.lerp(b.leftHand.x, b.x - b.r * 2.1 + Math.sin(t * 3) * 18, dt * 6);
  b.leftHand.y = Utils.lerp(b.leftHand.y, b.y + 30 + Math.cos(t * 4) * 20, dt * 6);
  b.rightHand.x = Utils.lerp(b.rightHand.x, b.x + b.r * 2.1 - Math.sin(t * 3) * 18, dt * 6);
  b.rightHand.y = Utils.lerp(b.rightHand.y, b.y + 30 + Math.cos(t * 4) * 20, dt * 6);

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
  try {
    dom.trackStatus.textContent = "Analizando...";
    const ac = ensureAudioContext();
    const buf = await file.arrayBuffer();
    const decoded = await ac.decodeAudioData(buf);
    loadAudioBuffer(decoded, file.name);
  } catch {
    showToast("Error al decodificar el audio", "error");
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
  if (!state.audioBuffer) return;
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
    state.currentTime = state.audioCtx.currentTime - state.startTime;
    dom.timeCurrent.textContent = Utils.formatTime(state.currentTime);
    updateSimulation(dt);
    drawTimeline(tCtx, dom.timelineCanvas);
  }
  renderFrame(ctx);
  requestAnimationFrame(mainLoop);
}

const resizeTimeline = () => {
  dom.timelineCanvas.width = dom.timelineWrapper.clientWidth || 400;
  dom.timelineCanvas.height = dom.timelineWrapper.clientHeight || 40;
  drawTimeline(tCtx, dom.timelineCanvas);
};
window.addEventListener("resize", resizeTimeline);
resizeTimeline();
requestAnimationFrame(mainLoop);
