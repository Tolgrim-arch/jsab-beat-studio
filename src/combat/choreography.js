import { PHASES } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";
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
    if (t < 0.8 || t > duration - 0.6) continue;

    const sec = sections.find(s => t >= s.start && t < s.end) || { type: "VERSE" };
    const progress = t / duration;
    const phase = progress < 0.22 ? 1 : progress < 0.52 ? 2 : progress < 0.82 ? 3 : 4;

    let setpiece = archetype.setpieces[Math.floor(rng() * archetype.setpieces.length)];
    if (sec.type === "DROP") {
      setpiece = (i % 8 === 0) ? "DROP_EXPLOSION" : archetype.setpieces[Math.floor(rng() * 3)];
    } else if (sec.type === "BUILDUP") {
      setpiece = "BUILDUP_LOCKON";
    } else if (sec.type === "BREAKDOWN" || sec.type === "INTRO") {
      setpiece = "BREAKDOWN_PULSE";
    }

    for (let step = 0; step < phraseLen && (i + step) < beats.length; step++) {
      const b = beats[i + step];
      const leadTime = Math.min(0.65, beatDur * 0.95);
      const spawnTime = Math.max(0.05, b.t - leadTime);
      schedule.push({
        spawnTime, impactTime: b.t, leadTime,
        phase, step, setpiece, section: sec.type, beat: b, seed: rng()
      });
    }
  }

  schedule.sort((a, b) => a.spawnTime - b.spawnTime);
  return schedule;
}

export function spawnSetpieceEvent(ev, domSetpieceEl) {
  const W = state.width, H = state.height;
  const bx = state.blixer.x, by = state.blixer.y;
  const cx = state.cyan.x, cy = state.cyan.y;
  const spdMul = PHASES[ev.phase - 1].speedMul;
  const lt = ev.leadTime;

  state.activeSetpiece = ev.setpiece;
  if (domSetpieceEl) domSetpieceEl.textContent = ev.setpiece.replace(/_/g, " ");
  state.blixer.pulse = 1.0;

  switch (ev.setpiece) {
    case "DROP_EXPLOSION": {
      if (ev.step === 0) {
        state.flashAlpha = 0.35;
        state.zoomPunch = 0.045;
        state.entities.push(AttackFactory.shockwave(bx, by, 480 * spdMul, Math.max(W, H) * 1.1, 24));
      }
      const count = 8 + ev.phase * 2;
      for (let k = 0; k < count; k++) {
        const a = (Math.PI * 2 * k) / count + ev.step * 0.3;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 260 * spdMul, Math.sin(a) * 260 * spdMul, 8, "diamond"));
      }
      break;
    }
    case "BUILDUP_LOCKON": {
      const ang = Math.atan2(cy - by, cx - bx);
      const len = Math.max(W, H) * 1.4;
      state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, 22, lt, 0.22));
      break;
    }
    case "TWIN_HAND_SMASH": {
      const tx = ev.step % 2 === 0 ? W * 0.28 + ev.seed * W * 0.18 : W * 0.54 + ev.seed * W * 0.18;
      const ty = H * 0.48 + (ev.seed - 0.5) * H * 0.28;
      state.entities.push(AttackFactory.handSlam(tx, ty, 88 + ev.phase * 8, lt));
      break;
    }
    case "HYDRAULIC_CRUSH": {
      const side = ev.step % 2 === 0 ? "left" : "right";
      state.entities.push(AttackFactory.hydraulicPiston(side, W * 0.22, lt, 0.32));
      break;
    }
    case "CHECKERBOARD_DANCE": {
      const cols = 4, rows = 3;
      const cw = W / cols, ch = H / rows;
      const parity = ev.step % 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 === parity) state.entities.push(AttackFactory.floorZone(c * cw, r * ch, cw, ch, lt, 0.22));
        }
      }
      break;
    }
    case "BARRACUDA_SWARM": {
      const dir = ev.step % 2 === 0 ? 1 : -1;
      state.entities.push(AttackFactory.barracudaSerpent(H * (0.22 + ev.seed * 0.58), dir, 480 * spdMul, 65, 5.5));
      break;
    }
    case "CLOSE_TO_ME_ORBS": {
      if (ev.step === 0) {
        for (let k = 0; k < 3; k++) {
          const a = (Math.PI * 2 * k) / 3 + ev.seed * Math.PI;
          state.entities.push(AttackFactory.rotatingBeam(bx, by, a, (ev.seed > 0.5 ? 1 : -1) * 1.15 * spdMul, Math.max(W, H) * 0.85, 20, lt, state.analysis.beatDur * 3.5));
        }
      } else {
        const px = 100 + ev.seed * (W - 200);
        const py = 120 + ((ev.seed * 5.3) % 1) * (H - 240);
        state.entities.push(AttackFactory.pulseBomb(px, py, 75, lt, 8, ev.step * 0.5));
      }
      break;
    }
    case "CLOCKWORK_LASERS": {
      const base = ev.step * 0.4 + ev.seed * Math.PI;
      const len = Math.max(W, H) * 1.4;
      for (let k = 0; k < 4; k++) {
        const a = base + (Math.PI / 2) * k;
        state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 22, lt, 0.25));
      }
      break;
    }
    case "LYCANTHROPY_VINES": {
      const count = 4 + ev.phase;
      for (let k = 0; k < count; k++) {
        const sx = (W / (count + 1)) * (k + 1) + (ev.step % 2 === 0 ? 25 : -25);
        state.entities.push(AttackFactory.lycanthropySpike(sx, H, H * (0.32 + ev.seed * 0.22), 38, lt, 0.38));
      }
      break;
    }
    case "ORB_RAIN": {
      for (let k = 0; k < 5; k++) {
        const sx = W * (0.1 + k * 0.2) + (ev.seed - 0.5) * 60;
        state.entities.push(AttackFactory.bullet(sx, -10, (ev.seed - 0.5) * 90, 140, 10, "circle", 360 * spdMul));
      }
      break;
    }
    case "WAVE_CORRIDOR": {
      const axis = ev.step % 2 === 0 ? "x" : "y";
      const dir = ev.seed > 0.5 ? 1 : -1;
      const start = dir === 1 ? -40 : (axis === "x" ? W + 40 : H + 40);
      const gap = (axis === "x" ? H : W) * (0.3 + ev.seed * 0.4);
      state.entities.push(AttackFactory.sweepBar(axis, start, dir, 380 * spdMul, 32, gap, 175));
      break;
    }
    case "SAWBLADE_GAUNTLET": {
      const side = ev.step % 2 === 0 ? 35 : W - 35;
      state.entities.push(AttackFactory.sawblade(side, 100 + ev.seed * (H - 200), (side < W / 2 ? 1 : -1) * 260 * spdMul, (ev.seed - 0.5) * 260, 24, 3.8));
      break;
    }
    case "MANDALA_BLOOM": {
      const count = 10 + ev.phase * 2;
      for (let k = 0; k < count; k++) {
        const a = ev.step * 0.45 + (Math.PI * 2 * k) / count;
        state.entities.push(AttackFactory.bullet(bx, by, Math.cos(a) * 250 * spdMul, Math.sin(a) * 250 * spdMul, 8, "triangle"));
      }
      break;
    }
    case "MEGA_MOUTH_BEAM": {
      const ang = Math.atan2(cy - by, cx - bx);
      const len = Math.max(W, H) * 1.4;
      state.entities.push(AttackFactory.laser(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, 64, lt, 0.38));
      break;
    }
    default: {
      if (ev.step % 2 === 0) state.entities.push(AttackFactory.shockwave(bx, by, 320, Math.max(W, H) * 0.9, 16));
      break;
    }
  }
}
