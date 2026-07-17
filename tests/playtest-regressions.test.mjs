import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
const navigation = await readFile(new URL("../app/game/scene-navigation.ts", import.meta.url), "utf8");

test("keeps the thirty-minute demo clock and three-second medicine cooldown", () => {
  assert.match(game, /DAY_DURATION_SECONDS = 1800/);
  assert.match(game, /setMedkitCooldown\(3\)/);
});

test("ships candidate motion, attack, hit and collapse sheets for players and enemies", async () => {
  const files = [
    "player-male-walk-v1.png", "player-male-attack-v1.png",
    "player-female-walk-v1.png", "player-female-attack-v1.png",
    "wall-resident-move-attack-v1.png", "wall-resident-hit-die-v1.png",
    "light-warden-states-24fps-v1.png", "receipt-collector-states-24fps-v1.png",
    "rent-pursuer-states-24fps-v1.png", "boss-b1-states-24fps-v1.png", "boss-b2-states-24fps-v1.png",
  ];
  for (const file of files) {
    const info = await stat(new URL(`../public/animations/${file}`, import.meta.url));
    assert.ok(info.size > 100_000, `${file} must contain real frame art`);
    assert.match(game, new RegExp(file.replaceAll(".", "\\.")));
  }
  assert.match(game, /deathTimer/);
  assert.match(game, /rewardGranted/);
});

test("keeps room, clinic and elevator movement inside world collision profiles", () => {
  assert.match(navigation, /RoomCollisionProfile = "home" \| "clinic" \| "management"/);
  assert.match(navigation, /CLINIC_COLLIDERS/);
  assert.match(navigation, /worldWidth \* \.085/);
  assert.match(game, /location === "elevator" \? 128/);
  assert.match(game, /location === "elevator" \? 812/);
});

test("keeps management independent and preserves the terminal ending", () => {
  assert.match(game, /enterManagementOffice/);
  assert.match(game, /setActiveRoom\(-99\)/);
  assert.match(game, /獨立行政空間｜租寓管理室/);
  assert.match(game, /if \(terminalRecordOpen\) setDemoEndingOpen\(true\)/);
});

test("ships one auto save, three manual saves and world-sourced refusal notice", () => {
  assert.match(game, /Array\.from\(\{ length: 4 \}/);
  assert.match(game, /toDataURL\("image\/jpeg"/);
  assert.match(game, /是否保存本輪進度/);
  assert.match(game, /overdueNotice/);
  assert.match(game, /spawnRentPursuers/);
});
