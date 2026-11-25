import { COLORS } from "../config.js";
import { Utils } from "../utils.js";
import { state } from "../state.js";

const getDanger = () => (state.customColors?.enabled ? state.customColors.danger : state.analysis?.dna?.palette?.danger) || "#FF1E6E";

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
      ctx.arc(tr.x, tr.y, Math.min(tr.r * 0.9, 95), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const cb = state.customBoss || {};
  const handsShape = cb.handsShape || "auto";
  const handsLayer = cb.handsLayer || "behind";
  const spikesLayer = cb.spikesLayer || "behind";

  const drawHands = () => {
    if (state.phase < 2 || handsShape === "none") return;
    [b.leftHand, b.rightHand].forEach((h, idx) => {
      const side = idx === 0 ? -1 : 1;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(side * 0.35 + Math.sin(state.currentTime * 4) * 0.15);
      ctx.fillStyle = flash ? COLORS.white : danger;

      const resolved = handsShape === "auto" ? bossCfg.limbStyle : handsShape;
      if (resolved === "triangle" || resolved === "floating_triangles") {
        Utils.drawPolygon(ctx, 0, 0, 3, b.r * 0.48, side > 0 ? 0 : Math.PI);
        ctx.fill();
      } else if (resolved === "square" || resolved === "orbit_cannons") {
        ctx.fillRect(-b.r * 0.28, -b.r * 0.28, b.r * 0.56, b.r * 0.56);
      } else if (resolved === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 0.36, 0, Math.PI * 2);
        ctx.fill();
      } else {
        Utils.drawPolygon(ctx, 0, 0, 5, b.r * 0.45, 0.3);
        ctx.fill();
      }
      ctx.restore();
    });
  };

  if (handsLayer !== "above") drawHands();

  ctx.save();
  const jx = b.jitter ? (Math.random() - 0.5) * b.jitter : 0;
  const jy = b.jitter ? (Math.random() - 0.5) * b.jitter : 0;
  const userScale = state.settings?.bossScale ?? 1;
  ctx.translate(b.x + jx, b.y + jy);
  ctx.rotate(b.tilt || 0);
  ctx.scale((b.scaleX || 1) * userScale, (b.scaleY || 1) * userScale);

  // Detached floating pink triangles around boss (respects spikesMode, spikesShape & spikesLayer)
  const spikesMode = cb.spikesMode || "phase3";
  const showSpikes = spikesMode === "always" || (spikesMode === "phase3" && (bossCfg.shape === "titan" || state.phase >= 3));
  const drawSpikes = () => {
    if (!showSpikes) return;
    const spikes = cb.spikeCount || (bossCfg.spikeCount + 4);
    let shape = cb.spikesShape || "auto";
    if (shape === "auto") {
      if (cb.img && (cb.frame === "square" || cb.frame === "hexagon" || cb.frame === "triangle")) shape = cb.frame;
      else shape = "circle";
    }
    ctx.save();
    ctx.fillStyle = flash ? COLORS.white : danger;

    const drawPolygonSpikes = (sidesCount, radiusMul, rotOffset) => {
      const perSide = Math.max(1, Math.round(spikes / sidesCount));
      const rad = b.r * (radiusMul + b.pulse * 0.16);
      ctx.rotate(b.rot * 0.32);
      for (let sideIdx = 0; sideIdx < sidesCount; sideIdx++) {
        const a0 = rotOffset + (Math.PI * 2 * sideIdx) / sidesCount;
        const a1 = rotOffset + (Math.PI * 2 * (sideIdx + 1)) / sidesCount;
        const x0 = Math.cos(a0) * rad, y0 = Math.sin(a0) * rad;
        const x1 = Math.cos(a1) * rad, y1 = Math.sin(a1) * rad;
        const outAngle = (a0 + a1) * 0.5;
        for (let i = 0; i < perSide; i++) {
          const u = (i + 0.5) / perSide;
          const px = x0 + (x1 - x0) * u;
          const py = y0 + (y1 - y0) * u;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(outAngle);
          ctx.beginPath();
          ctx.moveTo(b.r * 0.25, 0);
          ctx.lineTo(-b.r * 0.11, -b.r * 0.14);
          ctx.lineTo(-b.r * 0.11, b.r * 0.14);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    };

    if (shape === "square") {
      drawPolygonSpikes(4, 1.55, Math.PI / 4);
    } else if (shape === "hexagon") {
      drawPolygonSpikes(6, 1.32, 0);
    } else if (shape === "triangle") {
      drawPolygonSpikes(3, 1.65, -Math.PI / 2);
    } else {
      ctx.rotate(b.rot * 0.45);
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
    }
    ctx.restore();
  };

  if (spikesLayer !== "above") drawSpikes();

  // Helper to trace PNG frame path (DRY)
  const traceFramePath = (frame, s) => {
    ctx.beginPath();
    if (frame === "circle") ctx.arc(0, 0, s, 0, Math.PI * 2);
    else if (frame === "square") ctx.roundRect(-s, -s, s * 2, s * 2, 18);
    else if (frame === "hexagon") Utils.drawPolygon(ctx, 0, 0, 6, s * 1.12, 0);
    else if (frame === "triangle") Utils.drawPolygon(ctx, 0, 0, 3, s * 1.32, -Math.PI / 2);
  };

  // Offscreen scratch canvas for alpha-preserving beat flash (source-atop)
  if (!drawProceduralBoss._scratch && typeof document !== "undefined") {
    drawProceduralBoss._scratch = document.createElement("canvas");
  }

  // Custom PNG / Animated GIF Boss Mode
  if (cb.img) {
    const frame = cb.frame || "circle";
    const fw = cb.frameWidth ?? 6;
    const fInt = cb.flashIntensity ?? 0.72;
    const s = b.r * 1.15;
    const drawSize = Math.max(4, Math.ceil(s * 2.5));

    ctx.save();
    if (frame !== "none") {
      traceFramePath(frame, s);
      ctx.clip();
    }

    // Select current animated GIF frame if decoded via ImageDecoder, else static/DOM img
    let activeImg = cb.img;
    if (cb.gifFrames && cb.gifFrames.length > 0) {
      const totalDur = cb.gifFrames.reduce((s, f) => s + f.dur, 0) || 1;
      let tMod = ((performance.now() / 1000) % totalDur);
      for (const fr of cb.gifFrames) {
        if (tMod <= fr.dur) { activeImg = fr.bitmap; break; }
        tMod -= fr.dur;
      }
    }

    const scratch = drawProceduralBoss._scratch;
    if (scratch) {
      if (scratch.width !== drawSize || scratch.height !== drawSize) {
        scratch.width = drawSize;
        scratch.height = drawSize;
      }
      const sCtx = scratch.getContext("2d");
      sCtx.clearRect(0, 0, drawSize, drawSize);
      sCtx.globalCompositeOperation = "source-over";
      sCtx.drawImage(activeImg, 0, 0, drawSize, drawSize);

      // source-atop ONLY tints non-transparent pixels of the PNG/GIF!
      if (fInt > 0.01 && (flash || b.pulse > 0.35)) {
        sCtx.globalCompositeOperation = "source-atop";
        if (flash) {
          sCtx.fillStyle = `rgba(255, 255, 255, ${fInt})`;
        } else {
          sCtx.fillStyle = danger;
          sCtx.globalAlpha = (b.pulse - 0.35) * 0.55 * fInt;
        }
        sCtx.fillRect(0, 0, drawSize, drawSize);
        sCtx.globalAlpha = 1;
        sCtx.globalCompositeOperation = "source-over";
      }
      ctx.drawImage(scratch, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    } else {
      ctx.drawImage(cb.img, -s * 1.25, -s * 1.25, s * 2.5, s * 2.5);
    }
    ctx.restore();

    if (frame !== "none" && fw > 0) {
      ctx.save();
      ctx.strokeStyle = flash ? COLORS.white : danger;
      ctx.lineWidth = fw;
      traceFramePath(frame, s);
      ctx.stroke();
      ctx.restore();
    }
    if (spikesLayer === "above") drawSpikes();
    ctx.restore();
    if (handsLayer === "above") drawHands();
    return;
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
    // Annihilate / Titan: Dark maroon/black octagonal face with dynamic emotional expressions!
    if (b.lookaheadCharge > 0.35) {
      // Shrinking anticipation charge ring before a Drop!
      ctx.save();
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, b.r * (2.2 - b.lookaheadCharge * 1.1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#2A0716";
    Utils.drawPolygon(ctx, 0, 0, 8, b.r * 1.05, Math.PI / 8);
    ctx.fill();
    ctx.stroke();

    // Dynamic Eyes by Mood (smug / tense / frenzy / sad / blinking)
    const ang = Math.atan2(state.cyan.y - b.y, state.cyan.x - b.x);
    const lx = Math.cos(ang) * 5, ly = Math.sin(ang) * 5;
    const mood = b.mood || "smug";

    [-1, 1].forEach(side => {
      const ex = side * b.r * 0.36;
      const ey = -b.r * 0.12;
      if (b.isBlinking) {
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(ex - b.r * 0.16, ey);
        ctx.lineTo(ex + b.r * 0.16, ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = danger;
        ctx.beginPath();
        if (mood === "frenzy") {
          ctx.moveTo(side * b.r * 0.1, -b.r * 0.02);
          ctx.lineTo(side * b.r * 0.68, -b.r * 0.34);
          ctx.lineTo(side * b.r * 0.56, b.r * 0.12);
        } else if (mood === "tense") {
          ctx.arc(ex, ey, b.r * 0.22, 0, Math.PI * 2);
        } else if (mood === "sad") {
          ctx.arc(ex, ey + 4, b.r * 0.18, 0, Math.PI);
        } else {
          // smug half-lidded
          ctx.rect(ex - b.r * 0.18, ey - b.r * 0.06, b.r * 0.36, b.r * 0.16);
        }
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = COLORS.white;
        const pupilR = mood === "frenzy" ? b.r * 0.08 : b.r * 0.12;
        ctx.beginPath();
        ctx.arc(ex + lx, ey + ly, pupilR, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Dynamic Mouth by Mood
    const mOpen = 8 + b.mouthOpen * 24;
    ctx.fillStyle = "#040D14";
    ctx.strokeStyle = danger;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (mood === "smug") {
      // Cocky crooked smirk
      ctx.moveTo(-b.r * 0.45, b.r * 0.32);
      ctx.quadraticCurveTo(0, b.r * 0.42, b.r * 0.52, b.r * 0.18);
      ctx.stroke();
    } else if (mood === "sad") {
      ctx.arc(0, b.r * 0.48, b.r * 0.28, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      // Huge jagged roaring teeth (tense / frenzy)
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
  }

  if (spikesLayer === "above") drawSpikes();
  ctx.restore();
  if (handsLayer === "above") drawHands();
}
