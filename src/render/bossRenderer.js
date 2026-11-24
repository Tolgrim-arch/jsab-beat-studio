import { COLORS } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";

function getDangerColor() {
  return state.analysis?.dna?.palette?.danger || COLORS.pink;
}

function getHotColor() {
  return state.analysis?.dna?.palette?.hot || COLORS.pinkHot;
}

/**
 * Draws the procedural JSAB Boss based on the current song's DNA and Phase.
 */
export function drawProceduralBoss(ctx) {
  const b = state.blixer;
  const dna = state.analysis?.dna;
  const bossCfg = dna?.boss || {
    shape: "titan", eyeStyle: "angry", crownStyle: "horns",
    limbStyle: "claws", spikeCount: 8, innerDetail: 1, orbitSpeed: 1
  };
  const danger = getDangerColor();
  const hot = getHotColor();

  // 1. Articulated Limbs / Orbitals (Phase 2+)
  if (state.phase >= 2) {
    drawBossLimbs(ctx, b, bossCfg, danger);
  }

  ctx.save();
  ctx.translate(b.x, b.y);

  // 2. Outer Geometric Aura (Phase 2+)
  if (state.phase >= 2) {
    ctx.save();
    ctx.rotate(-b.rot * 0.65 * bossCfg.orbitSpeed);
    ctx.strokeStyle = danger;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 1.48, 0, Math.PI * 2);
    ctx.stroke();

    if (state.phase >= 4) {
      ctx.rotate(b.rot * 1.3);
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 1.78, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Crown / Horns / Floating Shards
  drawBossCrown(ctx, b, bossCfg, danger);

  // 4. Main Procedural Body Silhouette (JSAB sharp vector look)
  Utils.withGlow(ctx, danger, 28, () => {
    ctx.fillStyle = danger;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2.5;

    if (bossCfg.shape === "pyramid") {
      // Barracuda-style Floating Pyramid
      ctx.save();
      ctx.rotate(Math.sin(state.currentTime * 2) * 0.12);
      Utils.drawPolygon(ctx, 0, 0, 3, b.r * 1.38, -Math.PI / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (bossCfg.shape === "gear") {
      // Close To Me-style Saw/Gear Body
      ctx.save();
      ctx.rotate(b.rot * 0.8);
      const teeth = bossCfg.spikeCount + state.phase * 2;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const rad = i % 2 === 0 ? b.r * 1.28 : b.r * 0.92;
        const a = (Math.PI * i) / teeth;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (bossCfg.shape === "blossom") {
      // Lycanthropy-style Sharp Petals
      ctx.save();
      ctx.rotate(b.rot * 0.5);
      const petals = bossCfg.spikeCount;
      for (let i = 0; i < petals; i++) {
        const a = (Math.PI * 2 * i) / petals;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -b.r * 0.35);
        ctx.lineTo(b.r * 1.38, 0);
        ctx.lineTo(0, b.r * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      // Titan / Annihilate Spiky Core
      ctx.save();
      ctx.rotate(b.rot * 0.6);
      const spikes = bossCfg.spikeCount + state.phase;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? b.r * 1.26 : b.r * 0.84;
        const a = (Math.PI * i) / spikes;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });

  // 5. Inner Face Plate
  ctx.fillStyle = "#160410";
  if (bossCfg.shape === "pyramid") {
    Utils.drawPolygon(ctx, 0, 0, 3, b.r * 0.72, -Math.PI / 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Procedural Eyes (tracking Cyan)
  drawBossEyes(ctx, b, bossCfg, danger);

  // 7. Procedural Mouth / Equalizer
  if (bossCfg.shape !== "pyramid") {
    ctx.strokeStyle = hot;
    ctx.lineWidth = 3.2;
    const eyeOff = b.r * 0.24;
    const mOpen = 4 + b.mouthOpen * 16;
    ctx.beginPath();
    ctx.moveTo(-eyeOff * 1.15, b.r * 0.2);
    ctx.lineTo(-eyeOff * 0.45, b.r * 0.2 + mOpen);
    ctx.lineTo(0, b.r * 0.2);
    ctx.lineTo(eyeOff * 0.45, b.r * 0.2 + mOpen);
    ctx.lineTo(eyeOff * 1.15, b.r * 0.2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBossCrown(ctx, b, bossCfg, danger) {
  if (bossCfg.crownStyle === "none") return;
  ctx.save();
  ctx.fillStyle = danger;
  if (bossCfg.crownStyle === "horns") {
    // Classic Blixer / Annihilate Horns
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.moveTo(side * b.r * 0.45, -b.r * 0.75);
      ctx.lineTo(side * b.r * 1.05, -b.r * 1.48);
      ctx.lineTo(side * b.r * 0.85, -b.r * 0.5);
      ctx.closePath();
      ctx.fill();
    });
  } else if (bossCfg.crownStyle === "floating_shards") {
    for (let i = -1; i <= 1; i++) {
      const yOff = -b.r * 1.35 - Math.abs(i) * 10 + Math.sin(state.currentTime * 5 + i) * 6;
      Utils.drawPolygon(ctx, i * b.r * 0.55, yOff, 4, b.r * 0.2, state.currentTime * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBossEyes(ctx, b, bossCfg, danger) {
  const ang = Math.atan2(state.cyan.y - b.y, state.cyan.x - b.x);
  const lx = Math.cos(ang) * 5;
  const ly = Math.sin(ang) * 5;
  ctx.fillStyle = COLORS.white;

  if (bossCfg.eyeStyle === "cyclops") {
    ctx.beginPath();
    ctx.arc(lx, -b.r * 0.04 + ly, b.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = danger;
    ctx.beginPath();
    ctx.arc(lx * 1.35, -b.r * 0.04 + ly * 1.35, b.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (bossCfg.eyeStyle === "visor") {
    ctx.fillRect(-b.r * 0.38, -b.r * 0.16, b.r * 0.76, b.r * 0.16);
    ctx.fillStyle = danger;
    ctx.fillRect(-b.r * 0.12 + lx * 2, -b.r * 0.14, b.r * 0.24, b.r * 0.12);
  } else if (bossCfg.eyeStyle === "triple") {
    const off = b.r * 0.24;
    [[-off, 0], [off, 0], [0, -off * 0.9]].forEach(([ex, ey]) => {
      ctx.beginPath();
      ctx.arc(ex + lx, ey + ly, b.r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Angry / Classic JSAB slanted eyes
    const off = b.r * 0.24;
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.translate(side * off + lx, -b.r * 0.08 + ly);
      ctx.rotate(side * 0.25);
      ctx.beginPath();
      ctx.moveTo(-b.r * 0.14, -b.r * 0.08);
      ctx.lineTo(b.r * 0.14, -b.r * 0.02);
      ctx.lineTo(b.r * 0.08, b.r * 0.11);
      ctx.lineTo(-b.r * 0.12, b.r * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }
}

function drawBossLimbs(ctx, b, bossCfg, danger) {
  [b.leftHand, b.rightHand].forEach((h, idx) => {
    const side = idx === 0 ? -1 : 1;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(side * 0.35 + Math.sin(state.currentTime * 4) * 0.15);
    Utils.withGlow(ctx, danger, 16, () => {
      ctx.fillStyle = danger;
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      if (bossCfg.limbStyle === "floating_triangles") {
        Utils.drawPolygon(ctx, 0, 0, 3, b.r * 0.45, side > 0 ? 0 : Math.PI);
      } else if (bossCfg.limbStyle === "orbit_cannons") {
        ctx.fillRect(-b.r * 0.25, -b.r * 0.25, b.r * 0.5, b.r * 0.5);
        ctx.strokeRect(-b.r * 0.25, -b.r * 0.25, b.r * 0.5, b.r * 0.5);
      } else {
        // Claws
        Utils.drawPolygon(ctx, 0, 0, 5, b.r * 0.42, 0.3);
      }
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  });
}
