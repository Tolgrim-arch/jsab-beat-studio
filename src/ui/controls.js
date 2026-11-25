import { state } from "../state.js";

export function initStudioControls(showToast) {
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
    el?.addEventListener("input", () => {
      state.customColors.enabled = true;
      state.customColors[key] = el.value;
    });
  });

  document.getElementById("btnResetColors")?.addEventListener("click", () => {
    state.customColors.enabled = false;
    const defaults = { colorBg: "#040D14", colorDanger: "#FF1E6E", colorCyan: "#00F0FF", colorTrail: "#0077FF", colorEq: "#00F0FF" };
    Object.entries(defaults).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
    showToast("Colores restaurados a Auto ADN", "info");
  });

  // 2. Custom PNG Boss uploader & Frame selector
  const pngInput = document.getElementById("bossPngInput");
  const btnClearPng = document.getElementById("btnClearBossPng");
  const frameSelect = document.getElementById("bossFrameSelect");

  pngInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      state.customBoss.img = img;
      showToast(`Enemigo PNG cargado: ${file.name}`, "success");
    };
    img.src = URL.createObjectURL(file);
  });

  btnClearPng?.addEventListener("click", () => {
    state.customBoss.img = null;
    if (pngInput) pngInput.value = "";
    showToast("Jefe restaurado a modo Procedural", "info");
  });

  frameSelect?.addEventListener("change", (e) => {
    state.customBoss.frame = e.target.value;
  });
  document.getElementById("bossSpikesSelect")?.addEventListener("change", (e) => {
    state.customBoss.spikesMode = e.target.value;
  });
  document.getElementById("bossHandsSelect")?.addEventListener("change", (e) => {
    state.customBoss.handsShape = e.target.value;
  });

  // 3. Sliders with ◀ / ▶ stepper arrows (DRY)
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

    const apply = (val) => {
      const clamped = Math.max(Number(input.min), Math.min(Number(input.max), val));
      input.value = clamped;
      target[key] = clamped;
      if (label) label.textContent = fmt(clamped);
    };

    input.addEventListener("input", () => apply(Number(input.value)));
    document.querySelector(`[data-step-dec="${id}"]`)?.addEventListener("click", () => apply(Number(input.value) - step));
    document.querySelector(`[data-step-inc="${id}"]`)?.addEventListener("click", () => apply(Number(input.value) + step));
  });
}
