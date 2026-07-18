"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { DEFECT_DESCRIPTIONS, HONG_YI_LINES, IDENTITY_LORE, MANAGEMENT_COPY, TALENT_DESCRIPTIONS } from "./game/demo-content";
import { gameFlowReducer, INITIAL_GAME_FLOW } from "./game/flow-state";
import { ATTRIBUTE_NAMES, evaluateDestiny } from "./game/destiny-rules";
import { DiceRollScene } from "./game/dice-model";
import { ELEVATOR_FLOOR_MAX_Y, ELEVATOR_FLOOR_MIN_Y, isWalkable, probeGround, resolveBossSpawn, resolveSpawn } from "./game/scene-navigation";
import { advanceDemoEnding, canAccessDemoFloor, DEMO_ENDING_ZH_TW } from "./game/demo-ending";
import type { DemoEndingState } from "./game/demo-ending";
import { GAME_DAY_SECONDS, getEnemyAnimationExposureMultiplier, getPlayerAnimationExposureMultiplier, getTimePeriod, getTimePeriodIndex, getTimePeriodLabel, isPatrolLightManifested, isPatrolLightPeriod, resolveSceneLightingContext, sampleCharacterExposure, sampleCharacterLighting, sampleSceneColorGrade, SCENE_PRESENTATION, TIME_PERIOD_PROFILES, toCharacterCanvasFilter } from "./game/presentation-profiles";
import { parseRunSave, RUN_SAVE_KEY, serializeRunSave } from "./game/run-save";
import { advanceToNextDay as advanceRuntimeToNextDay, checkCanSleep, debtTotal, payAllOutstandingRentToHongYi, type DayAdvanceReason, type RentSettlementResult } from "./game/bed-rent-system";
import { bossMaxHealth, resetUndefeatedBossAfterEscape } from "./game/boss-encounter";
import { HOME_BED_LABEL_X, HOME_STORAGE_X, resolveHomeInteraction } from "./game/room-interactions";
import { createRandomEventAssignments, distanceToEventInteraction, findAssignedRandomEvent, getRandomEvent } from "./game/random-events";
import { getRentPursuitWave } from "./game/rent-pursuit";
import { hasEnemyPlayerClearance, isPositionBlockedByEnemy, separateEnemyFromPlayer } from "./game/actor-collision";
import { advanceDeadWorldClock, detachEnemiesFromDeadPlayer } from "./game/death-world";
import { DEFAULT_AUDIO_LEVELS, effectiveVolume, parseAudioLevels, type AudioLevels } from "./game/audio-settings";
import { BOSS_BALANCE, FLOOR_GENERATION_BALANCE, ITEM_BALANCE, calculateDailyRent, enemyAttackBalance, enemyCombatBalance, enemyDamage, escapeYieldMultiplier, floorMonsterCap, medicineHealing, monsterRentDrop, monsterScoreReward, playerAttackDamagePerSecond, playerAttackDurationSeconds, playerAttackStaminaCost, pursuerHealth } from "./game/game-balance";
import { createAwayElapsedEnemy, createElapsedDayEnemy, createFloorState } from "./game/floor-generation";
import { TitleAmbientEngine } from "./game/title-ambient";
import type { RunSaveV1 } from "./game/run-save";
import type { DebtEntry, Destiny, Enemy, FloorState, GameRuntime, Location, Pickup, StorageKind, StorageStack } from "./game/model";
import { getCharacterRenderHeightPx } from "./game/characterScale";
import { DesignSystemRoot, ManagementButton } from "./design/components";

const STARTING_FLOORS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ELEVATOR_PANEL_FLOORS = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const FLOOR10_VISIBLE_STATES = new Set<DemoEndingState>([
  "CLEARANCE_REPORT_VIEWED", "FLOOR10_BUTTON_DISCOVERED", "RETURN_TO_OFFICE", "KEYCARD_DELIVERED",
  "POST_B2_FREE_ROAM", "FLOOR10_NOTICE_DISCOVERED", "DEMO_ENDING_STARTED", "DEMO_COMPLETED",
]);
const SAVE_RECORD_PREFIX = "endless-lease.save-record.";
const AUDIO_SETTINGS_KEY = "endless-lease.audio-settings";
type SaveRecord = { savedAt: number; thumbnail: string; payload: string };
type ControlAction = "up" | "down" | "left" | "right" | "sprint" | "attack" | "interact" | "talent";
const DAY_DURATION_SECONDS = GAME_DAY_SECONDS;

const d6 = () => Math.floor(Math.random() * 6) + 1;
const createDestiny = (previous?: Destiny): Destiny => {
  const attributes = ATTRIBUTE_NAMES.map(() => d6());
  const outcome = evaluateDestiny(attributes);
  return {
    attributes,
    gender: previous?.gender ?? "male",
    identity: outcome.identity,
    talent: outcome.talent,
    defect: outcome.defect,
    floor: STARTING_FLOORS[Math.floor(Math.random() * STARTING_FLOORS.length)],
    roomSlot: 1 + Math.floor(Math.random() * 9),
  };
};
const INITIAL_DESTINY: Destiny = { attributes: [3, 3, 3, 3, 3, 3], gender: "male", identity: "清潔工", talent: "租緩", defect: "貪息", floor: 3, roomSlot: 4 };
const destinyPower = (destiny: Destiny) => destiny.attributes.reduce((sum, value) => sum + value * 9, 24) + (destiny.attributes[5] >= 5 ? 18 : 0);
const WORLD_W = 1800;
const WORLD_H = 900;
const ROOM_W = 1600;
const ELEVATOR_W = 1000;
const ELEVATOR_CONTROL_X = 720;
const MANAGEMENT_DESK_X = 820;
// Plaque anchors measured directly from scene-hallway-v1.png (1800 px source).
const DOORS = [
  { slot: 1, x: 62, plaqueY: .325 }, { slot: 2, x: 246, plaqueY: .337 }, { slot: 3, x: 448, plaqueY: .337 },
  { slot: 4, x: 646, plaqueY: .337 }, { slot: 5, x: 796, plaqueY: .337 }, { slot: 6, x: 1001, plaqueY: .337 },
  { slot: 7, x: 1167, plaqueY: .337 }, { slot: 8, x: 1337, plaqueY: .337 }, { slot: 9, x: 1487, plaqueY: .337 },
];
const HALLWAY_ELEVATOR_X = 1685;
const groundBand = (height: number, place: Location) => place === "elevator"
  ? { top: height * ELEVATOR_FLOOR_MIN_Y, bottom: height * ELEVATOR_FLOOR_MAX_Y }
  : place === "room"
    ? { top: height * .61, bottom: height * .84 }
    : { top: height * .64, bottom: height * .86 };
const roomNumber = (floor: number, slot: number) => `${floor}${String(slot).padStart(2, "0")}`;
const zoneName = (floor: number) => floor >= 20 ? "高級住戶區" : floor >= 10 ? "中層交易區" : "廉價住戶區";
const phaseName = (time: number) => getTimePeriodLabel(time);
const formatTime = (seconds: number) => { const whole = Math.ceil(seconds); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`; };
const inGameClock = (seconds: number) => {
  const minutes = Math.floor((360 + (DAY_DURATION_SECONDS - seconds) * 2) % 1440);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const sceneTransitionLockedUntil = useRef(0);
  const touch = useRef({ x: 0, y: 0 });
  const audio = useRef<AudioContext | null>(null);
  const storageId = useRef(1);
  const titleTransitionTimer = useRef<number | null>(null);
  const dayTransitionLock = useRef(false);
  const rentPaymentLock = useRef({ current: false });
  const nextFluorescentFlickerAt = useRef(0);
  const visualClock = useRef(0);
  const playerWasMoving = useRef(false);
  const game = useRef<GameRuntime>({
    player: { x: 150, y: 690, hp: 100, stamina: 100, facing: 1, attack: 0, invuln: 0 },
    enemies: [
      { x: 680, y: 330, hp: 45, phase: 0, location: "hallway" },
      { x: 1120, y: 470, hp: 55, phase: 1.7, location: "hallway" },
      { x: 1530, y: 300, hp: 65, phase: 3.2, location: "hallway" },
    ] as Enemy[],
    pickups: [
      { x: 430, y: 470, type: "租券", taken: false },
      { x: 875, y: 300, type: "藥品", taken: false },
      { x: 1320, y: 500, type: "鑰匙", taken: false },
    ] as Pickup[],
    rent: 38,
    time: DAY_DURATION_SECONDS,
    score: 182,
    day: 1,
    rentDue: 50,
    settlementTriggered: false,
    landlordTask: false,
    overdueDays: 0,
    taskKills: 0,
    debtMode: false,
    arrears: 0,
    rentProtectionLost: false,
    homeBreachTriggered: false,
    breachTick: 2,
    floor: 7,
    attention: 0,
    visitedRooms: [] as number[],
    resolvedEventIds: [] as string[],
    eventAssignments: [],
    floorStates: {} as Record<number, FloorState>,
    weaponLevel: 1,
    medkits: 1,
    keysOwned: 0,
    skillCooldown: 0,
    camera: 0,
    dead: false,
    debtLedger: [] as DebtEntry[],
    mortgageLayers: 0,
    defeatedBosses: [] as string[],
    activeBoss: null as null | "boss_b1" | "boss_b2",
    phaseIndex: 0,
    phaseFlash: 0,
  });
  const [flow, dispatchFlow] = useReducer(gameFlowReducer, INITIAL_GAME_FLOW);
  const started = flow.screen === "run" || flow.screen === "dead" || flow.screen === "complete";
  const introOpen = flow.screen === "intro";
  const dead = flow.screen === "dead";
  const complete = flow.screen === "complete";
  const destinyOpen = flow.screen === "destiny";
  const [destiny, setDestiny] = useState<Destiny>(() => ({ ...INITIAL_DESTINY, attributes: [...INITIAL_DESTINY.attributes] }));
  const [filingStage, setFilingStage] = useState<"ready" | "rolling" | "attributes" | "briefing" | "result" | "complete">("ready");
  const [inlineRerolling, setInlineRerolling] = useState(false);
  const [briefingPlayed, setBriefingPlayed] = useState(false);
  const [briefingFading, setBriefingFading] = useState(false);
  const [residentName, setResidentName] = useState("");
  const [registrationGender, setRegistrationGender] = useState<Destiny["gender"] | null>(null);
  const paused = flow.paused;
  const settlement = flow.overlay.kind === "settlement";
  const [settlementResult, setSettlementResult] = useState<RentSettlementResult | null>(null);
  const [bedDialog, setBedDialog] = useState<"confirm" | "blocked" | null>(null);
  const [hongYiRentDialog, setHongYiRentDialog] = useState<"none" | "offer" | "insufficient" | "confirm" | "success" | "error" | null>(null);
  const [dayTransitionVisual, setDayTransitionVisual] = useState<DayAdvanceReason | null>(null);
  const roomEvent = flow.overlay.kind === "roomEvent" ? flow.overlay.roomId : null;
  const roomEventDefinition = getRandomEvent(roomEvent);
  const floorSelect = flow.overlay.kind === "floorSelect";
  const [location, setLocation] = useState<"hallway" | "room" | "elevator">("hallway");
  const [elevatorTarget, setElevatorTarget] = useState<string | null>(null);
  const [elevatorDisplay, setElevatorDisplay] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [mortgageMarks, setMortgageMarks] = useState<string[]>([]);
  const [debtStatus, setDebtStatus] = useState({ arrears: 0, protectionLost: false });
  const [storage, setStorage] = useState<StorageStack[]>([]);
  const [storageCapacity, setStorageCapacity] = useState(5);
  const [selectedStorageSlot, setSelectedStorageSlot] = useState<number | null>(null);
  const [storageAmount, setStorageAmount] = useState<{ slot: number; direction: "store" | "take"; value: string } | null>(null);
  const storageOpen = flow.overlay.kind === "storage";
  const [message, setMessage] = useState("找到電梯，並在催租前湊齊 50 租券");
  const [residentLog, setResidentLog] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [terminalRecordOpen, setTerminalRecordOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [savePanelOpen, setSavePanelOpen] = useState(false);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listeningControl, setListeningControl] = useState<ControlAction | null>(null);
  const [controls, setControls] = useState<Record<ControlAction, string>>({ up:"w", down:"s", left:"a", right:"d", sprint:"shift", attack:" ", interact:"e", talent:"q" });
  const [overdueNotice, setOverdueNotice] = useState<string | null>(null);
  const [saveRecords, setSaveRecords] = useState<Array<SaveRecord | null>>([null, null, null, null]);
  const [hud, setHud] = useState({ hp: 100, stamina: 100, rent: 38, time: DAY_DURATION_SECONDS, score: 182, day: 1, rentDue: 50, debt: 0, mortgageLayers: 0, taskKills: 0, landlordTask: false, floor: 7, attention: 0, weaponLevel: 1, medkits: 1, keysOwned: 0, skillCooldown: 0, bossB1: false, bossB2: false });
  const [medkitCooldown, setMedkitCooldown] = useState(0);
  const ambience = useRef<HTMLAudioElement | null>(null);
  const music = useRef<HTMLAudioElement | null>(null);
  const voiceAudio = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const audioLevelsRef = useRef<AudioLevels>(DEFAULT_AUDIO_LEVELS);
  const titleAmbient = useRef<TitleAmbientEngine | null>(null);
  const elevatorAudio = useRef<HTMLAudioElement | null>(null);
  const drinkAudio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>(DEFAULT_AUDIO_LEVELS);
  const [deathReady, setDeathReady] = useState(false);
  const [demoEndingState, setDemoEndingState] = useState<DemoEndingState>("B2_ALIVE");
  const [clearanceReportOpen, setClearanceReportOpen] = useState(false);
  const [managementDialogueStep, setManagementDialogueStep] = useState<number | null>(null);
  const [floor10NoticeOpen, setFloor10NoticeOpen] = useState(false);
  const [demoEndingOpen, setDemoEndingOpen] = useState(false);
  const [floor10Attempts, setFloor10Attempts] = useState(0);
  const [elevatorVoiceSubtitle, setElevatorVoiceSubtitle] = useState<string | null>(null);
  const [availableSave, setAvailableSave] = useState<RunSaveV1 | null>(null);
  const [titleTransitioning, setTitleTransitioning] = useState(false);
  const [desktopScale, setDesktopScale] = useState(1);
  const cinematicOverlayOpen = clearanceReportOpen || managementDialogueStep !== null || hongYiRentDialog !== null || bedDialog !== null || dayTransitionVisual !== null || floor10NoticeOpen || demoEndingOpen || logOpen || profileOpen || savePanelOpen || exitPromptOpen;

  const playVoice = useCallback((number: number, onComplete?: () => void) => {
    if (typeof window === "undefined" || mutedRef.current) {
      onComplete?.();
      return null;
    }
    voiceAudio.current?.pause();
    const audio = new Audio(`/audio/voice/hongyi/demo${String(number).padStart(2, "0")}.mp3`);
    audio.volume = effectiveVolume(audioLevelsRef.current, "voice", mutedRef.current, .88);
    voiceAudio.current = audio;
    if (onComplete) {
      let completed = false;
      const completeVoice = () => {
        if (completed) return;
        completed = true;
        onComplete();
      };
      audio.addEventListener("ended", completeVoice, { once: true });
      audio.addEventListener("error", completeVoice, { once: true });
      void audio.play().catch(completeVoice);
    } else {
      void audio.play().catch(() => undefined);
    }
    return audio;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const save = parseRunSave(window.localStorage.getItem(RUN_SAVE_KEY));
    setAvailableSave(save);
    if (!save && window.localStorage.getItem(RUN_SAVE_KEY)) window.localStorage.removeItem(RUN_SAVE_KEY);
    setAudioLevels(parseAudioLevels(window.localStorage.getItem(AUDIO_SETTINGS_KEY)));
    setMuted(window.localStorage.getItem(`${AUDIO_SETTINGS_KEY}.muted`) === "true");
  }, []);

  useEffect(() => {
    if (flow.screen !== "title") return;
    const engine = new TitleAmbientEngine();
    titleAmbient.current = engine;
    engine.setMuted(muted);
    engine.setVolume(effectiveVolume(audioLevels, "music", false));
    void engine.start();
    const unlock = () => { void engine.start(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (titleAmbient.current === engine && flow.screen === "title") engine.stop();
    };
  }, [flow.screen]);

  useEffect(() => {
    mutedRef.current = muted;
    audioLevelsRef.current = audioLevels;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audioLevels));
      window.localStorage.setItem(`${AUDIO_SETTINGS_KEY}.muted`, String(muted));
    }
    titleAmbient.current?.setMuted(muted);
    titleAmbient.current?.setVolume(effectiveVolume(audioLevels, "music", false));
    if (voiceAudio.current) { voiceAudio.current.muted = muted; voiceAudio.current.volume = effectiveVolume(audioLevels, "voice", muted, .88); }
    const ambienceBase = activeRoom === -99 ? .16 : location === "elevator" ? .18 : .2;
    if (ambience.current) { ambience.current.muted = muted; ambience.current.volume = effectiveVolume(audioLevels, "music", muted, ambienceBase); }
    if (music.current) { music.current.muted = muted; music.current.volume = effectiveVolume(audioLevels, "music", muted, .28); }
    if (elevatorAudio.current) { elevatorAudio.current.muted = muted; elevatorAudio.current.volume = effectiveVolume(audioLevels, "sfx", muted, .45); }
    if (drinkAudio.current) { drinkAudio.current.muted = muted; drinkAudio.current.volume = effectiveVolume(audioLevels, "sfx", muted, .72); }
  }, [activeRoom, audioLevels, location, muted]);

  useEffect(() => {
    if (clearanceReportOpen) playVoice(2);
  }, [clearanceReportOpen, playVoice]);

  useEffect(() => {
    if (managementDialogueStep !== null) playVoice(5 + managementDialogueStep);
  }, [managementDialogueStep, playVoice]);

  const progressDemoEnding = useCallback((next: DemoEndingState) => {
    setDemoEndingState(current => {
      try { return advanceDemoEnding(current, next); }
      catch { return current; }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || demoEndingState === "B2_ALIVE") return;
    window.localStorage.setItem("endless-lease.demo-ending", JSON.stringify({ state: demoEndingState, day: hud.day, registration: `17-B-${String(destiny.floor).padStart(2,"0")}${destiny.roomSlot}` }));
  }, [demoEndingState, destiny.floor, destiny.roomSlot, hud.day]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (flow.screen === "dead" || flow.screen === "complete") {
      window.localStorage.removeItem(RUN_SAVE_KEY);
      setAvailableSave(null);
      return;
    }
    if (flow.screen !== "run" || game.current.dead) return;
    const persist = () => {
      window.localStorage.setItem(RUN_SAVE_KEY, serializeRunSave({
        residentName, destiny, location, activeRoom, demoEndingState,
        storage, storageCapacity, mortgageMarks, residentLog, game: game.current,
      }));
    };
    persist();
    const interval = window.setInterval(persist, 3000);
    const onVisibility = () => { if (document.visibilityState === "hidden") persist(); };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeRoom, demoEndingState, destiny, flow.screen, location, mortgageMarks, residentLog, residentName, storage, storageCapacity]);

  useEffect(() => {
    if (!started || !message) return;
    const stamp = inGameClock(game.current.time);
    setResidentLog(current => [`${stamp}　${message}`, ...current.filter(entry => !entry.endsWith(message))].slice(0, 40));
  }, [message, started]);

  const refreshSaveRecords = useCallback(() => {
    if (typeof window === "undefined") return;
    setSaveRecords(Array.from({ length: 4 }, (_, index) => {
      try { return JSON.parse(window.localStorage.getItem(`${SAVE_RECORD_PREFIX}${index}`) || "null") as SaveRecord | null; }
      catch { return null; }
    }));
  }, []);

  const writeSaveRecord = useCallback((slot: number) => {
    if (typeof window === "undefined") return;
    const payload = serializeRunSave({ residentName, destiny, location, activeRoom, demoEndingState, storage, storageCapacity, mortgageMarks, residentLog, game: game.current });
    const thumbnail = canvasRef.current?.toDataURL("image/jpeg", .58) ?? "";
    const record: SaveRecord = { savedAt: Date.now(), thumbnail, payload };
    window.localStorage.setItem(`${SAVE_RECORD_PREFIX}${slot}`, JSON.stringify(record));
    if (slot === 0) {
      window.localStorage.setItem(RUN_SAVE_KEY, payload);
      setAvailableSave(parseRunSave(payload));
    }
    setSaveRecords(current => current.map((value, index) => index === slot ? record : value));
    setMessage(slot === 0 ? "自動存檔已更新" : `手動存檔 ${slot} 已蓋章`);
  }, [activeRoom, demoEndingState, destiny, location, mortgageMarks, residentLog, residentName, storage, storageCapacity]);

  const leaveRunFromPause = useCallback((save: boolean) => {
    if (save) writeSaveRecord(0);
    else {
      window.localStorage.removeItem(RUN_SAVE_KEY);
      setAvailableSave(null);
    }
    setSavePanelOpen(false);
    setExitPromptOpen(false);
    setOverdueNotice(null);
    setProfileOpen(false);
    setLogOpen(false);
    dispatchFlow({ type: "EXIT_TO_TITLE" });
  }, [writeSaveRecord]);

  useEffect(() => {
    if (!dead) { setDeathReady(false); return; }
    const timer = window.setTimeout(() => setDeathReady(true), 1150);
    return () => window.clearTimeout(timer);
  }, [dead]);

  useEffect(() => {
    if (medkitCooldown <= 0) return;
    const timer = window.setTimeout(() => setMedkitCooldown(value => Math.max(0, value - .1)), 100);
    return () => window.clearTimeout(timer);
  }, [medkitCooldown]);

  const sound = useCallback((kind: "dice" | "attack" | "pickup" | "hurt" | "rent" | "drink" | "flicker") => {
    const sfxMix = effectiveVolume(audioLevelsRef.current, "sfx", mutedRef.current);
    if (typeof window === "undefined" || sfxMix <= 0) return;
    if (kind === "drink") {
      if (!drinkAudio.current) {
        drinkAudio.current = new Audio("/audio/drink-swallow-cc0.mp3");
        drinkAudio.current.volume = effectiveVolume(audioLevelsRef.current, "sfx", mutedRef.current, .72);
      }
      drinkAudio.current.currentTime = 0;
      void drinkAudio.current.play().catch(() => undefined);
      return;
    }
    const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    const context = audio.current || new AudioClass();
    audio.current = context;
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    if (kind === "flicker") {
      const duration = .085;
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index++) {
        const time = index / context.sampleRate;
        data[index] = (Math.random() * 2 - 1) * Math.exp(-time * 44) * (.7 + .3 * Math.sin(time * 754));
      }
      const source = context.createBufferSource();
      const bandpass = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer; bandpass.type = "bandpass"; bandpass.frequency.value = 2100; bandpass.Q.value = .9; gain.gain.value = .075 * sfxMix;
      source.connect(bandpass); bandpass.connect(gain); gain.connect(context.destination); source.start();
      return;
    }
    if (kind === "pickup") {
      const duration = .34;
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index++) {
        const time = index / context.sampleRate;
        const cloth = (Math.random() * 2 - 1) * Math.exp(-time * 11) * (.72 + .28 * Math.sin(time * 92));
        const objectDrop = Math.sin(time * Math.PI * 2 * 86) * Math.exp(-Math.max(0, time - .09) * 28) * (time > .09 ? .34 : 0);
        data[index] = cloth * .58 + objectDrop;
      }
      const source = context.createBufferSource();
      const lowpass = context.createBiquadFilter();
      const body = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      lowpass.type = "lowpass"; lowpass.frequency.value = 1650; lowpass.Q.value = .45;
      body.type = "peaking"; body.frequency.value = 210; body.Q.value = .8; body.gain.value = 5;
      gain.gain.setValueAtTime(.26 * sfxMix, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      source.connect(lowpass); lowpass.connect(body); body.connect(gain); gain.connect(context.destination); source.start(now);
      return;
    }
    if (kind === "attack") {
      const duration = .42;
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index++) {
        const time = index / context.sampleRate;
        const swing = (Math.random() * 2 - 1) * Math.sin(Math.min(1, time / .23) * Math.PI) * (time < .25 ? .48 : 0);
        const impactTime = Math.max(0, time - .24);
        const metalImpact = time >= .24 ? (Math.sin(impactTime * Math.PI * 2 * 118) + .42 * Math.sin(impactTime * Math.PI * 2 * 243)) * Math.exp(-impactTime * 17) : 0;
        const contactNoise = time >= .24 ? (Math.random() * 2 - 1) * Math.exp(-impactTime * 32) * .62 : 0;
        data[index] = swing + metalImpact * .5 + contactNoise;
      }
      const source = context.createBufferSource();
      const band = context.createBiquadFilter();
      const body = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      band.type = "bandpass"; band.frequency.value = 780; band.Q.value = .48;
      body.type = "peaking"; body.frequency.value = 135; body.Q.value = 1.1; body.gain.value = 7;
      gain.gain.setValueAtTime(.31 * sfxMix, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      source.connect(band); band.connect(body); body.connect(gain); gain.connect(context.destination); source.start(now);
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const settings = {
      dice: [190, 90, 0.12], hurt: [75, 38, 0.2], rent: [52, 31, 0.35],
    }[kind];
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(settings[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2]);
    gain.gain.setValueAtTime((kind === "rent" ? 0.12 : 0.1) * sfxMix, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings[2]);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(now); oscillator.stop(now + settings[2]);
  }, []);

  const startRunAmbience = useCallback(() => {
    if (!ambience.current) {
      ambience.current = new Audio("/audio/ambience/floor-common-v1.wav");
      ambience.current.loop = true;
      ambience.current.volume = effectiveVolume(audioLevelsRef.current, "music", mutedRef.current, .2);
    }
    ambience.current.muted = mutedRef.current;
    void ambience.current.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!started) return;
    const path = activeRoom === -99 ? "/audio/ambience/management-office-v1.wav"
      : location === "elevator" ? "/audio/ambience/elevator-cabin-v1.wav"
        : hud.floor === 0 ? "/audio/ambience/b1-machinery-v1.wav"
          : hud.floor === -1 ? "/audio/ambience/b2-records-v1.wav"
            : "/audio/ambience/floor-common-v1.wav";
    if (!ambience.current || !ambience.current.src.endsWith(path)) {
      ambience.current?.pause();
      ambience.current = new Audio(path);
      ambience.current.loop = true;
      const ambienceBase = activeRoom === -99 ? .16 : location === "elevator" ? .18 : .2;
      ambience.current.volume = effectiveVolume(audioLevelsRef.current, "music", mutedRef.current, ambienceBase);
      ambience.current.muted = mutedRef.current;
    }
    void ambience.current.play().catch(() => undefined);
  }, [activeRoom, hud.floor, location, started]);

  useEffect(() => {
    if (ambience.current) ambience.current.muted = muted;
  }, [muted]);

  useEffect(() => () => {
    ambience.current?.pause();
    music.current?.pause();
    elevatorAudio.current?.pause();
    drinkAudio.current?.pause();
    voiceAudio.current?.pause();
    titleAmbient.current?.stop();
    if (titleTransitionTimer.current !== null) window.clearTimeout(titleTransitionTimer.current);
    void audio.current?.close();
  }, []);

  const reset = useCallback(() => {
    const power = destinyPower(destiny);
    const lowPowerBonus = power < 230 ? 12 : 0;
    const maxHp = 76 + destiny.attributes[0] * 5;
    const maxStamina = 72 + destiny.attributes[1] * 5;
    const initialFloorState = createFloorState(destiny.floor, 1);
    game.current = {
      player: { x: 155, y: 690, hp: maxHp, stamina: maxStamina, facing: 1, attack: 0, invuln: 0 },
      enemies: initialFloorState.enemies,
      pickups: initialFloorState.pickups,
      rent: 30 + lowPowerBonus,
      time: DAY_DURATION_SECONDS,
      score: power,
      day: 1,
      rentDue: calculateDailyRent(destiny.floor, 0, destiny.attributes[4]),
      settlementTriggered: false,
      landlordTask: false,
      taskKills: 0,
      overdueDays: 0,
      debtMode: false,
      arrears: 0,
      rentProtectionLost: false,
      homeBreachTriggered: false,
      breachTick: 2,
      floor: destiny.floor,
      attention: 0,
      visitedRooms: initialFloorState.visitedRooms,
      resolvedEventIds: [],
      eventAssignments: createRandomEventAssignments(destiny.floor, destiny.roomSlot),
      floorStates: { [destiny.floor]: initialFloorState },
      weaponLevel: 1,
      medkits: 1,
      keysOwned: 0,
      skillCooldown: 0,
      camera: 0,
      dead: false,
      debtLedger: [] as DebtEntry[],
      mortgageLayers: 0,
      defeatedBosses: [] as string[],
      activeBoss: null as null | "boss_b1" | "boss_b2",
      phaseIndex: 0,
      phaseFlash: 0,
    };
    setHud({ hp: maxHp, stamina: maxStamina, rent: 30 + lowPowerBonus, time: DAY_DURATION_SECONDS, score: power, day: 1, rentDue: calculateDailyRent(destiny.floor, 0, destiny.attributes[4]), debt: 0, mortgageLayers: 0, taskKills: 0, landlordTask: false, floor: destiny.floor, attention: 0, weaponLevel: 1, medkits: 1, keysOwned: 0, skillCooldown: 0, bossB1: false, bossB2: false });
    const roomSpawn = resolveSpawn("room", "from_hallway", ROOM_W, canvasRef.current?.clientHeight || 900);
    game.current.player.x = roomSpawn.ground.x;
    game.current.player.y = roomSpawn.ground.y;
    game.current.player.facing = roomSpawn.spawn.facing;
    setMessage(`${MANAGEMENT_COPY.checkIn} 承租房：${roomNumber(destiny.floor, destiny.roomSlot)}`);
    setLocation("room");
    setActiveRoom(destiny.roomSlot);
    setMortgageMarks([]);
    setDebtStatus({ arrears: 0, protectionLost: false });
    storageId.current = 1;
    setStorage([]);
    setStorageCapacity(5);
    setResidentLog([]);
    setLogOpen(false);
    setTerminalRecordOpen(false);
    setProfileOpen(false);
    setSavePanelOpen(false);
    setExitPromptOpen(false);
    setOverdueNotice(null);
    setMedkitCooldown(0);
    setElevatorTarget(null);
    setDemoEndingState("B2_ALIVE");
    setClearanceReportOpen(false);
    setManagementDialogueStep(null);
    setFloor10NoticeOpen(false);
    setDemoEndingOpen(false);
    dayTransitionLock.current = false;
    rentPaymentLock.current.current = false;
    setBedDialog(null);
    setHongYiRentDialog(null);
    setFloor10Attempts(0);
    if (typeof window !== "undefined") window.localStorage.removeItem("endless-lease.demo-ending");
    dispatchFlow({ type: "START_RUN" });
    startRunAmbience();
    playVoice(0);
  }, [destiny, playVoice, startRunAmbience]);

  const restoreRun = useCallback(() => {
    if (!availableSave) return;
    const restored = parseRunSave(JSON.stringify(availableSave));
    if (!restored) {
      window.localStorage.removeItem(RUN_SAVE_KEY);
      setAvailableSave(null);
      return;
    }
    restored.game.resolvedEventIds ??= [];
    if (!restored.game.eventAssignments?.length) restored.game.eventAssignments = createRandomEventAssignments(restored.destiny.floor, restored.destiny.roomSlot);
    game.current = restored.game;
    setResidentName(restored.residentName);
    setDestiny(restored.destiny);
    setLocation(restored.location);
    setActiveRoom(restored.activeRoom);
    setDemoEndingState(restored.demoEndingState);
    setStorage(restored.storage);
    setStorageCapacity(restored.storageCapacity);
    storageId.current = Math.max(1, ...restored.storage.map(stack => stack.id + 1));
    setMortgageMarks(restored.mortgageMarks);
    setResidentLog(restored.residentLog);
    setDebtStatus({ arrears: restored.game.arrears, protectionLost: restored.game.rentProtectionLost });
    setElevatorTarget(null);
    setClearanceReportOpen(false);
    setManagementDialogueStep(null);
    setFloor10NoticeOpen(false);
    setDemoEndingOpen(false);
    setLogOpen(false);
    setTerminalRecordOpen(false);
    setProfileOpen(false);
    dayTransitionLock.current = false;
    rentPaymentLock.current.current = false;
    setBedDialog(null);
    setHongYiRentDialog(null);
    setSavePanelOpen(false);
    setExitPromptOpen(false);
    setOverdueNotice(null);
    setMedkitCooldown(0);
    setHud({
      hp: restored.game.player.hp, stamina: restored.game.player.stamina, rent: restored.game.rent,
      time: restored.game.time, score: restored.game.score, day: restored.game.day, rentDue: restored.game.rentDue,
      debt: debtTotal(restored.game.debtLedger), mortgageLayers: restored.game.mortgageLayers,
      taskKills: restored.game.taskKills, landlordTask: restored.game.landlordTask, floor: restored.game.floor,
      attention: restored.game.attention, weaponLevel: restored.game.weaponLevel, medkits: restored.game.medkits,
      keysOwned: restored.game.keysOwned, skillCooldown: restored.game.skillCooldown,
      bossB1: restored.game.defeatedBosses.includes("boss_b1"), bossB2: restored.game.defeatedBosses.includes("boss_b2"),
    });
    setMessage(`已恢復第 ${restored.game.day} 日住戶紀錄；未完成的彈窗已安全關閉`);
    dispatchFlow({ type: "RESTORE_RUN" });
    startRunAmbience();
  }, [availableSave, startRunAmbience]);

  const beginNewRegistration = useCallback(() => {
    if (titleTransitioning) return;
    setResidentName("");
    setRegistrationGender(null);
    setDestiny({ ...INITIAL_DESTINY, attributes: [...INITIAL_DESTINY.attributes] });
    setFilingStage("ready");
    setTitleTransitioning(true);
    titleAmbient.current?.playPaperAndFade();
    titleTransitionTimer.current = window.setTimeout(() => {
      dispatchFlow({ type: "OPEN_INTRO" });
      setTitleTransitioning(false);
      titleTransitionTimer.current = null;
    }, 1500);
  }, [titleTransitioning]);

  const restartRegistration = useCallback(() => {
    ambience.current?.pause();
    music.current?.pause();
    elevatorAudio.current?.pause();
    voiceAudio.current?.pause();
    keys.current = {};
    game.current.dead = false;
    game.current.enemies = [];
    game.current.pickups = [];
    game.current.activeBoss = null;
    setResidentName("");
    setRegistrationGender(null);
    setDestiny({ ...INITIAL_DESTINY, attributes: [...INITIAL_DESTINY.attributes] });
    setFilingStage("ready");
    setInlineRerolling(false);
    setBriefingPlayed(false);
    setBriefingFading(false);
    setLocation("hallway");
    setActiveRoom(null);
    setDeathReady(false);
    setMortgageMarks([]);
    setStorage([]);
    setResidentLog([]);
    setLogOpen(false);
    setProfileOpen(false);
    setSavePanelOpen(false);
    setExitPromptOpen(false);
    setSettingsOpen(false);
    setOverdueNotice(null);
    setElevatorTarget(null);
    setElevatorDisplay(null);
    setClearanceReportOpen(false);
    setManagementDialogueStep(null);
    setFloor10NoticeOpen(false);
    setDemoEndingOpen(false);
    setDemoEndingState("B2_ALIVE");
    setMessage("請重新提交入住登記表");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RUN_SAVE_KEY);
      window.localStorage.removeItem("endless-lease.demo-ending");
    }
    setAvailableSave(null);
    dispatchFlow({ type: "RESTART" });
  }, []);

  const exitAfterDeath = useCallback(() => {
    ambience.current?.pause();
    music.current?.pause();
    elevatorAudio.current?.pause();
    voiceAudio.current?.pause();
    keys.current = {};
    game.current.dead = false;
    game.current.enemies = [];
    game.current.pickups = [];
    setResidentName("");
    setRegistrationGender(null);
    setDestiny({ ...INITIAL_DESTINY, attributes: [...INITIAL_DESTINY.attributes] });
    setFilingStage("ready");
    setDeathReady(false);
    setLocation("hallway");
    setActiveRoom(null);
    setMessage("找到電梯，並在催租前湊齊 50 租券");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RUN_SAVE_KEY);
      window.localStorage.removeItem("endless-lease.demo-ending");
    }
    setAvailableSave(null);
    dispatchFlow({ type: "EXIT_TO_TITLE" });
  }, []);

  const continueSavedRun = useCallback(() => {
    if (titleTransitioning) return;
    setTitleTransitioning(true);
    titleAmbient.current?.playPaperAndFade();
    titleTransitionTimer.current = window.setTimeout(() => {
      restoreRun();
      setTitleTransitioning(false);
      titleTransitionTimer.current = null;
    }, 1500);
  }, [restoreRun, titleTransitioning]);

  const spawnRentPursuers = useCallback((debtCount: number, targetLocation: Location, roomSlot?: number) => {
    const g = game.current;
    const { threat, count } = getRentPursuitWave(debtCount);
    const localLimit = targetLocation === "hallway" ? WORLD_W - 80 : targetLocation === "elevator" ? ELEVATOR_W - 55 : ROOM_W - 70;
    for (let index = 0; index < count; index++) {
      g.enemies.push({
        x: clamp(g.player.x + 150 + index * 65, 65, localLimit),
        y: g.player.y + (index % 2 ? 34 : -18),
        hp: pursuerHealth(threat, index),
        phase: 4.6 + index * 1.3,
        elite: true,
        threat,
        location: targetLocation,
        roomSlot: targetLocation === "room" ? roomSlot : undefined,
        followsIndoors: true,
        kind: "pursuer",
        maxHp: pursuerHealth(threat, index),
      });
    }
    return { threat, count };
  }, []);

  const advanceToNextDay = useCallback((reason: DayAdvanceReason) => {
    const g = game.current;
    if (dayTransitionLock.current || g.dead) return;
    dayTransitionLock.current = true;
    keys.current = {};
    setBedDialog(null);
    setHongYiRentDialog(null);
    dispatchFlow({ type: "CLOSE_OVERLAY" });
    setDayTransitionVisual(reason);

    window.setTimeout(() => {
      const maxHealth = 76 + destiny.attributes[0] * 5;
      const result = advanceRuntimeToNextDay(g, {
        reason,
        restoreFullHealth: reason === "sleep",
        maxHealth,
        nextDailyRent: calculateDailyRent(destiny.floor, g.attention, destiny.attributes[4]),
      });

    g.enemies = g.enemies.filter(enemy => enemy.kind !== "light" || enemy.hp <= 0);
    Object.values(g.floorStates).forEach(floorState => {
      floorState.enemies = floorState.enemies.filter(enemy => enemy.kind !== "light" || enemy.hp <= 0);
    });
    const aliveOnFloor = g.enemies.filter(enemy => enemy.hp > 0).length;
    if (g.day % 2 === 0 && aliveOnFloor < floorMonsterCap(g.floor)) {
      g.enemies.push(createElapsedDayEnemy(g.floor, g.day, 0, g.time));
    }
    g.activeBoss = null;
      if (result.settlement.debtAdded > 0) {
        g.attention += 1;
        g.rentDue = calculateDailyRent(destiny.floor, g.attention, destiny.attributes[4]);
        g.breachTick = 2;
        const pursuit = spawnRentPursuers(g.debtLedger.length, location, location === "room" ? activeRoom ?? undefined : undefined);
        g.homeBreachTriggered = location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot;
        const notice = `當期 ${result.settlement.rentAmount} 租券未扣款，完整列入欠款。追租程序啟動；${pursuit.count} 名第 ${pursuit.threat} 級追租者取得追索權。`;
        setOverdueNotice(notice);
        setMessage(notice);
      } else {
        setMessage(`第 ${g.day} 日房租已完整支付 ${result.settlement.amountPaid} 租券。`);
      }
      setSettlementResult(result.settlement);
    setDebtStatus({ arrears: g.arrears, protectionLost: g.rentProtectionLost });
      setHud({ hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: g.arrears, mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") });
      writeSaveRecord(0);
      dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "settlement" } });
      sound(result.settlement.paymentSucceeded ? "pickup" : "rent");
      setDayTransitionVisual(null);
      dayTransitionLock.current = false;
    }, 450);
  }, [activeRoom, destiny.attributes, destiny.floor, location, sound, spawnRentPursuers, writeSaveRecord]);

  const acknowledgeSettlement = useCallback(() => {
    game.current.settlementTriggered = false;
    setSettlementResult(null);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "settlement" });
  }, []);

  const openBedInteraction = useCallback(() => {
    const g = game.current;
    const inCombat = g.enemies.some(enemy => enemy.hp > 0 && enemy.location === "room" && enemy.roomSlot === activeRoom && (enemy.combatSeen || Math.hypot(enemy.x - g.player.x, enemy.y - g.player.y) < 330));
    const result = checkCanSleep({
      isInPlayerRoom: location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot,
      isInCombat: inCombat,
      isPlayerIncapacitated: g.dead || g.player.hp <= 0,
      isCutsceneActive: managementDialogueStep !== null || clearanceReportOpen || demoEndingOpen,
      isSceneTransitioning: performance.now() < sceneTransitionLockedUntil.current,
      isDayTransitioning: dayTransitionLock.current,
      outstandingRentDebt: debtTotal(g.debtLedger),
    });
    if (result.allowed) setBedDialog("confirm");
    else if (result.reason === "rent_overdue") setBedDialog("blocked");
    else setMessage(`目前無法休息：${result.reason === "in_combat" ? "房內仍有威脅" : "狀態或轉場尚未結束"}`);
  }, [activeRoom, clearanceReportOpen, demoEndingOpen, destiny.floor, destiny.roomSlot, location, managementDialogueStep]);

  const confirmHongYiPayment = useCallback(() => {
    const g = game.current;
    const result = payAllOutstandingRentToHongYi(g, rentPaymentLock.current, () => writeSaveRecord(0));
    if (!result.success) {
      setHongYiRentDialog(result.failureReason === "insufficient_funds" ? "insufficient" : "error");
      return;
    }
    setDebtStatus({ arrears: 0, protectionLost: false });
    setHud(value => ({ ...value, rent: g.rent, debt: 0 }));
    setHongYiRentDialog("success");
    setMessage(`欠款已全部清償 ${result.amountPaid} 租券；床鋪休息權限已恢復。`);
    sound("pickup");
  }, [sound, writeSaveRecord]);

  useEffect(() => {
    if (!overdueNotice) return;
    const forcedClose = window.setTimeout(() => setOverdueNotice(null), 3000);
    return () => window.clearTimeout(forcedClose);
  }, [overdueNotice]);

  const resolveRoom = useCallback((choice: number) => {
    if (roomEvent === null) return;
    const g = game.current;
    const resolvedEvents = g.resolvedEventIds ?? (g.resolvedEventIds = []);
    if (resolvedEvents.includes(roomEvent)) {
      dispatchFlow({ type: "CLOSE_OVERLAY", kind: "roomEvent" });
      setMessage("目前沒有發現異樣。");
      return;
    }
    const leavesUnresolved = choice === 2;
    if (roomEvent === "seepage_wall" && choice === 0) {
      g.attention += 1; g.score += 18;
      setMessage("你撿起舊租單：輪迴痕跡滲入掌心，公寓關注度上升"); sound("rent");
    } else if (roomEvent === "seepage_wall" && choice === 1) {
      const reward = Math.max(1, Math.floor(12 * escapeYieldMultiplier(g.floor, destiny.floor, "event")));
      g.player.stamina = Math.max(0, g.player.stamina - 18); g.rent += reward; g.score += 10;
      setMessage("你擦去溫濕滲液；牆縫裡有東西落進隨身袋。"); sound("pickup");
    } else if (roomEvent === "sealed_wall" && choice === 0) {
      if (destiny.attributes[2] >= 4) { g.score += 25; setMessage("你從鋼條後的敲擊辨認出一段舊房號。"); sound("pickup"); }
      else { g.player.hp = Math.max(1, g.player.hp - 10); setMessage("封鎖層忽然內縮，牆後的黑暗短暫吞過視野。"); sound("hurt"); }
    } else if (roomEvent === "sealed_wall" && choice === 1) {
      if (g.keysOwned <= 0) {
        setMessage("鋼條夾層沒有鬆動；需要一把老舊房門鑰匙。");
        dispatchFlow({ type: "CLOSE_OVERLAY", kind: "roomEvent" });
        return;
      }
      g.keysOwned -= 1; g.score += 20; g.rent += 12;
      setMessage("鑰匙卡進封鎖層後自行斷裂；牆內有東西落進隨身袋。"); sound("pickup");
    } else if (roomEvent === "resident_clinic" && choice === 0) {
      g.score += 20; setMessage("欠租筆記記著你的筆跡：真相事件權重提升"); sound("pickup");
    } else if (roomEvent === "resident_clinic" && choice === 1) {
      const reward = Math.max(1, Math.floor(24 * escapeYieldMultiplier(g.floor, destiny.floor, "event")));
      g.rent += reward; g.attention += 1; setMessage("你翻動器械盤，也在灰塵中留下了新鮮足跡。"); sound("pickup");
    } else {
      setMessage("你沒有處理異常，先離開了探索範圍。");
    }
    if (!leavesUnresolved && !resolvedEvents.includes(roomEvent)) resolvedEvents.push(roomEvent);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "roomEvent" });
    setHud({ hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: debtTotal(g.debtLedger), mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") });
  }, [activeRoom, destiny.attributes, roomEvent, sound]);

  const travelToFloor = useCallback((floor: number) => {
    const g = game.current;
    const travelingPursuers = g.enemies.filter(enemy => enemy.hp > 0 && enemy.location === "elevator" && enemy.followsIndoors);
    const remainingEnemies = g.enemies.filter(enemy => !travelingPursuers.includes(enemy));
    const currentState = g.floorStates[g.floor] ?? createFloorState(g.floor, g.day, g.time);
    currentState.enemies = remainingEnemies;
    currentState.pickups = g.pickups;
    currentState.visitedRooms = g.visitedRooms;
    g.floorStates[g.floor] = currentState;

    const firstVisit = !g.floorStates[floor];
    const targetState = g.floorStates[floor] ?? createFloorState(floor, g.day, g.time);
    const elapsedDays = Math.max(0, g.day - targetState.lastSpawnDay);
    const aliveCount = targetState.enemies.filter(enemy => enemy.hp > 0).length;
    const additions = Math.min(Math.floor(elapsedDays / FLOOR_GENERATION_BALANCE.elapsedDayMonsterInterval), Math.max(0, floorMonsterCap(floor) - aliveCount));
    for (let index = 0; index < additions; index++) {
      targetState.enemies.push(createAwayElapsedEnemy(floor, elapsedDays, index, g.time));
    }
    if (isPatrolLightPeriod(g.time) && !targetState.enemies.some(enemy => enemy.kind === "light" && enemy.hp > 0)) {
      const patrolLight = createFloorState(floor, g.day, g.time).enemies.find(enemy => enemy.kind === "light");
      if (patrolLight) targetState.enemies.push(patrolLight);
    }
    targetState.lastSpawnDay = g.day;
    travelingPursuers.forEach((enemy, index) => { enemy.location = "hallway"; enemy.roomSlot = undefined; enemy.x = 1580 - index * 55; enemy.y = 340 + (index % 2) * 120; });
    targetState.enemies.push(...travelingPursuers);
    g.floorStates[floor] = targetState;

    const hallwayEntry = resolveSpawn("hallway", "from_elevator", WORLD_W, canvasRef.current?.clientHeight || 900);
    g.floor = floor; g.activeBoss = null;
    g.player.x = hallwayEntry.ground.x;
    g.player.y = hallwayEntry.ground.y;
    g.player.facing = hallwayEntry.spawn.facing;
    g.camera = clamp(g.player.x - 760, 0, WORLD_W - 900);
    g.enemies = targetState.enemies;
    g.pickups = targetState.pickups;
    g.visitedRooms = targetState.visitedRooms;
    setMessage(firstVisit ? `首次抵達 ${floor}F：本輪樓層資源與裝備已生成，拾取後不會補生` : `返回 ${floor}F：載入原有樓層狀態；經過 ${elapsedDays} 日，新增 ${additions} 個異常`);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "floorSelect" }); setLocation("hallway"); setActiveRoom(null); sound("dice");
    setHud({ hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: debtTotal(g.debtLedger), mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") });
  }, [sound]);

  const enterManagementOffice = useCallback(() => {
    const g = game.current;
    g.activeBoss = null;
    g.floor = Math.max(1, destiny.floor);
    const roomSpawn = resolveSpawn("room", "from_hallway", ROOM_W, canvasRef.current?.clientHeight || 900);
    g.player.x = roomSpawn.ground.x;
    g.player.y = roomSpawn.ground.y;
    g.player.facing = roomSpawn.spawn.facing;
    g.camera = 0;
    g.enemies.forEach((enemy, index) => {
      if (enemy.hp > 0 && enemy.followsIndoors) {
        enemy.location = "room";
        enemy.roomSlot = -99;
        enemy.x = 90 + index * 42;
        enemy.y = 430 + (index % 2) * 80;
      }
    });
    keys.current = {};
    sceneTransitionLockedUntil.current = performance.now() + 650;
    setLocation("room");
    setActiveRoom(-99);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "floorSelect" });
    setClearanceReportOpen(false);
    setDemoEndingState(current => current === "KEYCARD_COLLECTED" || current === "CLEARANCE_REPORT_VIEWED" || current === "FLOOR10_BUTTON_DISCOVERED" ? "RETURN_TO_OFFICE" : current);
    const hasRequiredMainDialogue = ["KEYCARD_COLLECTED", "CLEARANCE_REPORT_VIEWED", "FLOOR10_BUTTON_DISCOVERED", "RETURN_TO_OFFICE"].includes(demoEndingState);
    setManagementDialogueStep(hasRequiredMainDialogue ? 0 : null);
    setHud(value => ({ ...value, floor: g.floor }));
    setMessage("租寓管理室｜將特殊權限卡放到櫃檯上");
    sound("rent");
  }, [demoEndingState, destiny.floor, sound]);

  const leaveManagementOffice = useCallback(() => {
    progressDemoEnding("POST_B2_FREE_ROAM");
    setManagementDialogueStep(null);
    const g = game.current;
    const elevatorSpawn = resolveSpawn("elevator", "from_room", ELEVATOR_W, canvasRef.current?.clientHeight || 900);
    g.player.x = elevatorSpawn.ground.x;
    g.player.y = elevatorSpawn.ground.y;
    g.player.facing = elevatorSpawn.spawn.facing;
    g.camera = 0;
    setLocation("elevator");
    setActiveRoom(null);
    g.enemies.forEach((enemy, index) => {
      if (enemy.hp > 0 && enemy.followsIndoors) {
        enemy.location = "elevator";
        enemy.roomSlot = undefined;
        enemy.x = 140 + index * 38;
        enemy.y = 430 + (index % 2) * 70;
      }
    });
    setMessage("管理室門在身後關上。電梯控制盤新增了十樓按鍵。");
  }, [progressDemoEnding]);

  const enterBoss = useCallback((boss: "boss_b1" | "boss_b2") => {
    const g = game.current;
    if (boss === "boss_b2" && !g.defeatedBosses.includes("boss_b1")) {
      setMessage("B2 的按鍵沒有亮起：租約要求先清除 B1 異常源");
      return;
    }
    const persistentPursuers = g.enemies.filter(enemy => enemy.hp > 0 && enemy.kind === "pursuer");
    persistentPursuers.forEach((enemy, index) => { enemy.location = "hallway"; enemy.roomSlot = undefined; enemy.x = 760 - index * 52; enemy.y = 340 + (index % 2) * 120; });
    const hp = bossMaxHealth(boss);
    g.activeBoss = boss;
    g.floor = boss === "boss_b1" ? 0 : -1;
    const bossEntry = resolveBossSpawn(boss, WORLD_W, canvasRef.current?.clientHeight || 900);
    g.player.x = bossEntry.ground.x; g.player.y = bossEntry.ground.y; g.player.facing = bossEntry.spawn.facing;
    g.camera = clamp(g.player.x - 760, 0, WORLD_W - 900);
    if (g.defeatedBosses.includes(boss)) {
      g.enemies = persistentPursuers;
      g.pickups = boss === "boss_b2" && demoEndingState === "KEYCARD_DROPPED" ? [{ x: 520, y: bossEntry.ground.y, type: "特殊權限卡", taken: false }] : [];
      setLocation("hallway"); setActiveRoom(null);
      dispatchFlow({ type: "CLOSE_OVERLAY", kind: "floorSelect" });
      setMessage(`${boss === "boss_b1" ? "B1" : "B2"} 已清除區域：可回訪戰場與電梯`);
      setHud(value => ({ ...value, floor: g.floor }));
      return;
    }
    g.enemies = [{ x: 520, y: bossEntry.ground.y, hp, maxHp: hp, phase: 0, location: "hallway", followsIndoors: false, kind: boss }, ...persistentPursuers];
    g.pickups = [];
    setLocation("hallway"); setActiveRoom(null);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "floorSelect" });
    if (!elevatorAudio.current) {
      elevatorAudio.current = new Audio("/audio/elevator-door-cc0.wav");
      elevatorAudio.current.volume = effectiveVolume(audioLevelsRef.current, "sfx", mutedRef.current, .45);
    }
    elevatorAudio.current.muted = mutedRef.current;
    void elevatorAudio.current.play().catch(() => undefined);
    setMessage(`${boss === "boss_b1" ? "B1" : "B2"} 底層異常源已封鎖出口；擊破後回到電梯`);
    setHud(value => ({ ...value, floor: g.floor }));
  }, [demoEndingState, muted]);

  const beginElevatorTravel = useCallback((target: number | "boss_b1" | "boss_b2" | "management") => {
    if (elevatorTarget) return;
    const label = typeof target === "number" ? `${target}F` : target === "boss_b1" ? "B1" : target === "boss_b2" ? "B2" : "管理室";
    const currentFloor = Math.max(1, game.current.floor);
    setElevatorDisplay(game.current.activeBoss === "boss_b1" ? "B1" : game.current.activeBoss === "boss_b2" ? "B2" : `${currentFloor}F`);
    setElevatorTarget(label);
    sound("dice");
    if (!elevatorAudio.current) {
      elevatorAudio.current = new Audio("/audio/elevator-door-cc0.wav");
      elevatorAudio.current.volume = effectiveVolume(audioLevelsRef.current, "sfx", mutedRef.current, .4);
    }
    elevatorAudio.current.muted = mutedRef.current;
    elevatorAudio.current.currentTime = 0;
    void elevatorAudio.current.play().catch(() => undefined);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion && typeof target === "number") {
      const direction = target >= currentFloor ? 1 : -1;
      const steps = Math.abs(target - currentFloor);
      for (let index = 1; index <= steps; index++) {
        window.setTimeout(() => setElevatorDisplay(`${currentFloor + direction * index}F`), 520 + index * Math.min(260, 1050 / Math.max(1, steps)));
      }
    } else {
      window.setTimeout(() => setElevatorDisplay(label), reducedMotion ? 120 : 1180);
    }
    window.setTimeout(() => {
      if (typeof target === "number") travelToFloor(target);
      else if (target === "management") enterManagementOffice();
      else enterBoss(target);
      setElevatorTarget(null);
      setElevatorDisplay(null);
    }, reducedMotion ? 450 : 2450);
  }, [elevatorTarget, enterBoss, enterManagementOffice, muted, sound, travelToFloor]);

  const useMedkit = useCallback(() => {
    const g = game.current;
    const maxHp = 76 + destiny.attributes[0] * 5;
    if (!started || medkitCooldown > 0 || g.medkits <= 0 || g.player.hp >= maxHp || g.dead) return;
    g.medkits -= 1; g.player.hp = Math.min(maxHp, g.player.hp + medicineHealing(destiny.talent === "急救常識"));
    setMedkitCooldown(ITEM_BALANCE.medicineCooldownSeconds);
    setMessage(destiny.talent === "急救常識" ? "急救常識生效：生命大幅恢復" : "飲用過期藥水：生命恢復"); sound("drink");
    setHud(value => ({ ...value, hp: g.player.hp, medkits: g.medkits }));
  }, [destiny.attributes, destiny.talent, medkitCooldown, sound, started]);

  const useTalent = useCallback(() => {
    const g = game.current;
    if (!started || g.skillCooldown > 0 || g.dead) return;
    if (destiny.talent === "租緩") { g.time += 30; setMessage("租緩：今日結算延後 30 秒；寬限不是免除"); }
    if (destiny.talent === "窺層") {
      const traces = [g.floor - 1, g.floor + 1]
        .filter(floor => floor >= 1 && floor <= 9 && canAccessDemoFloor(floor, destiny.floor, demoEndingState))
        .map(floor => {
          const state = g.floorStates[floor];
          if (!state) return `${floor}F：紀錄混濁`;
          const threats = state.enemies.filter(enemy => enemy.hp > 0).length;
          const resources = state.pickups.filter(item => !item.taken).length;
          return `${floor}F：異常${threats > 3 ? "密集" : threats > 0 ? "零散" : "沉寂"}、資源${resources > 2 ? "明顯" : resources > 0 ? "微弱" : "無"}`;
        });
      setMessage(`窺層：${traces.length > 0 ? traces.join("；") : "相鄰可達樓層沒有留下痕跡"}`);
    }
    if (destiny.talent === "偽居") { g.attention = Math.max(0, g.attention - 1); g.player.stamina = Math.min(72 + destiny.attributes[1] * 5, g.player.stamina + 25); setMessage("偽居：追蹤壓力降低，體力已恢復"); }
    if (destiny.talent === "契語") { g.rentDue = Math.max(20, g.rentDue - 8); setMessage("契語：租約文字短暫重新排列，今日應繳額已更新"); }
    if (destiny.talent === "蝕耐") { g.player.hp = Math.min(76 + destiny.attributes[0] * 5, g.player.hp + 24); g.player.stamina = Math.min(72 + destiny.attributes[1] * 5, g.player.stamina + 20); setMessage("蝕耐：壓下異常侵蝕，恢復生命與體力"); }
    g.skillCooldown = Math.max(14, 26 - destiny.attributes[2] * 2); sound("dice");
    setHud(value => ({ ...value, hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, rentDue: g.rentDue, attention: g.attention, skillCooldown: g.skillCooldown }));
  }, [demoEndingState, destiny.attributes, destiny.floor, destiny.talent, sound, started]);

  const transferStorage = useCallback((kind: StorageKind, direction: "store" | "take", slot: number, requestedAmount = 1) => {
    const g = game.current;
    const maxStack = kind === "rent" ? Number.MAX_SAFE_INTEGER : 5;
    const inventoryAmount = () => kind === "rent" ? g.rent : kind === "medkits" ? g.medkits : g.keysOwned;
    const changeInventory = (amount: number) => {
      if (kind === "rent") g.rent += amount;
      if (kind === "medkits") g.medkits += amount;
      if (kind === "keys") g.keysOwned += amount;
    };
    setStorage(current => {
      const next = current.map(stack => ({ ...stack }));
      if (direction === "store") {
        const amount = Math.min(Math.max(1, Math.floor(requestedAmount)), inventoryAmount());
        if (amount <= 0) return current;
        let stack = next.find(item => item.slot === slot);
        if (stack && stack.kind !== kind) return current;
        if (!stack) {
          stack = { id: storageId.current++, slot, kind, quantity: 0 };
          next.push(stack);
        }
        const moved = Math.min(amount, maxStack - stack.quantity);
        stack.quantity += moved; changeInventory(-moved);
      } else {
        const stack = next.find(item => item.slot === slot && item.kind === kind);
        if (!stack) return current;
        const moved = Math.min(Math.max(1, Math.floor(requestedAmount)), stack.quantity);
        stack.quantity -= moved; changeInventory(moved);
        if (stack.quantity === 0) next.splice(next.findIndex(item => item.id === stack.id), 1);
      }
      setHud(value => ({ ...value, rent: g.rent, medkits: g.medkits, keysOwned: g.keysOwned }));
      return next;
    });
  }, []);

  const beginFiling = useCallback(() => {
    if (filingStage === "rolling") return;
    if (filingStage === "attributes") {
      if (inlineRerolling) return;
      setInlineRerolling(true);
      sound("dice");
      window.setTimeout(() => sound("dice"), 420);
      window.setTimeout(() => sound("dice"), 860);
      window.setTimeout(() => {
        setDestiny(previous => createDestiny(previous));
        setInlineRerolling(false);
        sound("rent");
      }, 1800);
      return;
    }
    setFilingStage("rolling"); sound("dice");
    window.setTimeout(() => sound("dice"), 420);
    window.setTimeout(() => sound("dice"), 860);
    window.setTimeout(() => {
      setDestiny(previous => createDestiny(previous));
      setFilingStage("attributes");
      sound("rent");
    }, 1800);
  }, [filingStage, inlineRerolling, sound]);

  const confirmIdentity = useCallback(() => {
    if (briefingPlayed) {
      setFilingStage("result");
      return;
    }
    setFilingStage("briefing");
    setBriefingPlayed(true);
    setBriefingFading(false);
    const advanceAfterVoice = () => {
      setBriefingFading(true);
      window.setTimeout(() => setFilingStage(stage => stage === "briefing" ? "result" : stage), 1000);
    };
    const voice = playVoice(1, advanceAfterVoice);
    if (!voice) return;
    window.setTimeout(() => {
      if (!voice.ended && voice.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) advanceAfterVoice();
    }, 15000);
  }, [briefingPlayed, playVoice]);

  const finishFiling = useCallback(() => {
    setFilingStage("complete"); sound("rent");
  }, [sound]);

  const attack = useCallback(() => {
    const p = game.current.player;
    const staminaCost = playerAttackStaminaCost(destiny.attributes[1]);
    if (p.attack <= 0 && p.stamina >= staminaCost && !game.current.dead) {
      p.attack = playerAttackDurationSeconds();
      p.stamina -= staminaCost;
      sound("attack");
    }
  }, [destiny.attributes, sound]);

  const interact = useCallback(() => {
    if (performance.now() < sceneTransitionLockedUntil.current) return;
    const g = game.current;
    if (location === "hallway") {
      const perceptionRadius = 48 + destiny.attributes[3] * 7;
      for (const item of g.pickups) {
        if (!item.taken && Math.hypot(item.x - g.player.x, item.y - g.player.y) < perceptionRadius) {
          item.taken = true;
          sound("pickup");
          if (item.type === "租券") { const amount = item.amount ?? Math.max(1, Math.floor(ITEM_BALANCE.rentPickupBase * escapeYieldMultiplier(g.floor, destiny.floor, "base") * (destiny.defect === "輕厄" ? ITEM_BALANCE.lightMisfortuneRentMultiplier : 1))); g.rent += amount; setMessage("拾取租券：已收進隨身袋"); }
          if (item.type === "藥品") { g.medkits += 1; setMessage("拾取過期藥品：已放入道具欄"); }
          if (item.type === "鑰匙") { g.keysOwned += 1; g.score += ITEM_BALANCE.keyScore; setMessage("取得老舊房門鑰匙"); }
          if (item.type === "裝備") { g.weaponLevel = Math.min(ITEM_BALANCE.weaponMaxLevel, g.weaponLevel + 1); g.score += ITEM_BALANCE.weaponScore; setMessage(`取得改造鋼管：武器提升至 ${g.weaponLevel} 級`); }
          if (item.type === "特殊權限卡") { progressDemoEnding("KEYCARD_COLLECTED"); setClearanceReportOpen(true); setMessage("關鍵物件已取得：特殊權限卡・10F"); }
          setHud(value => ({ ...value, rent: g.rent, score: g.score, medkits: g.medkits, keysOwned: g.keysOwned, weaponLevel: g.weaponLevel }));
          return;
        }
      }
      const nearBackWall = g.player.y <= groundBand(canvasRef.current?.clientHeight || WORLD_H, "hallway").top + 82;
      const nearbyDoor = g.activeBoss || !nearBackWall ? undefined : DOORS.find(door => Math.abs(door.x - g.player.x) < 43 + destiny.attributes[3] * 5);
      if (nearbyDoor) {
        const isOwnRoom = g.floor === destiny.floor && nearbyDoor.slot === destiny.roomSlot;
        const eventRoom = findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, nearbyDoor.slot);
        if (!isOwnRoom && !eventRoom) {
          setMessage(`${roomNumber(g.floor, nearbyDoor.slot)} 屬於其他住戶；多人模式需由屋主邀請、授權或使用特殊規則才能進入`);
          return;
        }
        const doorX = nearbyDoor.x;
        const roomSpawn = resolveSpawn("room", "from_hallway", ROOM_W, canvasRef.current?.clientHeight || 900);
        g.player.x = roomSpawn.ground.x; g.player.y = roomSpawn.ground.y; g.player.facing = roomSpawn.spawn.facing; g.camera = 0;
        g.enemies.forEach((enemy, index) => {
          if (enemy.hp > 0 && enemy.location === "hallway" && enemy.followsIndoors && (enemy.kind === "pursuer" || Math.abs(enemy.x - doorX) < 430)) {
            enemy.location = "room"; enemy.roomSlot = nearbyDoor.slot; enemy.x = 65 + index * 34; enemy.y = 320 + (index % 2) * 120;
          }
        });
        let entryMessage = isOwnRoom ? `${roomNumber(g.floor, nearbyDoor.slot)} 是你的承租房；門口可返回走廊` : `${roomNumber(g.floor, nearbyDoor.slot)}：走到異常物件旁按 E 探索`;
        if (isOwnRoom && g.rentProtectionLost && !g.homeBreachTriggered) {
          const pursuit = spawnRentPursuers(g.debtLedger.length, "room", nearbyDoor.slot);
          g.homeBreachTriggered = true; g.breachTick = 2;
          entryMessage = `租金保護已失效：牆膜侵蝕開始，${pursuit.count} 名第 ${pursuit.threat} 級追租者侵入房間`;
        }
        keys.current = {};
        sceneTransitionLockedUntil.current = performance.now() + 650;
        setActiveRoom(nearbyDoor.slot); setLocation("room");
        setMessage(entryMessage); sound("rent");
        return;
      }
        const escapedBoss = resetUndefeatedBossAfterEscape(g);
        if (escapedBoss) setMessage(`${g.activeBoss === "boss_b1" ? "B1" : "B2"} 戰鬥已脫離；再次進入時 Boss 將恢復全部生命。`);
      if (g.player.x > 1690) {
        const elevatorSpawn = resolveSpawn("elevator", "from_hallway", ELEVATOR_W, canvasRef.current?.clientHeight || WORLD_H);
        g.player.x = elevatorSpawn.ground.x;
        g.player.y = elevatorSpawn.ground.y;
        g.player.facing = elevatorSpawn.spawn.facing;
        g.camera = 0;
        g.enemies.forEach((enemy, index) => {
          if (enemy.hp > 0 && enemy.location === "hallway" && enemy.followsIndoors && (enemy.kind === "pursuer" || enemy.x > 1320)) {
            enemy.location = "elevator";
            enemy.roomSlot = undefined;
            enemy.x = clamp(520 + index * 38, 150, 790);
            enemy.y = probeGround("elevator", enemy.x, ELEVATOR_W, canvasRef.current?.clientHeight || WORLD_H, enemy.y).y;
          }
        });
        keys.current = {};
        sceneTransitionLockedUntil.current = performance.now() + 650;
        setLocation("elevator"); setActiveRoom(null);
        if (!escapedBoss) setMessage("已進入電梯轎廂：控制盤就在右側，靠近後按 E 選擇樓層"); sound("dice");
      }
      return;
    }
    if (g.player.x <= 330) {
      if (location === "room" && activeRoom === -99) {
        leaveManagementOffice();
        return;
      }
      const returnX = location === "room" && activeRoom !== null && activeRoom >= 1 && activeRoom <= 9 ? DOORS[activeRoom - 1].x : 1645;
      const localPlayerX = g.player.x;
      g.enemies.forEach(enemy => {
        const sameRoom = location !== "room" || enemy.roomSlot === activeRoom;
        if (enemy.hp > 0 && enemy.location === location && sameRoom && enemy.followsIndoors) {
          enemy.location = "hallway"; enemy.roomSlot = undefined; enemy.x = clamp(returnX + (enemy.x - localPlayerX), 55, WORLD_W - 55);
        }
      });
      const hallwayGround = probeGround("hallway", returnX, WORLD_W, canvasRef.current?.clientHeight || 900, g.player.y);
      g.player.x = returnX; g.player.y = hallwayGround.y; g.player.facing = 1; g.camera = clamp(returnX - 420, 0, WORLD_W - 900);
      keys.current = {};
      sceneTransitionLockedUntil.current = performance.now() + 650;
      dispatchFlow({ type: "CLOSE_OVERLAY" }); setLocation("hallway"); setActiveRoom(null);
      setMessage("返回公共走廊");
      return;
    }
    const activeEvent = activeRoom === null ? undefined : findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, activeRoom);
    const isOwnRoomLocation = location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot;
    const homeInteraction = resolveHomeInteraction(g.player.x);
    const interactionDistance = location === "elevator" ? Math.abs(g.player.x - ELEVATOR_CONTROL_X)
      : activeRoom === -99 ? Math.abs(g.player.x - MANAGEMENT_DESK_X)
        : isOwnRoomLocation ? homeInteraction.distance
          : activeEvent ? distanceToEventInteraction(activeEvent, g.player.x)
            : Math.abs(g.player.x - ROOM_W * .79);
    if (interactionDistance < (location === "elevator" ? 92 : 95)) {
      keys.current = {};
      if (location === "elevator") {
        dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "floorSelect" } }); setMessage("操作老式電梯控制盤"); sound("dice");
      } else if (activeRoom !== null) {
        const isOwnRoom = g.floor === destiny.floor && activeRoom === destiny.roomSlot;
        if (activeRoom === -99) {
          setHongYiRentDialog(debtTotal(g.debtLedger) > 0 ? "offer" : "none");
          setMessage(debtTotal(g.debtLedger) > 0 ? "紅怡：「你的帳還掛著。」" : "紅怡核對帳本：目前沒有欠租。");
        } else {
          const eventRoom = findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, activeRoom);
          if (isOwnRoom && homeInteraction.kind === "bed") {
          openBedInteraction();
        } else if (isOwnRoom) {
          dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "storage" } });
          setMessage("個人儲物櫃已開啟：相同物品可堆疊，離開櫃子範圍會自動關閉");
        } else if (eventRoom) {
          if ((g.resolvedEventIds ?? []).includes(eventRoom.id)) setMessage("目前沒有發現異樣。");
          else { dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "roomEvent", roomId: eventRoom.id } }); sound("rent"); }
        }
      }
    }
        }
  }, [activeRoom, demoEndingState, destiny.attributes, destiny.defect, destiny.floor, destiny.roomSlot, leaveManagementOffice, location, openBedInteraction, progressDemoEnding, sound, spawnRentPursuers]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c" && profileOpen) {
        setProfileOpen(false);
        return;
      }
      if (e.key.toLowerCase() === "c" && started && !dead && flow.overlay.kind === "none" && !cinematicOverlayOpen) {
        setProfileOpen(true);
        return;
      }
      if (cinematicOverlayOpen) {
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", " "].includes(e.key.toLowerCase())) e.preventDefault();
        return;
      }
      if (dead) {
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", " "].includes(e.key.toLowerCase())) e.preventDefault();
        return;
      }
      keys.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === controls.attack) { e.preventDefault(); attack(); }
      if (e.key.toLowerCase() === controls.interact && roomEvent === null && !floorSelect && !storageOpen) interact();
      if (e.key.toLowerCase() === controls.talent) useTalent();
      if (e.key === "2") useMedkit();
      if (e.key === "Escape") dispatchFlow({ type: "TOGGLE_PAUSE" });
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [attack, cinematicOverlayOpen, controls, dead, floorSelect, flow.overlay.kind, interact, profileOpen, roomEvent, started, storageOpen, useMedkit, useTalent]);

  useEffect(() => {
    if (!settingsOpen || !listeningControl) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      setControls(previous => ({ ...previous, [listeningControl]: event.key.toLowerCase() }));
      setListeningControl(null);
    };
    window.addEventListener("keydown", capture, { capture: true, once: true });
    return () => window.removeEventListener("keydown", capture, { capture: true });
  }, [listeningControl, settingsOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    let last = performance.now();
    let hudClock = 0;
    let animationFrame = 0;
    const sceneImages = {
      hallway: Object.assign(new Image(), { src: "/scene-hallway-v1.png" }),
      b1: Object.assign(new Image(), { src: "/scene-b1-maintenance-v1.png" }),
      b2: Object.assign(new Image(), { src: "/scene-b2-records-v1.png" }),
      room: Object.assign(new Image(), { src: "/scene-home-v2.png" }),
      clinic: Object.assign(new Image(), { src: "/scene-clinic-v3.png" }),
      eventSeepageWall: Object.assign(new Image(), { src: "/scene-event-seepage-wall-v1.png" }),
      eventSealedWall: Object.assign(new Image(), { src: "/scene-event-sealed-wall-v1.png" }),
      management: Object.assign(new Image(), { src: "/scene-management-office-v1.png" }),
      elevator: Object.assign(new Image(), { src: "/scene-elevator-v1.png" }),
      elevatorB1: Object.assign(new Image(), { src: "/scene-elevator-b1-v2.png" }),
      player: Object.assign(new Image(), { src: "/sprite-player-v1.png" }),
      playerFemale: Object.assign(new Image(), { src: "/sprite-player-female-v1.png" }),
      playerWalk: Object.assign(new Image(), { src: "/sprite-player-walk-v1.png" }),
      playerWalkTransition: Object.assign(new Image(), { src: "/sprite-player-walk-transition-v2.png" }),
      playerFemaleWalk: Object.assign(new Image(), { src: "/sprite-player-female-walk-v1.png" }),
      playerFemaleWalkTransition: Object.assign(new Image(), { src: "/sprite-player-female-walk-transition-v2.png" }),
      playerAttack: Object.assign(new Image(), { src: "/sprite-player-attack-v1.png" }),
      playerAttackWindup: Object.assign(new Image(), { src: "/sprite-player-attack-windup-v2.png" }),
      playerFemaleAttack: Object.assign(new Image(), { src: "/sprite-player-female-attack-v1.png" }),
      playerFemaleAttackWindup: Object.assign(new Image(), { src: "/sprite-player-female-attack-windup-v2.png" }),
      playerDeath: Object.assign(new Image(), { src: "/sprite-player-death-v1.png" }),
      playerFemaleDeath: Object.assign(new Image(), { src: "/sprite-player-female-death-v1.png" }),
      playerMaleWalkSheet: Object.assign(new Image(), { src: "/animations/player-male-walk-v1.png" }),
      playerMaleAttackSheet: Object.assign(new Image(), { src: "/animations/player-male-attack-v1.png" }),
      playerFemaleWalkSheet: Object.assign(new Image(), { src: "/animations/player-female-walk-v1.png" }),
      playerFemaleAttackSheet: Object.assign(new Image(), { src: "/animations/player-female-attack-v1.png" }),
      wall: Object.assign(new Image(), { src: "/sprite-wall-resident-v1.png" }),
      wallAttack: Object.assign(new Image(), { src: "/sprite-wall-resident-attack-v2.png" }),
      wallMoveAttackSheet: Object.assign(new Image(), { src: "/animations/wall-resident-move-attack-v1.png" }),
      wallHitDieSheet: Object.assign(new Image(), { src: "/animations/wall-resident-hit-die-v1.png" }),
      light: Object.assign(new Image(), { src: "/sprite-light-warden-v1.png" }),
      lightFullSheet: Object.assign(new Image(), { src: "/animations/light-warden-states-24fps-v1.png" }),
      receipt: Object.assign(new Image(), { src: "/sprite-receipt-collector-v1.png" }),
      receiptFullSheet: Object.assign(new Image(), { src: "/animations/receipt-collector-states-24fps-v1.png" }),
      pursuer: Object.assign(new Image(), { src: "/sprite-rent-pursuer-v1.png" }),
      pursuerAttack: Object.assign(new Image(), { src: "/sprite-rent-pursuer-attack-v2.png" }),
      pursuerFullSheet: Object.assign(new Image(), { src: "/animations/rent-pursuer-states-24fps-v1.png" }),
      bossB1: Object.assign(new Image(), { src: "/sprite-boss-b1-v2.png" }),
      bossB1Attack: Object.assign(new Image(), { src: "/sprite-boss-b1-attack-v2.png" }),
      bossB1FullSheet: Object.assign(new Image(), { src: "/animations/boss-b1-states-24fps-v1.png" }),
      bossB2: Object.assign(new Image(), { src: "/sprite-boss-b2-v1.png" }),
      bossB2Attack: Object.assign(new Image(), { src: "/sprite-boss-b2-attack-v2.png" }),
      bossB2FullSheet: Object.assign(new Image(), { src: "/animations/boss-b2-states-24fps-v1.png" }),
      pickupRent: Object.assign(new Image(), { src: "/pickup-rent-v1.png" }),
      pickupMedicine: Object.assign(new Image(), { src: "/pickup-medicine-v1.png" }),
      pickupKey: Object.assign(new Image(), { src: "/pickup-key-v1.png" }),
      pickupEquipment: Object.assign(new Image(), { src: "/pickup-equipment-v1.png" }),
      pickupKeycard10F: Object.assign(new Image(), { src: "/prop-keycard-floor10-v1.png" }),
    };

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const logicalWidth = canvas.clientWidth;
      const logicalHeight = canvas.clientHeight;
      canvas.width = Math.floor(logicalWidth * dpr);
      canvas.height = Math.floor(logicalHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const localWorldWidth = location === "hallway" ? WORLD_W : location === "elevator" ? ELEVATOR_W : ROOM_W;
      const current = game.current;
      current.player.x = clamp(current.player.x, location === "room" ? 108 : location === "elevator" ? 264 : 55, location === "elevator" ? 756 : localWorldWidth - 55);
      current.player.y = probeGround(location, current.player.x, localWorldWidth, logicalHeight, current.player.y).y;
      for (const enemy of current.enemies) if (enemy.location === location) enemy.y = probeGround(location, enemy.x, localWorldWidth, logicalHeight, enemy.y).y;
      for (const pickup of current.pickups) pickup.y = probeGround(location, pickup.x, localWorldWidth, logicalHeight, pickup.y).y;
      keys.current = {};
      touch.current = { x: 0, y: 0 };
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const dt = Math.min((now - last) / 1000, 0.033); last = now;
      if (!paused) visualClock.current += dt * 1000;
      const animationNow = visualClock.current;
      const g = game.current, p = g.player;
      const band = groundBand(h, location);
      const inputX = (keys.current[controls.right] || keys.current.arrowright ? 1 : 0) - (keys.current[controls.left] || keys.current.arrowleft ? 1 : 0);
      const inputY = (keys.current[controls.down] || keys.current.arrowdown ? 1 : 0) - (keys.current[controls.up] || keys.current.arrowup ? 1 : 0);
      const isMoving = flow.screen === "run" && !paused && !cinematicOverlayOpen && Math.hypot(inputX, inputY) > .1;
      if (!paused) playerWasMoving.current = isMoving;
      const renderPlayerMoving = paused ? playerWasMoving.current : isMoving;
      if (flow.screen === "run" && !paused && !cinematicOverlayOpen && !g.dead) {
        if (animationNow >= nextFluorescentFlickerAt.current) {
          const outageChance = TIME_PERIOD_PROFILES[getTimePeriod(g.time)].outageChance;
          nextFluorescentFlickerAt.current = animationNow + 4200 + Math.random() * 8800 * (1 - outageChance * .65);
          g.phaseFlash = Math.max(g.phaseFlash, .24);
          sound("flicker");
        }
        const localWorldWidth = location === "hallway" ? WORLD_W : location === "elevator" ? ELEVATOR_W : ROOM_W;
        const dx = inputX;
        const dy = inputY;
        const len = Math.hypot(dx, dy) || 1;
        const sprint = keys.current[controls.sprint] && p.stamina > 0 ? 1.55 : 1;
        const moveSpeed = 150 + destiny.attributes[1] * 15;
        const minPlayerX = location === "room" ? 84 : location === "elevator" ? 264 : 55;
        const maxPlayerX = location === "elevator" ? 756 : localWorldWidth - 55;
        const candidateX = clamp(p.x + (dx / len) * moveSpeed * sprint * dt, minPlayerX, maxPlayerX);
        const candidateY = clamp(p.y + (dy / len) * moveSpeed * .72 * sprint * dt, band.top, band.bottom);
        const assignedEvent = activeRoom === null ? undefined : findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, activeRoom);
        const roomProfile = activeRoom === -99 ? "management" : assignedEvent?.collisionProfile ?? "home";
        const positionBeforeMove = { x: p.x, y: p.y };
        const canPlayerOccupy = (x: number, y: number) => isWalkable(location, x, y, localWorldWidth, h, 24, roomProfile)
          && !isPositionBlockedByEnemy(g.enemies, location, activeRoom, x, y);
        if (canPlayerOccupy(candidateX, candidateY)) {
          p.x = candidateX; p.y = candidateY;
        } else if (Math.abs(dx) > .1 && canPlayerOccupy(candidateX, p.y)) {
          p.x = candidateX;
        } else if (Math.abs(dy) > .1 && canPlayerOccupy(p.x, candidateY)) {
          p.y = candidateY;
        }
        const movedThisFrame = Math.hypot(p.x - positionBeforeMove.x, p.y - positionBeforeMove.y) > .01;
        const sprintingThisFrame = sprint > 1 && movedThisFrame;
        for (const enemy of g.enemies) {
          if (enemy.location !== location) continue;
          if (enemy.y < band.top || enemy.y > band.bottom) enemy.y = band.top + 28 + ((enemy.x * .37) % Math.max(32, band.bottom - band.top - 45));
        }
        for (const item of g.pickups) {
          if (item.y < band.top || item.y > band.bottom) item.y = band.top + 35 + ((item.x * .29) % Math.max(30, band.bottom - band.top - 48));
        }
        const activeEvent = activeRoom === null ? undefined : findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, activeRoom);
        const interactionDistance = location === "elevator" ? Math.abs(p.x - ELEVATOR_CONTROL_X)
          : activeEvent ? distanceToEventInteraction(activeEvent, p.x)
            : location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot ? Math.abs(p.x - HOME_STORAGE_X)
              : Math.abs(p.x - ROOM_W * .79);
        if ((roomEvent !== null || floorSelect || storageOpen) && interactionDistance > (location === "elevator" ? 82 : 120)) {
          keys.current = {};
          dispatchFlow({ type: "CLOSE_OVERLAY" });
          setMessage("你離開互動區域，未完成的操作已關閉");
        }
        if (Math.abs(dx) > .1) p.facing = Math.sign(dx);
        const staminaRecovery = destiny.defect === "寡眠" ? 10 : 18;
        p.stamina = clamp(p.stamina + (sprintingThisFrame ? -30 : staminaRecovery) * dt, 0, 72 + destiny.attributes[1] * 5);
        p.attack = Math.max(0, p.attack - dt); p.invuln = Math.max(0, p.invuln - dt);
        g.skillCooldown = Math.max(0, g.skillCooldown - dt);
        g.time = Math.max(0, g.time - dt);
        if (music.current) {
          const urgency = clamp((120 - g.time) / 120, 0, 1);
          music.current.playbackRate = g.activeBoss === "boss_b2" ? 1.24 : g.activeBoss === "boss_b1" ? 1.12 : 1 + urgency * .2;
          music.current.volume = effectiveVolume(audioLevelsRef.current, "music", mutedRef.current, g.activeBoss ? .28 : .18 + urgency * .1);
        }
        const nextPhase = getTimePeriodIndex(g.time);
        if (nextPhase !== g.phaseIndex) {
          g.phaseIndex = nextPhase;
          g.phaseFlash = .75;
          if (!g.activeBoss && g.floor > 0) {
            const phaseState = createFloorState(g.floor, g.day, g.time);
            g.pickups = phaseState.pickups;
            if (isPatrolLightPeriod(g.time) && !g.enemies.some(enemy => enemy.kind === "light" && enemy.hp > 0)) {
              const patrolLight = phaseState.enemies.find(enemy => enemy.kind === "light");
              if (patrolLight) g.enemies.push(patrolLight);
            }
            const floorState = g.floorStates[g.floor];
            if (floorState) floorState.pickups = g.pickups;
          }
          setMessage(`目前時段已進入${getTimePeriodLabel(g.time)}。普通地面物品已重新生成。`);
        }
        g.phaseFlash = Math.max(0, g.phaseFlash - dt);
        const unprotectedHome = location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot && g.rentProtectionLost;
        if (unprotectedHome) {
          g.breachTick -= dt;
          if (g.breachTick <= 0) {
            g.breachTick = 2;
            p.hp -= 1 + Math.ceil(g.attention / 2);
            sound("hurt");
          }
        } else {
          g.breachTick = 2;
        }
        if (g.time === 0 && !g.settlementTriggered) advanceToNextDay("natural");
        for (const e of g.enemies) if (e.hp > 0 && e.location === location && (location !== "room" || e.roomSlot === activeRoom)) {
          const dist = Math.hypot(p.x - e.x, p.y - e.y);
          const safeDist = Math.max(1, dist);
          const isBoss = e.kind === "boss_b1" || e.kind === "boss_b2";
          const isPursuer = e.kind === "pursuer";
          const combatBalance = enemyCombatBalance(e.kind);
          const attackBalance = enemyAttackBalance(e);
          const chaseDistance = combatBalance.chaseDistance * (1 + g.mortgageLayers * .05);
          e.attackTimer = Math.max(0, (e.attackTimer ?? 0) - dt);
          e.attackCooldown = Math.max(0, (e.attackCooldown ?? 0) - dt);
          e.moving = false;
          if (e.kind === "wall" && !e.alerted) {
            e.y = band.top + 18;
            if (dist < chaseDistance) {
              e.alerted = true;
              e.emerging = true;
              e.aiState = "chase";
              setMessage("牆皮突然剝落：滲牆住戶脫離牆面");
              sound("hurt");
            } else continue;
          }
          const baseSpeed = combatBalance.speed;
          const contactDistance = combatBalance.contactDistance;
          if (!e.aiState) e.aiState = e.elite || dist <= chaseDistance ? "chase" : "patrol";
          if (!e.elite && e.aiState === "chase" && dist > chaseDistance) {
            e.aiState = "patrol";
            e.patrolAnchorX = e.x;
            e.patrolAnchorY = e.y;
            e.patrolTargetX = undefined;
            e.patrolTargetY = undefined;
            e.patrolWait = 0;
          } else if ((e.elite || dist <= chaseDistance) && e.aiState === "patrol") {
            e.aiState = "chase";
          }
          e.patrolWait = Math.max(0, (e.patrolWait ?? 0) - dt);
          if (e.aiState === "patrol" && (!e.patrolTargetX || !e.patrolTargetY || Math.hypot(e.patrolTargetX - e.x, e.patrolTargetY - e.y) < 34)) {
            if ((e.patrolWait ?? 0) <= 0) {
              const patrolSeed = animationNow / 5200 + e.phase + (e.patrolAnchorX ?? e.x) * .003;
              for (let attempt = 0; attempt < 5; attempt++) {
                const ratio = (Math.sin(patrolSeed + attempt * 1.73) + 1) / 2;
                const targetX = 70 + ratio * (localWorldWidth - 140);
                const targetY = band.top + 36 + ((Math.cos(patrolSeed * .83 + attempt) + 1) / 2) * Math.max(32, band.bottom - band.top - 72);
                if (isWalkable(location, targetX, targetY, localWorldWidth, h, isBoss ? 42 : 25, roomProfile)) {
                  e.patrolTargetX = targetX;
                  e.patrolTargetY = targetY;
                  break;
                }
              }
              e.patrolWait = .35;
            }
          }
          const targetX = e.aiState === "chase" ? p.x : e.patrolTargetX;
          const targetY = e.aiState === "chase" ? p.y : e.patrolTargetY;
          if (targetX !== undefined && targetY !== undefined && dist > (e.aiState === "chase" ? contactDistance : 20) && (e.attackTimer ?? 0) <= 0) {
            const targetDist = Math.max(1, Math.hypot(targetX - e.x, targetY - e.y));
            const speed = e.aiState === "chase" ? (e.elite ? moveSpeed * 1.05 : baseSpeed) : baseSpeed * .55;
            const dx = ((targetX - e.x) / targetDist) * speed * dt;
            const dy = ((targetY - e.y) / targetDist) * (speed * .78) * dt;
            const candidates = [[e.x + dx, e.y + dy], [e.x + dx, e.y], [e.x, e.y + dy], [e.x + dx * .55, e.y - dy * .7]];
            const wallEmerging = e.kind === "wall" && e.emerging;
            const unrestrictedNext = [clamp(e.x + dx, 45, localWorldWidth - 45), clamp(e.y + dy, band.top, band.bottom)];
            const next = isPursuer || wallEmerging
              ? (hasEnemyPlayerClearance(e, unrestrictedNext[0], unrestrictedNext[1], p.x, p.y) ? unrestrictedNext : undefined)
              : candidates.find(([x, y]) => isWalkable(location, x, y, localWorldWidth, h, isBoss ? 42 : 25, roomProfile)
                && hasEnemyPlayerClearance(e, x, y, p.x, p.y));
            if (next) {
              const previousX = e.x;
              const previousY = e.y;
              e.x = next[0]; e.y = next[1];
              e.moving = Math.hypot(e.x - previousX, e.y - previousY) > .01;
              if (Math.abs(e.x - previousX) > .01) e.facing = e.x > previousX ? -1 : 1;
              e.stuckSeconds = 0;
              if (e.aiState === "chase") e.combatSeen = true;
              if (wallEmerging) {
                const fullyInCorridor = e.y >= band.top + Math.max(76, (band.bottom - band.top) * .42);
                const hasLegalClearance = isWalkable(location, e.x, e.y, localWorldWidth, h, 25, roomProfile);
                if (fullyInCorridor && hasLegalClearance) e.emerging = false;
              }
            } else {
              e.stuckSeconds = (e.stuckSeconds ?? 0) + dt;
              if (e.stuckSeconds >= .8) {
                e.aiState = dist <= chaseDistance || e.elite ? "chase" : "patrol";
                e.patrolTargetX = undefined;
                e.patrolTargetY = undefined;
                if (e.kind !== "wall" || !e.emerging) e.y = probeGround(location, clamp(e.x, 70, localWorldWidth - 70), localWorldWidth, h, e.y).y;
                e.stuckSeconds = 0;
              }
            }
          }
          if (dist < contactDistance) {
            const nx = dist > 1 ? (e.x - p.x) / dist : Math.cos(e.phase || 1);
            const ny = dist > 1 ? (e.y - p.y) / dist : Math.sin(e.phase || 1) * .55;
            const contactX = clamp(p.x + nx * contactDistance, 55, localWorldWidth - 55);
            const contactY = clamp(p.y + ny * contactDistance * .72, band.top, band.bottom);
            const separated = separateEnemyFromPlayer(e, contactX, contactY, p.x, p.y);
            if (isPursuer || isWalkable(location, separated.x, separated.y, localWorldWidth, h, isBoss ? 42 : 25, roomProfile)) { e.x = separated.x; e.y = separated.y; }
          }
          if (dist <= contactDistance + 7 && (e.attackCooldown ?? 0) <= 0 && (e.attackTimer ?? 0) <= 0) {
            e.attackTimer = attackBalance.duration;
            e.attackCooldown = attackBalance.cooldown;
            e.attackLanded = false;
            e.combatSeen = true;
          }
          if ((e.attackTimer ?? 0) > 0 && (e.attackTimer ?? 0) <= attackBalance.landingAtRemaining && !e.attackLanded) {
            e.attackLanded = true;
            if (dist < attackBalance.hitRange && p.invuln === 0) {
              p.hp -= Math.max(1, enemyDamage(e) - Math.floor(destiny.attributes[5] / 2));
              p.invuln = .8;
              sound("hurt");
            }
          }
          e.hitTimer = Math.max(0, (e.hitTimer ?? 0) - dt);
          if (p.attack > ITEM_BALANCE.attackHitWindowRemainingMin && p.attack < ITEM_BALANCE.attackHitWindowRemainingMax && dist < ITEM_BALANCE.attackRange) { e.combatSeen = true; e.hitTimer = .18; e.hp -= playerAttackDamagePerSecond(g.weaponLevel) * dt; if (e.hp <= 0 && e.deathTimer === undefined) {
            e.hp = 0;
            e.deathDuration = 3;
            e.deathTimer = e.deathDuration;
            e.deathFacing = p.x > e.x ? -1 : 1;
            e.attackTimer = 0;
          }
          }
        }
        for (const e of g.enemies) if (e.hp <= 0 && e.deathTimer !== undefined && !e.rewardGranted) {
          e.deathTimer = Math.max(0, e.deathTimer - dt);
          if (e.deathTimer > 0) continue;
          e.rewardGranted = true;
          const isBoss = e.kind === "boss_b1" || e.kind === "boss_b2";
            if (isBoss) {
              const bossId = e.kind as "boss_b1" | "boss_b2";
              if (!g.defeatedBosses.includes(bossId)) g.defeatedBosses.push(bossId);
              g.rent += BOSS_BALANCE[bossId].rentReward;
              g.score += BOSS_BALANCE[bossId].scoreReward;
              setMessage(`${bossId === "boss_b1" ? "B1" : "B2"} 底層異常源已清除；特殊權限物已登記`);
              sound("rent");
              if (bossId === "boss_b2" && g.defeatedBosses.includes("boss_b1")) {
                g.pickups.push({ x: e.x, y: e.y, type: "特殊權限卡", taken: false });
                setDemoEndingState("B2_DEFEATED");
                window.setTimeout(() => progressDemoEnding("KEYCARD_DROPPED"), 650);
                setMessage(DEMO_ENDING_ZH_TW["demo.b2.defeat.objective_pickup"]);
              }
              continue;
            }
            const reward = monsterRentDrop(e, g.floor, destiny.floor);
            g.pickups.push({ x: e.x, y: e.y, type: "租券", amount: reward, taken: false });
            g.score += monsterScoreReward(e);
            const enemyName = e.kind === "light" ? "巡燈殘影" : e.kind === "receipt" ? "拾單游魂" : "滲牆住戶";
            setMessage(e.elite ? "追租者已清除：租券掉落在原地；欠租債務不會因此減少" : `${enemyName}已清除：租券掉落在原地`);
        }
        if (p.hp <= 0) { p.hp = 0; p.invuln = 0; p.attack = 0; g.dead = true; detachEnemiesFromDeadPlayer(g); dispatchFlow({ type: "DIE" }); setMessage("你已融入公寓。點擊重新入住。"); }
        g.camera += ((clamp(p.x - w * .38, 0, Math.max(0, localWorldWidth - w))) - g.camera) * Math.min(1, dt * 6);
        hudClock += dt;
        if (hudClock > .12) { hudClock = 0; setHud({ hp: p.hp, stamina: p.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: debtTotal(g.debtLedger), mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") }); }
      }

      if (flow.screen === "dead" && g.dead) {
        const previousPhase = g.phaseIndex;
        advanceDeadWorldClock(g, dt, DAY_DURATION_SECONDS);
        const nextDeathPhase = getTimePeriodIndex(g.time);
        if (nextDeathPhase !== previousPhase) { g.phaseIndex = nextDeathPhase; g.phaseFlash = .75; }
        else g.phaseFlash = Math.max(0, g.phaseFlash - dt);
        const deathWorldWidth = location === "hallway" ? WORLD_W : location === "elevator" ? ELEVATOR_W : ROOM_W;
        const deathAssignedEvent = activeRoom === null ? undefined : findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, activeRoom);
        const deathRoomProfile = activeRoom === -99 ? "management" : deathAssignedEvent?.collisionProfile ?? "home";
        for (const e of g.enemies) {
          if (e.hp <= 0) {
            if (e.deathTimer !== undefined && e.deathTimer > 0) e.deathTimer = Math.max(0, e.deathTimer - dt);
            continue;
          }
          if (e.location !== location || (location === "room" && e.roomSlot !== activeRoom)) continue;
          e.attackTimer = 0;
          e.attackCooldown = 0;
          e.attackLanded = false;
          e.aiState = "patrol";
          e.patrolWait = Math.max(0, (e.patrolWait ?? 0) - dt);
          if (!e.patrolTargetX || !e.patrolTargetY || Math.hypot(e.patrolTargetX - e.x, e.patrolTargetY - e.y) < 28) {
            if ((e.patrolWait ?? 0) <= 0) {
              const patrolSeed = animationNow / 5400 + e.phase + (e.patrolAnchorX ?? e.x) * .003;
              e.patrolTargetX = 70 + ((Math.sin(patrolSeed) + 1) / 2) * (deathWorldWidth - 140);
              e.patrolTargetY = band.top + 36 + ((Math.cos(patrolSeed * .83) + 1) / 2) * Math.max(32, band.bottom - band.top - 72);
              e.patrolWait = .45;
            }
          }
          const targetX = e.patrolTargetX;
          const targetY = e.patrolTargetY;
          e.moving = false;
          if (targetX !== undefined && targetY !== undefined) {
            const targetDistance = Math.max(1, Math.hypot(targetX - e.x, targetY - e.y));
            const speed = (e.kind === "boss_b1" || e.kind === "boss_b2" ? 30 : e.kind === "pursuer" ? 70 : 48) * dt;
            const dx = ((targetX - e.x) / targetDistance) * speed;
            const dy = ((targetY - e.y) / targetDistance) * speed * .72;
            const candidates = [[e.x + dx, e.y + dy], [e.x + dx, e.y], [e.x, e.y + dy]];
            const next = candidates.find(([x, y]) => isWalkable(location, x, y, deathWorldWidth, h, e.kind === "boss_b1" || e.kind === "boss_b2" ? 42 : 25, deathRoomProfile)
              && hasEnemyPlayerClearance(e, x, y, p.x, p.y));
            if (next) {
              const previousX = e.x;
              e.x = next[0]; e.y = next[1];
              e.moving = true;
              if (Math.abs(e.x - previousX) > .01) e.facing = e.x > previousX ? -1 : 1;
            }
          }
        }
        hudClock += dt;
        if (hudClock > .12) { hudClock = 0; setHud(value => ({ ...value, hp: 0, time: g.time, day: g.day })); }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#050706";
      ctx.fillRect(0, 0, w, h);
      const sx = -g.camera;
      const sceneWidth = location === "hallway" ? WORLD_W : location === "elevator" ? ELEVATOR_W : ROOM_W;
      const sceneOffset = location === "hallway" ? 0 : Math.max(0, (w - sceneWidth) / 2);
      ctx.save(); ctx.translate(sx + sceneOffset, 0);
      const activeSceneEvent = location === "room" && activeRoom !== null ? findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, activeRoom) : undefined;
      const sceneImage = location === "elevator" ? (g.floor === 0 ? sceneImages.elevatorB1 : sceneImages.elevator)
        : g.activeBoss === "boss_b1" ? sceneImages.b1
        : g.activeBoss === "boss_b2" ? sceneImages.b2
          : location === "room" && activeRoom === -99 ? sceneImages.management
            : location === "room" && activeRoom === destiny.roomSlot && g.floor === destiny.floor ? sceneImages.room
              : activeSceneEvent ? sceneImages[activeSceneEvent.sceneKey]
              : sceneImages[location];
      const sceneLightingContext = resolveSceneLightingContext(location, {
        activeBoss: g.activeBoss,
        managementOffice: location === "room" && activeRoom === -99,
        clinic: activeSceneEvent?.id === "resident_clinic",
      });
      if (sceneImage.complete && sceneImage.naturalWidth > 0) {
        ctx.drawImage(sceneImage, 0, 0, sceneWidth, h);
        ctx.fillStyle = "rgba(4,7,6,.12)";
        ctx.fillRect(0, 0, sceneWidth, h);
      }
      const timeProfile = TIME_PERIOD_PROFILES[getTimePeriod(g.time)];
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgba(${timeProfile.cold > 0 ? 8 : 35},${timeProfile.cold > 0 ? 18 : 22},${timeProfile.cold > 0 ? 29 : 12},${Math.max(0, 1 - timeProfile.exposure) * .58})`;
      ctx.fillRect(0, 0, sceneWidth, h);
      ctx.restore();
      for (const lightX of SCENE_PRESENTATION[location].lights) {
        const gradient = ctx.createRadialGradient(sceneWidth * lightX, h * .28, 8, sceneWidth * lightX, h * .42, h * .42);
        gradient.addColorStop(0, `rgba(198,215,207,${.12 * timeProfile.practicalIntensity})`);
        gradient.addColorStop(.45, `rgba(154,173,166,${.045 * timeProfile.practicalIntensity})`);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, sceneWidth, h);
      }
      if (location === "hallway") {
      for (const door of DOORS) {
        const own = g.floor === destiny.floor && door.slot === destiny.roomSlot;
        const eventRoom = findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, door.slot);
        const focused = !g.activeBoss && Math.abs(p.x - door.x) < 72 && p.y < band.top + 90;
        if (!g.activeBoss) {
          ctx.fillStyle = own ? "#dfca8d" : "#c5b99b"; ctx.font = "600 13px serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(roomNumber(g.floor, door.slot), door.x, h * door.plaqueY);
          ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        }
        if (focused) {
          ctx.fillStyle = "rgba(10,12,10,.82)"; ctx.fillRect(door.x - 48, band.top - 28, 96, 24);
          ctx.strokeStyle = own ? "#b69a57" : "#776452"; ctx.strokeRect(door.x - 48, band.top - 28, 96, 24);
          ctx.fillStyle = own ? "#dfca8d" : "#c5b99b"; ctx.font = "700 12px serif";
          ctx.fillText(own ? "你的房間" : eventRoom ? "可探索" : "其他住戶", door.x - 38, band.top - 11);
        }
      }
      if (Math.abs(p.x - HALLWAY_ELEVATOR_X) < (g.activeBoss ? 260 : 115) && p.y < band.top + 125) {
        ctx.fillStyle = "rgba(10,12,10,.82)"; ctx.fillRect(HALLWAY_ELEVATOR_X - 54, band.top - 34, 108, 28);
        ctx.strokeStyle = "#8b8069"; ctx.strokeRect(HALLWAY_ELEVATOR_X - 54, band.top - 34, 108, 28);
        ctx.fillStyle = "#d1c3a1"; ctx.font = "700 15px serif"; ctx.fillText("電梯｜E", HALLWAY_ELEVATOR_X - 34, band.top - 15);
      }

      for (const item of g.pickups) if (!item.taken) {
        const bob = 0;
        const pickupImage = item.type === "租券" ? sceneImages.pickupRent : item.type === "藥品" ? sceneImages.pickupMedicine : item.type === "裝備" ? sceneImages.pickupEquipment : item.type === "特殊權限卡" ? sceneImages.pickupKeycard10F : sceneImages.pickupKey;
        const pickupDepth = clamp((item.y - band.top) / Math.max(1, band.bottom - band.top), 0, 1);
        const pickupSize = 52 + pickupDepth * 16;
        ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.beginPath(); ctx.ellipse(item.x, item.y + 5, pickupSize * .36, 8, 0, 0, Math.PI * 2); ctx.fill();
        if (pickupImage.complete) { ctx.save(); ctx.translate(item.x, item.y - pickupSize * .22); ctx.rotate(((item.x % 29) - 14) * .012); ctx.scale(1, .72); ctx.filter = `brightness(${sampleCharacterExposure(location, item.x / sceneWidth, g.time)})`; ctx.drawImage(pickupImage, -pickupSize / 2, -pickupSize / 2 + bob, pickupSize, pickupSize); ctx.restore(); }
        if (Math.hypot(item.x - p.x, item.y - p.y) < 105) {
          ctx.fillStyle = "rgba(10,12,10,.8)"; ctx.fillRect(item.x - 35, item.y - pickupSize - 5, 70, 20);
          ctx.fillStyle = "#d7c9a6"; ctx.font = "700 11px serif"; ctx.fillText(`${item.type}｜E`, item.x - 27, item.y - pickupSize + 9);
        }
      }
      } else if (location === "room") {
        const activeEvent = activeRoom === null ? undefined : findAssignedRandomEvent(g.eventAssignments ?? [], g.floor, activeRoom);
        const own = activeRoom !== null && g.floor === destiny.floor && activeRoom === destiny.roomSlot;
        if (p.x < 175) { ctx.fillStyle = "rgba(9,12,10,.72)"; ctx.fillRect(15, h * .22, 125, 34); ctx.fillStyle = "#d0c29d"; ctx.font = "700 14px serif"; ctx.fillText("E 返回走廊", 25, h * .255); }
        if (own) {
          const nearestHomeInteraction = resolveHomeInteraction(p.x);
          if (nearestHomeInteraction.distance < 145) {
            const isBed = nearestHomeInteraction.kind === "bed";
            const promptX = (isBed ? HOME_BED_LABEL_X : HOME_STORAGE_X) - 90;
            ctx.fillStyle = "rgba(9,12,10,.78)"; ctx.fillRect(promptX, h * .38, 210, 64); ctx.fillStyle = "#d0c29d"; ctx.font = "700 16px serif"; ctx.fillText(isBed ? "承租房床鋪" : "個人儲物櫃", promptX + 15, h * .43); ctx.font = "13px serif"; ctx.fillText(isBed ? (debtTotal(g.debtLedger) > 0 ? "E　查看休息限制" : "E　休息至次日") : "靠近按 E 整理", promptX + 15, h * .47);
          }
        } else if (activeRoom === -99 && Math.abs(p.x - MANAGEMENT_DESK_X) < 145) {
          ctx.fillStyle = "rgba(9,12,10,.78)"; ctx.fillRect(MANAGEMENT_DESK_X - 90, h * .38, 210, 64); ctx.fillStyle = "#d0c29d"; ctx.font = "700 16px serif"; ctx.fillText("管理員・紅怡", MANAGEMENT_DESK_X - 75, h * .43); ctx.font = "13px serif"; ctx.fillText("E　辦理管理室業務", MANAGEMENT_DESK_X - 75, h * .47);
        } else {
          const promptX = (activeEvent?.interactionLabelX ?? 790) - 90;
          const interactionDistance = activeEvent ? distanceToEventInteraction(activeEvent, p.x) : Number.POSITIVE_INFINITY;
          if (activeEvent && interactionDistance < 145) { ctx.fillStyle = "rgba(9,12,10,.72)"; ctx.fillRect(promptX, h * .38, 180, 64); ctx.fillStyle = "#d0c29d"; ctx.font = "700 16px serif"; ctx.fillText(activeEvent.title, promptX + 15, h * .43); ctx.font = "13px serif"; ctx.fillText((g.resolvedEventIds ?? []).includes(activeEvent.id) ? "E　再次查看" : "靠近按 E 探索", promptX + 15, h * .47); }
        }
      } else {
        ctx.fillStyle = "rgba(9,12,10,.75)"; ctx.fillRect(12, h * .25, 80, 30); ctx.fillRect(750, h * .63, 220, 34);
        ctx.fillStyle = "#d0c29d"; ctx.font = "700 12px serif"; ctx.fillText("E 離開", 24, h * .28); ctx.fillText(g.floor <= 0 ? "維修貨梯控制盤｜E 操作" : "控制盤｜E 操作", 765, h * .67);
      }
      for (const e of g.enemies) if ((e.hp > 0 || e.deathTimer !== undefined) && e.location === location && (location !== "room" || e.roomSlot === activeRoom)) {
        const isBoss = e.kind === "boss_b1" || e.kind === "boss_b2";
        const enemyDepth = clamp((e.y - band.top) / Math.max(1, band.bottom - band.top), 0, 1);
        const enemyScale = .82 + enemyDepth * .26;
        const enemyDistance = Math.hypot(p.x - e.x, p.y - e.y);
        const attacking = e.hp > 0 && (e.attackTimer ?? 0) > 0;
        const movingEnemy = !attacking && Boolean(e.moving);
        const step = movingEnemy ? Math.sin(animationNow / (isBoss ? 145 : 105) + e.phase) : 0;
        const attackProgress = attacking ? 1 - (e.attackTimer ?? 0) / enemyAttackBalance(e).duration : 0;
        const lunge = attacking ? Math.sin(attackProgress * Math.PI) * (isBoss ? 18 : 11) : 0;
        const enemyLighting = sampleCharacterLighting(sceneLightingContext, e.x / sceneWidth, g.time);
        const lightManifested = e.kind !== "light" || isPatrolLightManifested(animationNow, e.phase, e.hp, g.time);
        if (lightManifested) { ctx.save(); ctx.filter = `blur(${enemyLighting.shadowBlurPx}px)`; ctx.fillStyle = `rgba(0,0,0,${enemyLighting.shadowOpacity})`; ctx.beginPath(); ctx.ellipse(e.x + enemyLighting.shadowOffsetX, e.y + 2, (e.elite || isBoss ? 48 : 34) * enemyScale, (e.elite || isBoss ? 10 : 8) * enemyScale, enemyLighting.shadowOffsetX * .009, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        const enemyFacing = e.hp <= 0 ? (e.deathFacing ?? 1) : e.aiState === "patrol" ? (e.facing ?? 1) : (p.x > e.x ? -1 : 1);
        const corpseFade = e.hp <= 0 && e.deathTimer !== undefined ? clamp(e.deathTimer, 0, 1) : 1;
        const enemyPose = e.deathTimer !== undefined ? "death" : (e.hitTimer ?? 0) > 0 ? "hit" : attacking ? "attack" : movingEnemy ? "walk" : "idle";
        ctx.save(); ctx.translate(e.x + (e.hp > 0 && p.x > e.x ? lunge : e.hp > 0 ? -lunge : 0), e.y); ctx.scale(enemyFacing, 1); ctx.filter = toCharacterCanvasFilter(enemyLighting, (e.kind === "light" ? .62 : 1) * getEnemyAnimationExposureMultiplier(enemyPose));
        ctx.globalAlpha *= lightManifested ? corpseFade : 0;
        if (e.kind === "wall" && !e.alerted) ctx.globalAlpha = .14;
        const enemyKey = e.kind === "boss_b1" ? (attacking ? "bossB1Attack" : "bossB1") : e.kind === "boss_b2" ? (attacking ? "bossB2Attack" : "bossB2") : e.kind === "light" ? "light" : e.kind === "receipt" ? "receipt" : e.elite || e.kind === "pursuer" ? (attacking ? "pursuerAttack" : "pursuer") : attacking ? "wallAttack" : "wall";
        const enemyCrops: Record<string, {x:number;y:number;w:number;h:number}> = {
          wall:{x:51,y:88,w:702,h:1485}, wallAttack:{x:21,y:164,w:891,h:1359}, light:{x:264,y:107,w:407,h:1451}, receipt:{x:120,y:56,w:874,h:1374},
          pursuer:{x:233,y:58,w:564,h:1511}, pursuerAttack:{x:157,y:76,w:705,h:1457}, bossB1:{x:64,y:85,w:758,h:1423}, bossB1Attack:{x:126,y:137,w:797,h:1343}, bossB2:{x:67,y:104,w:942,h:1342}, bossB2Attack:{x:129,y:73,w:836,h:1263},
        };
        const enemyImage = sceneImages[enemyKey as keyof typeof sceneImages];
        const enemyCrop = enemyCrops[enemyKey];
        const enemyRole = isBoss ? "boss" : e.elite || e.kind === "pursuer" ? "rentPursuer" : "normalMonster";
        const baseEnemyHeight = getCharacterRenderHeightPx(enemyRole);
        let spriteH = baseEnemyHeight * enemyScale * SCENE_PRESENTATION[location].characterScale;
        let spriteW = spriteH * (enemyCrop.w / enemyCrop.h);
        const fullSheet = e.kind === "boss_b1" ? sceneImages.bossB1FullSheet
          : e.kind === "boss_b2" ? sceneImages.bossB2FullSheet
            : e.elite || e.kind === "pursuer" ? sceneImages.pursuerFullSheet
              : e.kind === "light" ? sceneImages.lightFullSheet
                : e.kind === "receipt" ? sceneImages.receiptFullSheet
                  : null;
        if (fullSheet?.complete) {
          const deathProgress = e.deathTimer !== undefined ? clamp(((e.deathDuration ?? 3) - e.deathTimer) / (16 / 24), 0, 1) : 0;
          const hitProgress = clamp(1 - (e.hitTimer ?? 0) / .2, 0, 1);
          const frameIndex = e.deathTimer !== undefined
            ? 48 + Math.min(15, Math.floor(deathProgress * 16))
            : (e.hitTimer ?? 0) > 0
              ? 32 + Math.min(15, Math.floor(hitProgress * 16))
              : attacking
                ? 16 + Math.min(15, Math.floor(attackProgress * 16))
                : movingEnemy
                  ? Math.floor(animationNow / (1000 / 24)) % 16
                  : 0;
          const frameX = (frameIndex % 8) * 512;
          const frameY = Math.floor(frameIndex / 8) * 384;
          const sourceHeight = e.kind === "boss_b1" ? 340 : 350;
          const frameRenderH = spriteH * 384 / sourceHeight;
          const frameRenderW = frameRenderH * 512 / 384;
          spriteH = frameRenderH * sourceHeight / 384;
          spriteW = frameRenderW;
          ctx.drawImage(fullSheet, frameX, frameY, 512, 384, -frameRenderW / 2, -frameRenderH * (372 / 384), frameRenderW, frameRenderH);
        } else if (e.kind === "wall" && (sceneImages.wallMoveAttackSheet.complete || sceneImages.wallHitDieSheet.complete)) {
          const deadOrHit = e.deathTimer !== undefined || (e.hitTimer ?? 0) > 0;
          const sheet = deadOrHit ? sceneImages.wallHitDieSheet : sceneImages.wallMoveAttackSheet;
          const deathProgress = e.deathTimer !== undefined ? clamp(((e.deathDuration ?? 3) - e.deathTimer) / (16 / 24), 0, 1) : 0;
          const frameIndex = e.deathTimer !== undefined
            ? Math.min(15, Math.floor(deathProgress * 16))
            : (e.hitTimer ?? 0) > 0
              ? 4
              : attacking
                ? 8 + Math.min(7, Math.floor(attackProgress * 8))
                : movingEnemy
                  ? Math.floor(animationNow / (1000 / 24)) % 8
                  : 0;
          const frameX = (frameIndex % 4) * 512;
          const frameY = Math.floor(frameIndex / 4) * 384;
          const frameRenderH = spriteH * 384 / 340;
          const frameRenderW = frameRenderH * 512 / 384;
          spriteH = frameRenderH * 340 / 384;
          spriteW = frameRenderW;
          if (sheet.complete) ctx.drawImage(sheet, frameX, frameY, 512, 384, -frameRenderW / 2, -frameRenderH * (372 / 384), frameRenderW, frameRenderH);
        } else {
          const deathProgress = e.deathTimer !== undefined ? clamp(((e.deathDuration ?? 3) - e.deathTimer) / (16 / 24), 0, 1) : 0;
          if (deathProgress > 0) {
            ctx.translate(0, -Math.sin(deathProgress * Math.PI) * 4);
            ctx.rotate(deathProgress * Math.PI * .48);
          } else if ((e.hitTimer ?? 0) > 0) {
            ctx.rotate((p.x > e.x ? 1 : -1) * .08);
          }
          if (enemyImage.complete) ctx.drawImage(enemyImage, enemyCrop.x, enemyCrop.y, enemyCrop.w, enemyCrop.h, -spriteW / 2, -spriteH, spriteW, spriteH);
        }
        ctx.restore();
        if (e.hp > 0 && lightManifested && (isBoss || e.elite || e.combatSeen || enemyDistance < 270)) {
          const barY = e.y - spriteH - 11, barW = isBoss ? 118 : 68;
          ctx.fillStyle = "rgba(15,12,11,.84)"; ctx.fillRect(e.x - barW / 2, barY, barW, isBoss ? 9 : 6);
          ctx.fillStyle = e.elite || isBoss ? "#71332f" : "#5e3934"; ctx.fillRect(e.x - barW / 2 + 1, barY + 1, (barW - 2) * clamp(e.hp / (e.maxHp ?? 60), 0, 1), isBoss ? 7 : 4);
          const enemyName = e.kind === "boss_b1" ? "B1 維修執行人" : e.kind === "boss_b2" ? "B2 檔案保管人" : e.elite ? `追租者｜第 ${e.threat ?? 1} 級` : e.kind === "light" ? "巡燈殘影" : e.kind === "receipt" ? "拾單游魂" : "滲牆住戶";
          ctx.fillStyle="#c2b69a";ctx.font=isBoss?"700 14px serif":"11px serif";ctx.textAlign="center";ctx.fillText(enemyName,e.x,barY-7);ctx.textAlign="start";
        }
      }
      const depth = clamp((p.y - band.top) / Math.max(1, band.bottom - band.top), 0, 1);
      const depthScale = .82 + depth * .26;
      const playerLighting = sampleCharacterLighting(sceneLightingContext, p.x / sceneWidth, g.time);
      ctx.save(); ctx.filter = `blur(${playerLighting.shadowBlurPx}px)`; ctx.fillStyle = `rgba(0,0,0,${playerLighting.shadowOpacity})`; ctx.beginPath(); ctx.ellipse(p.x + playerLighting.shadowOffsetX, p.y + 2, 38 * depthScale, 8 * depthScale, playerLighting.shadowOffsetX * .008, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.scale(p.facing, 1);
      const walkPhase = renderPlayerMoving ? Math.floor(animationNow / (1000 / 12)) % 16 : -1;
      const pose = g.dead ? "death" : p.attack > 0 ? "attack" : renderPlayerMoving ? "walk" : "idle";
      const female = destiny.gender === "female";
      ctx.filter = toCharacterCanvasFilter(playerLighting, getPlayerAnimationExposureMultiplier(destiny.gender, pose));
      if (p.invuln > 0) ctx.globalAlpha = .45 + Math.sin(animationNow / 35) * .25;
      const useCandidateSheet = !g.dead && (pose === "attack" || pose === "walk");
      if (useCandidateSheet) {
        const attackProgress = pose === "attack" ? clamp(1 - p.attack / playerAttackDurationSeconds(), 0, 1) : 0;
        const frameIndex = pose === "attack" ? Math.min(15, Math.floor(attackProgress * 16)) : walkPhase;
        const sheet = female
          ? (pose === "attack" ? sceneImages.playerFemaleAttackSheet : sceneImages.playerFemaleWalkSheet)
          : (pose === "attack" ? sceneImages.playerMaleAttackSheet : sceneImages.playerMaleWalkSheet);
        const frameRenderH = getCharacterRenderHeightPx("player") * depthScale * SCENE_PRESENTATION[location].characterScale * 384 / 340;
        const frameRenderW = frameRenderH * 512 / 384;
        if (sheet.complete) ctx.drawImage(sheet, (frameIndex % 4) * 512, Math.floor(frameIndex / 4) * 384, 512, 384, -frameRenderW / 2, -frameRenderH * (372 / 384), frameRenderW, frameRenderH);
        ctx.restore();
        ctx.restore();
      } else {
      const playerImage = pose === "death"
        ? (female ? sceneImages.playerFemaleDeath : sceneImages.playerDeath)
        : pose === "attack"
        ? (female ? sceneImages.playerFemaleAttack : sceneImages.playerAttack)
        : pose === "walk"
          ? (female ? sceneImages.playerFemaleWalk : sceneImages.playerWalk)
          : (female ? sceneImages.playerFemale : sceneImages.player);
      const crop = pose === "death"
        ? (female ? { x: 256, y: 263, w: 987, h: 476 } : { x: 74, y: 218, w: 1261, h: 603 })
        : pose === "attack"
        ? (female ? { x: 101, y: 106, w: 876, h: 1181 } : { x: 66, y: 114, w: 940, h: 1203 })
        : pose === "walk"
          ? (female ? { x: 132, y: 102, w: 668, h: 1243 } : { x: 185, y: 102, w: 587, h: 1218 })
          : (female ? { x: 214, y: 97, w: 562, h: 1263 } : { x: 201, y: 79, w: 588, h: 1278 });
      const spriteH = (pose === "death" ? 126 : getCharacterRenderHeightPx("player")) * depthScale * SCENE_PRESENTATION[location].characterScale;
      const spriteW = spriteH * (crop.w / crop.h);
      if (playerImage.complete) ctx.drawImage(playerImage, crop.x, crop.y, crop.w, crop.h, -spriteW * .48, -spriteH, spriteW, spriteH);
      ctx.restore();
      ctx.restore();
      }

      const sceneGrade = sampleSceneColorGrade(sceneLightingContext, g.time);
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgba(${sceneGrade.multiply[0]},${sceneGrade.multiply[1]},${sceneGrade.multiply[2]},${sceneGrade.multiplyOpacity})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(${sceneGrade.softLight[0]},${sceneGrade.softLight[1]},${sceneGrade.softLight[2]},${sceneGrade.softLightOpacity})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();


      if (g.debtMode) { const v = ctx.createRadialGradient(w / 2, h / 2, h * .55, w / 2, h / 2, h * .9); v.addColorStop(0, "transparent"); v.addColorStop(1, "rgba(72,45,35,.14)"); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
      if (p.hp < (76 + destiny.attributes[0] * 5) * .3) { const low = clamp(1 - p.hp / ((76 + destiny.attributes[0] * 5) * .3), 0, 1); const v = ctx.createRadialGradient(w/2,h/2,h*.5,w/2,h/2,h*.86);v.addColorStop(0,"transparent");v.addColorStop(1,`rgba(92,18,17,${.1 + low * .2})`);ctx.fillStyle=v;ctx.fillRect(0,0,w,h); }
      if (g.phaseFlash > 0) { const flashStep = Math.floor((.75 - g.phaseFlash) / .125); if (flashStep >= 0 && flashStep < 6 && flashStep % 2 === 0) { ctx.fillStyle = "rgba(215,228,216,.3)"; ctx.fillRect(0, 0, w, h); } }
      ctx.fillStyle = "rgba(255,255,255,.035)"; for (let i = 0; i < 60; i++) ctx.fillRect((i * 89 + frame * 3) % w, (i * 47) % h, 1, 1);
      frame++; animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resize); };
  }, [activeRoom, advanceToNextDay, cinematicOverlayOpen, controls, demoEndingState, flow.screen, paused, floorSelect, roomEvent, storageOpen, location, destiny.attributes, destiny.floor, destiny.roomSlot, destiny.gender, destiny.talent, destiny.defect, sound]);

  useEffect(() => {
    const updateDesktopScale = () => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      setDesktopScale(Math.min(1, viewportWidth / 1600, viewportHeight / 900));
    };
    updateDesktopScale();
    window.addEventListener("resize", updateDesktopScale);
    window.visualViewport?.addEventListener("resize", updateDesktopScale);
    return () => {
      window.removeEventListener("resize", updateDesktopScale);
      window.visualViewport?.removeEventListener("resize", updateDesktopScale);
    };
  }, []);
  const maxHp = 76 + destiny.attributes[0] * 5;
  const maxStamina = 72 + destiny.attributes[1] * 5;
  const attentionLabel = hud.attention <= 1 ? "未留意" : hud.attention <= 3 ? "低度監控" : hud.attention <= 5 ? "監控強化" : hud.attention <= 7 ? "高度關注" : hud.attention <= 9 ? "全面追蹤" : "回收程序";
  const managementBroadcast = /管理室|租約|租金|欠款|追租程序|居住權|結算/.test(message);
  const floor10Visible = FLOOR10_VISIBLE_STATES.has(demoEndingState);
  const elevatorFloorNow = game.current.activeBoss === "boss_b1" ? "B1" : game.current.activeBoss === "boss_b2" ? "B2" : `${hud.floor}F`;
  return (
    <main className={`game-shell ${started ? "is-started" : "is-menu"}`} onContextMenu={event => event.preventDefault()} onDragStart={event => { if (event.target instanceof HTMLImageElement) event.preventDefault(); }}>
      <div className="desktop-game-viewport" style={{ width: 1600 * desktopScale, height: 900 * desktopScale }}>
      <div className="desktop-game-stage" style={{ transform: `scale(${desktopScale})` }}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="無期租寓可玩遊戲區" />
      <div className="film" />
      <header className="topbar"><span>無期租寓</span><b>第 {hud.day} 日　目前時間 {inGameClock(hud.time)}　{phaseName(hud.time)}　目前樓層 {game.current.activeBoss ? (game.current.activeBoss === "boss_b1" ? "B1" : "B2") : `${hud.floor}F`}　承租房 {roomNumber(destiny.floor, destiny.roomSlot)}</b><button onClick={() => setProfileOpen(true)}>住戶檔案</button><button onClick={() => { if (!paused) dispatchFlow({ type: "TOGGLE_PAUSE" }); setTerminalRecordOpen(false); setLogOpen(true); }}>住戶紀錄</button><button disabled={flow.overlay.kind !== "none" || dead || complete} onClick={() => dispatchFlow({ type: "TOGGLE_PAUSE" })}>{paused ? "繼續" : "暫停"}</button></header>
      <section className="rent-card"><small>今日租金</small><strong>{hud.rentDue} 租券</strong><b>距離結算　{formatTime(hud.time)}</b><em>既有欠款　{hud.debt} 租券</em></section>
      <section className="vitals"><label><span>生命　{Math.ceil(hud.hp)} / {maxHp}</span><i style={{ width: `${clamp(hud.hp / maxHp * 100, 0, 100)}%` }} /></label><label><span>體力　{Math.ceil(hud.stamina)} / {maxStamina}</span><i style={{ width: `${clamp(hud.stamina / maxStamina * 100, 0, 100)}%` }} /></label></section>
      <section className="score-card"><small>租券</small><strong>{hud.rent}</strong><span>戰力　{hud.score}</span></section>
      {started && <div className="inventory-bar">
        <button><i>1</i><b>改造鋼管</b><span>Lv.{hud.weaponLevel}</span></button>
        <button onClick={useMedkit} disabled={hud.medkits <= 0 || medkitCooldown > 0}><i>2</i><b>逾期藥品</b><span>{medkitCooldown > 0 ? `${medkitCooldown.toFixed(1)}秒` : `×${hud.medkits}`}</span></button>
        <button disabled={hud.keysOwned <= 0}><i>3</i><b>房門鑰匙</b><span>×{hud.keysOwned}</span></button>
        <button className="talent-button" onClick={useTalent} disabled={hud.skillCooldown > 0}><i>Q</i><b>{destiny.talent}</b><span>{hud.skillCooldown > 0 ? `${Math.ceil(hud.skillCooldown)}秒` : "可使用"}</span></button>
      </div>}
      {managementBroadcast ? <div key={message} className="mission"><small>管理室通知</small><span>{message}</span></div> : <div key={message} className="action-toast">{message}</div>}
      {hud.landlordTask && <div className="task-slip"><small>房東委託</small><b>清除追租異常</b><span>{hud.taskKills} / 2</span></div>}
      {started && <section className={`lease-status ${hud.debt > 0 ? "overdue" : ""}`}><h3>租約狀態</h3><dl><div><dt>欠款</dt><dd>{hud.debt} 租券</dd></div><div><dt>追租程序</dt><dd>{hud.debt > 0 ? "已啟動" : "未啟動"}</dd></div><div><dt>承租房保護</dt><dd>{debtStatus.protectionLost ? "失效" : "有效"}</dd></div><div><dt>公寓關注度</dt><dd>{Math.min(10,hud.attention)} / 10</dd></div><div><dt>監控狀態</dt><dd>{attentionLabel}</dd></div></dl></section>}
      {elevatorVoiceSubtitle && <div className="hongyi-elevator-subtitle" role="status"><b>管理員・紅怡</b><span>{elevatorVoiceSubtitle}</span></div>}
      {mortgageMarks.length > 0 && <div className="mortgage-status"><small>能力抵押／輪迴保留</small><b>{mortgageMarks.join("　")}</b></div>}
      {hud.day === 1 && <div className="desktop-help">WASD　移動　　Shift　奔跑　　Space　攻擊　　E　互動</div>}
      {paused && !logOpen && !savePanelOpen && !exitPromptOpen && !settingsOpen && <DesignSystemRoot className="pause-menu"><div><small>無期租寓管理室｜暫停登記單</small><h2>暫停</h2><ManagementButton onClick={() => dispatchFlow({type:"TOGGLE_PAUSE"})}>繼續遊戲</ManagementButton><ManagementButton onClick={() => { writeSaveRecord(0); refreshSaveRecords(); setSavePanelOpen(true); }}>存檔管理</ManagementButton><ManagementButton onClick={() => setSettingsOpen(true)}>設定</ManagementButton><ManagementButton onClick={() => setExitPromptOpen(true)}>結束遊戲</ManagementButton></div></DesignSystemRoot>}
      {paused && settingsOpen && <DesignSystemRoot className="settings-ledger"><article><header><small>無期租寓管理室｜住戶環境設定表</small><h2>設定</h2></header><section><h3>操作控制</h3><div className="settings-control-grid">{([['up','向上'],['down','向下'],['left','向左'],['right','向右']] as Array<[ControlAction,string]>).map(([action,label]) => <ManagementButton key={action} onClick={() => setListeningControl(action)}><span>{label}</span><b>{listeningControl === action ? "請按下按鍵" : controls[action] === " " ? "Space" : controls[action].toUpperCase()}</b></ManagementButton>)}</div></section><section><h3>按鍵設置</h3><div className="settings-control-grid">{([['sprint','奔跑'],['attack','攻擊'],['interact','互動'],['talent','天賦']] as Array<[ControlAction,string]>).map(([action,label]) => <ManagementButton key={action} onClick={() => setListeningControl(action)}><span>{label}</span><b>{listeningControl === action ? "請按下按鍵" : controls[action] === " " ? "Space" : controls[action].toUpperCase()}</b></ManagementButton>)}</div></section><section><h3>環境設置</h3><div className="audio-settings"><button className="audio-mute" type="button" aria-pressed={muted} onClick={() => setMuted(value => !value)}><span>全部靜音</span><b>{muted ? "已啟用" : "未啟用"}</b></button>{([['master','總音量'],['sfx','音效'],['music','音樂'],['voice','語音']] as Array<[keyof AudioLevels,string]>).map(([channel,label]) => <label key={channel}><span>{label}</span><input aria-label={label} type="range" min="0" max="100" step="1" value={audioLevels[channel]} onChange={event => setAudioLevels(current => ({ ...current, [channel]: Number(event.target.value) }))}/><b>{audioLevels[channel]}%</b></label>)}</div></section><footer><ManagementButton data-variant="paper" onClick={() => { setListeningControl(null); setSettingsOpen(false); }}>完成</ManagementButton></footer></article></DesignSystemRoot>}
      {savePanelOpen && <DesignSystemRoot className="save-ledger"><article><header><small>無期租寓管理室｜住戶存檔簿</small><h2>存檔管理</h2><ManagementButton onClick={() => setSavePanelOpen(false)}>關閉文件</ManagementButton></header><div className="save-slots">{saveRecords.map((record,index)=><section key={index}><div className="save-thumbnail">{record?.thumbnail ? <img src={record.thumbnail} alt={`存檔 ${index} 場景縮圖`}/> : <span>尚無場景縮圖</span>}</div><small>{index === 0 ? "自動存檔" : `手動存檔 ${index}`}</small><b>{record ? new Date(record.savedAt).toLocaleString("zh-TW") : "空白欄位"}</b>{index === 0 ? <em>遊戲進度自動更新</em> : <ManagementButton onClick={() => writeSaveRecord(index)}>覆寫存檔</ManagementButton>}</section>)}</div></article></DesignSystemRoot>}
      {exitPromptOpen && <section className="exit-save-prompt"><article><small>離開前存檔詢問</small><h2>是否保存本輪進度？</h2><p>選擇「是」會更新自動存檔與場景縮圖；選擇「否」會清除本輪自動進度後離開。</p><footer><button onClick={() => leaveRunFromPause(true)}>是，存檔後離開</button><button onClick={() => leaveRunFromPause(false)}>否，直接離開</button><button onClick={() => setExitPromptOpen(false)}>取消</button></footer></article></section>}
      {overdueNotice && <section className="overdue-notice" aria-live="assertive"><article><small>管理室牆面公告槽｜追租執行通知｜3 秒後收回</small><h2>拒絕交租紀錄</h2><p>{overdueNotice}</p><strong>公告期間遊戲持續；追租者可立即攻擊，並可進入房間、公共樓層、電梯與管理室。</strong></article></section>}
      {logOpen && <section className="resident-log"><div><header><small>{terminalRecordOpen ? "本輪已封存｜唯讀文件" : "住戶個人文件"}</small><h2>住戶執行紀錄</h2><button onClick={() => { setLogOpen(false); if (terminalRecordOpen) setDemoEndingOpen(true); }}>關閉</button></header><p>{terminalRecordOpen ? "結案後不可恢復探索；關閉文件將返回結案畫面。" : "此處只記錄本輪住戶的行動與結果，不屬於管理室公告。"}</p><ol>{residentLog.length ? residentLog.map((entry,index)=><li key={`${entry}-${index}`}>{entry}</li>) : <li>本輪尚無執行紀錄。</li>}</ol></div></section>}
      {profileOpen && <section className="resident-profile"><article><header><small>無期租寓管理室｜住戶隨身檔案</small><h2>{residentName || "未署名住戶"}</h2><button onClick={() => setProfileOpen(false)}>收回檔案</button></header><div className="profile-columns"><section><h3>本輪身份</h3><dl><div><dt>承租房</dt><dd>{roomNumber(destiny.floor,destiny.roomSlot)}</dd></div><div><dt>身份背景</dt><dd>{destiny.identity}</dd></div><div><dt>天賦／缺陷</dt><dd>{destiny.talent}／{destiny.defect}</dd></div><div><dt>武器登記</dt><dd>改造鋼管 Lv.{hud.weaponLevel}</dd></div></dl></section><section><h3>背包</h3><div className="profile-inventory"><span><small>租券</small><b>{hud.rent}</b></span><span><small>過期藥品</small><b>×{hud.medkits}</b></span><span><small>房門鑰匙</small><b>×{hud.keysOwned}</b></span><span className="permission-item"><small>特殊權限物</small><b>{["KEYCARD_COLLECTED","CLEARANCE_REPORT_VIEWED","FLOOR10_BUTTON_DISCOVERED","RETURN_TO_OFFICE"].includes(demoEndingState) ? "10F 權限卡｜隨身" : ["KEYCARD_DELIVERED","POST_B2_FREE_ROAM","FLOOR10_NOTICE_DISCOVERED","DEMO_ENDING_STARTED","DEMO_COMPLETED"].includes(demoEndingState) ? "10F 權限卡｜管理室登記" : "未持有"}</b></span></div></section></div><footer>按 C 開啟／收回住戶檔案。行政事件期間不可翻閱。</footer></article></section>}
      {flow.screen === "title" && <DesignSystemRoot className={`start-screen ${titleTransitioning ? "is-leaving" : ""}`}>
        <div className="start-copy">
          <h1><img src="/logo-title-v1.png" alt="無期租寓"/></h1>
          <blockquote className="title-slogan">
            <span>付得起租金，活得像人。</span>
            <span>付不起租金，歸於樓宇。</span>
          </blockquote>
          <div className="title-actions">
            <ManagementButton data-variant="paper" disabled={titleTransitioning} onClick={beginNewRegistration}>開始入住登記</ManagementButton>
            {availableSave && <ManagementButton disabled={titleTransitioning} onClick={continueSavedRun}>繼續上次入住</ManagementButton>}
          </div>
        </div>
      </DesignSystemRoot>}
      {introOpen && <section className="intro-screen">
        <article className="intro-contract" aria-label="入住登記表">
          <header className="registration-header">
            <b>無期租寓管理室</b>
            <small>WUCHI APARTMENT MANAGEMENT OFFICE</small>
            <span>表單 01-A<br/>FORM 01-A</span>
          </header>
          <h1>入住登記表</h1>
          <h2>入寓抵債，萬事皆平</h2>
          <div className="registration-copy">
            <p>現實從不會無故吞沒一個人，它只會先奪走一張被規則允許的假象。</p>
            <p>你曾欠下一筆無形債務，因此這棟公寓替你保留了一個位置。</p>
            <p>提交登記後，管理室將展開本輪審查，並決定你此後的命運輪廓。</p>
          </div>
          <blockquote>「記憶歸零，債務留存。命運重擲，租約無期。」</blockquote>
          <label className="intro-name">
            <span>本輪住戶姓名</span>
            <input value={residentName} maxLength={18} autoComplete="off" onChange={event => setResidentName(event.target.value)} placeholder="請填寫姓名"/>
          </label>
          <fieldset className="intro-gender">
            <legend>本輪住戶性別</legend>
            <button type="button" className={registrationGender === "male" ? "selected" : ""} onClick={() => { setRegistrationGender("male"); setDestiny(value => ({...value, gender:"male"})); }}>男性</button>
            <button type="button" className={registrationGender === "female" ? "selected" : ""} onClick={() => { setRegistrationGender("female"); setDestiny(value => ({...value, gender:"female"})); }}>女性</button>
          </fieldset>
          <button className="registration-submit" disabled={!residentName.trim() || registrationGender === null} onClick={() => { setFilingStage("ready"); dispatchFlow({ type: "OPEN_DESTINY" }); sound("rent"); }}>接受資格審查</button>
          <span className="registration-rules">閱讀租寓規則</span>
          <small className="intro-rules">提交後，系統將依此資訊生成本輪初始檔案。</small>
        </article>
      </section>}
      {!started && destinyOpen && <section className={`destiny-screen stage-${filingStage}`}>
        <nav className="filing-progress" aria-label="租約建檔進度"><span className={filingStage === "ready" || filingStage === "rolling" ? "active" : "done"}>骰子結果</span><i>›</i><span className={filingStage === "attributes" ? "active" : filingStage === "briefing" || filingStage === "result" || filingStage === "complete" ? "done" : ""}>選擇建檔</span><i>›</i><span className={filingStage === "briefing" || filingStage === "result" || filingStage === "complete" ? "active" : ""}>身份確認</span></nav>
        <div className="contract-head">
          <span>無期租寓管理室</span>
          <small>入住登記表｜表單 17-B</small>
          {(filingStage !== "ready" && filingStage !== "rolling") && <h2>租約建檔</h2>}
          <p>{filingStage === "complete"
            ? "建檔程序已完成。你的身份已被管理室正式存檔。"
            : filingStage === "result"
              ? "你所選擇的檔案將成為公寓對你的最終認定。這些資訊將定義你在本輪的存在方式、局限與可用能力。"
              : filingStage === "attributes"
                ? "本輪骰面已完成登記。"
                : "管理室將以骰面裁定你的暫定身份，此結果會影響後續建檔資料與居住條件。"}</p>
          <div className="dossier-rule"/>
          <blockquote>{filingStage === "complete" ? "本輪居住權即刻生效。" : "在這裡，每一份檔案，都是你在這棟世界裡的存續證明。"}</blockquote>
          <footer>◇ ROOM 17 ◇</footer>
        </div>
        {(filingStage === "ready" || filingStage === "rolling") && <div className="filing-die">
          <header>
            <small>骰子結果</small>
            <h3>命運裁定</h3>
            <p>管理室將以骰面裁定你的暫定身份。請靜候片刻，接受寓所的裁定。</p>
          </header>
          <div className={`physical-die-tray ${filingStage === "rolling" ? "rolling" : ""}`}>
            <DiceRollScene values={destiny.attributes} rolling={filingStage === "rolling"}/>
          </div>
          <p className="roll-instruction">請擲出本輪建檔結果。</p>
          <ManagementButton className="fate-roll-action" data-variant="paper" disabled={filingStage === "rolling"} onClick={beginFiling}>{filingStage === "rolling" ? "裁定中…" : "擲出結果"}</ManagementButton>
          <ManagementButton className="return-registration" disabled={filingStage === "rolling"} onClick={() => dispatchFlow({ type: "RETURN_REGISTRATION" })}>返回登記資料</ManagementButton>
        </div>}
        {filingStage === "attributes" && <div className="filing-main">
          <header><h3>依骰子結果建立的檔案</h3></header>
          <div className="dice-grid filing-values">
            {ATTRIBUTE_NAMES.map((name, index) => <article key={name} className="die">
              <small>{name}</small>
              <strong>{destiny.attributes[index]}</strong>
            </article>)}
          </div>
          {inlineRerolling && <div className="inline-reroll" aria-label="重新擲骰動畫"><DiceRollScene values={destiny.attributes} rolling/></div>}
        </div>}
        {filingStage === "result" && <div className="filing-main">
          <header><h3>確認你的最終建檔內容</h3><span>請確認資訊後完成建檔</span></header>
          <div className="fate-details filing-result">
            <article><small>身份背景</small><b>{destiny.identity}</b><p className="detail">{IDENTITY_LORE[destiny.identity]}</p></article>
            <article><small>天賦技能</small><b>{destiny.talent}</b><p className="detail">{TALENT_DESCRIPTIONS[destiny.talent]}</p></article>
            <article className="defect"><small>缺陷／詛咒</small><b>{destiny.defect}</b><p className="detail">{DEFECT_DESCRIPTIONS[destiny.defect]}</p></article>
            <article><small>初始租房</small><b>{roomNumber(destiny.floor, destiny.roomSlot)}</b><p className="detail">本輪從此房間出生；只有你與獲得授權的玩家可以正常進入。</p></article>
          </div>
        </div>}
        {filingStage === "attributes" && <div className="contract-actions">
          <ManagementButton className="reroll" disabled={inlineRerolling} onClick={beginFiling}>再骰一次<small>重新獲得結果</small></ManagementButton>
          <ManagementButton className="accept" data-variant="paper" disabled={inlineRerolling} onClick={confirmIdentity}>身份確認<small>建立正式檔案</small></ManagementButton>
          <p className="filing-warning">一經確認將無法更改，請謹慎選擇</p>
        </div>}
        {filingStage === "briefing" && <div className={`hongyi-briefing ${briefingFading ? "is-fading" : ""}`} role="status" aria-live="polite"><small>租寓管理室｜紅怡</small><p>「{HONG_YI_LINES.registrationComplete}」</p><span>登記編號　17-B-{String(destiny.floor).padStart(2,"0")}{destiny.roomSlot}</span></div>}
        {filingStage === "result" && <div className="contract-actions">
          <ManagementButton className="reroll" onClick={() => setFilingStage("attributes")}>返回修改<small>重新決定身份</small></ManagementButton>
          <ManagementButton className="accept" data-variant="paper" onClick={finishFiling}>確認建檔結果<small>建立正式檔案</small></ManagementButton>
          <p className="filing-warning">一經確認將無法更改，請謹慎確認</p>
        </div>}
        {filingStage === "complete" && <div className="filing-complete">
          <header><span>建檔完成</span><small>居住權已正式生效</small></header>
          <article>
            <small>租約建檔完成。<br/>居住權已生效。</small>
            <strong><span>無退租。</span><span>無到期。</span><em>無例外。</em></strong>
            <i className="lease-seal" aria-hidden="true">封</i>
            <b>ROOM 17 — DOSSIER SEALED</b>
          </article>
          <div className="filing-summary">
            <span>身份背景<b>{destiny.identity}</b></span>
            <span>天賦技能<b>{destiny.talent}</b></span>
            <span>缺陷／詛咒<b>{destiny.defect}</b></span>
            <span>初始租房<b>{roomNumber(destiny.floor, destiny.roomSlot)}</b></span>
          </div>
          <div className="filing-complete-actions">
            <ManagementButton className="enter-lease" data-variant="paper" onClick={reset}>入住</ManagementButton>
            <p>建檔已封存，身份資料不可撤回</p>
          </div>
        </div>}
      </section>}
      {started && settlement && <section className="settlement-screen">
        <div className="settlement-paper">
          <header><small>無期租寓管理室｜日租結算通知</small><h2>第 {hud.day} 日</h2><strong>當期 {settlementResult?.rentAmount ?? 0} 租券</strong><p>{settlementResult?.paymentSucceeded ? `已完整支付 ${settlementResult.amountPaid} 租券。` : `持有租券不足，未扣除任何金額；完整 ${settlementResult?.debtAdded ?? 0} 租券已列入欠款。`}</p></header>
          <div className="settlement-options">
            <button onClick={acknowledgeSettlement}><b>確認結算</b><span>{hud.debt > 0 ? `累積欠款 ${hud.debt} 租券；請前往管理處找紅怡一次結清。` : `目前沒有欠款；承租房床鋪可正常使用。`}</span></button>
          </div>
          <footer>承租房 {roomNumber(destiny.floor, destiny.roomSlot)}｜房租只在日期增加時結算一次；欠款不接受部分支付。</footer>
        </div>
      </section>}
      {started && bedDialog !== null && <section className="bed-rent-dialog"><article>
        <small>{roomNumber(destiny.floor, destiny.roomSlot)}｜承租房床鋪</small>
        {bedDialog === "blocked" ? <>
          <h2>休息權限已暫停</h2><strong>目前欠繳：{hud.debt} 租券</strong>
          <p>請前往管理處，向紅怡一次繳清全部欠款後，恢復床鋪休息權限。</p>
          <blockquote>居住權仍有效。完整休息權限已凍結。</blockquote>
          <footer><ManagementButton data-variant="paper" onClick={() => setBedDialog(null)}>確認</ManagementButton></footer>
        </> : <>
          <h2>完整休息</h2><p>生命將完全恢復。今日剩餘時間將直接結束，遊戲將前進至下一日房租結算。</p>
          <dl><div><dt>目前日期</dt><dd>第 {hud.day} 日</dd></div><div><dt>目前時間</dt><dd>{inGameClock(hud.time)}</dd></div><div><dt>下一期房租</dt><dd>{hud.rentDue} 租券</dd></div></dl>
          {hud.rent < hud.rentDue && <p className="bed-rent-warning">警告：目前租券不足以支付下一期房租。結算後將進入欠租狀態，床鋪休息權限會停用。</p>}
          <footer><ManagementButton onClick={() => setBedDialog(null)}>取消</ManagementButton><ManagementButton data-variant="paper" onClick={() => advanceToNextDay("sleep")}>休息</ManagementButton></footer>
        </>}
      </article></section>}
      {started && hongYiRentDialog !== null && <section className="bed-rent-dialog hongyi-rent-dialog"><article>
        <small>租寓管理室｜管理員・紅怡</small>
        {hongYiRentDialog === "none" && <><h2>帳本無欠款</h2><p>「目前沒有掛帳。別把準時當成恩惠。」</p><footer><ManagementButton data-variant="paper" onClick={() => setHongYiRentDialog(null)}>離開</ManagementButton></footer></>}
        {hongYiRentDialog === "offer" && <><h2>「你的帳還掛著。」</h2><dl><div><dt>欠款</dt><dd>{hud.debt} 租券</dd></div><div><dt>持有</dt><dd>{hud.rent} 租券</dd></div></dl><footer><ManagementButton onClick={() => setHongYiRentDialog(null)}>離開</ManagementButton><ManagementButton data-variant="paper" onClick={() => setHongYiRentDialog(hud.rent >= hud.debt ? "confirm" : "insufficient")}>繳交欠租</ManagementButton></footer></>}
        {hongYiRentDialog === "insufficient" && <><h2>無法結清</h2><dl><div><dt>欠款</dt><dd>{hud.debt}</dd></div><div><dt>持有</dt><dd>{hud.rent}</dd></div><div><dt>尚缺</dt><dd>{Math.max(0, hud.debt - hud.rent)}</dd></div></dl><p>「管理處只接受一次結清。等你湊齊再來。」</p><footer><ManagementButton data-variant="paper" onClick={() => setHongYiRentDialog(null)}>離開</ManagementButton></footer></>}
        {hongYiRentDialog === "confirm" && <><h2>一次付清全部欠款</h2><p>欠款：{hud.debt} 租券<br/>持有：{hud.rent} 租券</p><strong>是否一次付清全部欠款？</strong><footer><ManagementButton onClick={() => setHongYiRentDialog("offer")}>取消</ManagementButton><ManagementButton data-variant="paper" onClick={confirmHongYiPayment}>支付 {hud.debt}</ManagementButton></footer></>}
        {hongYiRentDialog === "success" && <><h2>「收到了。」</h2><p>欠款已全部清償。床鋪休息權限已恢復。</p><footer><ManagementButton data-variant="paper" onClick={() => setHongYiRentDialog(null)}>完成</ManagementButton></footer></>}
        {hongYiRentDialog === "error" && <><h2>交易未完成</h2><p>帳本沒有變動，請重新與紅怡辦理。</p><footer><ManagementButton data-variant="paper" onClick={() => setHongYiRentDialog(null)}>離開</ManagementButton></footer></>}
      </article></section>}
      {started && dayTransitionVisual !== null && <section className="day-transition" aria-live="polite"><span>{dayTransitionVisual === "sleep" ? "休息中" : "日期結算中"}</span></section>}
      {started && roomEventDefinition && <section className="room-event-screen"><div className="room-event-card">
        <small>{roomNumber(hud.floor, activeRoom ?? 0)} 號房｜未登記空間</small><h2>{roomEventDefinition.title}</h2><p>{roomEventDefinition.description}</p>
        <p className="auto-choice">離開探索物件的互動範圍會關閉事件窗；要離開房間請走回門口。</p>
        <div>{roomEventDefinition.choices.map((choice, index) => <button key={choice} onClick={() => resolveRoom(index)}>{choice}</button>)}</div>
      </div></section>}
      {started && storageOpen && <section className="storage-screen"><div className="storage-panel"><header><small>{roomNumber(destiny.floor, destiny.roomSlot)}｜住戶寄存櫃</small><h2>{storageCapacity} 格寄存位</h2><p>點擊寄存位後，從背包選取要寄存的物品。租券沒有堆疊上限，存入與取出時自行填寫數量。</p></header><div className="storage-slots">{Array.from({ length: storageCapacity }, (_, index) => { const stack = storage.find(item => item.slot === index); return <button type="button" key={stack?.id ?? `empty-${index}`} className={`${stack ? "filled" : "empty"} ${selectedStorageSlot === index ? "selected" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { const kind = event.dataTransfer.getData("application/x-lease-item") as StorageKind; setSelectedStorageSlot(index); if (kind === "rent") setStorageAmount({slot:index,direction:"store",value:String(hud.rent)}); else if (kind) transferStorage(kind,"store",index,1); }} onClick={() => setSelectedStorageSlot(index)}><i>寄存位 {String(index + 1).padStart(2,"0")}</i>{stack ? <><img className="stored-icon" src={stack.kind === "rent" ? "/pickup-rent-v1.png" : stack.kind === "medkits" ? "/pickup-medicine-v1.png" : "/pickup-key-v1.png"} alt=""/><b>{stack.kind === "rent" ? "租券" : stack.kind === "medkits" ? "過期藥品" : "房門鑰匙"}</b><strong>{stack.kind === "rent" ? stack.quantity : `×${stack.quantity}`}</strong><span>點擊管理</span></> : <span>目前空置</span>}</button>; })}</div>{selectedStorageSlot !== null && <div className="storage-backpack"><header><b>{storage.find(item => item.slot === selectedStorageSlot) ? "寄存位內容" : "背包"}</b><button onClick={() => setSelectedStorageSlot(null)}>關閉</button></header>{(() => { const stack = storage.find(item => item.slot === selectedStorageSlot); if (stack) return <div className="stored-item"><img className="stored-icon" src={stack.kind === "rent" ? "/pickup-rent-v1.png" : stack.kind === "medkits" ? "/pickup-medicine-v1.png" : "/pickup-key-v1.png"} alt=""/><b>{stack.kind === "rent" ? `租券 ${stack.quantity}` : stack.kind === "medkits" ? `過期藥品 ×${stack.quantity}` : `房門鑰匙 ×${stack.quantity}`}</b><button className="asset-button" onClick={() => stack.kind === "rent" ? setStorageAmount({slot:selectedStorageSlot,direction:"take",value:String(stack.quantity)}) : transferStorage(stack.kind,"take",selectedStorageSlot,1)}>取出</button></div>; return <div className="backpack-items"><button draggable disabled={hud.rent <= 0} onDragStart={event => event.dataTransfer.setData("application/x-lease-item","rent")} onClick={() => setStorageAmount({slot:selectedStorageSlot,direction:"store",value:String(hud.rent)})}><img src="/pickup-rent-v1.png" alt=""/>租券<b>{hud.rent}</b></button><button draggable disabled={hud.medkits <= 0} onDragStart={event => event.dataTransfer.setData("application/x-lease-item","medkits")} onClick={() => transferStorage("medkits","store",selectedStorageSlot,1)}><img src="/pickup-medicine-v1.png" alt=""/>過期藥品<b>×{hud.medkits}</b></button><button draggable disabled={hud.keysOwned <= 0} onDragStart={event => event.dataTransfer.setData("application/x-lease-item","keys")} onClick={() => transferStorage("keys","store",selectedStorageSlot,1)}><img src="/pickup-key-v1.png" alt=""/>房門鑰匙<b>×{hud.keysOwned}</b></button></div>; })()}</div>}{storageAmount && <div className="storage-amount-dialog" role="dialog" aria-modal="true"><label>{storageAmount.direction === "store" ? "存入" : "取出"}租券數量<input type="text" inputMode="none" readOnly value={storageAmount.value}/></label><div className="storage-keypad">{["1","2","3","4","5","6","7","8","9","清除","0","倒退"].map(key => <ManagementButton key={key} onClick={() => setStorageAmount(current => current ? {...current,value:key === "清除" ? "" : key === "倒退" ? current.value.slice(0,-1) : `${current.value}${key}`.replace(/^0+/,"")} : current)}>{key}</ManagementButton>)}</div><div><ManagementButton onClick={() => setStorageAmount(null)}>取消</ManagementButton><ManagementButton data-variant="paper" onClick={() => { transferStorage("rent",storageAmount.direction,storageAmount.slot,Number(storageAmount.value)); setStorageAmount(null); }}>確認</ManagementButton></div></div>}<div className="storage-actions"><ManagementButton className="close-storage" onClick={() => { setSelectedStorageSlot(null); setStorageAmount(null); dispatchFlow({ type: "CLOSE_OVERLAY", kind: "storage" }); }}>關閉櫃門</ManagementButton></div></div></section>}
      {started && floorSelect && <section className={`floor-select-screen ${elevatorTarget ? "in-transit" : ""}`}>
        <div className="elevator-console" aria-label="老式電梯控制盤">
          <div className="floor-indicator" role="status">目前樓層：<strong>{elevatorDisplay ?? elevatorFloorNow}</strong></div>
          <div className="floor-buttons">
            {floor10Visible && <button aria-label="10F" className={`floor10-pending ${elevatorTarget === "10F" ? "pressed" : ""}`} disabled={Boolean(elevatorTarget) || ["FLOOR10_NOTICE_DISCOVERED","DEMO_ENDING_STARTED","DEMO_COMPLETED"].includes(demoEndingState)} onClick={() => { if (["KEYCARD_DELIVERED","POST_B2_FREE_ROAM"].includes(demoEndingState)) { if (demoEndingState === "POST_B2_FREE_ROAM") progressDemoEnding("FLOOR10_NOTICE_DISCOVERED"); setFloor10NoticeOpen(true); setMessage("十樓候選住戶通知已從控制盤文件槽推出"); return; } const firstAttempt = floor10Attempts === 0; const line = firstAttempt ? DEMO_ENDING_ZH_TW["demo.elevator.floor10.first_interaction"] : DEMO_ENDING_ZH_TW["demo.elevator.floor10.repeat_interaction"]; setFloor10Attempts(value => value + 1); if (demoEndingState === "CLEARANCE_REPORT_VIEWED") progressDemoEnding("FLOOR10_BUTTON_DISCOVERED"); setMessage(line); setElevatorVoiceSubtitle(line); playVoice(firstAttempt ? 3 : 4, () => window.setTimeout(() => setElevatorVoiceSubtitle(null), 1000)); }}><strong>10F</strong><span className="button-lamp" aria-hidden="true"/></button>}
            {ELEVATOR_PANEL_FLOORS.map(floor => { const locked = !canAccessDemoFloor(floor, destiny.floor, demoEndingState); const current = !game.current.activeBoss && floor === hud.floor; return <button key={floor} aria-label={`${floor}F`} disabled={locked || current || Boolean(elevatorTarget)} className={`${locked ? "locked" : ""} ${current ? "current" : ""} ${elevatorTarget === `${floor}F` ? "pressed" : ""}`} onClick={() => beginElevatorTravel(floor)}><strong>{floor}F</strong><span className="button-lamp" aria-hidden="true"/></button>; })}
            <button aria-label="B1" className={`boss-floor ${elevatorTarget === "B1" ? "pressed" : ""}`} disabled={Boolean(elevatorTarget)} onClick={() => beginElevatorTravel("boss_b1")}><strong>B1</strong><span className="button-lamp" aria-hidden="true"/></button>
            <button aria-label="B2" className={`boss-floor ${!hud.bossB1 ? "locked" : ""} ${elevatorTarget === "B2" ? "pressed" : ""}`} disabled={!hud.bossB1 || Boolean(elevatorTarget)} onClick={() => beginElevatorTravel("boss_b2")}><strong>B2</strong><span className="button-lamp" aria-hidden="true"/></button>
            <button aria-label="管理室" className={`management-floor ${elevatorTarget === "管理室" ? "pressed" : ""}`} disabled={Boolean(elevatorTarget)} onClick={() => beginElevatorTravel("management")}><strong>管理室</strong><span className="button-lamp" aria-hidden="true"/></button>
          </div>
        </div>
        {elevatorTarget && <div className="elevator-transit" aria-hidden="true"><div className="elevator-blackout"/><div className="elevator-doors"><i/><i/></div></div>}
      </section>}
      {started && clearanceReportOpen && <section className="clearance-report-screen"><article className="clearance-report"><header><small>{DEMO_ENDING_ZH_TW["demo.b2.clearance.header"]}</small><b>清剿紀錄：B2-{String(hud.day).padStart(2,"0")}-{String(destiny.roomSlot).padStart(2,"0")}</b></header><h2>{DEMO_ENDING_ZH_TW["demo.b2.clearance.title"]}</h2><h3>{DEMO_ENDING_ZH_TW["demo.b2.clearance.subtitle"]}</h3><p>{DEMO_ENDING_ZH_TW["demo.b2.clearance.body"]}</p><div className="clearance-status">{(["status_b1","status_b2","status_power","status_elevator","status_floor10"] as const).map((key,index)=><span key={key} style={{animationDelay:`${.2 + index * .18}s`}}>{DEMO_ENDING_ZH_TW[`demo.b2.clearance.${key}`]}<i>{key === "status_floor10" ? "待核准" : key === "status_power" ? "已登記" : key === "status_b1" ? "已封鎖" : "已清除"}</i></span>)}</div><blockquote>「{DEMO_ENDING_ZH_TW["demo.b2.clearance.hongyi_message"]}」<small>——管理員・紅怡</small></blockquote><footer><button onClick={() => { progressDemoEnding("CLEARANCE_REPORT_VIEWED"); setClearanceReportOpen(false); setMessage("特殊權限卡仍在你手中；可從電梯選擇獨立的管理室按鈕"); }}>查看戰場</button><button className="asset-button" onClick={enterManagementOffice}>返回管理室<small>將特殊權限卡交給紅怡</small></button></footer></article></section>}
      {started && managementDialogueStep !== null && <section className="hongyi-office-dialogue"><article><header><small>獨立行政空間｜租寓管理室</small><b>管理員・紅怡</b></header><p>「{[DEMO_ENDING_ZH_TW["demo.hongyi.keycard.intro"],DEMO_ENDING_ZH_TW["demo.hongyi.keycard.floor10"],DEMO_ENDING_ZH_TW["demo.hongyi.keycard.registration"],DEMO_ENDING_ZH_TW["demo.hongyi.keycard.conclusion"]][managementDialogueStep]}」</p><footer><span>特殊權限卡・10F</span><button className="asset-button" onClick={() => { if (managementDialogueStep < 2) { setManagementDialogueStep(managementDialogueStep + 1); return; } if (managementDialogueStep === 2) { progressDemoEnding("KEYCARD_DELIVERED"); setManagementDialogueStep(3); setMessage("特殊權限卡已由管理室登記；可在住戶檔案的權限物欄查看"); return; } leaveManagementOffice(); }}>{managementDialogueStep === 2 ? "交付並登記" : managementDialogueStep === 3 ? "離開管理室" : "繼續"}</button></footer></article></section>}
      {started && floor10NoticeOpen && <section className="floor10-notice-screen"><article><small>{DEMO_ENDING_ZH_TW["demo.floor10.notice.header"]}</small><h2>{DEMO_ENDING_ZH_TW["demo.floor10.notice.title"]}</h2><p>{DEMO_ENDING_ZH_TW["demo.floor10.notice.body"]}</p><blockquote>{DEMO_ENDING_ZH_TW["demo.floor10.notice.inspect"]}</blockquote><button className="asset-button" onClick={() => { progressDemoEnding("DEMO_ENDING_STARTED"); setFloor10NoticeOpen(false); setDemoEndingOpen(true); }}>翻閱通知單</button></article></section>}
      {started && demoEndingOpen && <section className="demo-ending-cinematic"><article><small>本輪紀錄｜已封存</small><h2>{DEMO_ENDING_ZH_TW["demo.ending.title"]}</h2><p>{DEMO_ENDING_ZH_TW["demo.ending.body"]}</p><strong>{DEMO_ENDING_ZH_TW["demo.ending.teaser"]}</strong><footer><button onClick={() => { setDemoEndingOpen(false); setTerminalRecordOpen(true); setLogOpen(true); }}>查看本輪紀錄</button><button className="asset-button" onClick={() => { progressDemoEnding("DEMO_COMPLETED"); setDemoEndingOpen(false); setTerminalRecordOpen(false); setFilingStage("ready"); window.localStorage.removeItem(RUN_SAVE_KEY); setAvailableSave(null); dispatchFlow({type:"COMPLETE_DEMO"}); dispatchFlow({type:"RETURN_TITLE"}); }}>返回標題</button></footer></article></section>}
      {dead && deathReady && <section className="death-menu"><div><h2>你已融入公寓</h2><button onClick={restartRegistration}>重新入住</button><button onClick={exitAfterDeath}>離開遊戲</button></div></section>}
      {complete && null}
      </div>
      </div>
    </main>
  );
}
