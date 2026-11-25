import { state } from "../state.js";

function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return rgbToHex(r * 255, g * 255, b * 255);
}

/**
 * Extracts vibrant dominant colors from an image/ImageBitmap and applies them to state.customColors.
 */
export function extractPaletteFromImage(img) {
  if (!img || typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = 48;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, 48, 48);
    const data = g.getImageData(0, 0, 48, 48).data;

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 140) continue;
      const r = data[i], gr = data[i + 1], b = data[i + 2];
      const [h, s, l] = rgbToHsl(r, gr, b);
      if (l < 0.12 || l > 0.92 || s < 0.18) continue;
      const key = `${Math.floor(h * 18)}_${Math.floor(s * 4)}`;
      const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0, score: 0 };
      entry.count++;
      entry.r += r;
      entry.g += gr;
      entry.b += b;
      entry.score += (0.5 + s * 1.4) * (1 - Math.abs(l - 0.52));
      buckets.set(key, entry);
    }

    const sorted = [...buckets.values()].sort((a, b) => b.score - a.score);
    if (!sorted.length) return null;

    const top = sorted[0];
    const [h1, s1] = rgbToHsl(top.r / top.count, top.g / top.count, top.b / top.count);
    const danger = hslToHex(h1, Math.max(0.75, s1), 0.55);
    const bg = hslToHex(h1, Math.min(0.55, Math.max(0.28, s1 * 0.5)), 0.06);

    // Complementary or secondary vibrant hue for Cyan & EQ
    const h2 = (h1 + 0.52) % 1;
    const cyan = hslToHex(h2, 0.92, 0.56);
    const trail = hslToHex((h2 + 0.06) % 1, 0.88, 0.48);

    const palette = { bg, danger, cyan, trail, eq: danger };
    state.customColors.enabled = true;
    Object.assign(state.customColors, palette);
    return palette;
  } catch {
    return null;
  }
}

/**
 * Decodes an animated GIF/WebP Blob or ArrayBuffer into ImageBitmap frames using native ImageDecoder.
 */
export async function decodeAnimatedGifBlob(blob) {
  if (typeof ImageDecoder === "undefined") return null;
  const type = blob.type || "image/gif";
  if (!type.includes("gif") && !type.includes("webp")) return null;
  try {
    const supported = await ImageDecoder.isTypeSupported(type);
    if (!supported) return null;
    const decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type });
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    const count = Math.min(track?.frameCount || 1, 160);
    if (count <= 1) {
      decoder.close();
      return null;
    }
    const frames = [];
    for (let i = 0; i < count; i++) {
      const res = await decoder.decode({ frameIndex: i });
      const bmp = await createImageBitmap(res.image);
      const dur = Math.max(0.02, (res.image.duration || 60000) / 1e6);
      res.image.close();
      frames.push({ bitmap: bmp, dur });
    }
    decoder.close();
    return frames;
  } catch {
    return null;
  }
}

/**
 * Loads a boss image or animated GIF from a direct URL (GIPHY, Tenor, PNG, etc.).
 */
export async function loadBossFromUrl(url) {
  const cleanUrl = (url || "").trim();
  if (!cleanUrl) throw new Error("URL vacía");

  // Try fetch first so we can decode animated GIF frames cleanly
  let blob = null;
  try {
    const resp = await fetch(cleanUrl, { mode: "cors" });
    if (resp.ok) blob = await resp.blob();
  } catch {
    // Fallback to direct <img> with crossOrigin
  }

  if (blob) {
    const gifFrames = await decodeAnimatedGifBlob(blob);
    const objUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      el.src = objUrl;
    });
    state.customBoss.img = img;
    state.customBoss.gifFrames = gifFrames;
    state.customBoss.gifTime = 0;
    return { img, frameCount: gifFrames?.length || 1 };
  }

  // Fallback without CORS fetch (static image)
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("CORS bloqueado o URL inválida"));
    el.src = cleanUrl;
  });
  state.customBoss.img = img;
  state.customBoss.gifFrames = null;
  state.customBoss.gifTime = 0;
  return { img, frameCount: 1 };
}

/**
 * Captures a high-impact PNG thumbnail from the current canvas, with optional VS title overlay.
 */
export function captureThumbnail(sourceCanvas, showToast) {
  if (!sourceCanvas) return;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d");

  g.drawImage(sourceCanvas, 0, 0, w, h);

  // Boost contrast / cinematic vignette for YouTube CTR
  const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.62)");
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);

  const cfg = state.studio?.thumbnail || { showText: true, title: "VS BOSS", subtitle: "NO-HIT CHALLENGE" };
  if (cfg.showText && (cfg.title || cfg.subtitle)) {
    g.save();
    g.textAlign = "center";
    const titleSize = Math.round(Math.min(w, h) * 0.115);
    const subSize = Math.round(Math.min(w, h) * 0.042);
    const danger = (state.customColors?.enabled ? state.customColors.danger : "#FF1E6E") || "#FF1E6E";
    const cyan = (state.customColors?.enabled ? state.customColors.cyan : "#00F0FF") || "#00F0FF";

    if (cfg.title) {
      g.font = `900 ${titleSize}px Orbitron, sans-serif`;
      g.lineWidth = Math.max(6, titleSize * 0.14);
      g.strokeStyle = "#040610";
      g.strokeText(cfg.title.toUpperCase(), w / 2, h * 0.82);
      g.fillStyle = "#FFFFFF";
      g.shadowColor = danger;
      g.shadowBlur = 24;
      g.fillText(cfg.title.toUpperCase(), w / 2, h * 0.82);
    }
    if (cfg.subtitle) {
      g.shadowBlur = 12;
      g.shadowColor = cyan;
      g.font = `800 ${subSize}px 'JetBrains Mono', monospace`;
      g.fillStyle = cyan;
      g.fillText(cfg.subtitle.toUpperCase(), w / 2, h * 0.90);
    }
    g.restore();
  }

  const a = document.createElement("a");
  const clean = (state.trackTitle || "jsab_boss").replace(/[^a-z0-9]/gi, "_").slice(0, 28);
  a.download = `THUMBNAIL_${clean}.png`;
  a.href = out.toDataURL("image/png");
  a.click();
  showToast?.("📸 Miniatura PNG descargada", "success");
}

/**
 * 1-Click Creator Style Presets
 */
export const STYLE_PRESETS = {
  phonk_short: {
    label: "Phonk Edit 9:16",
    aspect: "9:16-hd",
    settings: { phonkMode: true, touhouMode: false, biomeBgEnabled: true, biomeBgStyle: "tunnel", biomeBgIntensity: 0.85, shakeMul: 1.35, zoomMul: 1.35, attackSpeed: 1.15 },
    studio: {
      commentCard: { enabled: true },
      vsIntro: { enabled: true },
      bossBar: { enabled: true, showNearMiss: true },
      endCta: { enabled: true }
    }
  },
  touhou_chaos: {
    label: "Touhou Chaos 16:9",
    aspect: "16:9-hd",
    settings: { phonkMode: false, touhouMode: true, biomeBgEnabled: true, biomeBgStyle: "vortex", biomeBgIntensity: 0.8, shakeMul: 0.9, zoomMul: 1.0, attackDensity: 1.45, attackSpeed: 1.1 },
    studio: {
      vsIntro: { enabled: true },
      bossBar: { enabled: true, showNearMiss: true },
      endCta: { enabled: true }
    }
  },
  clean_jsab: {
    label: "Clean JSAB 16:9",
    aspect: "16:9-hd",
    settings: { phonkMode: false, touhouMode: false, biomeBgEnabled: true, biomeBgStyle: "auto", biomeBgIntensity: 0.65, shakeMul: 1.0, zoomMul: 1.0, attackDensity: 1.0, attackSpeed: 1.0 },
    studio: {
      commentCard: { enabled: false },
      vsIntro: { enabled: false },
      bossBar: { enabled: true, showNearMiss: false },
      endCta: { enabled: false }
    }
  },
  viral_short: {
    label: "Short Viral 9:16",
    aspect: "9:16-hd",
    settings: { phonkMode: true, touhouMode: false, biomeBgEnabled: true, biomeBgStyle: "perspective", biomeBgIntensity: 0.9, shakeMul: 1.2, zoomMul: 1.25, attackDensity: 1.2 },
    studio: {
      commentCard: { enabled: true },
      vsIntro: { enabled: true },
      bossBar: { enabled: true, showNearMiss: true },
      endCta: { enabled: true },
      clip: { enabled: true, start: 0, end: 40 }
    }
  },
  pure_minimal: {
    label: "Modo Puro (Todo Off)",
    settings: { phonkMode: false, touhouMode: false, biomeBgEnabled: false, biomeBgStyle: "flat", shakeMul: 1.0, zoomMul: 1.0, attackDensity: 1.0, attackSpeed: 1.0 },
    studio: {
      commentCard: { enabled: false },
      vsIntro: { enabled: false },
      bossBar: { enabled: false, showNearMiss: false },
      endCta: { enabled: false },
      clip: { enabled: false }
    }
  }
};

export function applyStylePreset(presetKey, setAspectFn) {
  const p = STYLE_PRESETS[presetKey];
  if (!p) return null;
  if (p.aspect && setAspectFn) setAspectFn(p.aspect);
  if (p.settings) Object.assign(state.settings, p.settings);
  if (p.studio) {
    for (const [k, v] of Object.entries(p.studio)) {
      if (state.studio[k]) Object.assign(state.studio[k], v);
    }
  }
  return p;
}

const STORAGE_KEY = "jsab_beat_studio_preset_v1";

export function exportStudioPresetObject() {
  return {
    aspect: state.aspect,
    customColors: { ...state.customColors },
    settings: { ...state.settings },
    studio: JSON.parse(JSON.stringify(state.studio)),
    customBoss: {
      gifAnimate: state.customBoss.gifAnimate,
      gifBpmSync: state.customBoss.gifBpmSync,
      gifSpeed: state.customBoss.gifSpeed,
      autoPalette: state.customBoss.autoPalette,
      frame: state.customBoss.frame,
      frameWidth: state.customBoss.frameWidth,
      spikesMode: state.customBoss.spikesMode,
      spikesShape: state.customBoss.spikesShape,
      spikesLayer: state.customBoss.spikesLayer,
      spikeStyle: state.customBoss.spikeStyle,
      spikeAnim: state.customBoss.spikeAnim,
      spikeSpeed: state.customBoss.spikeSpeed,
      spikeSize: state.customBoss.spikeSize,
      spikeFill: state.customBoss.spikeFill,
      spikeColorMode: state.customBoss.spikeColorMode,
      spikeCustomColor: state.customBoss.spikeCustomColor,
      spikeCount: state.customBoss.spikeCount,
      spikeRadiusMul: state.customBoss.spikeRadiusMul,
      handsShape: state.customBoss.handsShape,
      handsMode: state.customBoss.handsMode,
      handsLayer: state.customBoss.handsLayer,
      handsDistanceMul: state.customBoss.handsDistanceMul,
      handsAnim: state.customBoss.handsAnim,
      handsRotate: state.customBoss.handsRotate,
      flashIntensity: state.customBoss.flashIntensity
    }
  };
}

export function applyStudioPresetObject(data, setAspectFn) {
  if (!data || typeof data !== "object") return false;
  if (data.aspect && setAspectFn) setAspectFn(data.aspect);
  if (data.customColors) Object.assign(state.customColors, data.customColors);
  if (data.settings) Object.assign(state.settings, data.settings);
  if (data.studio) {
    for (const [k, v] of Object.entries(data.studio)) {
      if (state.studio[k]) Object.assign(state.studio[k], v);
    }
  }
  if (data.customBoss) Object.assign(state.customBoss, data.customBoss);
  return true;
}

export function savePresetToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exportStudioPresetObject()));
    return true;
  } catch {
    return false;
  }
}

export function loadPresetFromStorage(setAspectFn) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return applyStudioPresetObject(JSON.parse(raw), setAspectFn);
  } catch {
    return false;
  }
}
