import { COLORS, PHASES } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";
import { drawProceduralBoss } from "./bossRenderer.js?v=68";

function getCyanColor() {
  return state.customColors?.enabled ? state.customColors.cyan : COLORS.cyan;
}

function getDangerColor() {
  return (state.customColors?.enabled ? state.customColors.danger : state.analysis?.dna?.palette?.danger) || "#FF1E6E";
}

function drawBiomeBackground(ctx, W, H) {
  ctx.fillStyle = state.customColors?.enabled ? state.customColors.bg : "#040D14";
  ctx.fillRect(0, 0, W, H);

  const eqCol = state.customColors?.enabled ? (state.customColors.eq || getCyanColor()) : getCyanColor();
  const eqAlpha = state.settings?.eqAlpha ?? 0.14;
  if (eqAlpha > 0.01) {
    const bars = 36;
    const bw = W / bars;
    ctx.save();
    ctx.fillStyle = eqCol;
    ctx.globalAlpha = eqAlpha;
    for (let i = 0; i < bars; i++) {
      const wave = 0.4 + 0.6 * Math.sin(state.currentTime * 4 + i * 0.45);
      const bh = (24 + state.bgPulse * 70) * wave;
      ctx.fillRect(i * bw, H - bh, bw - 2, bh);
    }
    ctx.restore();
  }

  if (state.phase >= 2) {
    const borderH = 10 + state.bgPulse * 18;
    ctx.fillStyle = getDangerColor();
    ctx.fillRect(0, 0, W, borderH * 0.5);
    ctx.fillRect(0, H - borderH * 0.5, W, borderH * 0.5);
  }
}

function drawCyan(ctx) {
  const c = state.cyan;
  const cyanCol = getCyanColor();
  const trailCol = state.customColors?.enabled ? (state.customColors.trail || "#0077FF") : "#0077FF";

  if (c.dashRing) {
    ctx.save();
    ctx.globalAlpha = Utils.clamp(c.dashRing.alpha, 0, 1);
    ctx.fillStyle = cyanCol;
    ctx.beginPath();
    ctx.arc(c.dashRing.x, c.dashRing.y, c.dashRing.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const tr of c.trail) {
    ctx.save();
    ctx.globalAlpha = Utils.clamp(tr.alpha, 0, 1);
    ctx.fillStyle = trailCol;
    const sz = tr.size || 4;
    ctx.fillRect(tr.x - sz, tr.y - sz, sz * 2, sz * 2);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rot);

  if (c.dashTimer > 0) {
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(-c.r * 2.4, -c.r * 0.72, c.r * 4.8, c.r * 1.44);
    ctx.fillStyle = cyanCol;
    ctx.fillRect(-c.r * 1.8, -c.r * 0.42, c.r * 3.6, c.r * 0.84);
  } else {
    const sx = Utils.clamp(c.squash || 1, 0.68, 1.85);
    const sy = 1 / sx;
    if (c.skew) ctx.transform(1, c.skew, 0, 1, 0, 0);
    ctx.scale(sx, sy);
    ctx.fillStyle = cyanCol;
    ctx.fillRect(-c.r, -c.r, c.r * 2, c.r * 2);
  }
  ctx.restore();
}

export function renderFrame(ctx) {
  const W = state.width, H = state.height;
  ctx.save();

  const zoom = (state.zoomPunch || 0) * (state.settings?.zoomMul ?? 1);
  const tilt = state.settings?.phonkMode ? (state.camTilt || 0) : 0;
  if (zoom > 0.001 || Math.abs(tilt) > 0.0005) {
    const z = 1 + zoom + Math.abs(tilt) * 1.15;
    ctx.translate(W / 2, H / 2);
    if (Math.abs(tilt) > 0.0005) ctx.rotate(tilt);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
  }
  const shake = (state.shake || 0) * (state.settings?.shakeMul ?? 1);
  if (shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawBiomeBackground(ctx, W, H);
  for (const ent of state.entities) ent.draw(ctx, W, H);

  for (const p of state.particles) {
    ctx.globalAlpha = Utils.clamp(p.life / p.maxLife, 0, 1);
    if (p.expandRate) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (p.isRing) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(3, p.r * 0.28);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
  }
  ctx.globalAlpha = 1;

  if (!state.bossDefeated) drawProceduralBoss(ctx);
  drawCyan(ctx);

  if (state.bossDefeated) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.white;
    ctx.font = "900 42px Orbitron, sans-serif";
    ctx.fillText("STAGE CLEAR", W / 2, H * 0.42);
    ctx.fillStyle = getCyanColor();
    ctx.font = "700 18px 'JetBrains Mono', monospace";
    ctx.fillText("PERFECT NO-HIT", W / 2, H * 0.48);
    ctx.restore();
  }

  if (state.settings?.phonkMode) {
    const sub = state.audioTelemetry?.sub || 0;
    // 1. Pulsing dark cinematic vignette reacting to 808 sub-bass
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.24, W / 2, H / 2, Math.max(W, H) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, `rgba(0,0,0,${0.6 + state.bgPulse * 0.25 + sub * 0.12})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // 2. Subtle VHS/CRT scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);

    // 3. Radial anime/phonk speed lines + RGB chromatic split on hard kicks
    if (state.rgbSplit > 0.08) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const s = state.rgbSplit;
      ctx.fillStyle = `rgba(0, 240, 255, ${s * 0.22})`;
      ctx.fillRect(0, 0, 26 * s, H);
      ctx.fillStyle = `rgba(255, 30, 110, ${s * 0.24})`;
      ctx.fillRect(W - 26 * s, 0, 26 * s, H);

      // Radial speed lines bursting from edges
      if (s > 0.22) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${s * 0.35})`;
        ctx.lineWidth = 2;
        const lines = 22;
        const maxR = Math.hypot(W, H) * 0.55;
        for (let i = 0; i < lines; i++) {
          const a = (Math.PI * 2 * i) / lines + (state.currentTime || 0) * 1.4;
          const rIn = maxR * (0.58 + (i % 3) * 0.08);
          ctx.beginPath();
          ctx.moveTo(W / 2 + Math.cos(a) * rIn, H / 2 + Math.sin(a) * rIn);
          ctx.lineTo(W / 2 + Math.cos(a) * maxR, H / 2 + Math.sin(a) * maxR);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4. Cinematic letterbox bars breathing with sub-bass
    const barH = Math.max(18, H * (0.048 + sub * 0.025));
    ctx.fillStyle = "#03040A";
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);
  }

  if (state.flashAlpha > 0.01) {
    const fMul = state.settings?.impactFlashMul ?? 0.55;
    if (fMul > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${state.flashAlpha * 0.55 * fMul})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  if (state.showHud) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 14px Orbitron, sans-serif";
    ctx.fillText(`PHASE ${state.phase} • ${PHASES[state.phase - 1].name}`, 24, 34);
    ctx.fillStyle = COLORS.cyan;
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.fillText(`SETPIECE: ${state.activeSetpiece.replace(/_/g, " ")} • MOOD: ${(state.blixer.mood || "SMUG").toUpperCase()}`, 24, 54);
  }

  ctx.restore();
}

export function drawTimeline(tCtx, timelineCanvas) {
  const w = timelineCanvas.width;
  const h = timelineCanvas.height;
  tCtx.clearRect(0, 0, w, h);
  if (!state.analysis) return;

  const { frames } = state.analysis;
  tCtx.fillStyle = "rgba(0, 240, 255, 0.32)";
  const step = Math.max(1, Math.floor(frames.length / w));
  for (let x = 0; x < w; x++) {
    const f = frames[Math.min(frames.length - 1, x * step)];
    const barH = Utils.clamp(f.rms * h * 0.85, 2, h);
    tCtx.fillRect(x, h - barH, 1, barH);
  }

  const prog = state.duration > 0 ? state.currentTime / state.duration : 0;
  tCtx.fillStyle = "#FF1E6E";
  tCtx.fillRect(prog * w - 1, 0, 2, h);
}
