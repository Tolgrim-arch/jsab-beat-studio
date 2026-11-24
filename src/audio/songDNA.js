import { Utils } from "../utils.js";

/**
 * Generates a unique, deterministic procedural Song DNA from audio analysis.
 * Controls Boss morphology, visual biome, color accents, and combat style.
 */
export function generateSongDNA(analysis, duration) {
  const { bpm, profile, archetype } = analysis;
  const seed = Math.floor(
    bpm * 1009 +
    profile.avgBass * 7919 +
    profile.avgHigh * 6271 +
    profile.avgRms * 4999 +
    duration * 131
  );
  const rng = Utils.seededRandom(seed);

  // Determine base boss morphology from musical archetype
  const shapeByArchetype = {
    TITAN_CRUSHER: "titan",       // Annihilate / Blixer horned beast
    HYPER_BARRAGE: "pyramid",     // Barracuda triangle/pyramid
    CLOCKWORK_SYNTH: "gear",      // Close To Me saw/gear heart
    ABYSSAL_ECLIPSE: "blossom"    // Lycanthropy / Abyssal spiky flower
  };
  const bossShape = shapeByArchetype[archetype.id] || "titan";

  // Procedural Boss traits (never identical between two songs!)
  const eyeStyles = ["angry", "cyclops", "visor", "triple", "x_eyes"];
  const crownStyles = ["horns", "halo_spikes", "floating_shards", "saw_crown", "none"];
  const limbStyles = ["claws", "orbit_cannons", "tendrils", "floating_triangles"];

  const boss = {
    shape: bossShape,
    eyeStyle: bossShape === "pyramid" ? "cyclops" : eyeStyles[Math.floor(rng() * eyeStyles.length)],
    crownStyle: crownStyles[Math.floor(rng() * crownStyles.length)],
    limbStyle: limbStyles[Math.floor(rng() * limbStyles.length)],
    spikeCount: 5 + Math.floor(rng() * 7), // 5 to 11
    innerDetail: Math.floor(rng() * 3),    // 0: core ring, 1: equalizer mouth, 2: geometric sigil
    orbitSpeed: (rng() > 0.5 ? 1 : -1) * (0.7 + rng() * 0.9)
  };

  // Procedural JSAB-faithful color palette (high-contrast pink/crimson/magenta danger hues)
  const palettes = [
    { name: "CORRUPT PINK",   danger: "#FF1F71", hot: "#FF66A1", bg: "#070412", grid: "rgba(255, 31, 113, " },
    { name: "NEON CRIMSON",   danger: "#FF004D", hot: "#FF5588", bg: "#0d030a", grid: "rgba(255, 0, 77, " },
    { name: "HYPER MAGENTA",  danger: "#FF1493", hot: "#FF77C6", bg: "#090418", grid: "rgba(255, 20, 147, " },
    { name: "ABYSSAL ROSE",   danger: "#E0115F", hot: "#FF4D8D", bg: "#050614", grid: "rgba(224, 17, 95, " },
    { name: "PLASMA FUCHSIA", danger: "#F72585", hot: "#FF70B8", bg: "#0b041c", grid: "rgba(247, 37, 133, " }
  ];
  const palette = palettes[Math.floor(rng() * palettes.length)];

  // Procedural Biome
  const biomes = ["seismic", "tunnel", "perspective", "vortex", "starfield"];
  const biome = archetype.bgStyle || biomes[Math.floor(rng() * biomes.length)];

  // Projectile flavor
  const bulletShapes = ["circle", "diamond", "triangle", "square"];
  const primaryBullet = bulletShapes[Math.floor(rng() * bulletShapes.length)];

  return {
    seed,
    boss,
    palette,
    biome,
    primaryBullet,
    signatureLabel: `${boss.shape.toUpperCase()} • ${boss.eyeStyle.toUpperCase()}`
  };
}
