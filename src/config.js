export const COLORS = {
  bg: "#060714",
  cyan: "#00F0FF",
  pink: "#FF1F71",
  pinkHot: "#FF4D8D",
  yellow: "#FFD166",
  purple: "#9D4EDD",
  white: "#FFFFFF"
};

export const ASPECT_PRESETS = {
  "16:9":    { w: 1280, h: 720,  label: "1280×720" },
  "16:9-hd": { w: 1920, h: 1080, label: "1920×1080" },
  "9:16":    { w: 720,  h: 1280, label: "720×1280" },
  "9:16-hd": { w: 1080, h: 1920, label: "1080×1920" },
  "1:1":     { w: 1080, h: 1080, label: "1080×1080" }
};

export const PHASES = [
  { id: 1, name: "SEMILLA CORRUPTA",  speedMul: 1.0,  scale: 0.95 },
  { id: 2, name: "OVERDRIVE",         speedMul: 1.18, scale: 1.12 },
  { id: 3, name: "ANNIHILATE TITAN",  speedMul: 1.38, scale: 1.28 },
  { id: 4, name: "HIPERNOVA FINAL",   speedMul: 1.55, scale: 1.42 }
];

export const ARCHETYPES = {
  TITAN_CRUSHER: {
    id: "TITAN_CRUSHER",
    label: "ANNIHILATE / TITAN",
    bgStyle: "seismic",
    bgTint: "#120411",
    gridColor: "rgba(255, 31, 113, ",
    setpieces: ["TWIN_HAND_SMASH", "HYDRAULIC_CRUSH", "DROP_EXPLOSION", "CHECKERBOARD_DANCE", "MEGA_MOUTH_BEAM"]
  },
  HYPER_BARRAGE: {
    id: "HYPER_BARRAGE",
    label: "BARRACUDA / HYPER",
    bgStyle: "tunnel",
    bgTint: "#06081a",
    gridColor: "rgba(255, 45, 130, ",
    setpieces: ["BARRACUDA_SWARM", "MANDALA_BLOOM", "SAWBLADE_GAUNTLET", "WAVE_CORRIDOR", "CLOCKWORK_LASERS"]
  },
  CLOCKWORK_SYNTH: {
    id: "CLOCKWORK_SYNTH",
    label: "CLOSE TO ME / SYNTH",
    bgStyle: "perspective",
    bgTint: "#0c061f",
    gridColor: "rgba(180, 60, 255, ",
    setpieces: ["CLOSE_TO_ME_ORBS", "CLOCKWORK_LASERS", "CHECKERBOARD_DANCE", "WAVE_CORRIDOR", "MANDALA_BLOOM"]
  },
  ABYSSAL_ECLIPSE: {
    id: "ABYSSAL_ECLIPSE",
    label: "LYCANTHROPY / ABYSS",
    bgStyle: "vortex",
    bgTint: "#090414",
    gridColor: "rgba(255, 0, 90, ",
    setpieces: ["LYCANTHROPY_VINES", "BUILDUP_LOCKON", "ORB_RAIN", "HYDRAULIC_CRUSH", "BREAKDOWN_PULSE"]
  }
};
