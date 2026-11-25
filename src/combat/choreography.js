import { PHASES } from "../config.js";
import { Utils } from "../utils.js";
import { state, spawnParticles } from "../state.js";
import { AttackFactory } from "./attacks.js?v=62";

export const ATTACK_CATALOG = [
  { id: "DROP_EXPLOSION",    icon: "💥", name: "Explosión Drop",       desc: "Onda de choque, 4 láseres en cruz, anillo de diamantes y Mega-Rayo." },
  { id: "MEGA_MOUTH_BEAM",   icon: "⚡", name: "Mega-Rayo Annihilate", desc: "Haz gigante horizontal o vertical con burbujas hirvientes y agujeros negros." },
  { id: "TOUHOU_DANMAKU",    icon: "🌸", name: "Bullet Hell Touhou",   desc: "Espirales Danmaku de múltiples brazos, anillos en flor y abanicos dirigidos." },
  { id: "CLOCKWORK_LASERS",  icon: "🌀", name: "Tornado 4 Brazos",     desc: "El jefe al centro gira 4 brazos de engranajes como tornado + láseres radiales." },
  { id: "CLOSE_TO_ME_ORBS",  icon: "🦾", name: "Brazos 8 Púas",        desc: "2 brazos articulados con palma hueca, rayos giratorios y bombas de pulso." },
  { id: "LYCANTHROPY_VINES", icon: "🌋", name: "Suite Lycanthropy",    desc: "Olas de lava, gusano de engranajes gigante, jaula dentada y fuente de esporas." },
  { id: "ORB_RAIN",          icon: "⚙️", name: "Lluvia Engranajes",    desc: "Olas de lava bajas con lluvia de mini-engranajes de 8 púas y orbes." },
  { id: "TWIN_HAND_SMASH",   icon: "👊", name: "Golpe de Manos",       desc: "Aplastamientos laterales con manos gigantes, brazos y láser horizontal." },
  { id: "HYDRAULIC_CRUSH",   icon: "🗜️", name: "Pistones Prensa",      desc: "Pistones hidráulicos cerrando los bordes + láser divisor." },
  { id: "BARRACUDA_SWARM",   icon: "🐍", name: "Serpientes Zig-Zag",   desc: "3 serpientes Barracuda paralelas + ráfaga de triángulos." },
  { id: "BUILDUP_LOCKON",    icon: "🎯", name: "Láseres Sniper",       desc: "3 láseres fijando a Cian + bombas de pulso cronometradas." },
  { id: "CHECKERBOARD_DANCE",icon: "🏁", name: "Tablero Mortal",       desc: "Zonas de peligro en patrón ajedrez alternándose con el beat." },
  { id: "WAVE_CORRIDOR",     icon: "🚧", name: "Barras Corredor",      desc: "Barras que barren la arena dejando un único pasillo seguro." },
  { id: "SAWBLADE_GAUNTLET", icon: "🪚", name: "Sierras Rebotantes",   desc: "Sierras circulares rebotando por toda la pantalla." },
  { id: "MANDALA_BLOOM",     icon: "🌸", name: "Flor Mandala",         desc: "Anillos giratorios de triángulos brotando desde el jefe." },
  { id: "SYNCOPATED_BURST",  icon: "💎", name: "Ráfaga Sincopada",     desc: "Abanico rápido de diamantes disparado en contratiempos." },
  { id: "BREAKDOWN_PULSE",   icon: "💫", name: "Pulso de Calma",       desc: "Onda de choque suave y anillo de 8 orbes para partes tranquilas." }
];

export function buildChoreographySchedule() {
  const { analysis, duration } = state;
  if (!analysis) return [];

  const { beats, beatDur, sections, archetype, bpm } = analysis;
  const rng = Utils.seededRandom(Math.floor(bpm * 131 + analysis.profile.avgBass * 997));
  const schedule = [];

  const phraseLen = 4;
  for (let i = 0; i < beats.length; i += phraseLen) {
    const t = beats[i].t;
    if (t < 0.5 || t > duration - 2.6) continue;

    const sec = sections.find(s => t >= s.start && t < s.end) || { type: "VERSE" };
    const progress = t / duration;
    const phase = progress < 0.2 ? 1 : progress < 0.5 ? 2 : progress < 0.8 ? 3 : 4;

    let setpiece = archetype.setpieces[Math.floor(rng() * archetype.setpieces.length)];
    if (sec.type === "DROP") {
      setpiece = (i % 8 === 0) ? "DROP_EXPLOSION" : archetype.setpieces[Math.floor(rng() * 3)];
    } else if (sec.type === "BUILDUP") {
      setpiece = "BUILDUP_LOCKON";
    } else if (sec.type === "BREAKDOWN" || sec.type === "INTRO") {
      setpiece = "BREAKDOWN_PULSE";
    }

    const INSTANT_SETPIECES = new Set([
      "BARRACUDA_SWARM", "ORB_RAIN", "WAVE_CORRIDOR",
      "SAWBLADE_GAUNTLET", "MANDALA_BLOOM", "BREAKDOWN_PULSE", "SYNCOPATED_BURST"
    ]);

    for (let step = 0; step < phraseLen && (i + step) < beats.length; step++) {
      const b = beats[i + step];
      if (b.isSilent || sec.type === "SILENCE") continue;
      const chosenSetpiece = b.isSyncopated ? "SYNCOPATED_BURST" : setpiece;
      const isInstant = INSTANT_SETPIECES.has(chosenSetpiece);
      const leadTime = isInstant ? 0 : Math.min(0.52, beatDur * 0.88);
      const spawnTime = Math.max(0.02, b.t - leadTime);
      schedule.push({
        spawnTime, impactTime: b.t, leadTime,
        phase, step,
        setpiece: chosenSetpiece,
        section: sec.type, beat: b, seed: rng()
      });
    }
  }

  schedule.sort((a, b) => a.spawnTime - b.spawnTime);
  return schedule;
}

export function spawnSetpieceEvent(ev, domSetpieceEl) {
  const W = state.width, H = state.height;
  const b = state.blixer;
  const cx = state.cyan.x, cy = state.cyan.y;
  const spdMul = PHASES[ev.phase - 1].speedMul * (state.settings?.attackSpeed ?? 1);
  const lt = ev.leadTime;
  const danger = (state.customColors?.enabled ? state.customColors.danger : state.analysis?.dna?.palette?.danger) || "#FF1E6E";

  // Filter disabled attacks (fallback to any enabled attack, or skip if all disabled)
  const disabled = state.disabledAttacks || {};
  let activeSetpiece = ev.setpiece;
  if (disabled[activeSetpiece]) {
    const enabledPool = ATTACK_CATALOG.filter(a => !disabled[a.id]);
    if (!enabledPool.length) return;
    activeSetpiece = enabledPool[Math.floor(ev.seed * enabledPool.length) % enabledPool.length].id;
  }

  state.activeSetpiece = activeSetpiece;
  if (domSetpieceEl) domSetpieceEl.textContent = activeSetpiece.replace(/_/g, " ");
  b.pulse = 1.0;

  // Dramatic Boss Snap-Positioning on beat 0 of every phrase!
  if (ev.step === 0) {
    const spots = [
      { x: W * 0.5, y: H * 0.5 },   // Center stage (JSAB Drop!)
      { x: W * 0.5, y: H * 0.22 },  // Top center
      { x: W * 0.22, y: H * 0.35 }, // Left flank
      { x: W * 0.78, y: H * 0.35 }  // Right flank
    ];
    const pick = ev.section === "DROP" ? spots[0] : spots[Math.floor(ev.seed * spots.length)];
    b.targetX = pick.x;
    b.targetY = pick.y;
    spawnParticles(b.x, b.y, danger, 14, 120, 360);
  }

  const bx = b.x, by = b.y;
  const len = Math.max(W, H) * 1.45;

  switch (activeSetpiece) {
    case "DROP_EXPLOSION": {
      if (ev.step === 0) {
        state.flashAlpha = 0.45;
        state.zoomPunch = 0.055;
        state.shake = 16;
        state.entities.push(AttackFactory.shockwave(bx, by, 520 * spdMul, len, 28));
      }
      // 4 diagonal lasers + 16-bullet double ring
      const baseA = ev.step * 0.38;
      for (let k = 0; k < 4; k++) {
        const a = baseA + (Math.PI / 2) * k;
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 28, lt, 0.26));
      }
      const count = 14 + ev.phase * 2;
      for (let k = 0; k < count; k++) {
        const a = (Math.PI * 2 * k) / count + ev.step * 0.25;
        const spd = (k % 2 === 0 ? 310 : 220) * spdMul;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * spd, Math.sin(a) * spd, 8, "diamond"));
      }
      if (ev.step === 2) {
        const isHoriz = ev.phase % 2 === 0;
        const thick = (isHoriz ? H : W) * 0.24;
        const targetPos = isHoriz ? H * 0.5 : W * 0.5;
        state.entities.push(AttackFactory.megaBeam(isHoriz ? "y" : "x", targetPos, thick, lt, 0.44));
      }
      break;
    }

    case "BUILDUP_LOCKON": {
      // 3 converging sniper lasers locking onto Cyan + pulse bomb
      const ang = Math.atan2(cy - by, cx - bx);
      [-0.22, 0, 0.22].forEach(off => {
        const a = ang + off;
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 24, lt, 0.22));
      });
      if (ev.step % 2 === 0) {
        state.entities.push(AttackFactory.pulseBomb(cx + (ev.seed - 0.5) * 140, cy + (ev.seed - 0.5) * 140, 80, lt, 10, ev.step));
      }
      break;
    }

    case "TWIN_HAND_SMASH": {
      if (ev.step === 0 && !state.entities.some(e => e.type === "articulatedArms")) {
        state.entities.push(AttackFactory.articulatedArms(Math.max(3.6, state.analysis.beatDur * 4.2), spdMul));
      }
      // Simultaneous left + right hand slams + sweeping center laser
      const ty = H * (0.38 + ev.seed * 0.36);
      state.entities.push(AttackFactory.handSlam(W * 0.26, ty, 95 + ev.phase * 8, lt));
      state.entities.push(AttackFactory.handSlam(W * 0.74, H - ty * 0.7, 95 + ev.phase * 8, lt));
      const yBeam = H * (0.25 + ((ev.step * 0.27) % 0.6));
      state.entities.push(AttackFactory.laser(0, yBeam, W, yBeam, 32, lt, 0.26));
      break;
    }

    case "HYDRAULIC_CRUSH": {
      // Twin pistons closing BOTH sides + vertical center laser
      if (ev.step % 2 === 0) {
        state.entities.push(AttackFactory.hydraulicPiston("left", W * 0.26, lt, 0.34));
        state.entities.push(AttackFactory.hydraulicPiston("right", W * 0.26, lt, 0.34));
      } else {
        state.entities.push(AttackFactory.hydraulicPiston("top", H * 0.24, lt, 0.34));
        state.entities.push(AttackFactory.hydraulicPiston("bottom", H * 0.24, lt, 0.34));
      }
      const xBeam = W * (0.35 + ev.seed * 0.3);
      state.entities.push(AttackFactory.laser(xBeam, 0, xBeam, H, 28, lt, 0.25));
      break;
    }

    case "CHECKERBOARD_DANCE": {
      const cols = 4, rows = 3;
      const cw = W / cols, ch = H / rows;
      const parity = ev.step % 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 === parity) state.entities.push(AttackFactory.floorZone(c * cw, r * ch, cw, ch, lt, 0.24));
        }
      }
      // Layer a shockwave on step 0
      if (ev.step === 0) state.entities.push(AttackFactory.shockwave(bx, by, 440 * spdMul, len, 20));
      break;
    }

    case "BARRACUDA_SWARM": {
      // 3 parallel staggered zig-zag serpents + triangle burst
      const dir = ev.step % 2 === 0 ? 1 : -1;
      [0.2, 0.5, 0.8].forEach((frac, idx) => {
        state.entities.push(AttackFactory.barracudaSerpent(H * frac, idx % 2 === 0 ? dir : -dir, 520 * spdMul, 58, 6.2));
      });
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * 2 * k) / 8 + ev.step * 0.4;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 300 * spdMul, Math.sin(a) * 300 * spdMul, 9, "triangle"));
      }
      break;
    }

    case "CLOSE_TO_ME_ORBS": {
      if (ev.step === 0) {
        if (!state.entities.some(e => e.type === "articulatedArms")) {
          state.entities.push(AttackFactory.articulatedArms(Math.max(4.0, state.analysis.beatDur * 4.5), spdMul));
        }
        for (let k = 0; k < 4; k++) {
          const a = (Math.PI * 2 * k) / 4 + ev.seed * Math.PI;
          state.entities.push(AttackFactory.rotatingBeam(bx, by, a, (ev.seed > 0.5 ? 1 : -1) * 1.25 * spdMul, len * 0.7, 22, lt, state.analysis.beatDur * 3.8));
        }
      }
      // 2 pulse bombs per beat
      for (let p = 0; p < 2; p++) {
        const px = 120 + ((ev.seed * (p + 3.1)) % 1) * (W - 240);
        const py = 120 + ((ev.seed * (p + 7.7)) % 1) * (H - 240);
        state.entities.push(AttackFactory.pulseBomb(px, py, 80, lt, 10, ev.step * 0.6));
      }
      break;
    }

    case "CLOCKWORK_LASERS": {
      if (ev.step === 0 && !state.entities.some(e => e.type === "articulatedArms")) {
        const spinDir = ev.phase % 2 === 0 ? 1 : -1;
        state.entities.push(AttackFactory.articulatedArms(Math.max(4.0, state.analysis.beatDur * 4.5), spdMul, "tornado", spinDir));
      }
      const base = ev.step * 0.35 + ev.seed * Math.PI;
      for (let k = 0; k < 6; k++) {
        const a = base + (Math.PI / 3) * k;
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 24, lt, 0.26));
      }
      break;
    }

    case "LYCANTHROPY_VINES": {
      const dur = Math.max(4.0, state.analysis.beatDur * 4.4);
      if (ev.step === 0) {
        if (!state.entities.some(e => e.type === "lavaWaveFloor")) {
          const pat = ev.phase % 2 === 0 ? "doubleCrest" : "traveling";
          state.entities.push(AttackFactory.lavaWaveFloor(dur, pat));
        }
        if (ev.phase >= 2 && !state.entities.some(e => e.type === "sawtoothCage")) {
          state.entities.push(AttackFactory.sawtoothCage(dur, 66));
        }
        state.entities.push(AttackFactory.gearWormArc(ev.phase % 2 === 0 ? 1 : -1, 2.5));
      }
      // Symmetrical spore fountain arcs erupting from bottom center (jgjhg.PNG)
      if (ev.step === 1 || ev.step === 3) {
        const fx = W * 0.5, fy = H * 0.72;
        for (let k = 0; k < 10; k++) {
          const frac = (k / 9) * 2 - 1; // -1 to 1
          const vx = frac * 340 * spdMul;
          const vy = -(380 + (1 - Math.abs(frac)) * 180) * spdMul;
          state.entities.push(AttackFactory.bullet(fx, fy, vx, vy, 7, "circle", 520 * spdMul));
        }
      }
      break;
    }

    case "ORB_RAIN": {
      if (ev.step === 0 && !state.entities.some(e => e.type === "lavaWaveFloor")) {
        state.entities.push(AttackFactory.lavaWaveFloor(Math.max(3.6, state.analysis.beatDur * 4.0), "valley"));
      }
      for (let k = 0; k < 8; k++) {
        const sx = W * (0.08 + k * 0.12) + (ev.seed - 0.5) * 40;
        const shape = k % 2 === 0 ? "gear8" : "circle";
        state.entities.push(AttackFactory.bullet(sx, -12, (ev.seed - 0.5) * 80, 175 + (k % 3) * 55, shape === "gear8" ? 13 : 9, shape, 410 * spdMul));
      }
      break;
    }

    case "WAVE_CORRIDOR": {
      // Dual cross sweep bars with safe gaps
      const dir = ev.seed > 0.5 ? 1 : -1;
      state.entities.push(AttackFactory.sweepBar("x", dir === 1 ? -40 : W + 40, dir, 420 * spdMul, 36, H * (0.28 + ev.seed * 0.44), 175));
      if (ev.step % 2 === 0) {
        state.entities.push(AttackFactory.sweepBar("y", -40, 1, 360 * spdMul, 32, W * (0.3 + (1 - ev.seed) * 0.4), 185));
      }
      break;
    }

    case "SAWBLADE_GAUNTLET": {
      for (let k = 0; k < 2; k++) {
        const side = (ev.step + k) % 2 === 0 ? 35 : W - 35;
        state.entities.push(AttackFactory.sawblade(side, 100 + ((ev.seed + k * 0.4) % 1) * (H - 200), (side < W / 2 ? 1 : -1) * 320 * spdMul, (ev.seed - 0.5) * 300, 26, 4.0));
      }
      break;
    }

    case "MANDALA_BLOOM": {
      const count = 14 + ev.phase * 2;
      for (let k = 0; k < count; k++) {
        const a = ev.step * 0.45 + (Math.PI * 2 * k) / count;
        const spd = (k % 2 === 0 ? 300 : 210) * spdMul;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * spd, Math.sin(a) * spd, 8, "triangle"));
      }
      break;
    }

    case "MEGA_MOUTH_BEAM": {
      const isHoriz = (ev.step + ev.phase) % 2 === 0;
      const thick = (isHoriz ? H : W) * 0.24;
      const targetPos = isHoriz
        ? Utils.clamp(cy, thick * 0.6, H - thick * 0.6)
        : Utils.clamp(cx, thick * 0.6, W - thick * 0.6);
      state.entities.push(AttackFactory.megaBeam(isHoriz ? "y" : "x", targetPos, thick, lt, 0.46));
      break;
    }

    case "SYNCOPATED_BURST": {
      const count = 6 + ev.phase;
      const base = Math.atan2(cy - by, cx - bx);
      for (let k = 0; k < count; k++) {
        const a = base + (k - (count - 1) / 2) * 0.22;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 360 * spdMul, Math.sin(a) * 360 * spdMul, 8, "diamond"));
      }
      break;
    }

    case "TOUHOU_DANMAKU": {
      if (ev.step === 0 && !state.entities.some(e => e.type === "danmakuSpiral")) {
        state.entities.push(AttackFactory.danmakuSpiral(4 + ev.phase, 195 * spdMul, (ev.phase % 2 === 0 ? 1 : -1) * 2.1, Math.max(2.8, state.analysis.beatDur * 3.8), 6));
      }
      if (ev.step % 2 === 0) {
        AttackFactory.danmakuFlower(bx, by, 18 + ev.phase * 4, 2, 175 * spdMul);
      } else {
        AttackFactory.danmakuAimedFan(bx, by, cx, cy, 5 + ev.phase, 1.0, 250 * spdMul);
      }
      break;
    }

    default: {
      // BREAKDOWN_PULSE: Clean shockwave + 8-dot ring
      state.entities.push(AttackFactory.shockwave(bx, by, 380, len * 0.9, 18));
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * 2 * k) / 8 + ev.step * 0.3;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 240, Math.sin(a) * 240, 7, "circle"));
      }
      break;
    }
  }

  // Global Bullet Hell (Touhou) Mode overlay
  if (state.settings?.touhouMode && activeSetpiece !== "TOUHOU_DANMAKU") {
    if (ev.step === 0 && !state.entities.some(e => e.type === "danmakuSpiral")) {
      state.entities.push(AttackFactory.danmakuSpiral(4 + ev.phase, 185 * spdMul, (ev.phase % 2 === 0 ? 1 : -1) * 1.9, Math.max(2.4, state.analysis.beatDur * 3.5), 5.5));
    }
    if (ev.step === 2) {
      AttackFactory.danmakuAimedFan(bx, by, cx, cy, 5 + ev.phase, 0.95, 240 * spdMul);
    }
  }
}
