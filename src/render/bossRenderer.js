import { COLORS } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";

const getDanger = () => state.analysis?.dna?.palette?.danger || "#FF1E6E";

/**
 * Draws the procedural JSAB Boss inspired directly by the official JSAB Boss silhouettes
 * (Annihilate, Barracuda, Close To Me, Lycanthropy) in crisp flat-vector style.
 */
export function drawProceduralBoss(ctx) {
  const b = state.blixer;
  const bossCfg = state.analysis?.dna?.boss || {
    shape: "titan", eyeStyle: "angry", crownStyle: "horns",
    limbStyle: "claws", spikeCount: 8, orbitSpeed: 1
  };
  const danger = getDanger();
  const flash = b.pulse > 0.82;

  // Crisp JSAB Dash Afterimages
  if (b.trail && b.trail.length > 0) {
    for (const tr of b.trail) {
      ctx.save();
      ctx.globalAlpha = tr.alpha * 0.45;
      ctx.fillStyle = danger;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Articulated Limbs in Phase 2+
  if (state.phase >= 2) {
    [b.leftHand, b.rightHand].forEach((h, idx) => {
      const side = idx === 0 ? -1 : 1;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(side * 0.35 + Math.sin(state.currentTime * 4) * 0.15);
      ctx.fillStyle = flash ? COLORS.white : danger;
      if (bossCfg.limbStyle === "floating_triangles") {
        Utils.drawPolygon(ctx, 0, 0, 3, b.r * 0.48, side > 0 ? 0 : Math.PI);
      } else if (bossCfg.limbStyle === "orbit_cannons") {
        ctx.fillRect(-b.r * 0.28, -b.r * 0.28, b.r * 0.56, b.r * 0.56);
      } else {
        Utils.drawPolygon(ctx, 0, 0, 5, b.r * 0.45, 0.3);
      }
      ctx.fill();
      ctx.restore();
    });
  }

  ctx.save();
  const jx = b.jitter ? (Math.random() - 0.5) * b.jitter : 0;
  const jy = b.jitter ? (Math.random() - 0.5) * b.jitter : 0;
  ctx.translate(b.x + jx, b.y + jy);
  ctx.rotate(b.tilt || 0);
  ctx.scale(b.scaleX || 1, b.scaleY || 1);

  // Close-Call Annoyed '!' pop when Cyan dashes right past the boss!
  if (b.annoyedTimer > 0) {
    ctx.save();
    ctx.fillStyle = COLORS.white;
    ctx.font = "900 28px Orbitron, sans-serif";
    ctx.fillText("!", b.r * 1.15, -b.r * 0.95);
    ctx.restore();
  }

  // Detached floating pink triangles around boss (like Annihilate reference!)
  if (bossCfg.shape === "titan" || state.phase >= 3) {
    const spikes = bossCfg.spikeCount + 4;
    ctx.save();
    ctx.rotate(b.rot * 0.45);
    ctx.fillStyle = flash ? COLORS.white : danger;
    for (let i = 0; i < spikes; i++) {
      const a = (Math.PI * 2 * i) / spikes;
      const dist = b.r * (1.25 + b.pulse * 0.18);
      ctx.save();
      ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(b.r * 0.26, 0);
      ctx.lineTo(-b.r * 0.12, -b.r * 0.14);
      ctx.lineTo(-b.r * 0.12, b.r * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Main Boss Body Silhouette
  ctx.fillStyle = flash ? COLORS.white : danger;
  ctx.strokeStyle = danger;
  ctx.lineWidth = 5;

  if (bossCfg.shape === "pyramid") {
    // Barracuda: Crisp solid pink equilateral triangle + cyclops eye
    ctx.save();
    ctx.rotate(Math.sin(state.currentTime * 2.5) * 0.08);
    Utils.drawPolygon(ctx, 0, 0, 3, b.r * 1.45, -Math.PI / 2);
    ctx.fill();
    // Black half-moon cyclops eye
    ctx.fillStyle = "#040D14";
    ctx.beginPath(); ctx.arc(0, b.r * 0.1, b.r * 0.34, 0, Math.PI); ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(0, b.r * 0.15, b.r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (bossCfg.shape === "gear") {
    // Close To Me: Crisp rounded pink square with angry slanted eyes
    const s = b.r * 1.05;
    ctx.beginPath();
    ctx.roundRect(-s, -s, s * 2, s * 2, 22);
    ctx.fill();
    ctx.fillStyle = "#040D14";
    // Angry slanted eyes
    ctx.save();
    ctx.rotate(0.28); ctx.fillRect(-s * 0.62, -s * 0.22, s * 0.46, s * 0.14);
    ctx.restore();
    ctx.save();
    ctx.rotate(-0.28); ctx.fillRect(s * 0.16, -s * 0.22, s * 0.46, s * 0.14);
    ctx.restore();
    // Frown
    ctx.strokeStyle = "#040D14";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, s * 0.45, s * 0.28, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  } else if (bossCfg.shape === "blossom") {
    // Lycanthropy: Spiky pink silhouette with dark angry eyes and fanged grin
    ctx.beginPath();
    const pts = 8;
    for (let i = 0; i < pts * 2; i++) {
      const rad = i % 2 === 0 ? b.r * 1.25 : b.r * 0.88;
      const a = (Math.PI * i) / pts;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#040D14";
    ctx.beginPath();
    ctx.arc(-b.r * 0.3, -b.r * 0.1, b.r * 0.16, 0, Math.PI * 2);
    ctx.arc(b.r * 0.3, -b.r * 0.1, b.r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // Fanged mouth
    ctx.beginPath();
    ctx.arc(0, b.r * 0.22, b.r * 0.38, 0, Math.PI);
    ctx.fill();
  } else {
    // Annihilate / Titan: Dark maroon/black octagonal face with glowing white eyes & huge jagged teeth!
    ctx.fillStyle = "#2A0716";
    Utils.drawPolygon(ctx, 0, 0, 8, b.r * 1.05, Math.PI / 8);
    ctx.fill();
    ctx.stroke();

    // Glowing white eyes inside pink triangles
    const ang = Math.atan2(state.cyan.y - b.y, state.cyan.x - b.x);
    const lx = Math.cos(ang) * 4, ly = Math.sin(ang) * 4;
    [-1, 1].forEach(side => {
      ctx.fillStyle = danger;
      ctx.beginPath();
      ctx.moveTo(side * b.r * 0.12, -b.r * 0.05);
      ctx.lineTo(side * b.r * 0.65, -b.r * 0.28);
      ctx.lineTo(side * b.r * 0.55, b.r * 0.08);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.arc(side * b.r * 0.38 + lx, -b.r * 0.08 + ly, b.r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    });

    // Huge jagged teeth mouth
    const mOpen = 8 + b.mouthOpen * 22;
    ctx.fillStyle = "#040D14";
    ctx.strokeStyle = danger;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.68, b.r * 0.15);
    ctx.lineTo(-b.r * 0.35, b.r * 0.15 + mOpen);
    ctx.lineTo(0, b.r * 0.12);
    ctx.lineTo(b.r * 0.35, b.r * 0.15 + mOpen);
    ctx.lineTo(b.r * 0.68, b.r * 0.15);
    ctx.lineTo(b.r * 0.45, b.r * 0.55 + mOpen * 0.5);
    ctx.lineTo(-b.r * 0.45, b.r * 0.55 + mOpen * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}
