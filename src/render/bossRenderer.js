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
  const handsMode = cb.handsMode || "phase2";
  const handsLayer = cb.handsLayer || "behind";
  const handsRotate = cb.handsRotate || "tilt";
  const spikesLayer = cb.spikesLayer || "behind";
  const bgCol = (state.customColors?.enabled ? state.customColors.bg : state.analysis?.dna?.palette?.bg) || "#040D14";

  const drawHands = () => {
    if ((handsMode !== "always" && state.phase < 2) || handsShape === "none") return;
    if (state.entities?.some(e => !e.dead && e.type === "articulatedArms")) return;
    const col = flash ? COLORS.white : danger;
    [b.leftHand, b.rightHand].forEach((h, idx) => {
      const side = idx === 0 ? -1 : 1;
      ctx.save();
      ctx.translate(h.x, h.y);
      if (handsRotate === "spin") {
        ctx.rotate(state.currentTime * 2.8 * side);
      } else if (handsRotate === "tilt") {
        ctx.rotate(side * 0.22 + Math.sin(state.currentTime * 4) * 0.16);
      }
      ctx.fillStyle = col;

      const resolved = handsShape === "auto" ? bossCfg.limbStyle : handsShape;
      if (resolved === "peace" && typeof Path2D !== "undefined") {
        const sc = (b.r * 0.86) / 128;
        ctx.scale(side * sc, sc);
        ctx.translate(-128, -128);
        const bodyPath = new Path2D("M 92 144 L 70 56 A 12.4 12.4 0 0 1 94 50 L 113 126 L 141 42 A 12.7 12.7 0 0 1 165 50 L 138 131 L 185 160.5 C 185 204 161 226 130.5 226 C 98 226 76 204 76 174 L 76 158 Q 76 144 90 144 Z");
        ctx.fill(bodyPath);
        ctx.strokeStyle = bgCol;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const f1 = new Path2D("M 150 116 A 12 12 0 0 1 162 128 L 162 154 A 12 12 0 0 1 138 154 L 138 128 A 12 12 0 0 1 150 116 Z");
        const f2 = new Path2D("M 173.5 128 A 11.5 11.5 0 0 1 185 139.5 L 185 160.5 A 11.5 11.5 0 0 1 162 160.5 L 162 139.5 A 11.5 11.5 0 0 1 173.5 128 Z");
        const thumb = new Path2D("M 76 174 L 76 158 Q 76 144 90 144 L 136 144 A 12 12 0 0 1 136 168 L 114 168 Q 100 168 98 188");
        ctx.fill(f1); ctx.stroke(f1);
        ctx.fill(f2); ctx.stroke(f2);
        ctx.fill(thumb); ctx.stroke(thumb);
      } else if (resolved === "triangle" || resolved === "floating_triangles") {
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

  // Detached floating spikes around boss (full customization: 7 styles, 8 orbits, 5 anims, size/speed/fill/color)
  const spikesMode = cb.spikesMode || "phase3";
  const showSpikes = spikesMode === "always" || (spikesMode === "phase3" && (bossCfg.shape === "titan" || state.phase >= 3));
  const drawSpikes = () => {
    if (!showSpikes) return;
    const spikes = cb.spikeCount || (bossCfg.spikeCount + 4);
    const spread = cb.spikeRadiusMul ?? 1.0;
    const spSize = cb.spikeSize ?? 1.0;
    const spSpeed = cb.spikeSpeed ?? 1.0;
    const spStyle = cb.spikeStyle || "classic";
    const spAnim = cb.spikeAnim || "spin";
    const isOutline = (cb.spikeFill || "solid") === "outline";

    let spColor = danger;
    if (cb.spikeColorMode === "white") spColor = COLORS.white;
    else if (cb.spikeColorMode === "cyan") spColor = (state.customColors?.enabled ? state.customColors.cyan : COLORS.cyan);
    else if (cb.spikeColorMode === "custom" && cb.spikeCustomColor) spColor = cb.spikeCustomColor;
    const finalCol = flash ? COLORS.white : spColor;

    let shape = cb.spikesShape || "auto";
    if (shape === "auto") {
      if (cb.img && (cb.frame === "square" || cb.frame === "hexagon" || cb.frame === "triangle")) shape = cb.frame;
      else shape = "circle";
    }

    const tData = state.audioTelemetry || { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0 };
    const eqBands = [tData.sub || 0, tData.bass || 0, tData.lowMid || 0, tData.mid || 0, tData.high || 0];

    // High-density 48-bar Symmetric Radial Spectrum Equalizer with Peak-Hold Caps
    if (spStyle === "equalizer") {
      const barCount = Math.max(32, spikes * 3);
      if (!drawProceduralBoss._eqBars || drawProceduralBoss._eqBars.length !== barCount) {
        drawProceduralBoss._eqBars = Array.from({ length: barCount }, () => ({ val: 0.08, peak: 0.12 }));
      }
      const eqBars = drawProceduralBoss._eqBars;
      const t = state.currentTime || 0;
      const dir = spAnim === "spinReverse" ? -1 : 1;
      const baseRot = b.rot * 0.25 * spSpeed * dir;

      ctx.save();
      ctx.rotate(baseRot);
      const baseRad = b.r * (1.16 * spread);
      const barW = Math.max(2.2, ((Math.PI * 2 * baseRad) / barCount) * 0.56);

      // Subtle inner glow ring anchoring the equalizer
      ctx.beginPath();
      ctx.arc(0, 0, baseRad - 1, 0, Math.PI * 2);
      ctx.strokeStyle = finalCol;
      ctx.globalAlpha = 0.35 + b.pulse * 0.35;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      for (let i = 0; i < barCount; i++) {
        // Mirror bilaterally (Trap Nation / Monstercat symmetry)
        const half = barCount / 2;
        const symIdx = i < half ? i : (barCount - 1 - i);
        const norm = symIdx / Math.max(1, half - 1); // 0 = bass/sub, 1 = high/synth
        const bandF = norm * (eqBands.length - 1);
        const b0 = eqBands[Math.floor(bandF)];
        const b1 = eqBands[Math.min(eqBands.length - 1, Math.floor(bandF) + 1)];
        const baseEnergy = b0 + (b1 - b0) * (bandF - Math.floor(bandF));
        const ripple = 0.16 * Math.abs(Math.sin(t * 9.5 + symIdx * 0.65));
        const target = Utils.clamp(baseEnergy * 1.15 + ripple * (0.3 + baseEnergy) + b.pulse * 0.22, 0.06, 1.35);

        const st = eqBars[i];
        st.val = target > st.val ? Utils.lerp(st.val, target, 0.45) : Utils.lerp(st.val, target, 0.16);
        st.peak = st.val >= st.peak ? st.val : Math.max(st.val, st.peak - 0.018);

        const a = (Math.PI * 2 * i) / barCount - Math.PI / 2;
        const maxLen = b.r * 0.92 * spSize;
        const len = Math.max(4, st.val * maxLen);
        const peakDist = baseRad + st.peak * maxLen + 4;

        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.roundRect(baseRad, -barW * 0.5, len, barW, barW * 0.45);
        if (isOutline) {
          ctx.strokeStyle = finalCol;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else {
          ctx.fillStyle = finalCol;
          ctx.fill();
        }

        // Floating white peak-hold cap
        ctx.fillStyle = COLORS.white;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.roundRect(peakDist, -barW * 0.42, Math.max(2.5, barW * 0.65), barW * 0.84, 1.5);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    const drawSingleSpike = (sizeMul = 1, idx = 0, total = spikes) => {
      const sz = b.r * spSize * sizeMul;
      ctx.beginPath();
      if (spStyle === "needle") {
        ctx.moveTo(sz * 0.42, 0);
        ctx.lineTo(-sz * 0.14, -sz * 0.08);
        ctx.lineTo(-sz * 0.14, sz * 0.08);
        ctx.closePath();
      } else if (spStyle === "saw") {
        ctx.moveTo(sz * 0.28, -sz * 0.12);
        ctx.lineTo(-sz * 0.12, -sz * 0.16);
        ctx.lineTo(-sz * 0.06, sz * 0.16);
        ctx.closePath();
      } else if (spStyle === "diamond") {
        ctx.moveTo(sz * 0.30, 0);
        ctx.lineTo(0, -sz * 0.14);
        ctx.lineTo(-sz * 0.22, 0);
        ctx.lineTo(0, sz * 0.14);
        ctx.closePath();
      } else if (spStyle === "claw") {
        ctx.moveTo(sz * 0.34, -sz * 0.08);
        ctx.quadraticCurveTo(sz * 0.06, -sz * 0.20, -sz * 0.14, -sz * 0.12);
        ctx.lineTo(-sz * 0.10, sz * 0.14);
        ctx.quadraticCurveTo(sz * 0.12, sz * 0.04, sz * 0.34, -sz * 0.08);
        ctx.closePath();
      } else if (spStyle === "gear") {
        ctx.moveTo(sz * 0.22, -sz * 0.09);
        ctx.lineTo(sz * 0.22, sz * 0.09);
        ctx.lineTo(-sz * 0.12, sz * 0.15);
        ctx.lineTo(-sz * 0.12, -sz * 0.15);
        ctx.closePath();
      } else if (spStyle === "star") {
        for (let k = 0; k < 8; k++) {
          const rad = k % 2 === 0 ? sz * 0.24 : sz * 0.09;
          const ang = (Math.PI * k) / 4;
          if (k === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath();
      } else {
        ctx.moveTo(sz * 0.26, 0);
        ctx.lineTo(-sz * 0.12, -sz * 0.14);
        ctx.lineTo(-sz * 0.12, sz * 0.14);
        ctx.closePath();
      }
      if (isOutline) {
        ctx.strokeStyle = finalCol;
        ctx.lineWidth = Math.max(2, b.r * 0.045);
        ctx.stroke();
      } else {
        ctx.fillStyle = finalCol;
        ctx.fill();
      }
    };

    const t = state.currentTime || 0;
    const dir = spAnim === "spinReverse" ? -1 : 1;
    const baseRot = b.rot * 0.42 * spSpeed * dir;

    const animRadialOffset = (idx, total) => {
      if (spAnim === "pulse") return b.r * (0.28 * b.pulse + 0.08 * Math.sin(t * 8));
      if (spAnim === "wave") return b.r * 0.22 * Math.sin(t * 7 - (idx / Math.max(1, total)) * Math.PI * 2);
      if (spAnim === "jitter") return (Math.random() - 0.5) * b.r * (0.14 + b.pulse * 0.2);
      return b.r * b.pulse * 0.16;
    };

    ctx.save();

    const drawPolygonSpikes = (sidesCount, radiusMul, rotOffset) => {
      const perSide = Math.max(1, Math.round(spikes / sidesCount));
      const rad = b.r * (radiusMul * spread) + (spAnim === "pulse" ? b.r * b.pulse * 0.26 : b.r * b.pulse * 0.16);
      ctx.rotate(baseRot * 0.75);
      let idx = 0;
      for (let sideIdx = 0; sideIdx < sidesCount; sideIdx++) {
        const a0 = rotOffset + (Math.PI * 2 * sideIdx) / sidesCount;
        const a1 = rotOffset + (Math.PI * 2 * (sideIdx + 1)) / sidesCount;
        const x0 = Math.cos(a0) * rad, y0 = Math.sin(a0) * rad;
        const x1 = Math.cos(a1) * rad, y1 = Math.sin(a1) * rad;
        const outAngle = (a0 + a1) * 0.5;
        for (let i = 0; i < perSide; i++) {
          const u = (i + 0.5) / perSide;
          const curIdx = idx++;
          const off = animRadialOffset(curIdx, spikes);
          const px = x0 + (x1 - x0) * u + Math.cos(outAngle) * off;
          const py = y0 + (y1 - y0) * u + Math.sin(outAngle) * off;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(outAngle);
          drawSingleSpike(1, curIdx, spikes);
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
    } else if (shape === "doubleRing") {
      [0, 1].forEach((ring) => {
        ctx.save();
        ctx.rotate(baseRot * (ring === 0 ? 1 : -1.25));
        const rMul = ring === 0 ? 1.15 : 1.55;
        for (let i = 0; i < spikes; i++) {
          const a = (Math.PI * 2 * i) / spikes;
          const dist = b.r * (rMul * spread) + animRadialOffset(i, spikes);
          ctx.save();
          ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
          ctx.rotate(a);
          drawSingleSpike(ring === 0 ? 0.85 : 1.05, i, spikes);
          ctx.restore();
        }
        ctx.restore();
      });
    } else if (shape === "saturn") {
      ctx.rotate(-0.35 + baseRot * 0.2);
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes + baseRot;
        const rx = b.r * 1.68 * spread + animRadialOffset(i, spikes);
        const ry = b.r * 0.62 * spread;
        const px = Math.cos(a) * rx, py = Math.sin(a) * ry;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2(py, px));
        drawSingleSpike(0.95, i, spikes);
        ctx.restore();
      }
    } else if (shape === "spiral") {
      ctx.rotate(baseRot);
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes * 1.5;
        const dist = b.r * ((0.95 + (i / Math.max(1, spikes - 1)) * 0.78) * spread) + animRadialOffset(i, spikes);
        ctx.save();
        ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
        ctx.rotate(a);
        drawSingleSpike(0.75 + (i / spikes) * 0.5, i, spikes);
        ctx.restore();
      }
    } else {
      ctx.rotate(baseRot);
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes;
        const alt = shape === "starCrown" ? (i % 2 === 0 ? 1.18 : 0.82) : 1.0;
        const dist = b.r * (1.25 * spread * alt) + animRadialOffset(i, spikes);
        ctx.save();
        ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
        ctx.rotate(a);
        drawSingleSpike(shape === "starCrown" ? (i % 2 === 0 ? 1.25 : 0.75) : 1, i, spikes);
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
    if (cb.gifFrames && cb.gifFrames.length > 0 && cb.gifAnimate !== false) {
      const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      const lastMs = drawProceduralBoss._lastGifMs || nowMs;
      const dtGif = Math.min(0.08, Math.max(0, (nowMs - lastMs) / 1000));
      drawProceduralBoss._lastGifMs = nowMs;

      // Freeze GIF during hitstop, otherwise advance with optional BPM/bass boost
      if ((state.hitstopTimer || 0) <= 0) {
        const baseSpd = cb.gifSpeed ?? 1.0;
        const bpmFactor = cb.gifBpmSync
          ? ((state.analysis?.bpm || 128) / 128) * (1 + (state.audioTelemetry?.bass || 0) * 0.65)
          : 1.0;
        cb.gifTime = (cb.gifTime || 0) + dtGif * baseSpd * bpmFactor;
      }

      const totalDur = cb.gifFrames.reduce((acc, f) => acc + f.dur, 0) || 1;
      let tMod = cb.gifTime % totalDur;
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
