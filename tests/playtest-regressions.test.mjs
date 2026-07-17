import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
const navigation = await readFile(new URL("../app/game/scene-navigation.ts", import.meta.url), "utf8");

test("keeps T14 on the approved logo and shared management buttons", () => {
  assert.match(game, /<img src="\/logo-title-v1\.png" alt="無期租寓"\/>/);
  assert.match(game, /<ManagementButton data-variant="paper"[^>]*>開始入住登記<\/ManagementButton>/);
  assert.doesNotMatch(game, /title-primary-action/);
  assert.doesNotMatch(game, /無期租約｜第 17 次輪迴/);
  assert.doesNotMatch(game, /Demo 目標：依序清除 B1、B2 底層異常源/);
});

test("keeps the thirty-minute demo clock and three-second medicine cooldown", () => {
  assert.match(game, /DAY_DURATION_SECONDS = GAME_DAY_SECONDS/);
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
  assert.match(navigation, /worldWidth \* \.06/);
  assert.match(navigation, /clinic_privacy_screen.*x1: \.41/);
  assert.match(game, /g\.player\.x <= 330/);
  assert.match(game, /location === "elevator" \? 128/);
  assert.match(game, /location === "elevator" \? 812/);
});

test("keeps the game desktop-only and scales the complete stage proportionally", () => {
  assert.match(game, /desktop-game-stage/);
  assert.match(game, /Math\.min\(1, window\.innerWidth \/ 1600, window\.innerHeight \/ 900\)/);
  assert.doesNotMatch(game, /touch-controls|onPointerDown=\{\(\) => joy/);
});

test("does not duplicate dossier card copy in native hover tooltips", () => {
  assert.doesNotMatch(game, /title=\{TALENT_DESCRIPTIONS|title=\{DEFECT_DESCRIPTIONS/);
});

test("drains sprint stamina only when the player actually moves", () => {
  assert.match(game, /const movedThisFrame = Math\.hypot\(p\.x - positionBeforeMove\.x, p\.y - positionBeforeMove\.y\) > \.01/);
  assert.match(game, /const sprintingThisFrame = sprint > 1 && movedThisFrame/);
  assert.match(game, /sprintingThisFrame \? -30 : staminaRecovery/);
  assert.doesNotMatch(game, /p\.stamina = clamp\(p\.stamina \+ \(sprint > 1 \? -30/);
});

test("keeps patrol-light invisibility visual-only and disables it on death", () => {
  assert.match(game, /ordinaryKinds = isPatrolLightPeriod\(secondsRemaining\)/);
  assert.match(game, /roomEvent === 1 && choice === 1 && isPatrolLightPeriod\(g\.time\)/);
  assert.match(game, /const lightManifested = e\.kind !== "light" \|\| isPatrolLightManifested\(now, e\.phase, e\.hp, g\.time\)/);
  assert.match(game, /enemyExposure = sampleCharacterExposure[^\n]+e\.kind === "light" \? \.62 : 1/);
  assert.match(game, /ctx\.globalAlpha \*= lightManifested \? corpseFade : 0/);
  assert.match(game, /e\.hp > 0 && lightManifested && \(isBoss \|\| e\.elite \|\| e\.combatSeen \|\| enemyDistance < 270\)/);
  assert.doesNotMatch(game, /if \(!lightManifested\) continue/);
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
