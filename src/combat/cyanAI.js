import { COLORS } from "../config.js";
import { Utils } from "../utils.js";
import { state, spawnParticles } from "../state.js";

export function evaluateDangerAt(px, py, tAhead) {
  let danger = 0;
  const W = state.width, H = state.height;
  const margin = 42;
  if (px < margin) danger += (margin - px) * 3.8;
  if (px > W - margin) danger += (px - (W - margin)) * 3.8;
  if (py < margin) danger += (margin - py) * 3.8;
  if (py > H - margin) danger += (py - (H - margin)) * 3.8;

  const bd = Math.hypot(px - state.blixer.x, py - state.blixer.y);
  if (bd < state.blixer.r + 52) danger += (1 - bd / (state.blixer.r + 52)) * 170;

  for (const ent of state.entities) {
    danger += ent.getDanger(px, py, tAhead);
  }
  return danger;
}

export function updateCyanAI(dt) {
  const c = state.cyan;
  const W = state.width, H = state.height;
  if (c.dashCooldown > 0) c.dashCooldown -= dt;
  if (c.invuln > 0) c.invuln -= dt;
  c.squash = Utils.lerp(c.squash, 1, dt * 12);

  if (c.dashTimer > 0) {
    c.dashTimer -= dt;
    const dashSpd = 1040;
    c.x = Utils.clamp(c.x + c.dashDirX * dashSpd * dt, 24, W - 24);
    c.y = Utils.clamp(c.y + c.dashDirY * dashSpd * dt, 24, H - 24);
    c.trail.push({ x: c.x, y: c.y, alpha: 0.95 });
    return;
  }

  const speed = 445;
  let bestX = 0, bestY = 0, bestScore = Infinity;
  const dirs = 16;
  for (let i = 0; i <= dirs; i++) {
    const dx = i === dirs ? 0 : Math.cos((Math.PI * 2 * i) / dirs);
    const dy = i === dirs ? 0 : Math.sin((Math.PI * 2 * i) / dirs);
    const nx = Utils.clamp(c.x + dx * speed * 0.14, 24, W - 24);
    const ny = Utils.clamp(c.y + dy * speed * 0.14, 24, H - 24);

    let score = evaluateDangerAt(nx, ny, 0.08) * 0.6 + evaluateDangerAt(nx, ny, 0.20) * 0.4;
    score += Math.hypot(nx - W * 0.5, ny - H * 0.65) * 0.035;
    if (score < bestScore) { bestScore = score; bestX = dx; bestY = dy; }
  }

  const currentDanger = evaluateDangerAt(c.x, c.y, 0.05);
  if (currentDanger > 72 && c.dashCooldown <= 0 && (bestX !== 0 || bestY !== 0)) {
    c.dashTimer = 0.17;
    c.dashCooldown = 0.36;
    c.invuln = 0.24;
    c.squash = 1.45;
    c.dashDirX = bestX;
    c.dashDirY = bestY;
    spawnParticles(c.x, c.y, COLORS.cyan, 10, 80, 220);
    return;
  }

  c.vx = Utils.lerp(c.vx, bestX * speed, dt * 15);
  c.vy = Utils.lerp(c.vy, bestY * speed, dt * 15);
  c.x = Utils.clamp(c.x + c.vx * dt, 24, W - 24);
  c.y = Utils.clamp(c.y + c.vy * dt, 24, H - 24);
  c.rot = Math.atan2(c.vy, c.vx);

  if (Math.hypot(c.vx, c.vy) > 35) c.trail.push({ x: c.x, y: c.y, alpha: 0.6 });
  if (c.trail.length > 14) c.trail.shift();
  for (const tr of c.trail) tr.alpha -= dt * 2.4;
  c.trail = c.trail.filter(tr => tr.alpha > 0);
}
