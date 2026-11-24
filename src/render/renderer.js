import { COLORS, PHASES, ARCHETYPES } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";

function drawBiomeBackground(ctx, W, H) {
  const arch = state.analysis ? state.analysis.archetype : ARCHETYPES.TITAN_CRUSHER;
  ctx.fillStyle = arch.bgTint;
  ctx.fillRect(0, 0, W, H);

  const alpha = 0.07 + state.bgPulse * 0.16;
  ctx.strokeStyle = `${arch.gridColor}${alpha})`;
  ctx.lineWidth = 1.2;

  if (arch.bgStyle === "tunnel") {
    for (let i = 1; i <= 7; i++) {
      const s = ((i / 7 + (state.currentTime * 0.35) % (1 / 7)));
      const rw = W * s, rh = H * s;
      ctx.strokeRect((W - rw) / 2, (H - rh) / 2, rw, rh);
    }
  } else if (arch.bgStyle === "vortex") {
    for (let r = 80; r < Math.max(W, H); r += 90) {
      ctx.beginPath(); ctx.arc(W / 2, H / 2, r + state.bgPulse * 24, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    const step = 64;
    for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
}

function drawBlixer(ctx) {
  const b = state.blixer;

  if (state.phase >= 3) {
    [b.leftHand, b.rightHand].forEach((h, idx) => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(idx === 0 ? -0.35 : 0.35);
      Utils.withGlow(ctx, COLORS.pink, 16, () => {
        ctx.fillStyle = COLORS.pink;
        Utils.drawPolygon(ctx, 0, 0, 5, b.r * 0.42, 0.3);
        ctx.fill();
      });
      ctx.restore();
    });
  }

  ctx.save();
  ctx.translate(b.x, b.y);

  if (state.phase >= 2) {
    ctx.save();
    ctx.rotate(-b.rot * 0.7);
    ctx.strokeStyle = "rgba(255, 31, 113, 0.45)";
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.beginPath(); ctx.arc(0, 0, b.r * 1.48, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  ctx.rotate(b.rot);
  Utils.withGlow(ctx, COLORS.pink, 28, () => {
    ctx.fillStyle = COLORS.pink;
    ctx.beginPath();
    const spikes = 6 + state.phase * 2;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? b.r * 1.25 : b.r * 0.82;
      const a = (Math.PI * i) / spikes;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  });

  ctx.rotate(-b.rot);
  ctx.fillStyle = "#1a0612";
  ctx.beginPath(); ctx.arc(0, 0, b.r * 0.58, 0, Math.PI * 2); ctx.fill();

  const angToCyan = Math.atan2(state.cyan.y - b.y, state.cyan.x - b.x);
  const lookX = Math.cos(angToCyan) * 4;
  const lookY = Math.sin(angToCyan) * 4;
  ctx.fillStyle = COLORS.white;
  const eyeOff = b.r * 0.22;
  ctx.beginPath();
  ctx.arc(-eyeOff + lookX, -b.r * 0.08 + lookY, b.r * 0.12, 0, Math.PI * 2);
  ctx.arc(eyeOff + lookX, -b.r * 0.08 + lookY, b.r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLORS.pinkHot;
  ctx.lineWidth = 3;
  const mOpen = 4 + b.mouthOpen * 14;
  ctx.beginPath();
  ctx.moveTo(-eyeOff * 1.1, b.r * 0.2);
  ctx.lineTo(-eyeOff * 0.4, b.r * 0.2 + mOpen);
  ctx.lineTo(0, b.r * 0.2);
  ctx.lineTo(eyeOff * 0.4, b.r * 0.2 + mOpen);
  ctx.lineTo(eyeOff * 1.1, b.r * 0.2);
  ctx.stroke();

  ctx.restore();
}

function drawCyan(ctx) {
  const c = state.cyan;
  for (const tr of c.trail) {
    ctx.fillStyle = `rgba(0, 240, 255, ${tr.alpha * 0.45})`;
    ctx.fillRect(tr.x - c.r * 0.7, tr.y - c.r * 0.7, c.r * 1.4, c.r * 1.4);
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rot);
  ctx.scale(c.squash, 2 - c.squash);
  Utils.withGlow(ctx, COLORS.cyan, 18, () => {
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(-c.r, -c.r, c.r * 2, c.r * 2);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(-c.r * 0.4, -c.r * 0.4, c.r * 0.8, c.r * 0.8);
  });
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
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawProceduralBoss(ctx);
  drawCyan(ctx);

  if (state.flashAlpha > 0.01) {
    ctx.fillStyle = `rgba(255, 31, 113, ${state.flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.showHud) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
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
  tCtx.fillStyle = "rgba(0, 240, 255, 0.28)";
  const step = Math.max(1, Math.floor(frames.length / w));
  for (let x = 0; x < w; x++) {
    const f = frames[Math.min(frames.length - 1, x * step)];
    const barH = Utils.clamp(f.rms * h * 0.85, 2, h);
    tCtx.fillRect(x, h - barH, 1, barH);
  }

  const prog = state.duration > 0 ? state.currentTime / state.duration : 0;
  tCtx.fillStyle = COLORS.pink;
  tCtx.fillRect(prog * w - 1, 0, 2, h);
}
