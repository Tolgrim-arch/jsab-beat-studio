import { state } from "../state.js";
import {
  extractPaletteFromImage,
  loadBossFromUrl,
  captureThumbnail,
  applyStylePreset,
  exportStudioPresetObject,
  applyStudioPresetObject,
  savePresetToStorage,
  loadPresetFromStorage
} from "../studio/creatorTools.js";

export function initYoutubeStudioControls(showToast, hooks = {}, savePrefs = () => {}) {
  const $ = (id) => document.getElementById(id);

  // Helper to sync UI inputs from current state (used after loading presets)
  const syncStudioUIFromState = () => {
    const s = state.settings;
    const cb = state.customBoss;
    const st = state.studio;

    if ($("toggleGifAnimate")) $("toggleGifAnimate").checked = cb.gifAnimate !== false;
    if ($("toggleGifBpmSync")) $("toggleGifBpmSync").checked = cb.gifBpmSync !== false;
    if ($("sliderGifSpeed")) $("sliderGifSpeed").value = cb.gifSpeed ?? 1.0;
    if ($("valGifSpeed")) $("valGifSpeed").textContent = `${(cb.gifSpeed ?? 1.0).toFixed(1)}x`;
    if ($("toggleAutoPalette")) $("toggleAutoPalette").checked = !!cb.autoPalette;

    if ($("toggleBiomeBg")) $("toggleBiomeBg").checked = s.biomeBgEnabled !== false;
    if ($("selectBiomeBgStyle")) $("selectBiomeBgStyle").value = s.biomeBgStyle || "auto";
    if ($("selectYoutubeBiomeBg")) $("selectYoutubeBiomeBg").value = s.biomeBgStyle || "auto";
    if ($("sliderBiomeBgInt")) $("sliderBiomeBgInt").value = s.biomeBgIntensity ?? 0.75;
    if ($("valBiomeBgInt")) $("valBiomeBgInt").textContent = `${Math.round((s.biomeBgIntensity ?? 0.75) * 100)}%`;

    if ($("selectExportFps")) $("selectExportFps").value = String(s.exportFps || 60);
    if ($("selectExportBitrate")) $("selectExportBitrate").value = String(s.exportBitrateMbps || 12);
    if ($("exportQualityBadge")) $("exportQualityBadge").textContent = `WebM ${s.exportFps || 60}fps • ${s.exportBitrateMbps || 12}M`;

    if ($("toggleClipRange")) $("toggleClipRange").checked = !!st.clip.enabled;
    if ($("inputClipStart")) $("inputClipStart").value = st.clip.start ?? 0;
    if ($("inputClipEnd")) $("inputClipEnd").value = st.clip.end ?? 35;

    if ($("toggleCommentCard")) $("toggleCommentCard").checked = !!st.commentCard.enabled;
    if ($("inputCommentUser")) $("inputCommentUser").value = st.commentCard.user || "";
    if ($("inputCommentText")) $("inputCommentText").value = st.commentCard.text || "";
    if ($("selectCommentPos")) $("selectCommentPos").value = st.commentCard.position || "top-left";
    if ($("inputCommentDur")) $("inputCommentDur").value = st.commentCard.duration ?? 4.5;

    if ($("toggleVsIntro")) $("toggleVsIntro").checked = !!st.vsIntro.enabled;
    if ($("inputVsBossName")) $("inputVsBossName").value = st.vsIntro.bossName || "";
    if ($("inputVsSongTitle")) $("inputVsSongTitle").value = st.vsIntro.songTitle || "";
    if ($("inputVsDur")) $("inputVsDur").value = st.vsIntro.duration ?? 2.4;

    if ($("toggleBossBar")) $("toggleBossBar").checked = !!st.bossBar.enabled;
    if ($("toggleNearMiss")) $("toggleNearMiss").checked = st.bossBar.showNearMiss !== false;
    if ($("selectBossBarPos")) $("selectBossBarPos").value = st.bossBar.position || "top";

    if ($("toggleEndCta")) $("toggleEndCta").checked = !!st.endCta.enabled;
    if ($("inputEndCtaText")) $("inputEndCtaText").value = st.endCta.text || "";
    if ($("inputEndCtaSub")) $("inputEndCtaSub").value = st.endCta.subtext || "";
    if ($("inputEndCtaDur")) $("inputEndCtaDur").value = st.endCta.duration ?? 3.5;

    if ($("toggleThumbText")) $("toggleThumbText").checked = st.thumbnail.showText !== false;
    if ($("inputThumbTitle")) $("inputThumbTitle").value = st.thumbnail.title || "";
    if ($("inputThumbSub")) $("inputThumbSub").value = st.thumbnail.subtitle || "";

    // Also sync Phonk/Touhou toggles if present in FX tab
    if ($("togglePhonkMode")) $("togglePhonkMode").checked = !!s.phonkMode;
    if ($("toggleTouhouMode")) $("toggleTouhouMode").checked = !!s.touhouMode;
  };

  // 1. GIF Animation & Auto-Palette
  $("toggleGifAnimate")?.addEventListener("change", (e) => {
    state.customBoss.gifAnimate = e.target.checked;
    savePrefs();
  });
  $("toggleGifBpmSync")?.addEventListener("change", (e) => {
    state.customBoss.gifBpmSync = e.target.checked;
    savePrefs();
  });
  $("sliderGifSpeed")?.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value) || 1.0;
    state.customBoss.gifSpeed = v;
    if ($("valGifSpeed")) $("valGifSpeed").textContent = `${v.toFixed(1)}x`;
    savePrefs();
  });
  $("toggleAutoPalette")?.addEventListener("change", (e) => {
    state.customBoss.autoPalette = e.target.checked;
    if (e.target.checked && state.customBoss.img) {
      const pal = extractPaletteFromImage(state.customBoss.img);
      if (pal) showToast("🎨 Auto-Paleta aplicada desde el Boss", "success");
    }
    savePrefs();
  });
  $("btnExtractPaletteNow")?.addEventListener("click", () => {
    if (!state.customBoss.img) {
      showToast("Carga primero una imagen o GIF del Boss", "info");
      return;
    }
    const pal = extractPaletteFromImage(state.customBoss.img);
    if (pal) {
      savePrefs();
      showToast("🎨 Paleta extraída del Boss y aplicada", "success");
    } else {
      showToast("No se pudieron extraer colores (posible bloqueo CORS)", "error");
    }
  });

  // 2. Reactive Biome Background
  $("toggleBiomeBg")?.addEventListener("change", (e) => {
    state.settings.biomeBgEnabled = e.target.checked;
    savePrefs();
  });
  $("selectBiomeBgStyle")?.addEventListener("change", (e) => {
    state.settings.biomeBgStyle = e.target.value;
    state.settings.biomeBgEnabled = e.target.value !== "flat";
    if ($("toggleBiomeBg")) $("toggleBiomeBg").checked = state.settings.biomeBgEnabled;
    if ($("selectYoutubeBiomeBg")) $("selectYoutubeBiomeBg").value = e.target.value;
    savePrefs();
  });
  $("selectYoutubeBiomeBg")?.addEventListener("change", (e) => {
    state.settings.biomeBgStyle = e.target.value;
    state.settings.biomeBgEnabled = e.target.value !== "flat";
    if ($("toggleBiomeBg")) $("toggleBiomeBg").checked = state.settings.biomeBgEnabled;
    if ($("selectBiomeBgStyle")) $("selectBiomeBgStyle").value = e.target.value;
    savePrefs();
  });
  $("sliderBiomeBgInt")?.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value) || 0;
    state.settings.biomeBgIntensity = v;
    if ($("valBiomeBgInt")) $("valBiomeBgInt").textContent = `${Math.round(v * 100)}%`;
    savePrefs();
  });

  // 2b. Sincronización Musical Pro toggles
  $("toggleSubdivisionSync")?.addEventListener("change", (e) => {
    state.settings.subdivisionSync = e.target.checked;
    savePrefs();
  });
  $("togglePreDropFreeze")?.addEventListener("change", (e) => {
    state.settings.preDropFreeze = e.target.checked;
    savePrefs();
  });
  $("toggleMelodicSync")?.addEventListener("change", (e) => {
    state.settings.melodicSync = e.target.checked;
    savePrefs();
  });
  $("toggleAutoLatencyComp")?.addEventListener("change", (e) => {
    state.settings.autoLatencyComp = e.target.checked;
    savePrefs();
  });

  // 3. Export Quality (FPS / Bitrate)
  const updateExportBadge = () => {
    if ($("exportQualityBadge")) {
      $("exportQualityBadge").textContent = `WebM ${state.settings.exportFps || 60}fps • ${state.settings.exportBitrateMbps || 12}M`;
    }
  };
  $("selectExportFps")?.addEventListener("change", (e) => {
    state.settings.exportFps = parseInt(e.target.value, 10) || 60;
    updateExportBadge();
    savePrefs();
  });
  $("selectExportBitrate")?.addEventListener("change", (e) => {
    state.settings.exportBitrateMbps = parseInt(e.target.value, 10) || 12;
    updateExportBadge();
    savePrefs();
  });

  // 4. 1-Click Style Presets & JSON Persistence
  document.querySelectorAll("[data-style-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = applyStylePreset(btn.dataset.stylePreset, hooks.setAspect);
      if (p) {
        syncStudioUIFromState();
        hooks.redrawTimeline?.();
        savePrefs();
        showToast(`⚡ Preset aplicado: ${p.label}`, "success");
      }
    });
  });

  $("btnSaveLocalPreset")?.addEventListener("click", () => {
    if (savePresetToStorage()) showToast("💾 Preset guardado en el navegador", "success");
    else showToast("No se pudo guardar el preset", "error");
  });
  $("btnLoadLocalPreset")?.addEventListener("click", () => {
    if (loadPresetFromStorage(hooks.setAspect)) {
      syncStudioUIFromState();
      hooks.redrawTimeline?.();
      showToast("📂 Preset cargado", "success");
    } else {
      showToast("No hay ningún preset guardado aún", "info");
    }
  });
  $("btnExportJsonPreset")?.addEventListener("click", () => {
    const data = JSON.stringify(exportStudioPresetObject(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jsab_preset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("⬇ Preset JSON exportado", "success");
  });
  $("inputImportJsonPreset")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      applyStudioPresetObject(obj, hooks.setAspect);
      syncStudioUIFromState();
      hooks.redrawTimeline?.();
      showToast("⬆ Preset JSON importado", "success");
    } catch {
      showToast("Archivo JSON inválido", "error");
    }
    e.target.value = "";
  });

  // 5. Clip In / Out (Shorts)
  $("toggleClipRange")?.addEventListener("change", (e) => {
    state.studio.clip.enabled = e.target.checked;
    hooks.redrawTimeline?.();
  });
  $("inputClipStart")?.addEventListener("input", (e) => {
    state.studio.clip.start = Math.max(0, parseFloat(e.target.value) || 0);
    hooks.redrawTimeline?.();
  });
  $("inputClipEnd")?.addEventListener("input", (e) => {
    state.studio.clip.end = Math.max(1, parseFloat(e.target.value) || 35);
    hooks.redrawTimeline?.();
  });
  $("btnMarkClipStart")?.addEventListener("click", () => {
    const t = Math.floor(state.currentTime || 0);
    state.studio.clip.start = t;
    state.studio.clip.enabled = true;
    if ($("inputClipStart")) $("inputClipStart").value = t;
    if ($("toggleClipRange")) $("toggleClipRange").checked = true;
    hooks.redrawTimeline?.();
    showToast(`✂️ Inicio de clip fijado en ${t}s`, "info");
  });
  $("btnMarkClipEnd")?.addEventListener("click", () => {
    const t = Math.max(1, Math.ceil(state.currentTime || 35));
    state.studio.clip.end = t;
    state.studio.clip.enabled = true;
    if ($("inputClipEnd")) $("inputClipEnd").value = t;
    if ($("toggleClipRange")) $("toggleClipRange").checked = true;
    hooks.redrawTimeline?.();
    showToast(`✂️ Fin de clip fijado en ${t}s`, "info");
  });

  // 6. Retention Overlays
  $("toggleCommentCard")?.addEventListener("change", (e) => { state.studio.commentCard.enabled = e.target.checked; });
  $("inputCommentUser")?.addEventListener("input", (e) => { state.studio.commentCard.user = e.target.value; });
  $("inputCommentText")?.addEventListener("input", (e) => { state.studio.commentCard.text = e.target.value; });
  $("selectCommentPos")?.addEventListener("change", (e) => { state.studio.commentCard.position = e.target.value; });
  $("inputCommentDur")?.addEventListener("input", (e) => { state.studio.commentCard.duration = Math.max(0.5, parseFloat(e.target.value) || 4.5); });

  $("toggleVsIntro")?.addEventListener("change", (e) => { state.studio.vsIntro.enabled = e.target.checked; });
  $("inputVsBossName")?.addEventListener("input", (e) => { state.studio.vsIntro.bossName = e.target.value; });
  $("inputVsSongTitle")?.addEventListener("input", (e) => { state.studio.vsIntro.songTitle = e.target.value; });
  $("inputVsDur")?.addEventListener("input", (e) => { state.studio.vsIntro.duration = Math.max(0.5, parseFloat(e.target.value) || 2.4); });

  $("toggleBossBar")?.addEventListener("change", (e) => { state.studio.bossBar.enabled = e.target.checked; });
  $("toggleNearMiss")?.addEventListener("change", (e) => { state.studio.bossBar.showNearMiss = e.target.checked; });
  $("selectBossBarPos")?.addEventListener("change", (e) => { state.studio.bossBar.position = e.target.value; });

  $("toggleEndCta")?.addEventListener("change", (e) => { state.studio.endCta.enabled = e.target.checked; });
  $("inputEndCtaText")?.addEventListener("input", (e) => { state.studio.endCta.text = e.target.value; });
  $("inputEndCtaSub")?.addEventListener("input", (e) => { state.studio.endCta.subtext = e.target.value; });
  $("inputEndCtaDur")?.addEventListener("input", (e) => { state.studio.endCta.duration = Math.max(1, parseFloat(e.target.value) || 3.5); });

  // 7. Thumbnail Generator
  $("toggleThumbText")?.addEventListener("change", (e) => { state.studio.thumbnail.showText = e.target.checked; });
  $("inputThumbTitle")?.addEventListener("input", (e) => { state.studio.thumbnail.title = e.target.value; });
  $("inputThumbSub")?.addEventListener("input", (e) => { state.studio.thumbnail.subtitle = e.target.value; });
  $("btnCaptureThumbnail")?.addEventListener("click", () => {
    captureThumbnail(hooks.canvas, showToast);
  });

  // 8. Batch Render Queue
  const renderBatchList = () => {
    const list = $("batchQueueList");
    const countEl = $("batchQueueCount");
    if (countEl) countEl.textContent = `${state.batchQueue.length} en cola`;
    if (!list) return;
    list.innerHTML = "";
    state.batchQueue.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-[#070917] border border-slate-800 text-[9px]";
      row.innerHTML = `<span class="truncate text-slate-200">${idx + 1}. <strong>${item.bossName || "Boss"}</strong> — ${item.audioFile.name}</span>`;
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "✕";
      del.className = "text-rose-400 hover:text-rose-300 cursor-pointer px-1";
      del.addEventListener("click", () => {
        state.batchQueue.splice(idx, 1);
        renderBatchList();
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  };

  $("btnAddBatchItem")?.addEventListener("click", () => {
    const audioInput = $("batchAudioInput");
    const file = audioInput?.files?.[0];
    if (!file) {
      showToast("Selecciona un archivo de audio para añadir a la cola", "error");
      return;
    }
    state.batchQueue.push({
      audioFile: file,
      bossUrl: ($("batchBossUrl")?.value || "").trim(),
      bossName: ($("batchBossName")?.value || "").trim() || file.name.replace(/\.[^.]+$/, ""),
      commentText: ($("batchCommentText")?.value || "").trim()
    });
    audioInput.value = "";
    if ($("batchBossUrl")) $("batchBossUrl").value = "";
    if ($("batchBossName")) $("batchBossName").value = "";
    if ($("batchCommentText")) $("batchCommentText").value = "";
    renderBatchList();
    showToast("➕ Video añadido a la cola de render", "success");
  });

  $("btnClearBatchQueue")?.addEventListener("click", () => {
    if (state.batchRunning) return;
    state.batchQueue = [];
    renderBatchList();
    showToast("Cola limpiada", "info");
  });

  $("btnRunBatchQueue")?.addEventListener("click", async () => {
    if (state.batchRunning) return;
    if (!state.batchQueue.length) {
      showToast("La cola está vacía", "info");
      return;
    }
    state.batchRunning = true;
    const total = state.batchQueue.length;
    showToast(`🏭 Iniciando render en masa (${total} videos)...`, "success");

    const processNext = async (index) => {
      if (index >= state.batchQueue.length) {
        state.batchRunning = false;
        showToast(`✅ Cola completada (${total} videos exportados)`, "success");
        return;
      }
      const item = state.batchQueue[index];
      showToast(`🎬 Renderizando ${index + 1}/${total}: ${item.bossName}`, "info");

      if (item.bossUrl) {
        try {
          const res = await loadBossFromUrl(item.bossUrl);
          if (state.customBoss.autoPalette && res?.img) extractPaletteFromImage(res.img);
        } catch {
          showToast(`Aviso: No se pudo cargar el GIF de ${item.bossName}`, "error");
        }
      }
      if (item.bossName) {
        state.studio.vsIntro.bossName = item.bossName;
        if ($("inputVsBossName")) $("inputVsBossName").value = item.bossName;
      }
      if (item.commentText) {
        state.studio.commentCard.text = item.commentText;
        if ($("inputCommentText")) $("inputCommentText").value = item.commentText;
      }

      const loaded = await hooks.loadAudioFile?.(item.audioFile);
      if (!loaded) {
        processNext(index + 1);
        return;
      }

      setTimeout(() => {
        hooks.startRecordingFullTrack?.(`batch_${index + 1}_${item.bossName}`, () => {
          setTimeout(() => processNext(index + 1), 600);
        });
      }, 350);
    };

    processNext(0);
  });

  syncStudioUIFromState();
}
