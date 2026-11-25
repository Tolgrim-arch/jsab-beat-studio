export const state = {
  aspect: "16:9",
  width: 1280,
  height: 720,
  audioCtx: null,
  audioBuffer: null,
  sourceNode: null,
  mediaDest: null,
  isPlaying: false,
  startTime: 0,
  pauseOffset: 0,
  currentTime: 0,
  duration: 0,
  trackTitle: "",
  analysis: null,
  schedule: [],
  nextEventIdx: 0,
  isRecording: false,
  mediaRecorder: null,
  recordedChunks: [],
  showHud: true,

  phase: 1,
  activeSetpiece: "INTRO",
  shake: 0,
  zoomPunch: 0,
  camTilt: 0,
  hitstopTimer: 0,
  beatPulse: 0,
  flashAlpha: 0,
  bgPulse: 0,
  customColors: {
    enabled: false,
    bg: "#040D14",
    danger: "#FF1E6E",
    cyan: "#00F0FF",
    trail: "#0077FF",
    eq: "#00F0FF"
  },
  settings: {
    syncOffsetMs: 0,
    attackSpeed: 1.0,
    attackDensity: 1.0,
    bossScale: 1.0,
    shakeMul: 1.0,
    zoomMul: 1.0,
    eqAlpha: 0.14,
    impactFlashMul: 0.55,
    phonkMode: false
  },
  velocityTimer: 0,
  rgbSplit: 0,
  whipDir: 1,
  customBoss: {
    img: null,
    frame: "circle",      // "none" | "circle" | "square"
    frameWidth: 6,        // 0 to 16 px
    spikesMode: "phase3", // "always" | "phase3" | "never"
    spikesShape: "auto",  // "auto" | "circle" | "square" | "hexagon" | "triangle"
    spikesLayer: "behind",// "behind" | "above"
    spikeCount: 12,       // 4 to 20
    spikeRadiusMul: 1.0,  // 0.5 to 2.2
    handsShape: "auto",   // "auto" | "square" | "circle" | "triangle" | "claws" | "peace" | "none"
    handsLayer: "behind", // "behind" | "above"
    handsDistanceMul: 1.0,// 0.5 to 2.2
    handsAnim: "alternating", // "alternating" | "sync" | "orbit" | "vibe" | "wave"
    handsRotate: "tilt",  // "tilt" | "spin" | "none"
    flashIntensity: 0.72  // 0 to 1
  },
  disabledAttacks: {},
  entities: [],
  particles: [],
  blixer: {
    x: 640, y: 200,
    targetX: 640, targetY: 200,
    baseR: 54, r: 54, rot: 0,
    pulse: 0, mouthOpen: 0,
    mood: "smug",
    scaleX: 1, scaleY: 1,
    tilt: 0, jitter: 0,
    blinkTimer: 2.5, isBlinking: false,
    annoyedTimer: 0, lookaheadCharge: 0,
    trail: [],
    leftHand: { x: 440, y: 220 },
    rightHand: { x: 840, y: 220 }
  },
  cyan: {
    x: 640, y: 520, vx: 0, vy: 0,
    r: 12, rot: 0,
    dashCooldown: 0, dashTimer: 0,
    dashDirX: 0, dashDirY: 0,
    trail: [], invuln: 0,
    squash: 1
  }
};

export function spawnParticles(x, y, color, count = 10, sMin = 60, sMax = 240) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = sMin + Math.random() * (sMax - sMin);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      r: 2 + Math.random() * 3, color,
      life: 0.4 + Math.random() * 0.35, maxLife: 0.75
    });
  }
}

export function resetWorldEntities() {
  const W = state.width, H = state.height;
  state.entities = [];
  state.particles = [];
  state.phase = 1;
  state.shake = 0;
  state.zoomPunch = 0;
  state.flashAlpha = 0;
  state.bgPulse = 0;
  state.finaleTriggered = false;
  state.bossDefeated = false;
  state.blixer.x = W * 0.5;
  state.blixer.y = H * 0.26;
  state.cyan.x = W * 0.5;
  state.cyan.y = H * 0.72;
  state.cyan.vx = 0;
  state.cyan.vy = 0;
  state.cyan.trail = [];
  state.cyan.invuln = 0;
}
