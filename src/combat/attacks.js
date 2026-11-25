import { COLORS } from "../config.js";
import { Utils } from "../utils.js";
import { state, spawnParticles } from "../state.js";

const dangerCol = () => (state.customColors?.enabled ? state.customColors.danger : state.analysis?.dna?.palette?.danger) || "#FF1E6E";
const palePink = "#FFC2DC";

// JSAB signature: pure white flash for the first 80ms of an attack/impact
function isWhiteFlash(age, leadTime = 0) {
  return age >= leadTime && (age - leadTime) < 0.08;
}

export const AttackFactory = {
  laser(x1, y1, x2, y2, width = 30, leadTime = 0.45, activeTime = 0.28) {
    return {
      type: "laser", x1, y1, x2, y2, width, leadTime, activeTime,
      age: 0, dead: false, impacted: false,
      update(dt) {
        this.age += dt;
        if (!this.impacted && this.age >= this.leadTime) {
          this.impacted = true;
          state.shake = Math.max(state.shake, 7);
        }
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      getDanger(px, py, tAhead) {
        const fa = this.age + tAhead;
        if (fa > this.leadTime + this.activeTime) return 0;
        const d = Utils.pointToSegmentDist(px, py, this.x1, this.y1, this.x2, this.y2);
        const safe = this.width * 0.62 + 26;
        if (d < safe) {
          const urg = this.isActive() ? 1.15 : Utils.clamp(fa / this.leadTime, 0.25, 1.0);
          return (1 - d / safe) * 150 * urg;
        }
        return 0;
      },
      checkCollision(px, py, r) {
        return this.isActive() && Utils.pointToSegmentDist(px, py, this.x1, this.y1, this.x2, this.y2) < (this.width * 0.44 + r);
      },
      draw(ctx) {
        ctx.save();
        ctx.lineCap = "butt";
        const beamW = Math.max(38, this.width * 1.45);
        if (!this.isActive()) {
          // Stage 1: Low-opacity solid red/pink telegraph (no white center line)
          const p = Utils.clamp(this.age / this.leadTime, 0, 1);
          ctx.fillStyle = dangerCol();
          ctx.strokeStyle = dangerCol();
          ctx.globalAlpha = 0.16 + p * 0.16;
          ctx.lineWidth = beamW;
          ctx.beginPath(); ctx.moveTo(this.x1, this.y1); ctx.lineTo(this.x2, this.y2); ctx.stroke();
        } else {
          const t = (this.age - this.leadTime) / this.activeTime;
          const flash = isWhiteFlash(this.age, this.leadTime);
          // Stage 2: Solid pure white on impact -> Stage 3: Solid red/pink fading out
          ctx.strokeStyle = flash ? COLORS.white : dangerCol();
          ctx.globalAlpha = flash ? 1 : Utils.clamp(1 - t * 0.75, 0.15, 1);
          ctx.lineWidth = beamW * (1 - t * 0.35);
          ctx.beginPath(); ctx.moveTo(this.x1, this.y1); ctx.lineTo(this.x2, this.y2); ctx.stroke();
        }
        ctx.restore();
      }
    };
  },

  megaBeam(axis = "y", pos = 360, thickness = 165, leadTime = 0.48, activeTime = 0.46) {
    const bubbles = [];
    for (let i = 0; i < 34; i++) {
      const rRoll = Math.random();
      bubbles.push({
        along: Math.random(),
        cross: (Math.random() - 0.5) * 0.86,
        r: 7 + Math.random() * 22,
        kind: rRoll < 0.48 ? "blackHole" : rRoll < 0.78 ? "whiteBubble" : "greyCore",
        speed: (Math.random() > 0.5 ? 1 : -1) * (0.14 + Math.random() * 0.28),
        phase: Math.random() * Math.PI * 2
      });
    }
    return {
      type: "megaBeam", axis, pos, thickness, leadTime, activeTime, bubbles,
      age: 0, dead: false, impacted: false,
      update(dt) {
        this.age += dt;
        if (!this.impacted && this.age >= this.leadTime) {
          this.impacted = true;
          state.shake = Math.max(state.shake, 14);
          state.zoomPunch = Math.max(state.zoomPunch, 0.032);
        }
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      getDanger(px, py, tAhead) {
        const fa = this.age + tAhead;
        if (fa > this.leadTime + this.activeTime) return 0;
        const d = this.axis === "y" ? Math.abs(py - this.pos) : Math.abs(px - this.pos);
        const safe = this.thickness * 0.52 + 34;
        if (d < safe) {
          const urg = this.isActive() ? 1.25 : Utils.clamp(fa / this.leadTime, 0.35, 1.05);
          return (1 - d / safe) * 175 * urg;
        }
        return 0;
      },
      checkCollision(px, py, r) {
        if (!this.isActive()) return false;
        const t = (this.age - this.leadTime) / this.activeTime;
        if (t > 0.9) return false;
        const d = this.axis === "y" ? Math.abs(py - this.pos) : Math.abs(px - this.pos);
        return d < (this.thickness * 0.45 + r);
      },
      draw(ctx) {
        const W = state.width, H = state.height;
        const isH = this.axis === "y";
        const span = isH ? W : H;
        ctx.save();
        if (!this.isActive()) {
          // Stage 1: Wide low-opacity telegraph band + crisp edge guides
          const p = Utils.clamp(this.age / this.leadTime, 0, 1);
          const half = this.thickness * 0.5;
          ctx.fillStyle = dangerCol();
          ctx.globalAlpha = 0.14 + p * 0.2;
          if (isH) ctx.fillRect(0, this.pos - half, W, this.thickness);
          else ctx.fillRect(this.pos - half, 0, this.thickness, H);

          ctx.globalAlpha = 0.35 + p * 0.45;
          ctx.fillStyle = dangerCol();
          if (isH) {
            ctx.fillRect(0, this.pos - half, W, 3);
            ctx.fillRect(0, this.pos + half - 3, W, 3);
          } else {
            ctx.fillRect(this.pos - half, 0, 3, H);
            ctx.fillRect(this.pos + half - 3, 0, 3, H);
          }
        } else {
          const activeAge = this.age - this.leadTime;
          const t = Utils.clamp(activeAge / this.activeTime, 0, 1);
          const isFlash = activeAge < 0.095;
          const taper = t > 0.72 ? Utils.clamp(1 - (t - 0.72) / 0.28, 0.05, 1) : 1;
          const curThick = this.thickness * (isFlash ? 1.08 : taper);
          const half = curThick * 0.5;

          // Clip to beam rect so boiling circles stay razor-sharp inside the beam
          ctx.beginPath();
          if (isH) ctx.rect(0, this.pos - half, W, curThick);
          else ctx.rect(this.pos - half, 0, curThick, H);
          ctx.clip();

          // Beam body
          ctx.fillStyle = isFlash ? "#FFD8EC" : dangerCol();
          ctx.globalAlpha = isFlash ? 1 : Utils.clamp(1 - Math.max(0, t - 0.78) * 3.5, 0.2, 1);
          if (isH) ctx.fillRect(0, this.pos - half, W, curThick);
          else ctx.fillRect(this.pos - half, 0, curThick, H);

          // Stage 2: Bright white core during impact flash
          if (isFlash) {
            const flashP = activeAge / 0.095;
            ctx.fillStyle = COLORS.white;
            ctx.globalAlpha = 0.85 * (1 - flashP * 0.5);
            const coreH = curThick * 0.52;
            if (isH) ctx.fillRect(0, this.pos - coreH * 0.5, W, coreH);
            else ctx.fillRect(this.pos - coreH * 0.5, 0, coreH, H);
          }

          // Boiling holes & bubbles along the beam (Annihilate effect)
          const spread = isFlash ? (0.3 + (activeAge / 0.095) * 0.7) : 1;
          for (let i = 0; i < this.bubbles.length; i++) {
            const b = this.bubbles[i];
            const alongPos = (((b.along + activeAge * b.speed) % 1) + 1) % 1 * span;
            const crossPos = this.pos + b.cross * curThick * spread;
            const bx = isH ? alongPos : crossPos;
            const by = isH ? crossPos : alongPos;
            const pulse = 0.78 + 0.34 * Math.sin(activeAge * 26 + b.phase);
            const br = Math.max(2, b.r * pulse * (isFlash ? 1.15 : taper));

            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            if (isFlash) {
              // Impact flash: bright white/grey/dark-centered erupting bubbles
              ctx.globalAlpha = 0.95;
              ctx.fillStyle = b.kind === "blackHole" ? "#B8C0D0" : COLORS.white;
              ctx.fill();
              if (b.kind === "blackHole" && br > 6) {
                ctx.beginPath();
                ctx.arc(bx, by, br * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = "#181826";
                ctx.fill();
              }
            } else {
              // Active hot-pink beam: crisp black circular holes + white-rimmed grey bubbles
              ctx.globalAlpha = 0.96;
              if (b.kind === "blackHole") {
                ctx.fillStyle = "#080712";
                ctx.fill();
              } else if (b.kind === "whiteBubble") {
                ctx.fillStyle = COLORS.white;
                ctx.fill();
                if (br > 5) {
                  ctx.beginPath();
                  ctx.arc(bx, by, br * 0.62, 0, Math.PI * 2);
                  ctx.fillStyle = "#9BA3B4";
                  ctx.fill();
                }
              } else {
                ctx.fillStyle = "#D4DAE6";
                ctx.fill();
              }
            }
          }
        }
        ctx.restore();
      }
    };
  },

  rotatingBeam(cx, cy, startAngle, angVel, length, width = 24, leadTime = 0.5, activeTime = 1.6) {
    return {
      type: "rotatingBeam", cx, cy, angle: startAngle, angVel, length, width, leadTime, activeTime,
      age: 0, dead: false,
      update(dt) {
        this.age += dt;
        if (this.age >= this.leadTime) this.angle += this.angVel * dt;
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      _endPt(a) { return { x: this.cx + Math.cos(a) * this.length, y: this.cy + Math.sin(a) * this.length }; },
      getDanger(px, py, tAhead) {
        const fa = this.age + tAhead;
        const futAng = fa > this.leadTime ? this.angle + this.angVel * Math.max(0, tAhead) : this.angle;
        const end = this._endPt(futAng);
        const d = Utils.pointToSegmentDist(px, py, this.cx, this.cy, end.x, end.y);
        const safe = this.width * 0.65 + 32;
        if (d < safe) return (1 - d / safe) * 145 * (this.isActive() ? 1.1 : 0.7);
        return 0;
      },
      checkCollision(px, py, r) {
        if (!this.isActive()) return false;
        const end = this._endPt(this.angle);
        return Utils.pointToSegmentDist(px, py, this.cx, this.cy, end.x, end.y) < (this.width * 0.45 + r);
      },
      draw(ctx) {
        const end = this._endPt(this.angle);
        ctx.save();
        if (!this.isActive()) {
          const p = this.age / this.leadTime;
          ctx.strokeStyle = `rgba(255, 30, 110, ${0.15 + p * 0.25})`;
          ctx.lineWidth = this.width;
          ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(end.x, end.y); ctx.stroke();
        } else {
          ctx.strokeStyle = isWhiteFlash(this.age, this.leadTime) ? COLORS.white : dangerCol();
          ctx.lineWidth = this.width;
          ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(end.x, end.y); ctx.stroke();
        }
        ctx.restore();
      }
    };
  },

  floorZone(x, y, w, h, leadTime = 0.55, activeTime = 0.25) {
    return {
      type: "floorZone", x, y, w, h, leadTime, activeTime,
      age: 0, dead: false,
      update(dt) {
        this.age += dt;
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      getDanger(px, py, tAhead) {
        if (px >= this.x - 16 && px <= this.x + this.w + 16 && py >= this.y - 16 && py <= this.y + this.h + 16) {
          const urg = this.isActive() ? 1.2 : Utils.clamp((this.age + tAhead) / this.leadTime, 0.3, 1.0);
          return 135 * urg;
        }
        return 0;
      },
      checkCollision(px, py, r) {
        return this.isActive() && px + r > this.x && px - r < this.x + this.w && py + r > this.y && py - r < this.y + this.h;
      },
      draw(ctx) {
        ctx.save();
        if (!this.isActive()) {
          const p = this.age / this.leadTime;
          ctx.fillStyle = `rgba(255, 30, 110, ${0.08 + p * 0.18})`;
          ctx.strokeStyle = `rgba(255, 30, 110, ${0.4 + p * 0.5})`;
          ctx.lineWidth = 2;
          ctx.fillRect(this.x + 3, this.y + 3, this.w - 6, this.h - 6);
          ctx.strokeRect(this.x + 3, this.y + 3, this.w - 6, this.h - 6);
        } else {
          const a = 1 - (this.age - this.leadTime) / this.activeTime;
          ctx.fillStyle = isWhiteFlash(this.age, this.leadTime) ? COLORS.white : dangerCol();
          ctx.globalAlpha = a;
          ctx.fillRect(this.x + 3, this.y + 3, this.w - 6, this.h - 6);
        }
        ctx.restore();
      }
    };
  },

  hydraulicPiston(side, depth, leadTime = 0.6, activeTime = 0.35) {
    return {
      type: "hydraulicPiston", side, depth, leadTime, activeTime,
      age: 0, dead: false, impacted: false,
      update(dt) {
        this.age += dt;
        if (!this.impacted && this.age >= this.leadTime) {
          this.impacted = true;
          state.shake = Math.max(state.shake, 12);
        }
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      _rect(W, H) {
        // Explosive snap-out easing
        const p = this.isActive()
          ? 1 - Math.pow((this.age - this.leadTime) / this.activeTime, 3) * 0.25
          : Math.pow(this.age / this.leadTime, 4) * 0.12;
        const d = this.depth * p;
        if (this.side === "left") return { x: 0, y: 0, w: d, h: H };
        if (this.side === "right") return { x: W - d, y: 0, w: d, h: H };
        if (this.side === "top") return { x: 0, y: 0, w: W, h: d };
        return { x: 0, y: H - d, w: W, h: d };
      },
      getDanger(px, py) {
        const W = state.width, H = state.height;
        const pad = this.depth + 35;
        if (this.side === "left" && px < pad) return (1 - px / pad) * 145;
        if (this.side === "right" && px > W - pad) return (1 - (W - px) / pad) * 145;
        if (this.side === "top" && py < pad) return (1 - py / pad) * 145;
        if (this.side === "bottom" && py > H - pad) return (1 - (H - py) / pad) * 145;
        return 0;
      },
      checkCollision(px, py, r) {
        if (!this.isActive()) return false;
        const rc = this._rect(state.width, state.height);
        return px + r > rc.x && px - r < rc.x + rc.w && py + r > rc.y && py - r < rc.y + rc.h;
      },
      draw(ctx, W, H) {
        const rc = this._rect(W, H);
        ctx.save();
        if (!this.isActive()) {
          ctx.fillStyle = "rgba(255, 30, 110, 0.14)";
          if (this.side === "left") ctx.fillRect(0, 0, this.depth, H);
          else if (this.side === "right") ctx.fillRect(W - this.depth, 0, this.depth, H);
          else if (this.side === "top") ctx.fillRect(0, 0, W, this.depth);
          else ctx.fillRect(0, H - this.depth, W, this.depth);
        }
        ctx.fillStyle = isWhiteFlash(this.age, this.leadTime) ? COLORS.white : dangerCol();
        ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
        ctx.restore();
      }
    };
  },

  handSlam(targetX, targetY, radius = 95, leadTime = 0.55) {
    return {
      type: "handSlam", x: targetX, y: targetY, radius, leadTime,
      age: 0, dead: false, impacted: false,
      update(dt) {
        this.age += dt;
        if (!this.impacted && this.age >= this.leadTime) {
          this.impacted = true;
          state.shake = Math.max(state.shake, 14);
          spawnParticles(this.x, this.y, dangerCol(), 20, 120, 380);
          state.entities.push(AttackFactory.shockwave(this.x, this.y, 460, 480, 18));
        }
        if (this.age >= this.leadTime + 0.25) this.dead = true;
      },
      getDanger(px, py) {
        const d = Math.hypot(px - this.x, py - this.y);
        if (d < this.radius + 40) return (1 - d / (this.radius + 40)) * 155 * (this.age / this.leadTime);
        return 0;
      },
      checkCollision(px, py, r) {
        return this.impacted && Math.hypot(px - this.x, py - this.y) < (this.radius * 0.85 + r);
      },
      draw(ctx) {
        const p = Utils.clamp(this.age / this.leadTime, 0, 1);
        ctx.save();
        ctx.translate(this.x, this.y);
        if (!this.impacted) {
          ctx.fillStyle = `rgba(255, 30, 110, ${0.12 + p * 0.2})`;
          ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = dangerCol();
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, this.radius * (1.4 - p * 0.4), 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = isWhiteFlash(this.age, this.leadTime) ? COLORS.white : dangerCol();
          Utils.drawPolygon(ctx, 0, 0, 5, this.radius * 0.88, 0.4);
          ctx.fill();
        }
        ctx.restore();
      }
    };
  },

  lycanthropySpike(pos, maxH, width = 78, leadTime = 0.5, activeTime = 0.45, side = "bottom") {
    return {
      type: "lycanthropySpike", pos, maxH, width, leadTime, activeTime, side,
      age: 0, dead: false,
      update(dt) {
        this.age += dt;
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      _curH() {
        if (!this.isActive()) return this.maxH * 0.06;
        const t = (this.age - this.leadTime) / this.activeTime;
        return this.maxH * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
      },
      _rect(W, H, h) {
        if (this.side === "top") return { x: this.pos - this.width / 2, y: 0, w: this.width, h, r: [0, 0, this.width / 2, this.width / 2] };
        if (this.side === "left") return { x: 0, y: this.pos - this.width / 2, w: h, h: this.width, r: [0, this.width / 2, this.width / 2, 0] };
        if (this.side === "right") return { x: W - h, y: this.pos - this.width / 2, w: h, h: this.width, r: [this.width / 2, 0, 0, this.width / 2] };
        return { x: this.pos - this.width / 2, y: H - h, w: this.width, h, r: [this.width / 2, this.width / 2, 0, 0] };
      },
      getDanger(px, py) {
        const rc = this._rect(state.width, state.height, this.maxH + 25);
        if (px >= rc.x - 16 && px <= rc.x + rc.w + 16 && py >= rc.y - 16 && py <= rc.y + rc.h + 16) {
          return 145 * (this.isActive() ? 1.15 : 0.75);
        }
        return 0;
      },
      checkCollision(px, py, r) {
        if (!this.isActive()) return false;
        const rc = this._rect(state.width, state.height, this._curH());
        return px + r > rc.x && px - r < rc.x + rc.w && py + r > rc.y && py - r < rc.y + rc.h;
      },
      draw(ctx, W, H) {
        ctx.save();
        if (!this.isActive()) {
          const warn = this._rect(W, H, this.maxH);
          ctx.fillStyle = "rgba(255, 30, 110, 0.16)";
          ctx.beginPath();
          ctx.roundRect(warn.x, warn.y, warn.w, warn.h, warn.r);
          ctx.fill();
        }
        const rc = this._rect(W, H, this._curH());
        ctx.fillStyle = isWhiteFlash(this.age, this.leadTime) ? COLORS.white : dangerCol();
        ctx.beginPath();
        ctx.roundRect(rc.x, rc.y, rc.w, rc.h, rc.r);
        ctx.fill();
        ctx.restore();
      }
    };
  },

  // JSAB Stepped White->PalePink->HotPink Serpent/Meteor (like reference Twitter.jfif)
  barracudaSerpent(y, dir, speed = 520, amp = 75, freq = 6) {
    return {
      type: "barracudaSerpent", x: dir === 1 ? -60 : state.width + 60, baseY: y, y, dir, speed, amp, freq,
      age: 0, r: 22, dead: false, history: [],
      update(dt, W) {
        this.age += dt;
        this.x += this.dir * this.speed * dt;
        this.y = this.baseY + Math.sin(this.age * this.freq) * this.amp;
        this.history.unshift({ x: this.x, y: this.y });
        if (this.history.length > 12) this.history.pop();
        if ((this.dir === 1 && this.x > W + 160) || (this.dir === -1 && this.x < -160)) this.dead = true;
      },
      getDanger(px, py, tAhead) {
        const fx = this.x + this.dir * this.speed * tAhead;
        const fy = this.baseY + Math.sin((this.age + tAhead) * this.freq) * this.amp;
        const d = Math.hypot(px - fx, py - fy);
        if (d < this.r + 50) return (1 - d / (this.r + 50)) * 140;
        return 0;
      },
      checkCollision(px, py, pr) {
        for (let i = 0; i < this.history.length; i += 2) {
          if (Math.hypot(px - this.history[i].x, py - this.history[i].y) < this.r * 0.8 + pr) return true;
        }
        return false;
      },
      draw(ctx) {
        // Stepped crisp circles: tail pale pink -> white -> spiky hot-pink head
        for (let i = this.history.length - 1; i >= 1; i--) {
          const pt = this.history[i];
          const rad = this.r * (1 - i * 0.055);
          ctx.fillStyle = i <= 2 ? COLORS.white : (i <= 6 ? palePink : dangerCol());
          ctx.beginPath(); ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2); ctx.fill();
        }
        // Spiky JSAB head (white on spawn for 80ms, then danger color)
        ctx.fillStyle = isWhiteFlash(this.age, 0) ? COLORS.white : dangerCol();
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const rad = i % 2 === 0 ? this.r * 1.2 : this.r * 0.92;
          const a = (Math.PI * i) / 8 + this.age * 4;
          const px = this.x + Math.cos(a) * rad;
          const py = this.y + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }
    };
  },

  pulseBomb(x, y, maxR = 85, leadTime = 0.55, bulletCount = 12, spiral = 0) {
    return {
      type: "pulseBomb", x, y, maxR, leadTime, bulletCount, spiral,
      age: 0, dead: false,
      update(dt) {
        this.age += dt;
        if (this.age >= this.leadTime) {
          this.dead = true;
          spawnParticles(this.x, this.y, COLORS.white, 10, 90, 260);
          for (let i = 0; i < this.bulletCount; i++) {
            const ang = (Math.PI * 2 * i) / this.bulletCount + this.spiral;
            const spd = 280;
            state.entities.push(AttackFactory.bullet(this.x, this.y, Math.cos(ang) * spd, Math.sin(ang) * spd, 7, "circle"));
          }
        }
      },
      getDanger(px, py) {
        const d = Math.hypot(px - this.x, py - this.y);
        if (d < this.maxR + 35) return (1 - d / (this.maxR + 35)) * 105 * (this.age / this.leadTime);
        return 0;
      },
      checkCollision() { return false; },
      draw(ctx) {
        const p = Utils.clamp(this.age / this.leadTime, 0, 1);
        ctx.save();
        // Expanding crisp dotted ring telegraph (like Twitter.jfif)
        ctx.fillStyle = p > 0.85 ? COLORS.white : dangerCol();
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * 2 * i) / 10 + p;
          ctx.beginPath();
          ctx.arc(this.x + Math.cos(a) * this.maxR * p, this.y + Math.sin(a) * this.maxR * p, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Spiky bomb core
        ctx.beginPath();
        const r = 12 + p * 14;
        for (let i = 0; i < 16; i++) {
          const rad = i % 2 === 0 ? r * 1.22 : r * 0.9;
          const a = (Math.PI * i) / 8 + p * 2;
          if (i === 0) ctx.moveTo(this.x + Math.cos(a) * rad, this.y + Math.sin(a) * rad);
          else ctx.lineTo(this.x + Math.cos(a) * rad, this.y + Math.sin(a) * rad);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    };
  },

  shockwave(x, y, speed = 460, maxR = 950, thickness = 20) {
    return {
      type: "shockwave", x, y, speed, maxR, thickness, r: 22, age: 0, dead: false,
      update(dt) {
        this.age += dt;
        this.r += this.speed * dt;
        if (this.r >= this.maxR) this.dead = true;
      },
      getDanger(px, py, tAhead) {
        const fr = this.r + this.speed * tAhead;
        const band = Math.abs(Math.hypot(px - this.x, py - this.y) - fr);
        if (band < this.thickness + 30) return (1 - band / (this.thickness + 30)) * 125;
        return 0;
      },
      checkCollision(px, py, pr) {
        return Math.abs(Math.hypot(px - this.x, py - this.y) - this.r) < (this.thickness * 0.45 + pr);
      },
      draw(ctx) {
        if (this.r > 900) return;
        const alpha = Utils.clamp(1 - this.r / this.maxR, 0.15, 1);
        ctx.save();
        ctx.strokeStyle = this.age < 0.08 ? COLORS.white : dangerCol();
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Utils.clamp(this.thickness * alpha, 2, 18);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };
  },

  sweepBar(axis, pos, dir, speed, thickness = 34, gapCenter = null, gapSize = 165) {
    return {
      type: "sweepBar", axis, pos, dir, speed, thickness, gapCenter, gapSize, age: 0, dead: false,
      update(dt, W, H) {
        this.age += dt;
        this.pos += this.dir * this.speed * dt;
        const limit = this.axis === "x" ? W : H;
        if (this.pos < -100 || this.pos > limit + 100) this.dead = true;
      },
      _inGap(px, py) {
        if (this.gapCenter === null) return false;
        return Math.abs((this.axis === "x" ? py : px) - this.gapCenter) < this.gapSize * 0.5;
      },
      getDanger(px, py, tAhead) {
        if (this._inGap(px, py)) return 0;
        const d = Math.abs((this.axis === "x" ? px : py) - (this.pos + this.dir * this.speed * tAhead));
        if (d < this.thickness + 48) return (1 - d / (this.thickness + 48)) * 140;
        return 0;
      },
      checkCollision(px, py, r) {
        if (this._inGap(px, py)) return false;
        return Math.abs((this.axis === "x" ? px : py) - this.pos) < (this.thickness * 0.5 + r);
      },
      draw(ctx, W, H) {
        ctx.fillStyle = isWhiteFlash(this.age, 0) ? COLORS.white : dangerCol();
        if (this.axis === "x") {
          if (this.gapCenter !== null) {
            const gTop = this.gapCenter - this.gapSize * 0.5;
            const gBot = this.gapCenter + this.gapSize * 0.5;
            ctx.fillRect(this.pos - this.thickness / 2, 0, this.thickness, Math.max(0, gTop));
            ctx.fillRect(this.pos - this.thickness / 2, gBot, this.thickness, Math.max(0, H - gBot));
          } else ctx.fillRect(this.pos - this.thickness / 2, 0, this.thickness, H);
        } else {
          if (this.gapCenter !== null) {
            const gL = this.gapCenter - this.gapSize * 0.5;
            const gR = this.gapCenter + this.gapSize * 0.5;
            ctx.fillRect(0, this.pos - this.thickness / 2, Math.max(0, gL), this.thickness);
            ctx.fillRect(gR, this.pos - this.thickness / 2, Math.max(0, W - gR), this.thickness);
          } else ctx.fillRect(0, this.pos - this.thickness / 2, W, this.thickness);
        }
      }
    };
  },

  // Crisp JSAB Sawblade with hexagonal hole (from Enemy Shapes reference)
  sawblade(x, y, vx, vy, r = 26, life = 4.5) {
    return {
      type: "sawblade", x, y, vx, vy, r, life, age: 0, rot: 0, dead: false,
      update(dt, W, H) {
        this.age += dt; this.rot += dt * 11;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.x < this.r || this.x > W - this.r) this.vx *= -1;
        if (this.y < this.r || this.y > H - this.r) this.vy *= -1;
        if (this.age >= this.life) this.dead = true;
      },
      getDanger(px, py, tAhead) {
        const d = Math.hypot(px - (this.x + this.vx * tAhead), py - (this.y + this.vy * tAhead));
        if (d < this.r + 50) return (1 - d / (this.r + 50)) * 135;
        return 0;
      },
      checkCollision(px, py, pr) { return Math.hypot(px - this.x, py - this.y) < (this.r * 0.85 + pr); },
      draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        ctx.fillStyle = this.age < 0.06 ? COLORS.white : dangerCol();
        ctx.beginPath();
        const teeth = 10;
        for (let i = 0; i < teeth * 2; i++) {
          const rad = i % 2 === 0 ? this.r * 1.15 : this.r * 0.72;
          const a = (Math.PI * i) / teeth + (i % 2 === 0 ? 0.14 : 0);
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#040D14";
        Utils.drawPolygon(ctx, 0, 0, 6, this.r * 0.34, 0);
        ctx.fill();
        ctx.restore();
      }
    };
  },

  bullet(x, y, vx, vy, r = 8, shape = "circle", gravity = 0) {
    return {
      type: "bullet", x, y, vx, vy, r, shape, gravity, age: 0, dead: false, rot: Math.atan2(vy, vx),
      update(dt, W, H) {
        this.age += dt;
        this.vy += this.gravity * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.rot = Math.atan2(this.vy, this.vx);
        if (this.x < -50 || this.x > W + 50 || this.y < -50 || this.y > H + 50) this.dead = true;
      },
      getDanger(px, py, tAhead) {
        const fx = this.x + this.vx * tAhead;
        const fy = this.y + this.vy * tAhead + 0.5 * this.gravity * tAhead * tAhead;
        const d = Math.hypot(px - fx, py - fy);
        if (d < this.r + 36) return (1 - d / (this.r + 36)) * 120;
        return 0;
      },
      checkCollision(px, py, pr) { return Math.hypot(px - this.x, py - this.y) < (this.r * 0.85 + pr); },
      draw(ctx) {
        const pr = this.r * (1 + (state.beatPulse || 0) * 0.28);
        ctx.fillStyle = this.age < 0.08 ? COLORS.white : dangerCol();
        if (this.shape === "diamond") Utils.drawPolygon(ctx, this.x, this.y, 4, pr * 1.25, this.rot);
        else if (this.shape === "triangle") Utils.drawPolygon(ctx, this.x, this.y, 3, pr * 1.35, this.rot);
        else { ctx.beginPath(); ctx.arc(this.x, this.y, pr, 0, Math.PI * 2); }
        ctx.fill();
      }
    };
  },

  articulatedArms(duration = 4.2, speedMul = 1.0) {
    const bgCol = () => (state.customColors?.enabled ? state.customColors.bg : state.analysis?.dna?.palette?.bg) || "#040D14";

    const drawSpikedGear = (ctx, x, y, r, rot, col, isPalm) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = col;
      // 8 outer triangular spikes
      const spikes = 8;
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(r * 1.24, 0);
        ctx.lineTo(r * 0.72, -r * 0.24);
        ctx.lineTo(r * 0.72, r * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Core circle
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.fill();
      // Hollow center + inner circle dot for the palm
      if (isPalm) {
        ctx.fillStyle = bgCol();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.21, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    return {
      type: "articulatedArms", duration, speedMul, age: 0, dead: false,
      update(dt) {
        this.age += dt;
        if (this.age >= this.duration) this.dead = true;
      },
      _computeSegments(t) {
        const b = state.blixer;
        const bx = b.x, by = b.y;
        const baseR = (b.r || 60) * (state.settings?.bossScale ?? 1);
        const extend = Math.min(Utils.clamp(t / 0.45, 0, 1), Utils.clamp((this.duration - t) / 0.45, 0, 1));
        if (extend <= 0.02) return [];
        const segs = [];
        const w = t * 2.3 * this.speedMul;

        [-1, 1].forEach((side) => {
          const baseAngle = side > 0 ? 0 : Math.PI;
          const shoulderAng = baseAngle + side * (Math.sin(w) * 0.58 + Math.cos(w * 0.5) * 0.22);
          const bend1 = side * (Math.sin(w * 1.35 - 0.7) * 0.52);
          const bend2 = side * (Math.sin(w * 1.35 - 1.4) * 0.48);
          const bend3 = side * (Math.sin(w * 1.35 - 2.1) * 0.42);

          // Small shoulder connector ball
          const sx = bx + Math.cos(shoulderAng) * (baseR * 1.22 * extend);
          const sy = by + Math.sin(shoulderAng) * (baseR * 1.22 * extend);
          segs.push({ x: sx, y: sy, r: 9 * extend, kind: "ball", rot: 0 });

          // 3 progressively larger 8-spike gears + 1 large hollow-center palm
          const specs = [
            { dist: 48, r: 22, ang: shoulderAng + bend1 * 0.4, kind: "gear", spin: 1.8 },
            { dist: 64, r: 28, ang: shoulderAng + bend1, kind: "gear", spin: -2.2 },
            { dist: 76, r: 34, ang: shoulderAng + bend1 + bend2, kind: "gear", spin: 2.5 },
            { dist: 92, r: 46, ang: shoulderAng + bend1 + bend2 + bend3, kind: "palm", spin: -2.0 }
          ];

          let cx = sx, cy = sy;
          let palmAng = shoulderAng;
          specs.forEach((sp) => {
            cx += Math.cos(sp.ang) * sp.dist * extend;
            cy += Math.sin(sp.ang) * sp.dist * extend;
            palmAng = sp.ang;
            segs.push({ x: cx, y: cy, r: sp.r * extend, kind: sp.kind, rot: t * sp.spin * side });
          });

          // 3 simple ball fingers fanned around the outer edge of the palm
          const fingerDist = 58 * extend;
          [-0.58, 0, 0.58].forEach((off) => {
            const fa = palmAng + off;
            segs.push({
              x: cx + Math.cos(fa) * fingerDist,
              y: cy + Math.sin(fa) * fingerDist,
              r: 13 * extend,
              kind: "ball",
              rot: 0
            });
          });
        });
        return segs;
      },
      getDanger(px, py, tAhead) {
        const fa = this.age + tAhead;
        if (fa >= this.duration) return 0;
        const segs = this._computeSegments(fa);
        let maxD = 0;
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          const safe = s.r * 1.15 + 34;
          const d = Math.hypot(px - s.x, py - s.y);
          if (d < safe) {
            const val = (1 - d / safe) * 165;
            if (val > maxD) maxD = val;
          }
        }
        return maxD;
      },
      checkCollision(px, py, r) {
        if (this.age < 0.25 || this.age > this.duration - 0.25) return false;
        const segs = this._computeSegments(this.age);
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          if (Math.hypot(px - s.x, py - s.y) < (s.r * 0.88 + r)) return true;
        }
        return false;
      },
      draw(ctx) {
        const segs = this._computeSegments(this.age);
        const col = this.age < 0.08 ? COLORS.white : dangerCol();
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          if (s.kind === "ball") {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            drawSpikedGear(ctx, s.x, s.y, s.r, s.rot, col, s.kind === "palm");
          }
        }
      }
    };
  }
};
