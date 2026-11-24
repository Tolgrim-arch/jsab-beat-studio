import { COLORS } from "../config.js";
import { Utils } from "../utils.js";
import { state, spawnParticles } from "../state.js";

const dangerCol = () => state.analysis?.dna?.palette?.danger || COLORS.pink;

export const AttackFactory = {
  laser(x1, y1, x2, y2, width = 26, leadTime = 0.45, activeTime = 0.28) {
    return {
      type: "laser", x1, y1, x2, y2, width, leadTime, activeTime,
      age: 0, dead: false, impacted: false,
      update(dt) {
        this.age += dt;
        if (!this.impacted && this.age >= this.leadTime) {
          this.impacted = true;
          state.shake = Math.max(state.shake, 6);
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
        if (!this.isActive()) {
          Utils.drawTelegraphLine(ctx, this.x1, this.y1, this.x2, this.y2, this.age / this.leadTime);
        } else {
          const t = (this.age - this.leadTime) / this.activeTime;
          const w = this.width * (1 - t * 0.45);
          Utils.withGlow(ctx, dangerCol(), 22, () => {
            ctx.strokeStyle = dangerCol();
            ctx.lineWidth = w;
            ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(this.x1, this.y1); ctx.lineTo(this.x2, this.y2); ctx.stroke();
            ctx.strokeStyle = COLORS.white;
            ctx.lineWidth = w * 0.35;
            ctx.stroke();
          });
        }
      }
    };
  },

  rotatingBeam(cx, cy, startAngle, angVel, length, width = 22, leadTime = 0.5, activeTime = 1.6) {
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
        if (!this.isActive()) {
          Utils.drawTelegraphLine(ctx, this.cx, this.cy, end.x, end.y, this.age / this.leadTime);
        } else {
          Utils.withGlow(ctx, dangerCol(), 20, () => {
            ctx.strokeStyle = dangerCol();
            ctx.lineWidth = this.width;
            ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(end.x, end.y); ctx.stroke();
            ctx.strokeStyle = COLORS.white;
            ctx.lineWidth = this.width * 0.3;
            ctx.stroke();
          });
        }
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
        if (!this.isActive()) {
          const p = this.age / this.leadTime;
          ctx.save();
          ctx.strokeStyle = `rgba(255, 31, 113, ${0.35 + p * 0.65})`;
          ctx.fillStyle = `rgba(255, 31, 113, ${0.06 + p * 0.16})`;
          ctx.lineWidth = 2;
          ctx.fillRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
          ctx.strokeRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
          ctx.restore();
        } else {
          const a = 1 - (this.age - this.leadTime) / this.activeTime;
          Utils.withGlow(ctx, dangerCol(), 18, () => {
            ctx.fillStyle = `rgba(255, 31, 113, ${a * 0.9})`;
            ctx.fillRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
          });
        }
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
          state.shake = Math.max(state.shake, 11);
        }
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      _rect(W, H) {
        const p = this.isActive()
          ? 1 - Math.pow((this.age - this.leadTime) / this.activeTime, 2) * 0.2
          : Math.pow(this.age / this.leadTime, 3) * 0.15;
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
        if (!this.isActive()) {
          ctx.save();
          ctx.strokeStyle = "rgba(255, 31, 113, 0.55)";
          ctx.setLineDash([10, 8]);
          ctx.lineWidth = 2;
          if (this.side === "left") ctx.strokeRect(0, 0, this.depth, H);
          else if (this.side === "right") ctx.strokeRect(W - this.depth, 0, this.depth, H);
          else if (this.side === "top") ctx.strokeRect(0, 0, W, this.depth);
          else ctx.strokeRect(0, H - this.depth, W, this.depth);
          ctx.restore();
        }
        Utils.withGlow(ctx, dangerCol(), 20, () => {
          ctx.fillStyle = dangerCol();
          ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
        });
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
          state.shake = Math.max(state.shake, 13);
          spawnParticles(this.x, this.y, dangerCol(), 22, 120, 380);
          state.entities.push(AttackFactory.shockwave(this.x, this.y, 440, 460, 18));
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
          ctx.strokeStyle = `rgba(255, 31, 113, ${0.35 + p * 0.65})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.stroke();
          const scale = 1.8 - p * 0.8;
          ctx.scale(scale, scale);
          ctx.fillStyle = `rgba(255, 31, 113, ${0.25 + p * 0.5})`;
          Utils.drawPolygon(ctx, 0, 0, 5, this.radius * 0.65, p * 0.4);
          ctx.fill();
        } else {
          Utils.withGlow(ctx, dangerCol(), 24, () => {
            ctx.fillStyle = dangerCol();
            Utils.drawPolygon(ctx, 0, 0, 5, this.radius * 0.85, 0.4);
            ctx.fill();
          });
        }
        ctx.restore();
      }
    };
  },

  lycanthropySpike(x, baseY, maxH, width = 34, leadTime = 0.5, activeTime = 0.45) {
    return {
      type: "lycanthropySpike", x, baseY, maxH, width, leadTime, activeTime,
      age: 0, dead: false,
      update(dt) {
        this.age += dt;
        if (this.age >= this.leadTime + this.activeTime) this.dead = true;
      },
      isActive() { return this.age >= this.leadTime; },
      _curH() {
        if (!this.isActive()) return this.maxH * 0.08;
        const t = (this.age - this.leadTime) / this.activeTime;
        return this.maxH * (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75);
      },
      getDanger(px, py) {
        if (Math.abs(px - this.x) < this.width * 0.85 && py > this.baseY - this.maxH - 25) {
          return 140 * (this.isActive() ? 1.1 : 0.75);
        }
        return 0;
      },
      checkCollision(px, py, r) {
        if (!this.isActive()) return false;
        const h = this._curH();
        return Math.abs(px - this.x) < (this.width * 0.42 + r) && py > this.baseY - h;
      },
      draw(ctx) {
        const h = this._curH();
        if (!this.isActive()) {
          Utils.drawTelegraphLine(ctx, this.x, this.baseY, this.x, this.baseY - this.maxH, this.age / this.leadTime);
        }
        Utils.withGlow(ctx, dangerCol(), 16, () => {
          ctx.fillStyle = dangerCol();
          ctx.beginPath();
          ctx.moveTo(this.x - this.width / 2, this.baseY);
          ctx.lineTo(this.x, this.baseY - h);
          ctx.lineTo(this.x + this.width / 2, this.baseY);
          ctx.closePath();
          ctx.fill();
        });
      }
    };
  },

  barracudaSerpent(y, dir, speed = 520, amp = 75, freq = 6) {
    return {
      type: "barracudaSerpent", x: dir === 1 ? -60 : state.width + 60, baseY: y, y, dir, speed, amp, freq,
      age: 0, r: 20, dead: false, history: [],
      update(dt, W) {
        this.age += dt;
        this.x += this.dir * this.speed * dt;
        this.y = this.baseY + Math.sin(this.age * this.freq) * this.amp;
        this.history.unshift({ x: this.x, y: this.y });
        if (this.history.length > 9) this.history.pop();
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
        Utils.withGlow(ctx, dangerCol(), 14, () => {
          for (let i = this.history.length - 1; i >= 0; i--) {
            const pt = this.history[i];
            const rad = this.r * (1 - i * 0.08);
            ctx.fillStyle = i === 0 ? COLORS.white : dangerCol();
            Utils.drawPolygon(ctx, pt.x, pt.y, 3, rad, this.dir === 1 ? 0 : Math.PI);
            ctx.fill();
          }
        });
      }
    };
  },

  pulseBomb(x, y, maxR = 85, leadTime = 0.55, bulletCount = 10, spiral = 0) {
    return {
      type: "pulseBomb", x, y, maxR, leadTime, bulletCount, spiral,
      age: 0, dead: false,
      update(dt) {
        this.age += dt;
        if (this.age >= this.leadTime) {
          this.dead = true;
          spawnParticles(this.x, this.y, dangerCol(), 14, 90, 290);
          for (let i = 0; i < this.bulletCount; i++) {
            const ang = (Math.PI * 2 * i) / this.bulletCount + this.spiral;
            const spd = 260 + (i % 2) * 55;
            state.entities.push(AttackFactory.bullet(this.x, this.y, Math.cos(ang) * spd, Math.sin(ang) * spd, 8, i % 2 === 0 ? "diamond" : "circle"));
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
        ctx.strokeStyle = `rgba(255, 31, 113, ${0.4 + p * 0.6})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.maxR * p, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = dangerCol();
        ctx.beginPath(); ctx.arc(this.x, this.y, 10 + p * 14, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    };
  },

  shockwave(x, y, speed = 440, maxR = 950, thickness = 22) {
    return {
      type: "shockwave", x, y, speed, maxR, thickness, r: 22, dead: false,
      update(dt) {
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
        const alpha = Utils.clamp(1 - this.r / this.maxR, 0.1, 1);
        Utils.withGlow(ctx, dangerCol(), 18, () => {
          ctx.strokeStyle = `rgba(255, 31, 113, ${alpha})`;
          ctx.lineWidth = this.thickness * alpha;
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.stroke();
        });
      }
    };
  },

  sweepBar(axis, pos, dir, speed, thickness = 34, gapCenter = null, gapSize = 165) {
    return {
      type: "sweepBar", axis, pos, dir, speed, thickness, gapCenter, gapSize, dead: false,
      update(dt, W, H) {
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
        Utils.withGlow(ctx, COLORS.pink, 16, () => {
          ctx.fillStyle = COLORS.pink;
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
        });
      }
    };
  },

  sawblade(x, y, vx, vy, r = 24, life = 4.5) {
    return {
      type: "sawblade", x, y, vx, vy, r, life, age: 0, rot: 0, dead: false,
      update(dt, W, H) {
        this.age += dt; this.rot += dt * 10;
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
        Utils.withGlow(ctx, COLORS.pink, 14, () => {
          ctx.fillStyle = COLORS.pink;
          ctx.beginPath();
          const teeth = 10;
          for (let i = 0; i < teeth * 2; i++) {
            const rad = i % 2 === 0 ? this.r : this.r * 0.6;
            const a = (Math.PI * i) / teeth;
            if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = COLORS.bg;
          ctx.beginPath(); ctx.arc(0, 0, this.r * 0.28, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
      }
    };
  },

  bullet(x, y, vx, vy, r = 8, shape = "circle", gravity = 0) {
    return {
      type: "bullet", x, y, vx, vy, r, shape, gravity, dead: false, rot: Math.atan2(vy, vx),
      update(dt, W, H) {
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
        Utils.withGlow(ctx, COLORS.pink, 10, () => {
          ctx.fillStyle = COLORS.pink;
          if (this.shape === "diamond") Utils.drawPolygon(ctx, this.x, this.y, 4, this.r * 1.25, this.rot);
          else if (this.shape === "triangle") Utils.drawPolygon(ctx, this.x, this.y, 3, this.r * 1.3, this.rot);
          else { ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); }
          ctx.fill();
          ctx.fillStyle = COLORS.white;
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.38, 0, Math.PI * 2); ctx.fill();
        });
      }
    };
  }
};
