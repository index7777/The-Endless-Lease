import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getEnemyAnimationExposureMultiplier, getPlayerAnimationExposureMultiplier, resolveSceneLightingContext, sampleCharacterLighting, sampleSceneColorGrade, toCharacterCanvasFilter } from "../app/game/presentation-profiles.ts";

const source = await readFile(new URL("../app/game/presentation-profiles.ts", import.meta.url), "utf8");
const gameSource = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
test("defines shared lighting, time, character and UI profiles", () => {
  for (const token of ["daylight","evening","curfew_night","uncanny_dawn","hallway_fluorescent","CHARACTER_LIGHTING_PROFILES","sampleCharacterLighting","UI_THEME"]) assert.match(source, new RegExp(token));
  for (const obsolete of ["morning", "deep_night", "720 - secondsRemaining"]) assert.doesNotMatch(source, new RegExp(obsolete));
});

test("resolves dedicated lighting contexts instead of treating every interior as the same room", () => {
  assert.equal(resolveSceneLightingContext("room", { managementOffice: true }), "management");
  assert.equal(resolveSceneLightingContext("room", { clinic: true }), "clinic");
  assert.equal(resolveSceneLightingContext("hallway", { activeBoss: "boss_b1" }), "b1");
  assert.equal(resolveSceneLightingContext("hallway", { activeBoss: "boss_b2" }), "b2");
  assert.equal(resolveSceneLightingContext("elevator"), "elevator");
});

test("samples actual practical-light distance and clamps exposure below the pasted-on range", () => {
  const underLight = sampleCharacterLighting("hallway", .51, 720);
  const betweenLights = sampleCharacterLighting("hallway", .66, 720);
  const lateNight = sampleCharacterLighting("hallway", .51, 30);
  assert.ok(underLight.exposure > betweenLights.exposure);
  assert.ok(underLight.exposure <= .91);
  assert.ok(lateNight.exposure < underLight.exposure);
  assert.ok(lateNight.shadowOpacity > underLight.shadowOpacity);
  assert.notEqual(underLight.shadowOffsetX, betweenLights.shadowOffsetX);
});

test("builds one bounded canvas filter for every character animation state", () => {
  const sample = sampleCharacterLighting("b2", .4, 120);
  const filter = toCharacterCanvasFilter(sample);
  assert.match(filter, /^brightness\([\d.]+\) contrast\([\d.]+\) saturate\([\d.]+\) grayscale\([\d.]+\) sepia\([\d.]+\) hue-rotate\(-?\d+deg\) blur\([\d.]+px\)$/);
  assert.ok(sample.exposure >= .43 && sample.exposure <= .7);
  assert.ok(sample.blackPoint >= .08 && sample.blackPoint <= .28);
});

test("late hallway lighting never paints skin cyan or makes it self-luminous", () => {
  const lateHallway = sampleCharacterLighting("hallway", .46, 110);
  const underFixture = sampleCharacterLighting("hallway", .51, 110);
  assert.equal(lateHallway.hueRotateDeg, -14);
  assert.equal(lateHallway.sepia, .2);
  assert.equal(lateHallway.colorNeutralization, .84);
  assert.ok(lateHallway.exposure <= .72);
  assert.ok(underFixture.exposure <= .74);
  assert.ok(lateHallway.saturation <= .7);
});

test("normalizes baked exposure between player animation sheets", () => {
  assert.equal(getPlayerAnimationExposureMultiplier("male", "idle"), 1);
  assert.ok(getPlayerAnimationExposureMultiplier("male", "walk") < .9);
  assert.ok(getPlayerAnimationExposureMultiplier("male", "walk") <= .76);
  assert.ok(getPlayerAnimationExposureMultiplier("male", "attack") < 1);
  assert.ok(getPlayerAnimationExposureMultiplier("female", "walk") < 1);
  const lighting = sampleCharacterLighting("hallway", .5, 110);
  const idle = toCharacterCanvasFilter(lighting, getPlayerAnimationExposureMultiplier("male", "idle"));
  const walking = toCharacterCanvasFilter(lighting, getPlayerAnimationExposureMultiplier("male", "walk"));
  assert.notEqual(idle, walking);
});

test("normalizes every enemy candidate-sheet state against its idle exposure", () => {
  assert.equal(getEnemyAnimationExposureMultiplier("idle"), 1);
  for (const pose of ["walk", "attack", "hit", "death"]) {
    const multiplier = getEnemyAnimationExposureMultiplier(pose);
    assert.ok(multiplier < 1, `${pose} must compensate brighter baked frames`);
    assert.ok(multiplier >= .8, `${pose} must remain readable`);
  }
});

test("applies one scene-level color grade after backgrounds and characters are composed", () => {
  const room = sampleSceneColorGrade("room", 360);
  const b2 = sampleSceneColorGrade("b2", 110);
  assert.notDeepEqual(room.multiply, b2.multiply);
  assert.ok(b2.multiplyOpacity > room.multiplyOpacity);
  assert.ok(room.multiply[0] > room.multiply[2], "room grade remains warm");
  assert.ok(b2.multiply[0] >= b2.multiply[2], "B2 grade neutralizes cyan while retaining the scene art's cool base");
  const actorDraw = gameSource.indexOf("if (playerImage.complete) ctx.drawImage");
  const gradeDraw = gameSource.indexOf("const sceneGrade = sampleSceneColorGrade");
  const statusEffects = gameSource.indexOf("if (g.debtMode)");
  const resizeEffect = gameSource.indexOf("const updateDesktopScale");
  assert.ok(actorDraw < gradeDraw && gradeDraw < statusEffects, "scene grade must cover the composed world and actors before status effects");
  assert.ok(gradeDraw < resizeEffect, "scene grade must run inside the animation draw loop, never the resize effect");
});
