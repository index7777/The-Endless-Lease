import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
const navigation = await readFile(new URL("../app/game/scene-navigation.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("keeps T14 on the approved logo and shared management buttons", () => {
  assert.match(game, /<img src="\/logo-title-v1\.png" alt="無期租寓"\/>/);
  assert.match(game, /<ManagementButton data-variant="paper"[^>]*>開始入住登記<\/ManagementButton>/);
  assert.doesNotMatch(game, /title-primary-action/);
  assert.doesNotMatch(game, /無期租約｜第 17 次輪迴/);
  assert.doesNotMatch(game, /Demo 目標：依序清除 B1、B2 底層異常源/);
  assert.doesNotMatch(game, /輪迴入住登記表/);
  assert.match(game, /aria-label="入住登記表"/);
});

test("keeps the twelve-minute demo clock and three-second medicine cooldown", () => {
  assert.match(game, /DAY_DURATION_SECONDS = GAME_DAY_SECONDS/);
  assert.match(game, /\(DAY_DURATION_SECONDS - seconds\) \* 2/);
  assert.match(game, /setMedkitCooldown\(3\)/);
});

test("keeps the current in-game time and four-period label visible in the top bar", () => {
  assert.match(game, /目前時間 \{inGameClock\(hud\.time\)\}/);
  assert.match(game, /\{phaseName\(hud\.time\)\}/);
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
  assert.match(game, /location === "elevator" \? 264/);
  assert.match(game, /location === "elevator" \? 756/);
  assert.match(game, /height \* \.82, bottom: height \* \.94/);
  assert.match(css, /\.desktop-game-stage/);
  assert.match(game, /resolveSpawn\("elevator", "from_hallway", ELEVATOR_W/);
  assert.match(game, /const ELEVATOR_CONTROL_X = 720/);
  assert.doesNotMatch(game, /location === "elevator" \? 824/);
  assert.doesNotMatch(game, /g\.player\.x = 105; g\.player\.y = 690/);
});

test("keeps elevator characters on the visible floor at the calibrated cabin scale", () => {
  assert.match(game, /SCENE_PRESENTATION\[location\]\.characterScale/);
  assert.match(navigation, /worldWidth \* \.24/);
  assert.match(navigation, /worldWidth \* \.78/);
  assert.match(navigation, /from_hallway", x: \.28/);
});

test("keeps the game desktop-only and scales the complete stage proportionally", () => {
  assert.match(game, /desktop-game-viewport/);
  assert.match(game, /desktop-game-stage/);
  assert.match(game, /viewportWidth \/ 1600, viewportHeight \/ 900/);
  assert.match(game, /width: 1600 \* desktopScale, height: 900 \* desktopScale/);
  assert.match(game, /window\.visualViewport\?\.addEventListener\("resize", updateDesktopScale\)/);
  assert.match(css, /\.desktop-game-viewport \{[^}]*overflow:hidden/);
  assert.match(css, /\.desktop-game-stage \{[^}]*transform-origin:left top/);
  assert.doesNotMatch(game, /touch-controls|onPointerDown=\{\(\) => joy/);
});

test("does not render the retired persistent demo objective HUD", () => {
  assert.doesNotMatch(game, /className="demo-goal"/);
  assert.doesNotMatch(game, /<small>目前目標<\/small>/);
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

test("keeps the rent notice non-blocking and forces it closed after three seconds", () => {
  assert.doesNotMatch(game, /cinematicOverlayOpen[^\n]+overdueNotice/);
  assert.match(game, /window\.setTimeout\(\(\) => setOverdueNotice\(null\), 3000\)/);
  assert.doesNotMatch(game, /onClick=\{\(\) => setOverdueNotice\(null\)\}/);
});

test("keeps living pursuers when a new wave or boss encounter begins", () => {
  assert.match(game, /const persistentPursuers = g\.enemies\.filter\(enemy => enemy\.hp > 0 && enemy\.kind === "pursuer"\)/);
  assert.match(game, /kind: boss \}, \.\.\.persistentPursuers/);
  assert.doesNotMatch(game, /Math\.min\(4, 1 \+ Math\.floor/);
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
