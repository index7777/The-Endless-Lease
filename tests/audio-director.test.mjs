import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("ships and maps all nine Hong-Yi voice recordings", async () => {
  const [game, files] = await Promise.all([
    readFile(new URL("../app/game.tsx", import.meta.url), "utf8"),
    readdir(new URL("../public/audio/voice/hongyi/", import.meta.url)),
  ]);
  assert.deepEqual(files.sort(), Array.from({ length: 9 }, (_, index) => `demo${String(index).padStart(2, "0")}.mp3`));
  for (const number of [0, 1, 2]) assert.match(game, new RegExp(`playVoice\\(${number}`));
  assert.match(game, /playVoice\(firstAttempt \? 3 : 4\)/);
  assert.match(game, /playVoice\(5 \+ managementDialogueStep\)/);
  assert.doesNotMatch(game, /SpeechSynthesisUtterance|speechSynthesis\.speak/);
});

test("keeps the title soundscape non-musical and independently randomized", async () => {
  const ambient = await readFile(new URL("../app/game/title-ambient.ts", import.meta.url), "utf8");
  assert.match(ambient, /createDrone\(\)/);
  assert.match(ambient, /createAirConditioner\(\)/);
  assert.match(ambient, /createFluorescentHum\(\)/);
  assert.match(ambient, /randomBetween\(20000, 60000\)/);
  assert.match(ambient, /randomBetween\(40000, 90000\)/);
  assert.match(ambient, /randomBetween\(15000, 35000\)/);
  assert.match(ambient, /playPianoNote\(261\.63/);
  assert.match(ambient, /playPianoNote\(329\.63/);
});
