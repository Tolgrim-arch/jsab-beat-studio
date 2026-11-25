import { state } from "../state.js";

const STORAGE_KEY = "jsab_studio_prefs_v1";

function savePrefs() {
  try {
    const payload = {
      customColors: state.customColors,
      settings: state.settings,
      customBoss: {
        frame: state.customBoss.frame,
        frameWidth: state.customBoss.frameWidth,
        spikesMode: state.customBoss.spikesMode,
        spikeCount: state.customBoss.spikeCount,
        handsShape: state.customBoss.handsShape,
        flashIntensity: state.customBoss.flashIntensity,
        dataUrl: state.customBoss.dataUrl || null
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function mountBossImage(src, onReady) {
  let el = document.getElementById("hiddenBossGifHost");
  if (!el) {
    el = document.createElement("img");
    el.id = "hiddenBossGifHost";
    el.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0.01;pointer-events:none;";
    document.body.appendChild(el);
  }
  el.onload = () => {
    state.customBoss.img = el;
    if (onReady) onReady();
  };
  el.src = src;
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.customColors) Object.assign(state.customColors, data.customColors);
    if (data.settings) Object.assign(state.settings, data.settings);
    if (data.customBoss) {
      Object.assign(state.customBoss, data.customBoss);
      if (data.customBoss.dataUrl) mountBossImage(data.customBoss.dataUrl);
    }
  } catch {}
}

export function initStudioControls(showToast) {
  loadPrefs();

  // 1. Color pickers
  const colorMap = [
    ["colorBg", "bg"],
    ["colorDanger", "danger"],
    ["colorCyan", "cyan"],
    ["colorTrail", "trail"],
    ["colorEq", "eq"]
  ];
  colorMap.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (state.customColors[key]) el.value = state.customColors[key];
    el.addEventListener("input", () => {
      state.customColors.enabled = true;
      state.customColors[key] = el.value;
      savePrefs();
    });
  });

  document.getElementById("btnResetColors")?.addEventListener("click", () => {
    state.customColors.enabled = false;
    const defaults = { bg: "#040D14", danger: "#FF1E6E", cyan: "#00F0FF", trail: "#0077FF", eq: "#00F0FF" };
    Object.assign(state.customColors, defaults);
    colorMap.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = defaults[key];
    });
    savePrefs();
    showToast("Colores restaurados a Auto ADN", "info");
  });

  // 2. Custom PNG / Animated GIF Boss uploader & Selectors
  const pngInput = document.getElementById("bossPngInput");
  const btnClearPng = document.getElementById("btnClearBossPng");

  pngInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      mountBossImage(dataUrl, () => {
        state.customBoss.dataUrl = dataUrl.length < 2_500_000 ? dataUrl : null;
        savePrefs();
        showToast(`Enemigo PNG/GIF cargado: ${file.name}`, "success");
      });
    };
    reader.readAsDataURL(file);
  });

  btnClearPng?.addEventListener("click", () => {
    state.customBoss.img = null;
    state.customBoss.dataUrl = null;
    if (pngInput) pngInput.value = "";
    savePrefs();
    showToast("Jefe restaurado a modo Procedural", "info");
  });

  const selects = [
    ["bossFrameSelect", "frame"],
    ["bossSpikesSelect", "spikesMode"],
    ["bossHandsSelect", "handsShape"]
  ];
  selects.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (state.customBoss[key]) el.value = state.customBoss[key];
    el.addEventListener("change", () => {
      state.customBoss[key] = el.value;
      savePrefs();
    });
  });

  // 3. Sliders with ◀ / ▶ stepper arrows + persistence
  const sliders = [
    { id: "sliderSync",       target: state.settings,   key: "syncOffsetMs",   valId: "valSync",       step: 10,   fmt: v => `${v}ms` },
    { id: "sliderSpeed",      target: state.settings,   key: "attackSpeed",    valId: "valSpeed",      step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderBoss",       target: state.settings,   key: "bossScale",      valId: "valBoss",       step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderShake",      target: state.settings,   key: "shakeMul",       valId: "valShake",      step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderZoom",       target: state.settings,   key: "zoomMul",        valId: "valZoom",       step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderEqAlpha",    target: state.settings,   key: "eqAlpha",        valId: "valEqAlpha",    step: 0.05, fmt: v => `${Math.round(v * 100)}%` },
    { id: "sliderFrameWidth", target: state.customBoss, key: "frameWidth",     valId: "valFrameWidth", step: 1,    fmt: v => `${v}px` },
    { id: "sliderSpikeCount", target: state.customBoss, key: "spikeCount",     valId: "valSpikeCount", step: 2,    fmt: v => `${v}` },
    { id: "sliderFlashInt",   target: state.customBoss, key: "flashIntensity", valId: "valFlashInt",   step: 0.1,  fmt: v => `${Math.round(v * 100)}%` }
  ];

  sliders.forEach(({ id, target, key, valId, step, fmt }) => {
    const input = document.getElementById(id);
    const label = document.getElementById(valId);
    if (!input) return;

    const apply = (val, persist = true) => {
      const clamped = Math.max(Number(input.min), Math.min(Number(input.max), val));
      input.value = clamped;
      target[key] = clamped;
      if (label) label.textContent = fmt(clamped);
      if (persist) savePrefs();
    };

    // Sync UI to loaded localStorage value on startup
    if (Number.isFinite(target[key])) apply(target[key], false);

    input.addEventListener("input", () => apply(Number(input.value)));
    document.querySelector(`[data-step-dec="${id}"]`)?.addEventListener("click", () => apply(Number(input.value) - step));
    document.querySelector(`[data-step-inc="${id}"]`)?.addEventListener("click", () => apply(Number(input.value) + step));
  });

  const phonkEl = document.getElementById("togglePhonk");
  if (phonkEl) {
    phonkEl.checked = !!state.settings.phonkMode;
    phonkEl.addEventListener("change", () => {
      state.settings.phonkMode = phonkEl.checked;
      savePrefs();
      showToast(phonkEl.checked ? "⚡ Modo TikTok / Phonk Edit ACTIVADO" : "Modo Phonk desactivado", "info");
    });
  }
}
