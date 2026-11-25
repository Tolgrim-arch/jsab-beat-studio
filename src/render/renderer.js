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
  const arch = state.analysis?.archetype;
  const bgBase = state.customColors?.enabled
    ? state.customColors.bg
    : (arch?.bgTint || "#040D14");
  ctx.fillStyle = bgBase;
  ctx.fillRect(0, 0, W, H);

  const biomeEnabled = state.settings?.biomeBgEnabled !== false;
  const biomeInt = state.settings?.biomeBgIntensity ?? 0.75;
  if (biomeEnabled && biomeInt > 0.01) {
    let style = state.settings?.biomeBgStyle || "auto";
    if (style === "auto") style = arch?.bgStyle || "seismic";

    if (style !== "flat") {
      const bp = state.beatPhase || 0;
      const barP = state.barPhase || 0;
      const pulse = state.bgPulse || 0;
      const sub = state.audioTelemetry?.sub || 0;
      const danger = getDangerColor();
      const cyan = getCyanColor();

      ctx.save();
      if (style === "seismic") {
        // Expanding concentric shockwave rings locked to beatPhase
        const cx = W * 0.5, cy = H * 0.35;
        const maxR = Math.hypot(W, H) * 0.65;
        ctx.strokeStyle = danger;
        ctx.lineWidth = 1.8;
        for (let i = 0; i < 6; i++) {
          const prog = ((barP + i / 6) % 1);
          const r = prog * maxR;
          ctx.globalAlpha = (1 - prog) * 0.24 * biomeInt * (1 + pulse * 0.9);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.08 * biomeInt;
        ctx.strokeStyle = cyan;
        const step = 64;
        const offY = bp * step;
        for (let y = offY; y < H; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
      } else if (style === "tunnel") {
        // Hypnotic zooming geometric tunnel advancing 1 square per beat
        const cx = W * 0.5, cy = H * 0.5;
        const maxS = Math.max(W, H) * 0.85;
        ctx.strokeStyle = danger;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const prog = ((bp / 2 + i / 8) % 1);
          const sz = prog * prog * maxS;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(barP * Math.PI * 0.5 + prog * 0.65);
          ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.26 * biomeInt * (1 + sub * 0.8);
          ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
          ctx.restore();
        }
      } else if (style === "perspective") {
        // Retro-synthwave perspective horizon grid locked to beatPhase
        const horizon = H * 0.42;
        ctx.strokeStyle = danger;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = (0.18 + pulse * 0.14) * biomeInt;
        for (let i = 0; i < 10; i++) {
          const prog = ((bp + i / 10) % 1);
          const y = horizon + prog * prog * (H - horizon);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        const rays = 12;
        for (let i = -rays; i <= rays; i++) {
          ctx.beginPath();
          ctx.moveTo(W * 0.5 + i * 24, horizon);
          ctx.lineTo(W * 0.5 + i * (W * 0.16), H);
          ctx.stroke();
        }
      } else if (style === "vortex") {
        // Rotating abyssal spiral arms locked to barPhase
        const cx = W * 0.5, cy = H * 0.45;
        const maxR = Math.hypot(W, H) * 0.6;
        ctx.strokeStyle = danger;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = (0.16 + pulse * 0.18) * biomeInt;
        const arms = 6;
        for (let a = 0; a < arms; a++) {
          ctx.beginPath();
          for (let step = 0; step <= 20; step++) {
            const u = step / 20;
            const ang = (Math.PI * 2 * a) / arms + u * 3.2 - barP * Math.PI * 2;
            const r = u * maxR;
            const px = cx + Math.cos(ang) * r;
            const py = cy + Math.sin(ang) * r;
            if (step === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Pre-Drop Silence dramatic focus vignette
  if (state.isPreDropSilence) {
    ctx.save();
    const vig = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.14, W / 2, H * 0.42, Math.max(W, H) * 0.65);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const eqCol = state.customColors?.enabled ? (state.customColors.eq || getCyanColor()) : getCyanColor();
  const eqAlpha = state.settings?.eqAlpha ?? 0.14;
  if (eqAlpha > 0.01) {
    const bars = 36;
    const bw = W / bars;
    const beatAng = (state.beatPhase || 0) * Math.PI * 2;
    ctx.save();
    ctx.fillStyle = eqCol;
    ctx.globalAlpha = eqAlpha;
    for (let i = 0; i < bars; i++) {
      const wave = 0.4 + 0.6 * Math.sin(beatAng + i * 0.45);
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
    const mLen = state.beatsPerBar || 4;
    const curBeat = state.beatInBar || 0;
    const dots = Array.from({ length: mLen }, (_, i) => (i === curBeat ? "●" : "○")).join(" ");
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 14px Orbitron, sans-serif";
    ctx.fillText(`PHASE ${state.phase} • ${PHASES[state.phase - 1].name}`, 24, 34);
    ctx.fillStyle = COLORS.cyan;
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    const layers = state.activeArtifactLayers || 1;
    const noisePct = Math.round((state.noiseLevel || 0) * 100);
    ctx.fillText(`SETPIECE: ${state.activeSetpiece.replace(/_/g, " ")} • ${state.liveBpm || 128} BPM [${state.meterLabel || "4/4"}] ${dots} • RUIDO ${noisePct}% (${layers}x)`, 24, 54);
  }

  drawStudioOverlays(ctx, W, H);

  ctx.restore();
}

function drawStudioOverlays(ctx, W, H) {
  const st = state.studio;
  if (!st) return;

  const clip = st.clip;
  const startT = (clip?.enabled && clip.start > 0) ? clip.start : 0;
  const endT = (clip?.enabled && clip.end > startT && state.duration > 0)
    ? Math.min(clip.end, state.duration)
    : (state.duration || 0);
  const relT = Math.max(0, (state.currentTime || 0) - startT);
  const totalDur = Math.max(0.1, endT - startT);
  const danger = getDangerColor();
  const cyan = getCyanColor();

  // 1. Boss HP / Progress Bar + Near-Miss Counter
  if (st.bossBar?.enabled) {
    const isBottom = st.bossBar.position === "bottom";
    const barW = Math.min(W * 0.54, 540);
    const barH = 12;
    const bx = (W - barW) / 2;
    const by = isBottom ? H - 36 : 22;
    const hpFrac = state.bossDefeated ? 0 : Utils.clamp(1 - relT / totalDur, 0, 1);

    ctx.save();
    ctx.fillStyle = "rgba(6, 9, 20, 0.78)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx - 4, by - 4, barW + 8, barH + 8, 8);
    else ctx.rect(bx - 4, by - 4, barW + 8, barH + 8);
    ctx.fill();

    ctx.fillStyle = danger;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, Math.max(0, barW * hpFrac), barH, 5);
    else ctx.rect(bx, by, Math.max(0, barW * hpFrac), barH);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 4, by - 4, barW + 8, barH + 8);

    const bossLabel = (st.vsIntro?.bossName || "BOSS HP").toUpperCase();
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.fillText(bossLabel, bx, by - 8);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(hpFrac * 100)}%`, bx + barW, by - 8);

    if (st.bossBar.showNearMiss) {
      const nm = state.nearMissCount || 0;
      const nmScale = 1 + (state.nearMissFlash || 0) * 0.18;
      ctx.save();
      ctx.translate(W - 24, isBottom ? H - 24 : 34);
      ctx.scale(nmScale, nmScale);
      ctx.textAlign = "right";
      ctx.font = "800 13px Orbitron, sans-serif";
      ctx.fillStyle = (state.nearMissFlash || 0) > 0.2 ? "#FFFFFF" : cyan;
      ctx.fillText(`NEAR MISS: ${nm}`, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // 2. YouTube / TikTok Comment Card Overlay
  if (st.commentCard?.enabled && relT <= (st.commentCard.duration || 4.5)) {
    const dur = st.commentCard.duration || 4.5;
    const fadeIn = Utils.clamp(relT / 0.35, 0, 1);
    const fadeOut = Utils.clamp((dur - relT) / 0.4, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const slide = (1 - fadeIn) * 28;

    const cardW = Math.min(W * 0.78, 380);
    const cardH = 74;
    let cx = 24, cy = 78;
    if (st.commentCard.position === "top-center") { cx = (W - cardW) / 2; cy = 62; }
    else if (st.commentCard.position === "bottom-left") { cx = 24; cy = H - cardH - 52; }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, -slide);
    ctx.fillStyle = "rgba(15, 19, 36, 0.92)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 14);
    else ctx.rect(cx, cy, cardW, cardH);
    ctx.fill();
    ctx.stroke();

    // Avatar circle
    ctx.fillStyle = danger;
    ctx.beginPath();
    ctx.arc(cx + 30, cy + cardH / 2, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 14px Orbitron, sans-serif";
    ctx.textAlign = "center";
    const initial = (st.commentCard.user || "@").replace(/^@/, "").charAt(0).toUpperCase() || "U";
    ctx.fillText(initial, cx + 30, cy + cardH / 2 + 5);

    ctx.textAlign = "left";
    ctx.fillStyle = cyan;
    ctx.font = "700 12px 'JetBrains Mono', monospace";
    ctx.fillText((st.commentCard.user || "@FanJSAB").slice(0, 28), cx + 58, cy + 28);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.fillText((st.commentCard.text || "").slice(0, 42), cx + 58, cy + 50);
    ctx.restore();
  }

  // 3. VS / Boss Intro Banner
  if (st.vsIntro?.enabled && relT <= (st.vsIntro.duration || 2.4)) {
    const dur = st.vsIntro.duration || 2.4;
    const fadeIn = Utils.clamp(relT / 0.22, 0, 1);
    const fadeOut = Utils.clamp((dur - relT) / 0.35, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);

    ctx.save();
    ctx.globalAlpha = alpha;
    const bandH = Math.min(H * 0.22, 148);
    const by = H * 0.44 - bandH / 2;
    ctx.fillStyle = "rgba(5, 7, 18, 0.86)";
    ctx.fillRect(0, by, W, bandH);
    ctx.fillStyle = danger;
    ctx.fillRect(0, by, W, 4);
    ctx.fillRect(0, by + bandH - 4, W, 4);

    ctx.textAlign = "center";
    ctx.fillStyle = cyan;
    ctx.font = "700 13px 'JetBrains Mono', monospace";
    ctx.fillText("NEXT BOSS BATTLE", W / 2, by + 32);

    ctx.fillStyle = "#FFFFFF";
    const titleSz = Math.round(Math.min(W, H) * 0.068);
    ctx.font = `900 ${titleSz}px Orbitron, sans-serif`;
    ctx.fillText(`VS ${(st.vsIntro.bossName || "BOSS").toUpperCase()}`, W / 2, by + bandH * 0.62);

    const songLabel = st.vsIntro.songTitle || state.trackTitle || "";
    if (songLabel) {
      ctx.fillStyle = "#FFD166";
      ctx.font = "600 13px 'JetBrains Mono', monospace";
      ctx.fillText(`♪ ${songLabel.slice(0, 48)}`, W / 2, by + bandH - 18);
    }
    ctx.restore();
  }

  // 4. End-Screen CTA Overlay
  if (st.endCta?.enabled && endT > 0) {
    const ctaDur = st.endCta.duration || 3.5;
    const timeLeft = endT - (state.currentTime || 0);
    if (timeLeft <= ctaDur || state.bossDefeated) {
      const alpha = state.bossDefeated ? 1 : Utils.clamp((ctaDur - timeLeft) / 0.45, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      const boxW = Math.min(W * 0.86, 620);
      const boxH = 104;
      const bx = (W - boxW) / 2;
      const by = H * 0.62;

      ctx.fillStyle = "rgba(8, 11, 26, 0.90)";
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 16);
      else ctx.rect(bx, by, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 18px Inter, sans-serif";
      ctx.fillText(st.endCta.text || "¿Qué Boss y canción hago después? Comenta 👇", W / 2, by + 44);

      ctx.fillStyle = danger;
      ctx.font = "800 13px Orbitron, sans-serif";
      ctx.fillText((st.endCta.subtext || "SUSCRÍBETE PARA MÁS").toUpperCase(), W / 2, by + 76);
      ctx.restore();
    }
  }
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

  // Highlight Clip In / Out range if enabled
  const clip = state.studio?.clip;
  if (clip?.enabled && state.duration > 0) {
    const x1 = Utils.clamp(clip.start / state.duration, 0, 1) * w;
    const x2 = Utils.clamp(clip.end / state.duration, 0, 1) * w;
    tCtx.fillStyle = "rgba(255, 209, 102, 0.18)";
    tCtx.fillRect(x1, 0, Math.max(2, x2 - x1), h);
    tCtx.fillStyle = "#FFD166";
    tCtx.fillRect(x1, 0, 2, h);
    tCtx.fillRect(x2 - 2, 0, 2, h);
  }

  const prog = state.duration > 0 ? state.currentTime / state.duration : 0;
  tCtx.fillStyle = "#FF1E6E";
  tCtx.fillRect(prog * w - 1, 0, 2, h);
}
