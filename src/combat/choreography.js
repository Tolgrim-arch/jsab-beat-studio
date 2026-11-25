import { PHASES } from "../config.js";
import { Utils } from "../utils.js";
import { state, spawnParticles } from "../state.js";
import { AttackFactory } from "./attacks.js?v=66";

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

  const { beats, beatDur, sections, archetype, bpm, meter } = analysis;
  const beatsPerBar = meter?.beatsPerBar || 4;
  const rng = Utils.seededRandom(Math.floor(bpm * 131 + analysis.profile.avgBass * 997));
  const schedule = [];

  const INSTRUMENT_POOLS = {
    SUB_BASS:    ["MEGA_MOUTH_BEAM", "DROP_EXPLOSION", "HYDRAULIC_CRUSH", "TWIN_HAND_SMASH"],
    SYNTH_LEAD:  ["CLOCKWORK_LASERS", "CLOSE_TO_ME_ORBS", "MANDALA_BLOOM", "WAVE_CORRIDOR"],
    PERCUSSION:  ["CHECKERBOARD_DANCE", "TWIN_HAND_SMASH", "SAWBLADE_GAUNTLET", "BUILDUP_LOCKON"],
    ARP_HYPER:   ["BARRACUDA_SWARM", "TOUHOU_DANMAKU", "WAVE_CORRIDOR", "SAWBLADE_GAUNTLET"],
    MELODIC_PAD: ["LYCANTHROPY_VINES", "ORB_RAIN", "BREAKDOWN_PULSE", "MANDALA_BLOOM"]
  };

  const INSTANT_SETPIECES = new Set([
    "BARRACUDA_SWARM", "ORB_RAIN", "WAVE_CORRIDOR",
    "SAWBLADE_GAUNTLET", "MANDALA_BLOOM", "BREAKDOWN_PULSE", "SYNCOPATED_BURST"
  ]);

  // Group beats by detected measure (compás / barIndex) so phrases lock to real bars!
  const barsMap = new Map();
  for (const b of beats) {
    const barIdx = Number.isFinite(b.barIndex) ? b.barIndex : Math.floor(b.t / (beatDur * beatsPerBar));
    if (!barsMap.has(barIdx)) barsMap.set(barIdx, []);
    barsMap.get(barIdx).push(b);
  }

  let prevKey = "";
  let cycleIdx = 0;
  const sortedBars = [...barsMap.entries()].sort((a, b) => a[0] - b[0]);

  for (const [barIdx, barBeats] of sortedBars) {
    if (!barBeats.length) continue;
    const t = barBeats[0].t;
    if (t < 0.35 || t > duration - 2.2) continue;

    const sec = sections.find(s => t >= s.start && t < s.end) || { type: "VERSE", instrument: "SYNTH_LEAD", rhythm: "NORMAL" };
    const progress = t / duration;
    const phase = progress < 0.2 ? 1 : progress < 0.5 ? 2 : progress < 0.8 ? 3 : 4;

    const curKey = `${sec.type}:${sec.instrument}:${sec.rhythm}`;
    if (curKey !== prevKey) {
      cycleIdx++;
      prevKey = curKey;
    }

    const pool = INSTRUMENT_POOLS[sec.instrument] || archetype.setpieces;
    let setpiece = pool[(cycleIdx + Math.floor(rng() * pool.length)) % pool.length];
    if (sec.type === "DROP") {
      setpiece = (barIdx % 2 === 0) ? "DROP_EXPLOSION" : pool[cycleIdx % pool.length];
    } else if (sec.type === "BUILDUP") {
      setpiece = sec.rhythm === "DOUBLE_TIME" ? "BARRACUDA_SWARM" : "BUILDUP_LOCKON";
    } else if (sec.type === "BREAKDOWN" || sec.type === "INTRO") {
      setpiece = sec.instrument === "MELODIC_PAD" ? "ORB_RAIN" : "BREAKDOWN_PULSE";
    } else if (sec.rhythm === "DOUBLE_TIME") {
      const fastPool = ["BARRACUDA_SWARM", "TOUHOU_DANMAKU", "SAWBLADE_GAUNTLET", "CLOCKWORK_LASERS"];
      setpiece = fastPool[cycleIdx % fastPool.length];
    } else if (sec.rhythm === "HALF_TIME") {
      const heavyPool = ["MEGA_MOUTH_BEAM", "HYDRAULIC_CRUSH", "LYCANTHROPY_VINES", "TWIN_HAND_SMASH"];
      setpiece = heavyPool[cycleIdx % heavyPool.length];
    }

    for (const b of barBeats) {
      if (b.isSilent || sec.type === "SILENCE") continue;
      const localBeatDur = b.localBeatDur || beatDur;
      const localBpm = b.localBpm || bpm;
      const beatInBar = Number.isFinite(b.beatInBar) && b.beatInBar >= 0 ? b.beatInBar : 0;
      const accentLevel = b.accentLevel || (beatInBar === 0 ? "DOWNBEAT" : "WEAK");
      const accentWeight = b.accentWeight ?? (accentLevel === "DOWNBEAT" ? 1.0 : accentLevel === "SECONDARY" ? 0.78 : 0.48);

      // Keep weak beats cleaner in calm sections so strong accents stand out
      if (accentLevel === "WEAK" && (sec.type === "INTRO" || sec.type === "BREAKDOWN") && b.rms < 0.28) continue;

      const chosenSetpiece = b.isSyncopated ? "SYNCOPATED_BURST" : setpiece;
      const isInstant = INSTANT_SETPIECES.has(chosenSetpiece);
      const leadMul = accentLevel === "DOWNBEAT" ? 0.90 : accentLevel === "SECONDARY" ? 0.78 : 0.62;
      const leadTime = isInstant ? 0 : Math.min(0.56, localBeatDur * leadMul);
      const spawnTime = Math.max(0.02, b.t - leadTime);

      schedule.push({
        spawnTime, impactTime: b.t, leadTime,
        phase,
        step: beatInBar,
        beatInBar,
        beatsPerBar,
        barIndex: barIdx,
        accentLevel,
        accentWeight,
        localBpm,
        localBeatDur,
        setpiece: chosenSetpiece,
        section: sec.type,
        beat: b,
        seed: rng()
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

  // Dynamic BPM scaling: attack velocities & timings follow the live/local BPM
  const curBpm = ev.localBpm || state.liveBpm || state.analysis?.bpm || 128;
  const curBeatDur = ev.localBeatDur || state.liveBeatDur || (60 / curBpm);
  const bpmScale = Utils.clamp(curBpm / 128, 0.68, 1.75);
  const accentLevel = ev.accentLevel || (ev.step === 0 ? "DOWNBEAT" : "WEAK");
  const accentWeight = ev.accentWeight ?? (accentLevel === "DOWNBEAT" ? 1.0 : accentLevel === "SECONDARY" ? 0.78 : 0.5);
  const isDownbeat = accentLevel === "DOWNBEAT";
  const isSecondary = accentLevel === "SECONDARY";
  const isStrong = isDownbeat || isSecondary;

  const spdMul = PHASES[ev.phase - 1].speedMul * (state.settings?.attackSpeed ?? 1) * bpmScale * (0.88 + accentWeight * 0.24);
  const lt = ev.leadTime;
  const danger = (state.customColors?.enabled ? state.customColors.danger : state.analysis?.dna?.palette?.danger) || "#FF1E6E";

  // Update live measure telemetry
  if (Number.isFinite(ev.beatInBar) && ev.beatInBar >= 0) state.beatInBar = ev.beatInBar;
  if (ev.beatsPerBar) state.beatsPerBar = ev.beatsPerBar;
  state.lastAccentLevel = accentLevel;

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

  // Accentuated pulse, camera punch, and boss snap on strong beats of the measure!
  b.pulse = Math.max(b.pulse, isDownbeat ? 1.0 : isSecondary ? 0.82 : 0.55);
  if (isDownbeat) {
    state.bgPulse = Math.max(state.bgPulse, 0.85 * accentWeight);
    state.zoomPunch = Math.max(state.zoomPunch, 0.032 * accentWeight);
    state.shake = Math.max(state.shake, 7 * accentWeight);
    const spots = [
      { x: W * 0.5, y: H * 0.5 },   // Center stage (JSAB Drop!)
      { x: W * 0.5, y: H * 0.22 },  // Top center
      { x: W * 0.22, y: H * 0.35 }, // Left flank
      { x: W * 0.78, y: H * 0.35 }  // Right flank
    ];
    const pick = ev.section === "DROP" ? spots[0] : spots[Math.floor(ev.seed * spots.length)];
    b.targetX = pick.x;
    b.targetY = pick.y;
    spawnParticles(b.x, b.y, danger, Math.round(12 + accentWeight * 10), 120 * bpmScale, 360 * bpmScale);
  } else if (isSecondary) {
    state.bgPulse = Math.max(state.bgPulse, 0.55 * accentWeight);
    state.zoomPunch = Math.max(state.zoomPunch, 0.018 * accentWeight);
  }

  const bx = b.x, by = b.y;
  const len = Math.max(W, H) * 1.45;

  // Measure real-time noise / spectral richness (how many bands & energy are active simultaneously)
  const tel = state.audioTelemetry || {};
  const bSub = tel.sub ?? (ev.beat?.bass || 0) * 0.85;
  const bBass = ev.beat?.bass ?? tel.bass ?? 0;
  const bLowMid = tel.lowMid ?? (ev.beat?.mid || 0) * 0.7;
  const bMid = ev.beat?.mid ?? tel.mid ?? 0;
  const bHigh = ev.beat?.high ?? tel.high ?? 0;
  const bRms = ev.beat?.rms ?? Math.max(bBass, bMid, bHigh);
  const bTension = tel.tension ?? 0;

  let activeBands = 0;
  if (bSub > 0.30) activeBands++;
  if (bBass > 0.30) activeBands++;
  if (bLowMid > 0.30) activeBands++;
  if (bMid > 0.30) activeBands++;
  if (bHigh > 0.30) activeBands++;

  const noiseLevel = Utils.clamp(bRms * 0.45 + (activeBands / 5) * 0.35 + bTension * 0.25, 0.08, 1.0);
  state.noiseLevel = noiseLevel;
  state.activeArtifactLayers = 1 + (noiseLevel >= 0.36 ? 1 : 0) + (noiseLevel >= 0.62 ? 1 : 0) + (noiseLevel >= 0.82 ? 1 : 0);

  const noiseDensityMul = 0.48 + noiseLevel * 1.12;
  const densityScale = (state.settings?.attackDensity ?? 1) * noiseDensityMul * (isDownbeat ? 1.15 : isSecondary ? 1.0 : 0.72);

  switch (activeSetpiece) {
    case "DROP_EXPLOSION": {
      if (isDownbeat) {
        state.flashAlpha = Math.max(state.flashAlpha, 0.45 * accentWeight);
        state.zoomPunch = Math.max(state.zoomPunch, 0.06 * accentWeight);
        state.shake = Math.max(state.shake, 16 * accentWeight);
        state.entities.push(AttackFactory.shockwave(bx, by, 520 * spdMul, len, 30));
      }
      // 4 diagonal lasers on strong beats, 2 crisp lasers on weak beats
      const laserCnt = isStrong ? 4 : 2;
      const baseA = ev.step * 0.38;
      for (let k = 0; k < laserCnt; k++) {
        const a = baseA + ((Math.PI * 2) / laserCnt) * k;
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, isDownbeat ? 30 : 22, lt, Math.min(0.32, curBeatDur * 0.55)));
      }
      const count = Math.max(6, Math.round((12 + ev.phase * 2) * densityScale));
      for (let k = 0; k < count; k++) {
        const a = (Math.PI * 2 * k) / count + ev.step * 0.25;
        const spd = (k % 2 === 0 ? 310 : 220) * spdMul;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * spd, Math.sin(a) * spd, isDownbeat ? 9 : 7, "diamond"));
      }
      if (isSecondary) {
        const isHoriz = ev.phase % 2 === 0;
        const thick = (isHoriz ? H : W) * 0.24;
        const targetPos = isHoriz ? H * 0.5 : W * 0.5;
        state.entities.push(AttackFactory.megaBeam(isHoriz ? "y" : "x", targetPos, thick, lt, Math.min(0.55, curBeatDur * 0.92)));
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
      // BREAKDOWN_PULSE: Clean shockwave + dot ring scaled by noiseLevel
      state.entities.push(AttackFactory.shockwave(bx, by, 380 * bpmScale, len * 0.9, 16));
      const dotCount = Math.max(4, Math.round(8 * densityScale));
      for (let k = 0; k < dotCount; k++) {
        const a = (Math.PI * 2 * k) / dotCount + ev.step * 0.3;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 240 * spdMul, Math.sin(a) * 240 * spdMul, 7, "circle"));
      }
      break;
    }
  }

  // Multi-Artifact Noise Layering: more audio noise / active bands => more DISTINCT attack artifacts simultaneously
  if (state.entities.length < 210) {
    const extraLayers = state.activeArtifactLayers - 1; // 0 (calm) up to 3 (wall of sound)
    const ltLayer = Math.max(0.18, Math.min(0.45, curBeatDur * 0.65));

    // Layer 2 (Medium+ noise >= 0.36): add a distinct artifact matching the loudest secondary frequency band
    if (extraLayers >= 1) {
      if (bBass >= bMid && bBass >= bHigh && activeSetpiece !== "DROP_EXPLOSION") {
        state.entities.push(AttackFactory.shockwave(bx, by, 440 * spdMul, len * 0.85, 22));
      } else if (bMid >= bHigh && activeSetpiece !== "BUILDUP_LOCKON") {
        const a = Math.atan2(cy - by, cx - bx);
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 20, ltLayer, 0.2));
      } else if (activeSetpiece !== "SYNCOPATED_BURST") {
        const fanCnt = Math.max(3, Math.round(4 * densityScale));
        const baseA = Math.atan2(cy - by, cx - bx);
        for (let k = 0; k < fanCnt; k++) {
          const a = baseA + (k - (fanCnt - 1) / 2) * 0.24;
          state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 330 * spdMul, Math.sin(a) * 330 * spdMul, 7.5, "diamond"));
        }
      }
    }

    // Layer 3 (High noise >= 0.62): add a second distinct artifact (sawblade, pulse bomb, or sweep bar)
    if (extraLayers >= 2 && state.entities.length < 210) {
      const pick2 = Math.floor((ev.seed * 17 + ev.step) % 3);
      if (pick2 === 0 && activeSetpiece !== "SAWBLADE_GAUNTLET") {
        const side = ev.step % 2 === 0 ? 32 : W - 32;
        state.entities.push(AttackFactory.sawblade(side, H * (0.25 + ev.seed * 0.5), (side < W / 2 ? 1 : -1) * 310 * spdMul, (ev.seed - 0.5) * 240, 24, 3.2));
      } else if (pick2 === 1 && activeSetpiece !== "CLOSE_TO_ME_ORBS") {
        const px = Utils.clamp(cx + (ev.seed - 0.5) * 220, 90, W - 90);
        const py = Utils.clamp(cy + (0.5 - ev.seed) * 180, 90, H - 90);
        state.entities.push(AttackFactory.pulseBomb(px, py, 74, ltLayer, 8, ev.step * 0.5));
      } else if (activeSetpiece !== "WAVE_CORRIDOR") {
        const dir = ev.seed > 0.5 ? 1 : -1;
        state.entities.push(AttackFactory.sweepBar("x", dir === 1 ? -36 : W + 36, dir, 400 * spdMul, 30, H * (0.25 + ev.seed * 0.5), 185));
      }
    }

    // Layer 4 (Extreme noise / saturated drop >= 0.82): add a third distinct artifact (cross lasers + triangle ring or serpent)
    if (extraLayers >= 3 && state.entities.length < 210) {
      if (bSub > 0.55 && activeSetpiece !== "HYDRAULIC_CRUSH") {
        const edge = ev.step % 2 === 0 ? "left" : "right";
        state.entities.push(AttackFactory.hydraulicPiston(edge, W * 0.2, ltLayer, 0.28));
      } else if (activeSetpiece !== "BARRACUDA_SWARM") {
        const dir = ev.step % 2 === 0 ? 1 : -1;
        state.entities.push(AttackFactory.barracudaSerpent(H * (0.25 + ev.seed * 0.5), dir, 480 * spdMul, 48, 5.5));
      }
      if (isStrong) {
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI * 2 * k) / 6 + ev.seed * Math.PI;
          state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 270 * spdMul, Math.sin(a) * 270 * spdMul, 8, "triangle"));
        }
      }
    }
  }

  // Global Bullet Hell (Touhou) Mode overlay
  if (state.settings?.touhouMode && activeSetpiece !== "TOUHOU_DANMAKU") {
    if (ev.step === 0 && !state.entities.some(e => e.type === "danmakuSpiral")) {
      state.entities.push(AttackFactory.danmakuSpiral(4 + ev.phase, 185 * spdMul, (ev.phase % 2 === 0 ? 1 : -1) * 1.9, Math.max(2.4, curBeatDur * 3.5), 5.5));
    }
    if (ev.step === 2) {
      AttackFactory.danmakuAimedFan(bx, by, cx, cy, 5 + ev.phase, 0.95, 240 * spdMul);
    }
  }
}
