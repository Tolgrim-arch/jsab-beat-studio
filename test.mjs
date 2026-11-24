import assert from "node:assert/strict";
import { state, resetWorldEntities } from "./src/state.js";
import { analyzeAudioBuffer } from "./src/audio/analyzer.js";
import { buildChoreographySchedule, spawnSetpieceEvent } from "./src/combat/choreography.js";
import { updateCyanAI } from "./src/combat/cyanAI.js";
import { renderFrame } from "./src/render/renderer.js";

// Lightweight mock Canvas 2D context for headless render verification
const noop = () => {};
const mockCtx = new Proxy({}, {
  get: (_, prop) => (prop === "measureText" ? () => ({ width: 50 }) : noop)
});

// 1. Synthetic audio buffer (10s @ 44.1kHz, 128 BPM pulse)
const sr = 44100;
const duration = 10;
const len = sr * duration;
const ch = new Float32Array(len);
const beatSamples = Math.floor(sr * (60 / 128));
for (let i = 0; i < len; i++) {
  const pos = i % beatSamples;
  const env = Math.exp(-pos / 2500);
  ch[i] = Math.sin(i * 0.03) * env * 0.85;
}
const fakeBuffer = { sampleRate: sr, duration, numberOfChannels: 1, getChannelData: () => ch };

// 2. Test Audio Analysis & Song DNA
state.duration = duration;
state.analysis = analyzeAudioBuffer(fakeBuffer);
assert.ok(state.analysis.bpm >= 70 && state.analysis.bpm <= 190, "BPM out of range");
assert.ok(state.analysis.dna?.boss?.shape, "Missing procedural Boss DNA");
assert.ok(state.analysis.beats.length > 5, "Too few beats detected");

// 3. Test Choreography Schedule & Spawning
state.schedule = buildChoreographySchedule();
assert.ok(state.schedule.length > 0, "Empty choreography schedule");
resetWorldEntities();

for (const ev of state.schedule.slice(0, 12)) {
  spawnSetpieceEvent(ev, null);
}
assert.ok(state.entities.length > 0, "No attack entities spawned");

// 4. Test Simulation + Cyan AI + Full Render Loop
for (let frame = 0; frame < 10; frame++) {
  state.currentTime += 1 / 60;
  for (const ent of state.entities) ent.update(1 / 60, state.width, state.height);
  updateCyanAI(1 / 60);
  renderFrame(mockCtx);
}

console.log(
  `ALL TESTS PASSED | BPM: ${state.analysis.bpm} | Boss: ${state.analysis.dna.boss.shape} | ` +
  `Events: ${state.schedule.length} | Active Entities: ${state.entities.length}`
);
