import assert from "node:assert/strict";
import test from "node:test";
import { effectiveVolume, parseAudioLevels } from "../app/game/audio-settings.ts";

test("master multiplies every independent audio channel", () => {
  const levels = { master: 50, sfx: 80, music: 60, voice: 40 };
  assert.equal(effectiveVolume(levels, "sfx", false), .4);
  assert.equal(effectiveVolume(levels, "music", false), .3);
  assert.equal(effectiveVolume(levels, "voice", false), .2);
  assert.equal(effectiveVolume(levels, "voice", true), 0);
});

test("saved audio levels are clamped and malformed settings reset safely", () => {
  assert.deepEqual(parseAudioLevels('{"master":120,"sfx":-3,"music":55,"voice":80}'), { master:100, sfx:0, music:55, voice:80 });
  assert.deepEqual(parseAudioLevels("broken"), { master:100, sfx:100, music:100, voice:100 });
});
