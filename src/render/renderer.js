import { COLORS, PHASES } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";
import { drawProceduralBoss } from "./bossRenderer.js";

function drawBiomeBackground(ctx, W, H) {
  // Crisp JSAB deep dark teal/black canvas
  ctx.fillStyle = "#040D14";
  ctx.fillRect(0, 0, W, H);

  // Subtle bottom cyan-teal equalizer wave (just like reference Twitter.jfif)
  const bars = 36;
  const bw = W / bars;
  ctx.fillStyle = "rgba(0, 240, 255, 0.14)";
  for (let i = 0; i < bars; i++) {
    const wave = 0.4 + 0.6 * Math.sin(state.currentTime * 4 + i * 0.45);
    const bh = (24 + state.bgPulse * 70) * wave;
    ctx.fillRect(i * bw, H - bh, bw - 2, bh);
  }

  // Living pulsing pink border spikes during Phase 2+ / Drops
  if (state.phase >= 2) {
    const danger = state.analysis?.dna?.palette?.danger || "#FF1E6E";
    const borderH = 10 + state.bgPulse * 18;
    ctx.fillStyle = danger;
    ctx.fillRect(0, 0, W, borderH * 0.5);
    ctx.fillRect(0, H - borderH * 0.5, W, borderH * 0.5);
  }
}

function drawCyan(ctx) {
  const c = state.cyan;

  // Crisp stepped ghost squares on dash/movement
  for (const tr of c.trail) {
    ctx.fillStyle = `rgba(0, 240, 255, ${tr.alpha * 0.5})`;
    ctx.fillRect(tr.x - c.r * 0.85, tr.y - c.r * 0.85, c.r * 1.7, c.r * 1.7);
  }

  // Expanding white/cyan dash ring
  if (c.dashTimer > 0) {
    const p = 1 - c.dashTimer / 0.17;
    ctx.save();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 3 * (1 - p);
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * (1.5 + p * 3.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rot);
  ctx.scale(c.squash, 2 - c.squash);
  ctx.fillStyle = c.dashTimer > 0 ? COLORS.white : COLORS.cyan;
  ctx.fillRect(-c.r, -c.r, c.r * 2, c.r * 2);
  ctx.restore();
}

export function renderFrame(ctx) {
  const W = state.width, H = state.height;
  ctx.save();

  if (state.zoomPunch > 0.001) {
    const z = 1 + state.zoomPunch;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
  }
  if (state.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }

  drawBiomeBackground(ctx, W, H);
  for (const ent of state.entities) ent.draw(ctx, W, H);

  for (const p of state.particles) {
    ctx.globalAlpha = Utils.clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.globalAlpha = 1;

  drawProceduralBoss(ctx);
  drawCyan(ctx);

  if (state.flashAlpha > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flashAlpha * 0.65})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.showHud) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 14px Orbitron, sans-serif";
    ctx.fillText(`PHASE ${state.phase} • ${PHASES[state.phase - 1].name}`, 24, 34);
    ctx.fillStyle = COLORS.cyan;
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.fillText(`SETPIECE: ${state.activeSetpiece.replace(/_/g, " ")}`, 24, 54);
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
