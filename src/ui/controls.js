import { state } from "../state.js";
import { ATTACK_CATALOG } from "../combat/choreography.js?v=54";
import { initYoutubeStudioControls } from "./youtubeControls.js";
import { extractPaletteFromImage } from "../studio/creatorTools.js";

const STORAGE_KEY = "jsab_studio_prefs_v1";

function savePrefs() {
  try {
    const payload = {
      customColors: state.customColors,
      settings: state.settings,
      disabledAttacks: state.disabledAttacks || {},
      customBoss: {
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
        flashIntensity: state.customBoss.flashIntensity,
        dataUrl: state.customBoss.dataUrl || null
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

async function decodeAnimatedGif(arrayBuffer) {
  if (typeof ImageDecoder === "undefined") return null;
  try {
    const decoder = new ImageDecoder({ data: new Uint8Array(arrayBuffer), type: "image/gif" });
    await decoder.tracks.ready;
    const frames = [];
    for (let i = 0; i < 300; i++) {
      let res;
      try {
        res = await decoder.decode({ frameIndex: i });
      } catch {
        break; // Reached end of GIF frames
      }
      const bitmap = await createImageBitmap(res.image);
      const durSec = Math.max(0.02, (res.image.duration || 80000) / 1_000_000);
      res.image.close();
      frames.push({ bitmap, dur: durSec });
    }
    return frames.length > 1 ? frames : null;
  } catch {
    return null;
  }
}

function mountBossImage(src, onReady) {
  let el = document.getElementById("hiddenBossGifHost");
  if (!el) {
    el = document.createElement("img");
    el.id = "hiddenBossGifHost";
    el.crossOrigin = "anonymous";
    el.style.cssText = "position:fixed;left:0;top:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-1;";
    document.body.appendChild(el);
  }
  el.onload = () => {
    state.customBoss.img = el;
    if (state.customBoss.autoPalette) extractPaletteFromImage(el);
    const thumb = document.getElementById("bossPreviewThumb");
    if (thumb) {
      thumb.innerHTML = "";
      const img = document.createElement("img");
      img.src = src;
      img.className = "w-full h-full object-cover";
      thumb.appendChild(img);
    }
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
    if (data.disabledAttacks) state.disabledAttacks = { ...data.disabledAttacks };
    if (data.customBoss) {
      Object.assign(state.customBoss, data.customBoss);
      if (data.customBoss.dataUrl) {
        mountBossImage(data.customBoss.dataUrl);
        if (data.customBoss.dataUrl.startsWith("data:image/gif") || data.customBoss.dataUrl.includes(".gif")) {
          fetch(data.customBoss.dataUrl)
            .then(r => r.arrayBuffer())
            .then(decodeAnimatedGif)
            .then(frames => { if (frames) state.customBoss.gifFrames = frames; })
            .catch(() => {});
        }
      }
    }
  } catch {}
}

export function initStudioControls(showToast, hooks = {}) {
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
    activePresetId = null;
    renderColorPresets();
    savePrefs();
    showToast("Colores restaurados a Auto ADN", "info");
  });

  // 1b. Saved Color Presets (Save, Switch, Rename, Delete)
  const PRESETS_KEY = "jsab_color_presets_v1";
  let colorPresets = [];
  let activePresetId = null;
  try {
    const rawP = localStorage.getItem(PRESETS_KEY);
    if (rawP) colorPresets = JSON.parse(rawP);
  } catch { colorPresets = []; }

  const saveColorPresets = () => {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(colorPresets)); } catch {}
  };

  const applyColorPreset = (preset) => {
    state.customColors.enabled = true;
    Object.assign(state.customColors, preset.colors);
    colorMap.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && preset.colors[key]) el.value = preset.colors[key];
    });
    activePresetId = preset.id;
    savePrefs();
    renderColorPresets();
    showToast(`Paleta aplicada: ${preset.name}`, "success");
  };

  const renderColorPresets = () => {
    const listEl = document.getElementById("colorPresetsList");
    const countEl = document.getElementById("colorPresetCount");
    if (countEl) countEl.textContent = String(colorPresets.length);
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!colorPresets.length) {
      const empty = document.createElement("div");
      empty.className = "text-[10px] text-slate-500 text-center py-1";
      empty.textContent = "Sin paletas guardadas";
      listEl.appendChild(empty);
      return;
    }
    colorPresets.forEach((preset) => {
      const isActive = preset.id === activePresetId;
      const row = document.createElement("div");
      row.className = `flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition ${
        isActive
          ? "bg-[#00F0FF]/10 border-[#00F0FF]/50"
          : "bg-[#090b1a] border-slate-800/80 hover:border-slate-700"
      }`;

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer";
      applyBtn.title = "Aplicar paleta";

      const dots = document.createElement("span");
      dots.className = "flex items-center -space-x-1 shrink-0";
      ["bg", "danger", "cyan", "trail", "eq"].forEach((k) => {
        const d = document.createElement("span");
        d.className = "w-2.5 h-2.5 rounded-full border border-slate-900 inline-block";
        d.style.backgroundColor = preset.colors[k] || "#ffffff";
        dots.appendChild(d);
      });

      const nameSpan = document.createElement("span");
      nameSpan.className = "text-[10px] font-medium text-slate-200 truncate";
      nameSpan.textContent = preset.name;

      applyBtn.appendChild(dots);
      applyBtn.appendChild(nameSpan);
      applyBtn.addEventListener("click", () => applyColorPreset(preset));

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer shrink-0";
      renameBtn.title = "Renombrar paleta";
      renameBtn.textContent = "✎";
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextName = window.prompt("Nuevo nombre para la paleta:", preset.name);
        if (nextName && nextName.trim()) {
          preset.name = nextName.trim().slice(0, 24);
          saveColorPresets();
          renderColorPresets();
          showToast(`Paleta renombrada a: ${preset.name}`, "info");
        }
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-[#FF1F71]/30 hover:text-[#FF1F71] text-[10px] text-slate-400 cursor-pointer shrink-0";
      delBtn.title = "Borrar paleta";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        colorPresets = colorPresets.filter((p) => p.id !== preset.id);
        if (activePresetId === preset.id) activePresetId = null;
        saveColorPresets();
        renderColorPresets();
        showToast(`Paleta eliminada: ${preset.name}`, "info");
      });

      row.appendChild(applyBtn);
      row.appendChild(renameBtn);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });
  };

  const presetNameInput = document.getElementById("colorPresetName");
  const saveCurrentPreset = () => {
    const rawName = presetNameInput?.value?.trim();
    const name = rawName || `Paleta ${colorPresets.length + 1}`;
    const colors = {
      bg: state.customColors.bg || "#040D14",
      danger: state.customColors.danger || "#FF1E6E",
      cyan: state.customColors.cyan || "#00F0FF",
      trail: state.customColors.trail || "#0077FF",
      eq: state.customColors.eq || "#00F0FF"
    };
    const preset = { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: name.slice(0, 24), colors };
    colorPresets.unshift(preset);
    activePresetId = preset.id;
    state.customColors.enabled = true;
    if (presetNameInput) presetNameInput.value = "";
    saveColorPresets();
    savePrefs();
    renderColorPresets();
    showToast(`Paleta guardada: ${preset.name}`, "success");
  };

  document.getElementById("btnSaveColorPreset")?.addEventListener("click", saveCurrentPreset);
  presetNameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCurrentPreset();
    }
  });
  renderColorPresets();

  // 2. Custom PNG & Animated GIF Boss uploaders
  const pngInput = document.getElementById("bossPngInput");
  const gifInput = document.getElementById("bossGifInput");
  const btnClearPng = document.getElementById("btnClearBossPng");

  const handleImageUpload = (file, inputEl) => {
    if (!file) return;
    state.customBoss.gifFrames = null;

    // 1. Instant display via ObjectURL (works for any size PNG or GIF!)
    const objUrl = URL.createObjectURL(file);
    mountBossImage(objUrl, () => {
      showToast(`Enemigo cargado: ${file.name}`, "success");
    });

    // 2. Save smaller images (<2MB) to localStorage in background
    if (file.size < 2_000_000) {
      const reader = new FileReader();
      reader.onload = () => {
        state.customBoss.dataUrl = reader.result;
        savePrefs();
      };
      reader.readAsDataURL(file);
    } else {
      state.customBoss.dataUrl = null;
      savePrefs();
    }

    // 3. Decode animated GIF frames in background
    if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) {
      file.arrayBuffer()
        .then(decodeAnimatedGif)
        .then(frames => {
          if (frames) {
            state.customBoss.gifFrames = frames;
            showToast(`GIF animado listo (${frames.length} frames)`, "success");
          }
        })
        .catch(() => {});
    }

    if (inputEl) inputEl.value = "";
  };

  pngInput?.addEventListener("change", (e) => handleImageUpload(e.target.files[0], pngInput));
  gifInput?.addEventListener("change", (e) => handleImageUpload(e.target.files[0], gifInput));

  btnClearPng?.addEventListener("click", () => {
    state.customBoss.img = null;
    state.customBoss.gifFrames = null;
    state.customBoss.dataUrl = null;
    if (pngInput) pngInput.value = "";
    if (gifInput) gifInput.value = "";
    savePrefs();
    showToast("Jefe restaurado a modo Procedural", "info");
  });

  // 2b. GIPHY Search + Saved Searches + Star Favorites + Direct GIF URL
  const tenorInput = document.getElementById("tenorSearchInput");
  const tenorBtn = document.getElementById("btnTenorSearch");
  const tenorGrid = document.getElementById("tenorResultsGrid");
  const giphyKeyInput = document.getElementById("giphyApiKeyInput");
  const historyChipsEl = document.getElementById("giphyHistoryChips");
  const favBtn = document.getElementById("btnGiphyFavs");
  const favCountEl = document.getElementById("giphyFavCount");
  const GIPHY_KEY_STORAGE = "jsab_giphy_api_key_v1";
  const GIPHY_HIST_STORAGE = "jsab_giphy_history_v1";
  const GIPHY_FAVS_STORAGE = "jsab_giphy_favorites_v1";

  let giphyHistory = [];
  let giphyFavs = [];
  try { giphyHistory = JSON.parse(localStorage.getItem(GIPHY_HIST_STORAGE) || "[]"); } catch { giphyHistory = []; }
  try { giphyFavs = JSON.parse(localStorage.getItem(GIPHY_FAVS_STORAGE) || "[]"); } catch { giphyFavs = []; }

  const saveHistory = () => { try { localStorage.setItem(GIPHY_HIST_STORAGE, JSON.stringify(giphyHistory)); } catch {} };
  const saveFavs = () => { try { localStorage.setItem(GIPHY_FAVS_STORAGE, JSON.stringify(giphyFavs)); } catch {} };

  if (giphyKeyInput) {
    try { giphyKeyInput.value = localStorage.getItem(GIPHY_KEY_STORAGE) || ""; } catch {}
    giphyKeyInput.addEventListener("change", () => {
      try { localStorage.setItem(GIPHY_KEY_STORAGE, giphyKeyInput.value.trim()); } catch {}
    });
  }

  const applyRemoteGif = async (gifUrl, label = "GIF") => {
    try {
      showToast(`Cargando ${label}...`, "info");
      state.customBoss.gifFrames = null;
      state.customBoss.dataUrl = gifUrl;
      savePrefs();
      mountBossImage(gifUrl);

      const res = await fetch(gifUrl);
      const buf = await res.arrayBuffer();
      const frames = await decodeAnimatedGif(buf);
      if (frames) {
        state.customBoss.gifFrames = frames;
        showToast(`GIF animado listo (${frames.length} frames)`, "success");
      } else {
        showToast(`GIF aplicado: ${label}`, "success");
      }
    } catch {
      showToast("No se pudo descargar el GIF (CORS o URL inválida)", "error");
    }
  };

  const updateFavCount = () => {
    if (favCountEl) favCountEl.textContent = String(giphyFavs.length);
  };

  const renderGifCard = (previewUrl, fullUrl, title, onUnfav) => {
    const isFav = giphyFavs.some(f => f.fullUrl === fullUrl);
    const wrap = document.createElement("div");
    wrap.className = "relative aspect-square rounded overflow-hidden border border-slate-800 hover:border-[#00F0FF] bg-slate-900 transition group";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-full h-full cursor-pointer block";
    btn.title = title || "Usar como jefe";
    const img = document.createElement("img");
    img.src = previewUrl;
    img.alt = title || "GIF";
    img.className = "w-full h-full object-cover";
    img.loading = "lazy";
    btn.appendChild(img);
    btn.addEventListener("click", () => applyRemoteGif(fullUrl, title || "GIPHY GIF"));

    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = `absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none cursor-pointer transition ${
      isFav ? "bg-[#070917]/85 text-[#FFD166]" : "bg-[#070917]/70 text-slate-300 opacity-80 group-hover:opacity-100 hover:text-[#FFD166]"
    }`;
    starBtn.title = isFav ? "Quitar de favoritos" : "Guardar en favoritos";
    starBtn.textContent = isFav ? "★" : "☆";
    starBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = giphyFavs.findIndex(f => f.fullUrl === fullUrl);
      if (idx >= 0) {
        giphyFavs.splice(idx, 1);
        starBtn.textContent = "☆";
        starBtn.className = "absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none cursor-pointer transition bg-[#070917]/70 text-slate-300 opacity-80 group-hover:opacity-100 hover:text-[#FFD166]";
        showToast("Eliminado de favoritos", "info");
        if (onUnfav) onUnfav();
      } else {
        giphyFavs.unshift({ previewUrl, fullUrl, title: title || "GIF" });
        starBtn.textContent = "★";
        starBtn.className = "absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none cursor-pointer transition bg-[#070917]/85 text-[#FFD166]";
        showToast("Guardado en favoritos ★", "success");
      }
      saveFavs();
      updateFavCount();
    });

    wrap.appendChild(btn);
    wrap.appendChild(starBtn);
    return wrap;
  };

  const renderFavoritesGrid = () => {
    if (!tenorGrid) return;
    tenorGrid.classList.remove("hidden");
    tenorGrid.innerHTML = "";
    if (!giphyFavs.length) {
      tenorGrid.innerHTML = `<div class="col-span-4 text-center text-[10px] text-slate-500 py-2">Aún no tienes GIFs favoritos. Toca ★ en cualquier GIF.</div>`;
      return;
    }
    giphyFavs.forEach((fav) => {
      tenorGrid.appendChild(renderGifCard(fav.previewUrl, fav.fullUrl, fav.title, renderFavoritesGrid));
    });
  };

  let giphyOffset = 0;
  let giphyLastQuery = "";

  const renderHistoryChips = () => {
    if (!historyChipsEl) return;
    historyChipsEl.innerHTML = "";
    giphyHistory.forEach((term) => {
      const chip = document.createElement("div");
      chip.className = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#070917] border border-slate-700/80 text-[10px] text-slate-300";

      const qBtn = document.createElement("button");
      qBtn.type = "button";
      qBtn.className = "hover:text-[#00F0FF] cursor-pointer";
      qBtn.textContent = term;
      qBtn.addEventListener("click", () => {
        if (tenorInput) tenorInput.value = term;
        searchTenor(false);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "text-slate-500 hover:text-[#FF1F71] cursor-pointer leading-none";
      delBtn.title = "Borrar búsqueda";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => {
        giphyHistory = giphyHistory.filter(t => t !== term);
        saveHistory();
        renderHistoryChips();
      });

      chip.appendChild(qBtn);
      chip.appendChild(delBtn);
      historyChipsEl.appendChild(chip);
    });
  };

  const searchTenor = async (loadMore = false) => {
    const q = tenorInput?.value?.trim();
    if (!q || !tenorGrid) return;

    // Direct GIF URL support
    if (/^https?:\/\//i.test(q)) {
      tenorGrid.classList.add("hidden");
      await applyRemoteGif(q, "URL directa");
      return;
    }

    const apiKey = giphyKeyInput?.value?.trim();
    tenorGrid.classList.remove("hidden");
    if (!apiKey) {
      tenorGrid.innerHTML = `<div class="col-span-4 text-center text-[10px] text-[#FFD166] py-2 px-1 leading-relaxed">Ingresa tu GIPHY API Key arriba (gratis en developers.giphy.com) o pega una URL directa de .gif</div>`;
      return;
    }

    if (!loadMore || q !== giphyLastQuery) {
      giphyOffset = 0;
      giphyLastQuery = q;
      giphyHistory = [q, ...giphyHistory.filter(t => t.toLowerCase() !== q.toLowerCase())].slice(0, 12);
      saveHistory();
      renderHistoryChips();
      tenorGrid.innerHTML = `<div class="col-span-4 text-center text-[10px] text-slate-400 py-2">Buscando en GIPHY...</div>`;
    } else {
      tenorGrid.querySelector(".giphy-load-more")?.remove();
    }

    try {
      const limit = 20;
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${giphyOffset}&rating=pg-13`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data?.meta?.status >= 400) {
        tenorGrid.innerHTML = `<div class="col-span-4 text-center text-[10px] text-[#FF1F71] py-2">API Key inválida o bloqueada (${data?.meta?.msg || res.status})</div>`;
        return;
      }
      const results = data?.data || [];
      if (!loadMore) tenorGrid.innerHTML = "";
      if (!results.length && !loadMore) {
        tenorGrid.innerHTML = `<div class="col-span-4 text-center text-[10px] text-slate-500 py-2">Sin resultados</div>`;
        return;
      }
      results.forEach((item) => {
        const previewUrl = item.images?.fixed_width_small?.url || item.images?.preview_gif?.url;
        const fullUrl = item.images?.downsized_medium?.url || item.images?.original?.url || previewUrl;
        if (!previewUrl) return;
        tenorGrid.appendChild(renderGifCard(previewUrl, fullUrl, item.title || "GIPHY GIF"));
      });

      giphyOffset += results.length;
      const total = data?.pagination?.total_count ?? 0;
      if (results.length === limit && giphyOffset < total) {
        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "giphy-load-more col-span-4 py-1.5 mt-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-[#00F0FF] cursor-pointer";
        moreBtn.textContent = "Cargar más GIFs";
        moreBtn.addEventListener("click", () => searchTenor(true));
        tenorGrid.appendChild(moreBtn);
      }
    } catch {
      if (!loadMore) tenorGrid.innerHTML = `<div class="col-span-4 text-center text-[10px] text-[#FF1F71] py-2">Error al conectar con GIPHY</div>`;
    }
  };

  tenorBtn?.addEventListener("click", () => searchTenor(false));
  favBtn?.addEventListener("click", renderFavoritesGrid);
  tenorInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchTenor(false);
    }
  });
  updateFavCount();
  renderHistoryChips();

  const selects = [
    ["bossFrameSelect", "frame"],
    ["bossSpikesSelect", "spikesMode"],
    ["bossSpikesShapeSelect", "spikesShape"],
    ["bossSpikeStyleSelect", "spikeStyle"],
    ["bossSpikeAnimSelect", "spikeAnim"],
    ["bossSpikeFillSelect", "spikeFill"],
    ["bossSpikeColorModeSelect", "spikeColorMode"],
    ["bossSpikesLayerSelect", "spikesLayer"],
    ["bossHandsSelect", "handsShape"],
    ["bossHandsModeSelect", "handsMode"],
    ["bossHandsLayerSelect", "handsLayer"],
    ["bossHandsAnimSelect", "handsAnim"],
    ["bossHandsRotateSelect", "handsRotate"]
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

  const spikeColorEl = document.getElementById("colorSpikeCustom");
  if (spikeColorEl) {
    if (state.customBoss.spikeCustomColor) spikeColorEl.value = state.customBoss.spikeCustomColor;
    spikeColorEl.addEventListener("input", () => {
      state.customBoss.spikeCustomColor = spikeColorEl.value;
      state.customBoss.spikeColorMode = "custom";
      const modeSel = document.getElementById("bossSpikeColorModeSelect");
      if (modeSel) modeSel.value = "custom";
      savePrefs();
    });
  }

  // 3. Sliders with ◀ / ▶ stepper arrows + persistence
  const sliders = [
    { id: "sliderSync",       target: state.settings,   key: "syncOffsetMs",   valId: "valSync",       step: 10,   fmt: v => `${v}ms` },
    { id: "sliderSpeed",      target: state.settings,   key: "attackSpeed",    valId: "valSpeed",      step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderBoss",       target: state.settings,   key: "bossScale",      valId: "valBoss",       step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderShake",      target: state.settings,   key: "shakeMul",       valId: "valShake",      step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderZoom",       target: state.settings,   key: "zoomMul",        valId: "valZoom",       step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderEqAlpha",     target: state.settings,   key: "eqAlpha",        valId: "valEqAlpha",     step: 0.05, fmt: v => `${Math.round(v * 100)}%` },
    { id: "sliderImpactFlash", target: state.settings,   key: "impactFlashMul", valId: "valImpactFlash", step: 0.05, fmt: v => `${Math.round(v * 100)}%` },
    { id: "sliderFrameWidth", target: state.customBoss, key: "frameWidth",     valId: "valFrameWidth", step: 1,    fmt: v => `${v}px` },
    { id: "sliderSpikeCount",  target: state.customBoss, key: "spikeCount",     valId: "valSpikeCount",  step: 2,    fmt: v => `${v}` },
    { id: "sliderSpikeSpread", target: state.customBoss, key: "spikeRadiusMul", valId: "valSpikeSpread", step: 0.05, fmt: v => `${v.toFixed(2)}x` },
    { id: "sliderSpikeSize",   target: state.customBoss, key: "spikeSize",      valId: "valSpikeSize",   step: 0.05, fmt: v => `${v.toFixed(2)}x` },
    { id: "sliderSpikeSpeed",  target: state.customBoss, key: "spikeSpeed",     valId: "valSpikeSpeed",  step: 0.1,  fmt: v => `${v.toFixed(1)}x` },
    { id: "sliderHandsDist",   target: state.customBoss, key: "handsDistanceMul", valId: "valHandsDist", step: 0.05, fmt: v => `${v.toFixed(2)}x` },
    { id: "sliderFlashInt",   target: state.customBoss, key: "flashIntensity", valId: "valFlashInt",   step: 0.1,  fmt: v => `${Math.round(v * 100)}%` }
  ];

  sliders.forEach(({ id, target, key, valId, step, fmt }) => {
    const input = document.getElementById(id);
    const label = document.getElementById(valId);
    if (!input) return;

    const apply = (val, persist = true) => {
      const min = Number(input.min), max = Number(input.max);
      const clamped = Math.max(min, Math.min(max, val));
      input.value = clamped;
      const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
      input.style.setProperty("--pct", `${pct}%`);
      target[key] = clamped;
      if (label) label.textContent = fmt(clamped);
      if (persist) savePrefs();
    };

    // Sync UI to loaded localStorage value on startup
    if (Number.isFinite(target[key])) apply(target[key], false);
    else apply(Number(input.value), false);

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

  const touhouEl = document.getElementById("toggleTouhou");
  if (touhouEl) {
    touhouEl.checked = !!state.settings.touhouMode;
    touhouEl.addEventListener("change", () => {
      state.settings.touhouMode = touhouEl.checked;
      savePrefs();
      showToast(touhouEl.checked ? "🌸 Modo Bullet Hell (Touhou) ACTIVADO" : "Modo Touhou desactivado", "info");
    });
  }

  // Reset boss thumb on clear
  btnClearPng?.addEventListener("click", () => {
    const thumb = document.getElementById("bossPreviewThumb");
    if (thumb) thumb.textContent = "👾";
  });

  // 4. Studio Sidebar Tabs (with persistence)
  const TAB_KEY = "jsab_active_tab_v1";
  const tabBtns = document.querySelectorAll("[data-studio-tab]");
  const tabPanels = document.querySelectorAll("[data-studio-panel]");
  const activateTab = (tabName) => {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.studioTab === tabName));
    tabPanels.forEach(p => p.classList.toggle("hidden", p.dataset.studioPanel !== tabName));
    try { localStorage.setItem(TAB_KEY, tabName); } catch {}
  };
  tabBtns.forEach(b => b.addEventListener("click", () => activateTab(b.dataset.studioTab)));
  try {
    const savedTab = localStorage.getItem(TAB_KEY);
    if (savedTab && document.querySelector(`[data-studio-tab="${savedTab}"]`)) activateTab(savedTab);
  } catch {}

  // 5. Cinema Mode & Mobile Panel Toggle
  const toggleCinema = () => {
    document.body.classList.toggle("cinema-mode");
  };
  document.getElementById("btnCinemaMode")?.addEventListener("click", toggleCinema);
  document.getElementById("btnExitCinema")?.addEventListener("click", toggleCinema);
  document.getElementById("btnMobilePanel")?.addEventListener("click", () => {
    document.body.classList.toggle("mobile-panel-hidden");
  });

  // 6. Keyboard Shortcuts (ignoring text inputs)
  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      document.getElementById("btnPlayPause")?.click();
    } else if (e.key === "r" || e.key === "R") {
      document.getElementById("btnRestart")?.click();
    } else if (e.key === "f" || e.key === "F") {
      toggleCinema();
    } else if (e.key === "h" || e.key === "H") {
      const hud = document.getElementById("toggleHud");
      if (hud) { hud.checked = !hud.checked; hud.dispatchEvent(new Event("change")); }
    } else if (e.key === "1") {
      document.querySelector('[data-aspect="16:9"]')?.click();
    } else if (e.key === "2") {
      document.querySelector('[data-aspect="9:16"]')?.click();
    } else if (e.key === "3") {
      document.querySelector('[data-aspect="1:1"]')?.click();
    }
  });

  // 7. Drag & Drop onto Stage (Audio/Video or Boss PNG/GIF)
  const stage = document.getElementById("stageContainer");
  if (stage) {
    ["dragenter", "dragover"].forEach(evt => {
      stage.addEventListener(evt, (e) => {
        e.preventDefault();
        stage.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach(evt => {
      stage.addEventListener(evt, (e) => {
        e.preventDefault();
        if (evt === "dragleave" && stage.contains(e.relatedTarget)) return;
        stage.classList.remove("drag-over");
      });
    });
    stage.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.type.startsWith("image/") || /\.(png|gif|webp)$/i.test(file.name)) {
        handleImageUpload(file, null);
      } else {
        const audioInput = document.getElementById("audioFileInput");
        if (audioInput) {
          const dt = new DataTransfer();
          dt.items.add(file);
          audioInput.files = dt.files;
          audioInput.dispatchEvent(new Event("change"));
        }
      }
    });
  }

  // 8. Combat Attack Toggles + Custom CSS Tooltips
  const attackListEl = document.getElementById("attackToggleList");
  const attackCountEl = document.getElementById("attackEnabledCount");

  const renderAttackToggles = () => {
    if (!attackListEl) return;
    const disabled = state.disabledAttacks || {};
    const enabledCount = ATTACK_CATALOG.filter(a => !disabled[a.id]).length;
    if (attackCountEl) attackCountEl.textContent = `${enabledCount}/${ATTACK_CATALOG.length}`;

    attackListEl.innerHTML = "";
    ATTACK_CATALOG.forEach((atk) => {
      const isEnabled = !disabled[atk.id];
      const row = document.createElement("div");
      row.className = `flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition ${
        isEnabled
          ? "bg-[#070917] border-slate-700/80"
          : "bg-[#070917]/50 border-slate-800/50 opacity-60"
      }`;

      const label = document.createElement("label");
      label.className = "flex-1 min-w-0 flex items-center gap-2 cursor-pointer";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = isEnabled;
      chk.className = "accent-[#00F0FF] w-3.5 h-3.5 rounded cursor-pointer shrink-0";
      chk.addEventListener("change", () => {
        if (chk.checked) delete state.disabledAttacks[atk.id];
        else state.disabledAttacks[atk.id] = true;
        savePrefs();
        renderAttackToggles();
      });

      const icon = document.createElement("span");
      icon.className = "text-xs shrink-0";
      icon.textContent = atk.icon;

      const name = document.createElement("span");
      name.className = "text-[11px] font-medium text-slate-200 truncate";
      name.textContent = atk.name;

      label.appendChild(chk);
      label.appendChild(icon);
      label.appendChild(name);

      // Dedicated CSS Tooltip Component
      const tip = document.createElement("div");
      tip.className = "jsab-tooltip shrink-0";
      tip.innerHTML = `<button type="button" class="jsab-tooltip-trigger" aria-label="Descripción">?</button><div class="jsab-tooltip-box"><strong>${atk.icon} ${atk.name}</strong><br>${atk.desc}</div>`;

      row.appendChild(label);
      row.appendChild(tip);
      attackListEl.appendChild(row);
    });
  };

  document.getElementById("btnEnableAllAttacks")?.addEventListener("click", () => {
    state.disabledAttacks = {};
    savePrefs();
    renderAttackToggles();
    showToast("Todos los ataques habilitados", "success");
  });

  document.getElementById("btnDisableAllAttacks")?.addEventListener("click", () => {
    state.disabledAttacks = {};
    ATTACK_CATALOG.forEach(a => { state.disabledAttacks[a.id] = true; });
    savePrefs();
    renderAttackToggles();
    showToast("Todos los ataques deshabilitados", "info");
  });

  renderAttackToggles();
  initYoutubeStudioControls(showToast, hooks, savePrefs);
}
