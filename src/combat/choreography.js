import { PHASES } from "../config.js";
import { Utils } from "../utils.js";
import { state, spawnParticles } from "../state.js";
import { AttackFactory } from "./attacks.js";

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
  const spdMul = PHASES[ev.phase - 1].speedMul;
  const lt = ev.leadTime;
  const danger = state.analysis?.dna?.palette?.danger || "#FF1E6E";

  state.activeSetpiece = ev.setpiece;
  if (domSetpieceEl) domSetpieceEl.textContent = ev.setpiece.replace(/_/g, " ");
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

  switch (ev.setpiece) {
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
      const base = ev.step * 0.35 + ev.seed * Math.PI;
      for (let k = 0; k < 6; k++) {
        const a = base + (Math.PI / 3) * k;
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 24, lt, 0.26));
      }
      break;
    }

    case "LYCANTHROPY_VINES": {
      const sides = ["bottom", "top", "left", "right"];
      const side = sides[ev.step % 4];
      const isHoriz = side === "left" || side === "right";
      const span = isHoriz ? H : W;
      const maxD = (isHoriz ? W : H) * 0.34;
      const count = 5 + Math.floor(ev.phase / 2);
      for (let k = 0; k < count; k++) {
        const pos = (span / (count + 1)) * (k + 1) + (ev.step % 2 === 0 ? 20 : -20);
        state.entities.push(AttackFactory.lycanthropySpike(pos, maxD * (0.75 + ((k * 0.17 + ev.seed) % 0.4)), 76, lt, 0.42, side));
      }
      break;
    }

    case "ORB_RAIN": {
      for (let k = 0; k < 9; k++) {
        const sx = W * (0.05 + k * 0.11) + (ev.seed - 0.5) * 45;
        state.entities.push(AttackFactory.bullet(sx, -10, (ev.seed - 0.5) * 90, 180 + (k % 3) * 60, 10, "circle", 440 * spdMul));
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
      const ang = Math.atan2(cy - by, cx - bx);
      state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, 84, lt, 0.42));
      [-0.4, 0.4].forEach(off => {
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(ang + off) * len, by + Math.sin(ang + off) * len, 26, lt, 0.34));
      });
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
}
