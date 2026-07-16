"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { DEFECT_DESCRIPTIONS, DEMO_OPENING, DEMO_ROOMS, HONG_YI_LINES, IDENTITY_LORE, MANAGEMENT_COPY, TALENT_DESCRIPTIONS } from "./game/demo-content";
import { gameFlowReducer, INITIAL_GAME_FLOW } from "./game/flow-state";
import { ATTRIBUTE_NAMES, evaluateDestiny } from "./game/destiny-rules";
import { DiceRollScene } from "./game/dice-model";
import { isWalkable, probeGround, resolveSpawn } from "./game/scene-navigation";
import { advanceDemoEnding, canAccessDemoFloor, DEMO_ENDING_ZH_TW } from "./game/demo-ending";
import type { DemoEndingState } from "./game/demo-ending";
import { getTimePeriod, sampleCharacterExposure, SCENE_PRESENTATION, TIME_PERIOD_PROFILES } from "./game/presentation-profiles";
import { parseRunSave, RUN_SAVE_KEY, serializeRunSave } from "./game/run-save";
import { TitleAmbientEngine } from "./game/title-ambient";
import type { RunSaveV1 } from "./game/run-save";
import type { DebtEntry, Destiny, Enemy, FloorState, GameRuntime, Location, Pickup, StorageKind, StorageStack } from "./game/model";
import { getCharacterRenderHeightPx } from "./game/characterScale";

const STARTING_FLOORS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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
const ROOMS = DEMO_ROOMS;

const WORLD_W = 1800;
const WORLD_H = 900;
const ROOM_W = 1000;
const ELEVATOR_W = 1000;
// Plaque anchors measured directly from scene-hallway-v1.png (1800 px source).
const DOORS = [
  { slot: 1, x: 62, plaqueY: .325 }, { slot: 2, x: 246, plaqueY: .337 }, { slot: 3, x: 448, plaqueY: .337 },
  { slot: 4, x: 646, plaqueY: .337 }, { slot: 5, x: 796, plaqueY: .337 }, { slot: 6, x: 1001, plaqueY: .337 },
  { slot: 7, x: 1167, plaqueY: .337 }, { slot: 8, x: 1337, plaqueY: .337 }, { slot: 9, x: 1487, plaqueY: .337 },
];
const HALLWAY_ELEVATOR_X = 1685;
const groundBand = (height: number, place: Location) => place === "elevator"
  ? { top: height * .69, bottom: height * .86 }
  : place === "room"
    ? { top: height * .61, bottom: height * .84 }
    : { top: height * .64, bottom: height * .86 };
const roomNumber = (floor: number, slot: number) => `${floor}${String(slot).padStart(2, "0")}`;
const zoneName = (floor: number) => floor >= 20 ? "高級住戶區" : floor >= 10 ? "中層交易區" : "廉價住戶區";
const baseRentForFloor = (floor: number, attention: number, negotiation: number) => Math.ceil((10 + 1.8 * floor + .11 * floor * floor) * (1 + attention * .06) * (1 - Math.min(.2, negotiation * .025)));
const debtTotal = (ledger: DebtEntry[]) => ledger.reduce((total, entry) => total + entry.remainingBalance, 0);
const phaseName = (time: number) => {
  const elapsed = 720 - time;
  return elapsed < 240 ? "白晝" : elapsed < 420 ? "黃昏" : elapsed < 630 ? "宵禁深夜" : "臨晨詭時";
};
const formatTime = (seconds: number) => { const whole = Math.ceil(seconds); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`; };
const inGameClock = (seconds: number) => {
  const minutes = Math.floor((360 + (720 - seconds) * 2) % 1440);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
const floorMonsterCap = (floor: number) => Math.min(10, 6 + Math.floor(floor / 10));
const escapeYieldMultiplier = (currentFloor: number, boundFloor: number, kind: "base" | "event" | "monster") => {
  const gap = boundFloor - currentFloor;
  if (gap <= 0) return 1;
  if (gap <= 2) return kind === "event" ? .85 : kind === "base" ? .8 : 1;
  if (gap <= 4) return kind === "event" ? .75 : kind === "monster" ? .8 : .65;
  return kind === "event" ? .6 : kind === "monster" ? .7 : .5;
};
const createFloorState = (floor: number, day: number): FloorState => {
  const enemyCount = Math.min(floorMonsterCap(floor) - 1, 2 + Math.floor(Math.random() * 3) + Math.floor(floor / 12));
  const enemies: Enemy[] = Array.from({ length: enemyCount }, (_, index) => ({
    x: 420 + index * (1150 / Math.max(1, enemyCount - 1)),
    y: index % 2 ? 470 : 310,
    hp: 42 + floor * 4 + Math.floor(Math.random() * 18),
    phase: Math.random() * 6,
    location: "hallway",
    followsIndoors: false,
    kind: (["wall", "light", "receipt"] as const)[index % 3],
    maxHp: 42 + floor * 4 + 18,
  }));
  const pickupCount = 2 + Math.floor(Math.random() * 3);
  const positions = [360, 620, 880, 1160, 1390];
  const pickups: Pickup[] = Array.from({ length: pickupCount }, (_, index) => {
    const roll = Math.random();
    const equipmentChance = Math.min(.28, .06 + floor * .008);
    const type: Pickup["type"] = roll < equipmentChance ? "裝備" : roll < .38 ? "藥品" : roll < .57 ? "鑰匙" : "租券";
    return { x: positions[index] + Math.floor(Math.random() * 70) - 35, y: index % 2 ? 490 : 310, type, taken: false };
  });
  return { enemies, pickups, visitedRooms: [], lastSpawnDay: day };
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
    time: 95,
    score: 182,
    day: 1,
    rentDue: 50,
    settlementTriggered: false,
    landlordTask: false,
    taskKills: 0,
    debtMode: false,
    arrears: 0,
    rentProtectionLost: false,
    homeBreachTriggered: false,
    breachTick: 2,
    floor: 7,
    attention: 0,
    visitedRooms: [] as number[],
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
  const [residentName, setResidentName] = useState("");
  const paused = flow.paused;
  const settlement = flow.overlay.kind === "settlement";
  const [settlementCountdown, setSettlementCountdown] = useState(8);
  const roomEvent = flow.overlay.kind === "roomEvent" ? flow.overlay.roomId : null;
  const floorSelect = flow.overlay.kind === "floorSelect";
  const [location, setLocation] = useState<"hallway" | "room" | "elevator">("hallway");
  const [elevatorTarget, setElevatorTarget] = useState<string | null>(null);
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
  const [hud, setHud] = useState({ hp: 100, stamina: 100, rent: 38, time: 720, score: 182, day: 1, rentDue: 50, debt: 0, mortgageLayers: 0, taskKills: 0, landlordTask: false, floor: 7, attention: 0, weaponLevel: 1, medkits: 1, keysOwned: 0, skillCooldown: 0, bossB1: false, bossB2: false });
  const ambience = useRef<HTMLAudioElement | null>(null);
  const music = useRef<HTMLAudioElement | null>(null);
  const voiceAudio = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const titleAmbient = useRef<TitleAmbientEngine | null>(null);
  const elevatorAudio = useRef<HTMLAudioElement | null>(null);
  const drinkAudio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [deathReady, setDeathReady] = useState(false);
  const [demoEndingState, setDemoEndingState] = useState<DemoEndingState>("B2_ALIVE");
  const [clearanceReportOpen, setClearanceReportOpen] = useState(false);
  const [managementDialogueStep, setManagementDialogueStep] = useState<number | null>(null);
  const [floor10NoticeOpen, setFloor10NoticeOpen] = useState(false);
  const [demoEndingOpen, setDemoEndingOpen] = useState(false);
  const [floor10Attempts, setFloor10Attempts] = useState(0);
  const [availableSave, setAvailableSave] = useState<RunSaveV1 | null>(null);
  const [titleTransitioning, setTitleTransitioning] = useState(false);
  const cinematicOverlayOpen = clearanceReportOpen || managementDialogueStep !== null || floor10NoticeOpen || demoEndingOpen;

  const playVoice = useCallback((number: number) => {
    if (typeof window === "undefined" || mutedRef.current) return;
    voiceAudio.current?.pause();
    const audio = new Audio(`/audio/voice/hongyi/demo${String(number).padStart(2, "0")}.mp3`);
    audio.volume = .88;
    voiceAudio.current = audio;
    void audio.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const save = parseRunSave(window.localStorage.getItem(RUN_SAVE_KEY));
    setAvailableSave(save);
    if (!save && window.localStorage.getItem(RUN_SAVE_KEY)) window.localStorage.removeItem(RUN_SAVE_KEY);
  }, []);

  useEffect(() => {
    if (flow.screen !== "title") return;
    const engine = new TitleAmbientEngine();
    titleAmbient.current = engine;
    engine.setMuted(muted);
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
    titleAmbient.current?.setMuted(muted);
    if (voiceAudio.current) voiceAudio.current.muted = muted;
  }, [muted]);

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

  useEffect(() => {
    if (!dead) { setDeathReady(false); return; }
    const timer = window.setTimeout(() => setDeathReady(true), 1150);
    return () => window.clearTimeout(timer);
  }, [dead]);

  const sound = useCallback((kind: "dice" | "attack" | "pickup" | "hurt" | "rent" | "drink") => {
    if (typeof window === "undefined" || muted) return;
    if (kind === "drink") {
      if (!drinkAudio.current) {
        drinkAudio.current = new Audio("/audio/drink-swallow-cc0.mp3");
        drinkAudio.current.volume = .72;
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
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const settings = {
      dice: [190, 90, 0.12], attack: [150, 42, 0.18], pickup: [420, 680, 0.16], hurt: [75, 38, 0.2], rent: [52, 31, 0.35],
    }[kind];
    oscillator.type = kind === "pickup" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(settings[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2]);
    gain.gain.setValueAtTime(kind === "attack" ? .22 : kind === "rent" ? 0.12 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings[2]);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(now); oscillator.stop(now + settings[2]);
    if (kind === "attack") {
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * .12), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index++) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / data.length, 2.8);
      const impact = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const impactGain = context.createGain();
      impact.buffer = buffer; filter.type = "bandpass"; filter.frequency.value = 1250; filter.Q.value = .7;
      impactGain.gain.setValueAtTime(.28, now); impactGain.gain.exponentialRampToValueAtTime(.001, now + .12);
      impact.connect(filter); filter.connect(impactGain); impactGain.connect(context.destination); impact.start(now);
    }
  }, [muted]);

  const startRunAmbience = useCallback(() => {
    if (!ambience.current) {
      ambience.current = new Audio("/audio/abandoned-passages-cc0.ogg");
      ambience.current.loop = true;
      ambience.current.volume = .24;
    }
    if (!music.current) {
      music.current = new Audio("/audio/narrow-corridors-cc0.ogg");
      music.current.loop = true;
      music.current.volume = .18;
    }
    ambience.current.muted = muted;
    music.current.muted = muted;
    void ambience.current.play().catch(() => undefined);
    void music.current.play().catch(() => undefined);
  }, [muted]);

  useEffect(() => {
    if (ambience.current) ambience.current.muted = muted;
    if (music.current) music.current.muted = muted;
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
      time: 720,
      score: power,
      day: 1,
      rentDue: baseRentForFloor(destiny.floor, 0, destiny.attributes[4]),
      settlementTriggered: false,
      landlordTask: false,
      taskKills: 0,
      debtMode: false,
      arrears: 0,
      rentProtectionLost: false,
      homeBreachTriggered: false,
      breachTick: 2,
      floor: destiny.floor,
      attention: 0,
      visitedRooms: initialFloorState.visitedRooms,
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
    setHud({ hp: maxHp, stamina: maxStamina, rent: 30 + lowPowerBonus, time: 720, score: power, day: 1, rentDue: baseRentForFloor(destiny.floor, 0, destiny.attributes[4]), debt: 0, mortgageLayers: 0, taskKills: 0, landlordTask: false, floor: destiny.floor, attention: 0, weaponLevel: 1, medkits: 1, keysOwned: 0, skillCooldown: 0, bossB1: false, bossB2: false });
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
    setElevatorTarget(null);
    setDemoEndingState("B2_ALIVE");
    setClearanceReportOpen(false);
    setManagementDialogueStep(null);
    setFloor10NoticeOpen(false);
    setDemoEndingOpen(false);
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
    setTitleTransitioning(true);
    titleAmbient.current?.playPaperAndFade();
    titleTransitionTimer.current = window.setTimeout(() => {
      dispatchFlow({ type: "OPEN_INTRO" });
      setTitleTransitioning(false);
      titleTransitionTimer.current = null;
    }, 1500);
  }, [titleTransitioning]);

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

  const spawnRentPursuers = useCallback((outstanding: number, targetLocation: Location, roomSlot?: number) => {
    const g = game.current;
    const threat = Math.max(1, Math.ceil((outstanding + g.attention * 25) / 50));
    const count = Math.min(4, 1 + Math.floor((outstanding + g.attention * 20) / 100));
    const localLimit = targetLocation === "hallway" ? WORLD_W - 80 : targetLocation === "elevator" ? ELEVATOR_W - 55 : ROOM_W - 70;
    for (let index = 0; index < count; index++) {
      g.enemies.push({
        x: clamp(g.player.x + 150 + index * 65, 65, localLimit),
        y: 330 + (index % 2) * 125,
        hp: 75 + threat * 38 + index * 16,
        phase: 4.6 + index * 1.3,
        elite: true,
        threat,
        location: targetLocation,
        roomSlot: targetLocation === "room" ? roomSlot : undefined,
        followsIndoors: true,
        kind: "pursuer",
        maxHp: 75 + threat * 38 + index * 16,
      });
    }
    return { threat, count };
  }, []);

  const resolveRent = useCallback((choice: "pay" | "mortgage" | "refuse") => {
    const g = game.current;
    if (g.dead || !g.settlementTriggered) return;
    g.debtLedger = g.debtLedger.map(entry => ({
      ...entry,
      remainingBalance: Math.ceil(entry.remainingBalance * 1.05),
      interestApplied: true,
    }));
    g.debtLedger.push({ dayId: g.day, originalRent: g.rentDue, remainingBalance: g.rentDue, interestApplied: false, createdAt: Date.now() });
    if (choice === "pay") {
      let payment = Math.min(g.rent, debtTotal(g.debtLedger));
      const paid = payment;
      g.rent -= paid;
      for (const entry of g.debtLedger) {
        const applied = Math.min(payment, entry.remainingBalance);
        entry.remainingBalance -= applied;
        payment -= applied;
      }
      g.debtLedger = g.debtLedger.filter(entry => entry.remainingBalance > 0);
      setMessage(g.debtLedger.length === 0 ? `管理室已蓋章：支付 ${paid} 租券，帳款清償` : `租券依序沖銷最舊欠款：已支付 ${paid}，餘額 ${debtTotal(g.debtLedger)}`);
      sound("pickup");
    }
    if (choice === "mortgage") {
      if (g.mortgageLayers >= 10) return;
      const cleared = g.debtLedger.shift();
      g.mortgageLayers += 1;
      setMortgageMarks([`負面契約 ${g.mortgageLayers} 層｜有效能力 −${g.mortgageLayers * 10}%`]);
      setMessage(`能力抵押成立：最舊第 ${cleared?.dayId ?? g.day} 日欠款已清除；總能力永久降低 10%`);
      sound("hurt");
      if (g.mortgageLayers >= 10) {
        g.settlementTriggered = false;
        g.dead = true;
        dispatchFlow({ type: "DIE" });
        setMessage("第十層抵押完成：本期帳款業已結清，你已不再具有可活動的人形資格。");
        return;
      }
    }
    const outstanding = debtTotal(g.debtLedger);
    if (choice === "refuse" || outstanding > 0) {
      g.debtMode = true;
      g.attention += 1;
      g.arrears = outstanding;
      g.rentProtectionLost = true;
      g.homeBreachTriggered = false;
      g.breachTick = 2;
      const alreadyHome = location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot;
      if (alreadyHome) {
        const pursuit = spawnRentPursuers(g.arrears, "room", activeRoom ?? undefined);
        g.homeBreachTriggered = true;
        setMessage(`帳本餘額 ${outstanding}；${pursuit.count} 名第 ${pursuit.threat} 級追租者已侵入承租房`);
      } else {
        setMessage(`${MANAGEMENT_COPY.overdue} 目前欠款 ${outstanding}；返回承租房將觸發追租入侵`);
      }
      sound("rent");
    } else {
      g.arrears = 0; g.debtMode = false; g.rentProtectionLost = false; g.homeBreachTriggered = false;
    }
    g.landlordTask = false;
    g.day += 1;
    const aliveOnFloor = g.enemies.filter(enemy => enemy.hp > 0).length;
    if (g.day % 2 === 0 && aliveOnFloor < floorMonsterCap(g.floor)) {
      g.enemies.push({ x: 520 + Math.random() * 980, y: Math.random() > .5 ? 470 : 310, hp: 44 + g.floor * 4 + g.day * 2, maxHp: 62 + g.floor * 4 + g.day * 2, phase: Math.random() * 6, location: "hallway", followsIndoors: false, kind: "wall" });
    }
    g.rentDue = baseRentForFloor(destiny.floor, g.attention, destiny.attributes[4]);
    g.time = 720;
    g.defeatedBosses = [];
    g.activeBoss = null;
    g.phaseIndex = 0;
    g.phaseFlash = .35;
    g.settlementTriggered = false;
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "settlement" });
    setSettlementCountdown(8);
    setDebtStatus({ arrears: g.arrears, protectionLost: g.rentProtectionLost });
    setHud({ hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: g.arrears, mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: false, bossB2: false });
  }, [activeRoom, destiny, location, sound, spawnRentPursuers]);

  useEffect(() => {
    if (!settlement || dead) return;
    setSettlementCountdown(8);
    const openedAt = Date.now();
    const ticker = window.setInterval(() => {
      setSettlementCountdown(Math.max(0, 8 - Math.floor((Date.now() - openedAt) / 1000)));
    }, 200);
    const refusal = window.setTimeout(() => resolveRent("refuse"), 8000);
    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(refusal);
    };
  }, [dead, resolveRent, settlement]);

  const resolveRoom = useCallback((choice: number) => {
    if (roomEvent === null) return;
    const g = game.current;
    if (!g.visitedRooms.includes(roomEvent)) g.visitedRooms.push(roomEvent);
    if (roomEvent === 0 && choice === 0) {
      g.attention += 1; g.score += 18;
      setMessage("你撿起舊租單：輪迴痕跡滲入掌心，公寓關注度上升"); sound("rent");
    } else if (roomEvent === 0 && choice === 1) {
      const reward = Math.max(1, Math.floor(12 * escapeYieldMultiplier(g.floor, destiny.floor, "event")));
      g.player.stamina = Math.max(0, g.player.stamina - 18); g.rent += reward; g.score += 10;
      setMessage(`你擦去溫濕滲液：體力 −18，從牆縫取得 ${reward} 張租券`); sound("pickup");
    } else if (roomEvent === 1 && choice === 0) {
      if (destiny.attributes[2] >= 4) { g.score += 25; setMessage("你從敲門節奏聽出一段舊房號：取得真相線索"); sound("pickup"); }
      else { g.player.hp = Math.max(1, g.player.hp - 10); setMessage("意志判定失敗：視野被空白牆面吞沒，生命 −10"); sound("hurt"); }
    } else if (roomEvent === 1 && choice === 1) {
      g.attention += 1;
      const roomSlot = activeRoom ?? ROOMS[roomEvent].slot;
      g.enemies.push(
        { x: 700, y: 310, hp: 72, maxHp: 72, phase: 2.2, location: "room", roomSlot, followsIndoors: false, kind: "light" },
        { x: 890, y: 470, hp: 72, maxHp: 72, phase: 5.1, location: "room", roomSlot, followsIndoors: false, kind: "light" },
      );
      setMessage("你回應了敲門聲：兩道巡燈殘影離開牆面"); sound("rent");
    } else if (roomEvent === 2 && choice === 0) {
      g.score += 20; setMessage("欠租筆記記著你的筆跡：真相事件權重提升"); sound("pickup");
    } else if (roomEvent === 2 && choice === 1) {
      const reward = Math.max(1, Math.floor(24 * escapeYieldMultiplier(g.floor, destiny.floor, "event")));
      g.rent += reward; g.attention += 1; setMessage(`你搜出 ${reward} 張租券，也在灰塵中留下了新鮮足跡`); sound("pickup");
    } else {
      setMessage(roomEvent === 2 ? "你替消失的住戶默立片刻，牆內的低語暫時遠去" : "你沒有回應，安全離開了異常範圍");
    }
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "roomEvent" });
    setHud({ hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: debtTotal(g.debtLedger), mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") });
  }, [activeRoom, destiny.attributes, roomEvent, sound]);

  const travelToFloor = useCallback((floor: number) => {
    const g = game.current;
    const travelingPursuers = g.enemies.filter(enemy => enemy.hp > 0 && enemy.location === "elevator" && enemy.followsIndoors);
    const remainingEnemies = g.enemies.filter(enemy => !travelingPursuers.includes(enemy));
    const currentState = g.floorStates[g.floor] ?? createFloorState(g.floor, g.day);
    currentState.enemies = remainingEnemies;
    currentState.pickups = g.pickups;
    currentState.visitedRooms = g.visitedRooms;
    g.floorStates[g.floor] = currentState;

    const firstVisit = !g.floorStates[floor];
    const targetState = g.floorStates[floor] ?? createFloorState(floor, g.day);
    const elapsedDays = Math.max(0, g.day - targetState.lastSpawnDay);
    const aliveCount = targetState.enemies.filter(enemy => enemy.hp > 0).length;
    const additions = Math.min(Math.floor(elapsedDays / 2), Math.max(0, floorMonsterCap(floor) - aliveCount));
    for (let index = 0; index < additions; index++) {
      targetState.enemies.push({ x: 520 + Math.random() * 980, y: index % 2 ? 470 : 310, hp: 44 + floor * 4 + elapsedDays * 3, maxHp: 62 + floor * 4 + elapsedDays * 3, phase: Math.random() * 6, location: "hallway", followsIndoors: false, kind: (["wall", "light", "receipt"] as const)[index % 3] });
    }
    targetState.lastSpawnDay = g.day;
    travelingPursuers.forEach((enemy, index) => { enemy.location = "hallway"; enemy.roomSlot = undefined; enemy.x = 1580 - index * 55; enemy.y = 340 + (index % 2) * 120; });
    targetState.enemies.push(...travelingPursuers);
    g.floorStates[floor] = targetState;

    g.floor = floor; g.activeBoss = null; g.player.x = 150; g.player.y = 690; g.camera = 0;
    g.enemies = targetState.enemies;
    g.pickups = targetState.pickups;
    g.visitedRooms = targetState.visitedRooms;
    setMessage(firstVisit ? `首次抵達 ${floor}F：本輪樓層資源與裝備已生成，拾取後不會補生` : `返回 ${floor}F：載入原有樓層狀態；經過 ${elapsedDays} 日，新增 ${additions} 個異常`);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "floorSelect" }); setLocation("hallway"); setActiveRoom(null); sound("dice");
    setHud({ hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: debtTotal(g.debtLedger), mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") });
  }, [sound]);

  const leaveManagementOffice = useCallback(() => {
    progressDemoEnding("POST_B2_FREE_ROAM");
    setManagementDialogueStep(null);
    travelToFloor(6);
    const g = game.current;
    g.player.x = 1450;
    g.player.y = probeGround("hallway", 1450, WORLD_W, canvasRef.current?.clientHeight || 900).y;
    g.camera = 900;
    setHud(value => ({ ...value, floor: 6 }));
    setMessage("返回 601。管理室允許你在封存紀錄前整理本輪物品。");
  }, [progressDemoEnding, travelToFloor]);

  const enterBoss = useCallback((boss: "boss_b1" | "boss_b2") => {
    const g = game.current;
    if (boss === "boss_b2" && !g.defeatedBosses.includes("boss_b1")) {
      setMessage("B2 的按鍵沒有亮起：租約要求先清除 B1 異常源");
      return;
    }
    const hp = boss === "boss_b1" ? 90 : 130;
    g.activeBoss = boss;
    g.floor = boss === "boss_b1" ? 0 : -1;
    g.player.x = 150; g.player.y = 690; g.camera = 0;
    g.enemies = [{ x: 1220, y: 680, hp, maxHp: hp, phase: 0, location: "hallway", followsIndoors: false, kind: boss }];
    g.pickups = [];
    setLocation("hallway"); setActiveRoom(null);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "floorSelect" });
    if (!elevatorAudio.current) {
      elevatorAudio.current = new Audio("/audio/elevator-door-cc0.wav");
      elevatorAudio.current.volume = .45;
    }
    elevatorAudio.current.muted = muted;
    void elevatorAudio.current.play().catch(() => undefined);
    setMessage(`${boss === "boss_b1" ? "B1" : "B2"} 底層異常源已封鎖出口；擊破後回到電梯`);
    setHud(value => ({ ...value, floor: g.floor }));
  }, [muted]);

  const beginElevatorTravel = useCallback((target: number | "boss_b1" | "boss_b2") => {
    if (elevatorTarget) return;
    const label = typeof target === "number" ? `${target}F` : target === "boss_b1" ? "B1" : "B2";
    setElevatorTarget(label);
    sound("dice");
    if (!elevatorAudio.current) {
      elevatorAudio.current = new Audio("/audio/elevator-door-cc0.wav");
      elevatorAudio.current.volume = .4;
    }
    elevatorAudio.current.muted = muted;
    elevatorAudio.current.currentTime = 0;
    void elevatorAudio.current.play().catch(() => undefined);
    window.setTimeout(() => {
      if (typeof target === "number") travelToFloor(target); else enterBoss(target);
      setElevatorTarget(null);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 1750);
  }, [elevatorTarget, enterBoss, muted, sound, travelToFloor]);

  const useMedkit = useCallback(() => {
    const g = game.current;
    const maxHp = 76 + destiny.attributes[0] * 5;
    if (!started || g.medkits <= 0 || g.player.hp >= maxHp || g.dead) return;
    g.medkits -= 1; g.player.hp = Math.min(maxHp, g.player.hp + (destiny.talent === "急救常識" ? 55 : 38));
    setMessage(destiny.talent === "急救常識" ? "急救常識生效：生命大幅恢復" : "飲用過期藥水：生命恢復"); sound("drink");
    setHud(value => ({ ...value, hp: g.player.hp, medkits: g.medkits }));
  }, [destiny.attributes, destiny.talent, sound, started]);

  const useTalent = useCallback(() => {
    const g = game.current;
    if (!started || g.skillCooldown > 0 || g.dead) return;
    if (destiny.talent === "租緩") { g.time += 30; setMessage("租緩：今日結算延後 30 秒；寬限不是免除"); }
    if (destiny.talent === "窺層") { g.score += 18; setMessage("窺層：你辨認出鄰近樓層的危險痕跡，戰力評估 +18"); }
    if (destiny.talent === "偽居") { g.attention = Math.max(0, g.attention - 1); g.player.stamina = Math.min(72 + destiny.attributes[1] * 5, g.player.stamina + 25); setMessage("偽居：追蹤壓力降低，體力恢復 25"); }
    if (destiny.talent === "契語") { g.rentDue = Math.max(20, g.rentDue - 8); setMessage("契語：讀出隱性條款，今日租金降低 8"); }
    if (destiny.talent === "蝕耐") { g.player.hp = Math.min(76 + destiny.attributes[0] * 5, g.player.hp + 24); g.player.stamina = Math.min(72 + destiny.attributes[1] * 5, g.player.stamina + 20); setMessage("蝕耐：壓下異常侵蝕，恢復生命與體力"); }
    g.skillCooldown = Math.max(14, 26 - destiny.attributes[2] * 2); sound("dice");
    setHud(value => ({ ...value, hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, rentDue: g.rentDue, attention: g.attention, skillCooldown: g.skillCooldown }));
  }, [destiny.attributes, destiny.talent, sound, started]);

  const unlockSealedRoom = useCallback(() => {
    const g = game.current;
    if (roomEvent !== 1 || g.keysOwned <= 0) return;
    g.keysOwned -= 1; g.score += 20; g.rent += 12;
    if (!g.visitedRooms.includes(1)) g.visitedRooms.push(1);
    setMessage("使用房門鑰匙解除封鎖：沒有驚醒凶宅，租券 +12"); sound("pickup");
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "roomEvent" });
    setHud(value => ({ ...value, score: g.score, rent: g.rent, keysOwned: g.keysOwned }));
  }, [roomEvent, sound]);

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
    setFilingStage("rolling"); sound("dice");
    window.setTimeout(() => sound("dice"), 420);
    window.setTimeout(() => sound("dice"), 860);
    window.setTimeout(() => {
      setDestiny(previous => createDestiny(previous));
      setFilingStage("attributes");
      sound("rent");
    }, 1800);
  }, [filingStage, sound]);

  const confirmIdentity = useCallback(() => {
    setFilingStage("briefing");
    playVoice(1);
    window.setTimeout(() => setFilingStage(stage => stage === "briefing" ? "result" : stage), 5200);
  }, [playVoice]);

  const finishFiling = useCallback(() => {
    setFilingStage("complete"); sound("rent");
  }, [sound]);

  const attack = useCallback(() => {
    const p = game.current.player;
    const staminaCost = Math.max(8, 16 - destiny.attributes[1]);
    if (p.attack <= 0 && p.stamina >= staminaCost && !game.current.dead) {
      p.attack = 0.44;
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
          if (item.type === "租券") { const amount = Math.max(1, Math.floor(22 * escapeYieldMultiplier(g.floor, destiny.floor, "base") * (destiny.defect === "輕厄" ? .9 : 1))); g.rent += amount; setMessage(`拾取租券：+${amount}${g.floor < destiny.floor ? "（逃租收益衰減）" : destiny.defect === "輕厄" ? "（輕厄）" : ""}`); }
          if (item.type === "藥品") { g.medkits += 1; setMessage("拾取過期藥品：已放入道具欄"); }
          if (item.type === "鑰匙") { g.keysOwned += 1; g.score += 12; setMessage("取得老舊房門鑰匙"); }
          if (item.type === "裝備") { g.weaponLevel = Math.min(3, g.weaponLevel + 1); g.score += 30; setMessage(`取得改造鋼管：武器提升至 ${g.weaponLevel} 級`); }
          if (item.type === "特殊權限卡") { progressDemoEnding("KEYCARD_COLLECTED"); setClearanceReportOpen(true); setMessage("關鍵物件已取得：特殊權限卡・10F"); }
          setHud(value => ({ ...value, rent: g.rent, score: g.score, medkits: g.medkits, keysOwned: g.keysOwned, weaponLevel: g.weaponLevel }));
          return;
        }
      }
      const nearBackWall = g.player.y <= groundBand(canvasRef.current?.clientHeight || WORLD_H, "hallway").top + 82;
      const nearbyDoor = g.activeBoss || !nearBackWall ? undefined : DOORS.find(door => Math.abs(door.x - g.player.x) < 43 + destiny.attributes[3] * 5);
      if (nearbyDoor) {
        const isOwnRoom = g.floor === destiny.floor && nearbyDoor.slot === destiny.roomSlot;
        const eventRoom = ROOMS.find(room => room.slot === nearbyDoor.slot);
        const isManagementOffice = g.floor === 6 && nearbyDoor.slot === 9 && ["CLEARANCE_REPORT_VIEWED","FLOOR10_BUTTON_DISCOVERED","RETURN_TO_OFFICE"].includes(demoEndingState);
        const isFloor10NoticeRoom = g.floor === 6 && nearbyDoor.slot === 1 && demoEndingState === "POST_B2_FREE_ROAM";
        if (!isOwnRoom && !eventRoom && !isManagementOffice && !isFloor10NoticeRoom) {
          setMessage(`${roomNumber(g.floor, nearbyDoor.slot)} 屬於其他住戶；多人模式需由屋主邀請、授權或使用特殊規則才能進入`);
          return;
        }
        const doorX = nearbyDoor.x;
        const roomSpawn = resolveSpawn("room", "from_hallway", ROOM_W, canvasRef.current?.clientHeight || 900);
        g.player.x = roomSpawn.ground.x; g.player.y = roomSpawn.ground.y; g.player.facing = roomSpawn.spawn.facing; g.camera = 0;
        g.enemies.forEach((enemy, index) => {
          if (enemy.hp > 0 && enemy.location === "hallway" && enemy.followsIndoors && Math.abs(enemy.x - doorX) < 430) {
            enemy.location = "room"; enemy.roomSlot = nearbyDoor.slot; enemy.x = 65 + index * 34; enemy.y = 320 + (index % 2) * 120;
          }
        });
        let entryMessage = isOwnRoom ? `${roomNumber(g.floor, nearbyDoor.slot)} 是你的承租房；門口可返回走廊` : `${roomNumber(g.floor, nearbyDoor.slot)}：走到異常物件旁按 E 探索`;
        if (isOwnRoom && g.rentProtectionLost && !g.homeBreachTriggered) {
          const pursuit = spawnRentPursuers(Math.max(g.arrears, g.rentDue), "room", nearbyDoor.slot);
          g.homeBreachTriggered = true; g.breachTick = 2;
          entryMessage = `租金保護已失效：牆膜侵蝕開始，${pursuit.count} 名第 ${pursuit.threat} 級追租者侵入房間`;
        }
        keys.current = {};
        sceneTransitionLockedUntil.current = performance.now() + 650;
        setActiveRoom(isManagementOffice ? -99 : nearbyDoor.slot); setLocation("room");
        if (isManagementOffice) {
          if (demoEndingState !== "RETURN_TO_OFFICE") progressDemoEnding("RETURN_TO_OFFICE");
          setManagementDialogueStep(0);
          entryMessage = "租寓管理室｜將特殊權限卡放到櫃檯上";
        } else if (isFloor10NoticeRoom) {
          progressDemoEnding("FLOOR10_NOTICE_DISCOVERED");
          setFloor10NoticeOpen(true);
          entryMessage = "門縫下壓著一張不屬於管理室格式的通知單。";
        }
        setMessage(entryMessage); sound("rent");
        return;
      }
      if (g.player.x > 1690) {
        g.player.x = 105; g.player.y = 690; g.camera = 0;
        g.enemies.forEach((enemy, index) => {
          if (enemy.hp > 0 && enemy.location === "hallway" && enemy.followsIndoors && enemy.x > 1320) {
            enemy.location = "elevator"; enemy.roomSlot = undefined; enemy.x = 55 + index * 28; enemy.y = 350 + (index % 2) * 95;
          }
        });
        keys.current = {};
        sceneTransitionLockedUntil.current = performance.now() + 650;
        setLocation("elevator"); setActiveRoom(null);
        setMessage("已進入電梯轎廂：控制盤就在右側，靠近後按 E 選擇樓層"); sound("dice");
      }
      return;
    }
    if (g.player.x < 92) {
      const returnX = location === "room" && activeRoom !== null ? DOORS[activeRoom - 1].x : 1645;
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
    const activeEvent = ROOMS.find(room => room.slot === activeRoom);
    const interactionX = location === "elevator" ? 850 : activeEvent?.id === 2 ? 430 : location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot ? 720 : 790;
    if (Math.abs(g.player.x - interactionX) < (location === "elevator" ? 62 : 95)) {
      keys.current = {};
      if (location === "elevator") {
        dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "floorSelect" } }); setMessage("操作老式電梯控制盤"); sound("dice");
      } else if (activeRoom !== null) {
        const isOwnRoom = g.floor === destiny.floor && activeRoom === destiny.roomSlot;
        const eventRoom = ROOMS.find(room => room.slot === activeRoom);
        if (isOwnRoom) {
          dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "storage" } });
          setMessage("個人儲物櫃已開啟：相同物品可堆疊，離開櫃子範圍會自動關閉");
        } else if (eventRoom && !g.visitedRooms.includes(eventRoom.id)) {
          dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "roomEvent", roomId: eventRoom.id } }); sound("rent");
        } else if (eventRoom) {
          const survivors = g.enemies.filter(enemy => enemy.hp > 0 && enemy.location === "room" && enemy.roomSlot === activeRoom).length;
          setMessage(survivors > 0 ? `房間事件已觸發，仍有 ${survivors} 個異常留在房內` : "這個探索點已處理完畢");
        }
      }
    }
  }, [activeRoom, demoEndingState, destiny.attributes, destiny.defect, destiny.floor, destiny.roomSlot, location, progressDemoEnding, sound, spawnRentPursuers]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (cinematicOverlayOpen) {
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", " "].includes(e.key.toLowerCase())) e.preventDefault();
        return;
      }
      if (dead) {
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", " "].includes(e.key.toLowerCase())) e.preventDefault();
        return;
      }
      keys.current[e.key.toLowerCase()] = true;
      if (e.code === "Space") { e.preventDefault(); attack(); }
      if (e.key.toLowerCase() === "e" && roomEvent === null && !floorSelect && !storageOpen) interact();
      if (e.key.toLowerCase() === "q") useTalent();
      if (e.key === "2") useMedkit();
      if (e.key === "Escape") dispatchFlow({ type: "TOGGLE_PAUSE" });
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [attack, cinematicOverlayOpen, dead, floorSelect, interact, roomEvent, storageOpen, useMedkit, useTalent]);

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
      room: Object.assign(new Image(), { src: "/scene-home-v1.png" }),
      clinic: Object.assign(new Image(), { src: "/scene-clinic-v2.png" }),
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
      wall: Object.assign(new Image(), { src: "/sprite-wall-resident-v1.png" }),
      wallAttack: Object.assign(new Image(), { src: "/sprite-wall-resident-attack-v2.png" }),
      light: Object.assign(new Image(), { src: "/sprite-light-warden-v1.png" }),
      receipt: Object.assign(new Image(), { src: "/sprite-receipt-collector-v1.png" }),
      pursuer: Object.assign(new Image(), { src: "/sprite-rent-pursuer-v1.png" }),
      pursuerAttack: Object.assign(new Image(), { src: "/sprite-rent-pursuer-attack-v2.png" }),
      bossB1: Object.assign(new Image(), { src: "/sprite-boss-b1-v2.png" }),
      bossB1Attack: Object.assign(new Image(), { src: "/sprite-boss-b1-attack-v2.png" }),
      bossB2: Object.assign(new Image(), { src: "/sprite-boss-b2-v1.png" }),
      bossB2Attack: Object.assign(new Image(), { src: "/sprite-boss-b2-attack-v2.png" }),
      pickupRent: Object.assign(new Image(), { src: "/pickup-rent-v1.png" }),
      pickupMedicine: Object.assign(new Image(), { src: "/pickup-medicine-v1.png" }),
      pickupKey: Object.assign(new Image(), { src: "/pickup-key-v1.png" }),
      pickupEquipment: Object.assign(new Image(), { src: "/pickup-equipment-v1.png" }),
      pickupKeycard10F: Object.assign(new Image(), { src: "/prop-keycard-floor10-v1.png" }),
    };

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const dt = Math.min((now - last) / 1000, 0.033); last = now;
      const g = game.current, p = g.player;
      const band = groundBand(h, location);
      const inputX = (keys.current.d || keys.current.arrowright ? 1 : 0) - (keys.current.a || keys.current.arrowleft ? 1 : 0) + touch.current.x;
      const inputY = (keys.current.s || keys.current.arrowdown ? 1 : 0) - (keys.current.w || keys.current.arrowup ? 1 : 0) + touch.current.y;
      const isMoving = flow.screen === "run" && !paused && !cinematicOverlayOpen && Math.hypot(inputX, inputY) > .1;
      if (flow.screen === "run" && !paused && !cinematicOverlayOpen && !g.dead) {
        const localWorldWidth = location === "hallway" ? WORLD_W : location === "elevator" ? ELEVATOR_W : ROOM_W;
        const dx = inputX;
        const dy = inputY;
        const len = Math.hypot(dx, dy) || 1;
        const sprint = keys.current.shift && p.stamina > 0 ? 1.55 : 1;
        const moveSpeed = 150 + destiny.attributes[1] * 15;
        const candidateX = clamp(p.x + (dx / len) * moveSpeed * sprint * dt, 55, localWorldWidth - 55);
        const candidateY = clamp(p.y + (dy / len) * moveSpeed * .72 * sprint * dt, band.top, band.bottom);
        if (isWalkable(location, candidateX, candidateY, localWorldWidth, h)) { p.x = candidateX; p.y = candidateY; }
        for (const enemy of g.enemies) {
          if (enemy.location !== location) continue;
          if (enemy.y < band.top || enemy.y > band.bottom) enemy.y = band.top + 28 + ((enemy.x * .37) % Math.max(32, band.bottom - band.top - 45));
        }
        for (const item of g.pickups) {
          if (item.y < band.top || item.y > band.bottom) item.y = band.top + 35 + ((item.x * .29) % Math.max(30, band.bottom - band.top - 48));
        }
        const activeEvent = ROOMS.find(room => room.slot === activeRoom);
        const interactionX = location === "elevator" ? 850 : activeEvent?.id === 2 ? 430 : location === "room" && g.floor === destiny.floor && activeRoom === destiny.roomSlot ? 720 : 790;
        if ((roomEvent !== null || floorSelect || storageOpen) && Math.abs(p.x - interactionX) > (location === "elevator" ? 82 : 120)) {
          keys.current = {};
          dispatchFlow({ type: "CLOSE_OVERLAY" });
          setMessage("你離開互動區域，未完成的操作已關閉");
        }
        if (Math.abs(dx) > .1) p.facing = Math.sign(dx);
        const staminaRecovery = destiny.defect === "寡眠" ? 10 : 18;
        p.stamina = clamp(p.stamina + (sprint > 1 ? -30 : staminaRecovery) * dt, 0, 72 + destiny.attributes[1] * 5);
        p.attack = Math.max(0, p.attack - dt); p.invuln = Math.max(0, p.invuln - dt);
        g.skillCooldown = Math.max(0, g.skillCooldown - dt);
        g.time = Math.max(0, g.time - dt);
        if (music.current) {
          const urgency = clamp((120 - g.time) / 120, 0, 1);
          music.current.playbackRate = g.activeBoss === "boss_b2" ? 1.24 : g.activeBoss === "boss_b1" ? 1.12 : 1 + urgency * .2;
          music.current.volume = g.activeBoss ? .28 : .18 + urgency * .1;
        }
        const elapsed = 720 - g.time;
        const nextPhase = elapsed < 240 ? 0 : elapsed < 420 ? 1 : elapsed < 630 ? 2 : 3;
        if (nextPhase !== g.phaseIndex) {
          g.phaseIndex = nextPhase;
          g.phaseFlash = .75;
          if (!g.activeBoss && g.floor > 0) {
            g.pickups = createFloorState(g.floor, g.day).pickups;
            const floorState = g.floorStates[g.floor];
            if (floorState) floorState.pickups = g.pickups;
          }
          setMessage(`目前時段已進入${["白晝", "黃昏", "宵禁深夜", "臨晨詭時"][nextPhase]}。普通地面物品已重新生成。`);
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
        if (g.time === 0 && !g.settlementTriggered) {
          g.settlementTriggered = true;
          dispatchFlow({ type: "OPEN_OVERLAY", overlay: { kind: "settlement" } });
          setMessage(MANAGEMENT_COPY.rent);
          sound("rent");
        }
        for (const e of g.enemies) if (e.hp > 0 && e.location === location && (location !== "room" || e.roomSlot === activeRoom)) {
          const dist = Math.hypot(p.x - e.x, p.y - e.y);
          const safeDist = Math.max(1, dist);
          const isBoss = e.kind === "boss_b1" || e.kind === "boss_b2";
          e.attackTimer = Math.max(0, (e.attackTimer ?? 0) - dt);
          e.attackCooldown = Math.max(0, (e.attackCooldown ?? 0) - dt);
          if (e.kind === "wall" && !e.alerted) {
            e.y = band.top + 18;
            if (dist < 175) {
              e.alerted = true;
              setMessage("牆皮突然剝落：滲牆住戶脫離牆面");
              sound("hurt");
            } else continue;
          }
          const baseSpeed = e.kind === "receipt" ? 145 : e.kind === "light" ? 105 : isBoss ? 52 : 90;
          const contactDistance = isBoss ? 78 : 58;
          if ((dist < (isBoss ? 620 : e.kind === "receipt" ? 550 : e.kind === "light" ? 450 : 330) || e.elite) && dist > contactDistance && (e.attackTimer ?? 0) <= 0) {
            const speed = e.elite ? 68 + (e.threat ?? 1) * 8 + g.attention * 2 : baseSpeed;
            const enemyX = e.x + ((p.x - e.x) / safeDist) * speed * dt;
            const enemyY = e.y + ((p.y - e.y) / safeDist) * (speed * .78) * dt;
            if (isWalkable(location, enemyX, enemyY, localWorldWidth, h, isBoss ? 42 : 25)) { e.x = enemyX; e.y = enemyY; }
            e.combatSeen = true;
          }
          if (dist < contactDistance) {
            const nx = dist > 1 ? (e.x - p.x) / dist : Math.cos(e.phase || 1);
            const ny = dist > 1 ? (e.y - p.y) / dist : Math.sin(e.phase || 1) * .55;
            e.x = clamp(p.x + nx * contactDistance, 55, localWorldWidth - 55);
            e.y = clamp(p.y + ny * contactDistance * .72, band.top, band.bottom);
          }
          if (dist <= contactDistance + 7 && (e.attackCooldown ?? 0) <= 0 && (e.attackTimer ?? 0) <= 0) {
            e.attackTimer = isBoss ? .68 : .48;
            e.attackCooldown = isBoss ? 1.5 : e.elite ? 1.18 : 1.05;
            e.attackLanded = false;
            e.combatSeen = true;
          }
          if ((e.attackTimer ?? 0) > 0 && (e.attackTimer ?? 0) <= (isBoss ? .34 : .22) && !e.attackLanded) {
            e.attackLanded = true;
            if (dist < (isBoss ? 92 : 67) && p.invuln === 0) {
              const baseDamage = e.kind === "boss_b2" ? 14 : e.kind === "boss_b1" ? 10 : e.kind === "wall" ? 14 : e.kind === "receipt" ? 11 : 10;
              p.hp -= Math.max(1, baseDamage + (e.elite ? (e.threat ?? 1) * 2 : 0) - Math.floor(destiny.attributes[5] / 2));
              p.invuln = .8;
              sound("hurt");
            }
          }
          if (p.attack > .11 && p.attack < .31 && dist < 132) { e.combatSeen = true; e.hp -= (118 + g.weaponLevel * 28) * dt; if (e.hp <= 0) {
            if (isBoss) {
              const bossId = e.kind as "boss_b1" | "boss_b2";
              if (!g.defeatedBosses.includes(bossId)) g.defeatedBosses.push(bossId);
              g.rent += bossId === "boss_b1" ? 18 : 26;
              g.score += bossId === "boss_b1" ? 120 : 180;
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
            const rawReward = e.elite ? 6 + (e.threat ?? 1) * 2 : 7;
            const reward = Math.max(1, Math.floor(rawReward * escapeYieldMultiplier(g.floor, destiny.floor, "monster")));
            g.rent += reward; g.score += e.elite ? 28 + (e.threat ?? 1) * 7 : 21;
            const enemyName = e.kind === "light" ? "巡燈殘影" : e.kind === "receipt" ? "拾單游魂" : "滲牆住戶";
            setMessage(e.elite ? `追租者已清除：掉落租券 +${reward}；欠租債務不會因此減少` : `${enemyName}已清除：租券 +${reward}`);
          } }
        }
        if (p.hp <= 0) { p.hp = 0; g.dead = true; dispatchFlow({ type: "DIE" }); setMessage("你已融入公寓。點擊重新輪迴。"); }
        g.camera += ((clamp(p.x - w * .38, 0, Math.max(0, localWorldWidth - w))) - g.camera) * Math.min(1, dt * 6);
        hudClock += dt;
        if (hudClock > .12) { hudClock = 0; setHud({ hp: p.hp, stamina: p.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: debtTotal(g.debtLedger), mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") }); }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#050706";
      ctx.fillRect(0, 0, w, h);
      const sx = -g.camera;
      const sceneWidth = location === "hallway" ? WORLD_W : location === "elevator" ? ELEVATOR_W : ROOM_W;
      const sceneOffset = location === "hallway" ? 0 : Math.max(0, (w - sceneWidth) / 2);
      ctx.save(); ctx.translate(sx + sceneOffset, 0);
      const sceneImage = g.activeBoss === "boss_b1" ? sceneImages.b1
        : g.activeBoss === "boss_b2" ? sceneImages.b2
          : location === "room" && activeRoom === -99 ? sceneImages.management
            : location === "room" && ROOMS.find(room => room.slot === activeRoom)?.id === 2 ? sceneImages.clinic
              : location === "elevator" && g.floor === 0 ? sceneImages.elevatorB1 : sceneImages[location];
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
        const eventRoom = ROOMS.find(room => room.slot === door.slot);
        const managementOffice = g.floor === 6 && door.slot === 9 && ["CLEARANCE_REPORT_VIEWED","FLOOR10_BUTTON_DISCOVERED","RETURN_TO_OFFICE"].includes(demoEndingState);
        const floor10Notice = g.floor === 6 && door.slot === 1 && demoEndingState === "POST_B2_FREE_ROAM";
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
          ctx.fillText(managementOffice ? "管理室｜E" : floor10Notice ? "601 通知｜E" : own ? "你的房間｜E" : eventRoom ? "可探索｜E" : "其他住戶", door.x - 38, band.top - 11);
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
        const activeEvent = ROOMS.find(room => room.slot === activeRoom);
        const own = activeRoom !== null && g.floor === destiny.floor && activeRoom === destiny.roomSlot;
        const promptX = activeEvent?.id === 2 ? 340 : 705;
        if (p.x < 175) { ctx.fillStyle = "rgba(9,12,10,.72)"; ctx.fillRect(15, h * .22, 125, 34); ctx.fillStyle = "#d0c29d"; ctx.font = "700 14px serif"; ctx.fillText("E 返回走廊", 25, h * .255); }
        if (Math.abs(p.x - (activeEvent?.id === 2 ? 430 : own ? 720 : 790)) < 145) { ctx.fillStyle = "rgba(9,12,10,.72)"; ctx.fillRect(promptX, h * .38, 180, 64); ctx.fillStyle = "#d0c29d"; ctx.font = "700 16px serif"; ctx.fillText(own ? "個人儲物櫃" : activeEvent?.id === 0 ? "發霉冰箱" : activeEvent?.id === 1 ? "封鎖牆面" : "住戶診療台", promptX + 15, h * .43); ctx.font = "13px serif"; ctx.fillText(own ? "靠近按 E 整理" : "靠近按 E 探索", promptX + 15, h * .47); }
      } else {
        ctx.fillStyle = "rgba(9,12,10,.75)"; ctx.fillRect(12, h * .25, 80, 30); ctx.fillRect(750, h * .63, 220, 34);
        ctx.fillStyle = "#d0c29d"; ctx.font = "700 12px serif"; ctx.fillText("E 離開", 24, h * .28); ctx.fillText(g.floor <= 0 ? "維修貨梯控制盤｜E 操作" : "控制盤｜E 操作", 765, h * .67);
      }
      for (const e of g.enemies) if (e.hp > 0 && e.location === location && (location !== "room" || e.roomSlot === activeRoom)) {
        const isBoss = e.kind === "boss_b1" || e.kind === "boss_b2";
        const enemyDepth = clamp((e.y - band.top) / Math.max(1, band.bottom - band.top), 0, 1);
        const enemyScale = .82 + enemyDepth * .26;
        const enemyDistance = Math.hypot(p.x - e.x, p.y - e.y);
        const attacking = (e.attackTimer ?? 0) > 0;
        const movingEnemy = !attacking && enemyDistance < (isBoss ? 640 : e.elite ? 520 : 390);
        const step = movingEnemy ? Math.sin(now / (isBoss ? 145 : 105) + e.phase) : 0;
        const attackProgress = attacking ? 1 - (e.attackTimer ?? 0) / (isBoss ? .68 : .48) : 0;
        const lunge = attacking ? Math.sin(attackProgress * Math.PI) * (isBoss ? 18 : 11) : 0;
        ctx.fillStyle = `rgba(0,0,0,${.24 + enemyDepth * .18})`; ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, (e.elite || isBoss ? 52 : 39) * enemyScale, (e.elite || isBoss ? 15 : 11) * enemyScale, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(e.x + (p.x > e.x ? lunge : -lunge), e.y - Math.abs(step) * 1.6); ctx.scale(p.x > e.x ? -1 : 1, 1); ctx.rotate(step * .012); ctx.filter = `brightness(${sampleCharacterExposure(location, e.x / sceneWidth, g.time)}) saturate(.86)`;
        if (e.kind === "wall" && !e.alerted) ctx.globalAlpha = .14;
        const enemyKey = e.kind === "boss_b1" ? (attacking ? "bossB1Attack" : "bossB1") : e.kind === "boss_b2" ? (attacking ? "bossB2Attack" : "bossB2") : e.kind === "light" ? "light" : e.kind === "receipt" ? "receipt" : e.elite || e.kind === "pursuer" ? (attacking ? "pursuerAttack" : "pursuer") : attacking ? "wallAttack" : "wall";
        const enemyCrops: Record<string, {x:number;y:number;w:number;h:number}> = {
          wall:{x:51,y:88,w:702,h:1485}, wallAttack:{x:21,y:164,w:891,h:1359}, light:{x:264,y:107,w:407,h:1451}, receipt:{x:120,y:56,w:874,h:1374},
          pursuer:{x:233,y:58,w:564,h:1511}, pursuerAttack:{x:157,y:76,w:705,h:1457}, bossB1:{x:64,y:85,w:758,h:1423}, bossB1Attack:{x:126,y:137,w:797,h:1343}, bossB2:{x:67,y:104,w:942,h:1342}, bossB2Attack:{x:129,y:73,w:836,h:1263},
        };
        const enemyImage = sceneImages[enemyKey as keyof typeof sceneImages];
        const enemyCrop = enemyCrops[enemyKey];
        const enemyRole = isBoss ? "boss" : e.elite || e.kind === "pursuer" ? "rentPursuer" : "normalMonster";
        const spriteH = getCharacterRenderHeightPx(enemyRole) * enemyScale * SCENE_PRESENTATION[location].characterScale;
        const spriteW = spriteH * (enemyCrop.w / enemyCrop.h);
        if (enemyImage.complete) ctx.drawImage(enemyImage, enemyCrop.x, enemyCrop.y, enemyCrop.w, enemyCrop.h, -spriteW / 2, -spriteH, spriteW, spriteH);
        ctx.restore();
        if (isBoss || e.elite || e.combatSeen || enemyDistance < 270) {
          const barY = e.y - spriteH - 11, barW = isBoss ? 118 : 68;
          ctx.fillStyle = "rgba(15,12,11,.84)"; ctx.fillRect(e.x - barW / 2, barY, barW, isBoss ? 9 : 6);
          ctx.fillStyle = e.elite || isBoss ? "#71332f" : "#5e3934"; ctx.fillRect(e.x - barW / 2 + 1, barY + 1, (barW - 2) * clamp(e.hp / (e.maxHp ?? 60), 0, 1), isBoss ? 7 : 4);
          const enemyName = e.kind === "boss_b1" ? "B1 維修執行人" : e.kind === "boss_b2" ? "B2 檔案保管人" : e.elite ? `追租者｜第 ${e.threat ?? 1} 級` : e.kind === "light" ? "巡燈殘影" : e.kind === "receipt" ? "拾單游魂" : "滲牆住戶";
          ctx.fillStyle="#c2b69a";ctx.font=isBoss?"700 14px serif":"11px serif";ctx.textAlign="center";ctx.fillText(enemyName,e.x,barY-7);ctx.textAlign="start";
        }
      }
      const depth = clamp((p.y - band.top) / Math.max(1, band.bottom - band.top), 0, 1);
      const depthScale = .82 + depth * .26;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = `rgba(0,0,0,${.28 + depth * .18})`;
      ctx.beginPath(); ctx.ellipse(0, 3, 42 * depthScale, 12 * depthScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(p.facing, 1);
      ctx.filter = `brightness(${sampleCharacterExposure(location, p.x / sceneWidth, g.time)}) saturate(.88)`;
      if (p.invuln > 0) ctx.globalAlpha = .45 + Math.sin(now / 35) * .25;
      const walkPhase = isMoving ? Math.floor(now / 105) % 4 : -1;
      const pose = g.dead ? "death" : p.attack > .29 ? "windup" : p.attack > 0 ? "attack" : isMoving ? (walkPhase % 2 === 0 ? "walk" : "walkTransition") : "idle";
      const female = destiny.gender === "female";
      const playerImage = pose === "death"
        ? (female ? sceneImages.playerFemaleDeath : sceneImages.playerDeath)
        : pose === "windup"
        ? (female ? sceneImages.playerFemaleAttackWindup : sceneImages.playerAttackWindup)
        : pose === "attack"
        ? (female ? sceneImages.playerFemaleAttack : sceneImages.playerAttack)
        : pose === "walkTransition"
          ? (female ? sceneImages.playerFemaleWalkTransition : sceneImages.playerWalkTransition)
        : pose === "walk"
          ? (female ? sceneImages.playerFemaleWalk : sceneImages.playerWalk)
          : (female ? sceneImages.playerFemale : sceneImages.player);
      const crop = pose === "death"
        ? (female ? { x: 256, y: 263, w: 987, h: 476 } : { x: 74, y: 218, w: 1261, h: 603 })
        : pose === "windup"
        ? (female ? { x: 349, y: 49, w: 654, h: 909 } : { x: 116, y: 123, w: 680, h: 1197 })
        : pose === "attack"
        ? (female ? { x: 101, y: 106, w: 876, h: 1181 } : { x: 66, y: 114, w: 940, h: 1203 })
        : pose === "walkTransition"
          ? (female ? { x: 254, y: 98, w: 477, h: 1267 } : { x: 147, y: 104, w: 612, h: 1217 })
        : pose === "walk"
          ? (female ? { x: 132, y: 102, w: 668, h: 1243 } : { x: 185, y: 102, w: 587, h: 1218 })
          : (female ? { x: 214, y: 97, w: 562, h: 1263 } : { x: 201, y: 79, w: 588, h: 1278 });
      const spriteH = (pose === "death" ? 126 : getCharacterRenderHeightPx("player")) * depthScale * SCENE_PRESENTATION[location].characterScale;
      const spriteW = spriteH * (crop.w / crop.h);
      const walkBob = isMoving && pose !== "attack" && pose !== "windup" ? Math.abs(Math.sin(now / 105)) * 1.8 : 0;
      if (p.attack > 0 && !g.dead) ctx.rotate(-Math.sin((1 - p.attack / .44) * Math.PI) * .035);
      if (playerImage.complete) ctx.drawImage(playerImage, crop.x, crop.y, crop.w, crop.h, -spriteW * .48, -spriteH - walkBob, spriteW, spriteH);
      ctx.restore();
      ctx.restore();

      if (g.debtMode) { const v = ctx.createRadialGradient(w / 2, h / 2, h * .55, w / 2, h / 2, h * .9); v.addColorStop(0, "transparent"); v.addColorStop(1, "rgba(72,45,35,.14)"); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
      if (p.hp < (76 + destiny.attributes[0] * 5) * .3) { const low = clamp(1 - p.hp / ((76 + destiny.attributes[0] * 5) * .3), 0, 1); const v = ctx.createRadialGradient(w/2,h/2,h*.5,w/2,h/2,h*.86);v.addColorStop(0,"transparent");v.addColorStop(1,`rgba(92,18,17,${.1 + low * .2})`);ctx.fillStyle=v;ctx.fillRect(0,0,w,h); }
      if (g.phaseFlash > 0) { const flashStep = Math.floor((.75 - g.phaseFlash) / .125); if (flashStep >= 0 && flashStep < 6 && flashStep % 2 === 0) { ctx.fillStyle = "rgba(215,228,216,.3)"; ctx.fillRect(0, 0, w, h); } }
      ctx.fillStyle = "rgba(255,255,255,.035)"; for (let i = 0; i < 60; i++) ctx.fillRect((i * 89 + frame * 3) % w, (i * 47) % h, 1, 1);
      frame++; animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resize); };
  }, [activeRoom, cinematicOverlayOpen, demoEndingState, flow.screen, paused, floorSelect, roomEvent, storageOpen, location, destiny.attributes, destiny.floor, destiny.roomSlot, destiny.gender, destiny.talent, destiny.defect, sound]);

  const joy = (x: number, y: number) => { touch.current = { x, y }; };
  const maxHp = 76 + destiny.attributes[0] * 5;
  const maxStamina = 72 + destiny.attributes[1] * 5;
  const attentionLabel = hud.attention <= 1 ? "未留意" : hud.attention <= 3 ? "低度監控" : hud.attention <= 5 ? "監控強化" : hud.attention <= 7 ? "高度關注" : hud.attention <= 9 ? "全面追蹤" : "回收程序";
  const managementBroadcast = /管理室|租約|租金|欠款|追租程序|居住權|結算/.test(message);
  const endingObjective = ["KEYCARD_DROPPED","B2_DEFEATED"].includes(demoEndingState)
    ? ["拾取異常物件","取得特殊權限卡"]
    : ["KEYCARD_COLLECTED","CLEARANCE_REPORT_VIEWED","FLOOR10_BUTTON_DISCOVERED","RETURN_TO_OFFICE"].includes(demoEndingState)
      ? ["返回管理室","交付特殊權限卡"]
      : demoEndingState === "POST_B2_FREE_ROAM"
        ? ["返回 601","查看門下通知單"]
        : demoEndingState !== "B2_ALIVE" ? ["本輪紀錄","等待管理室封存"] : null;

  return (
    <main className={`game-shell ${started ? "is-started" : "is-menu"}`}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="無期租寓可玩遊戲區" />
      <div className="film" />
      <header className="topbar"><span>無期租寓</span><b>第 {hud.day} 日　目前樓層 {game.current.activeBoss ? (game.current.activeBoss === "boss_b1" ? "B1" : "B2") : `${hud.floor}F`}　承租房 {roomNumber(destiny.floor, destiny.roomSlot)}</b><button onClick={() => { if (!paused) dispatchFlow({ type: "TOGGLE_PAUSE" }); setLogOpen(true); }}>住戶紀錄</button><button disabled={flow.overlay.kind !== "none" || dead || complete} onClick={() => dispatchFlow({ type: "TOGGLE_PAUSE" })}>{paused ? "繼續" : "暫停"}</button></header>
      <section className="rent-card"><small>今日租金</small><strong>{hud.rentDue} 租券</strong><b>距離結算　{formatTime(hud.time)}</b><em>既有欠款　{hud.debt} 租券</em></section>
      <section className="vitals"><label><span>生命　{Math.ceil(hud.hp)} / {maxHp}</span><i style={{ width: `${clamp(hud.hp / maxHp * 100, 0, 100)}%` }} /></label><label><span>體力　{Math.ceil(hud.stamina)} / {maxStamina}</span><i style={{ width: `${clamp(hud.stamina / maxStamina * 100, 0, 100)}%` }} /></label></section>
      <section className="score-card"><small>租券</small><strong>{hud.rent}</strong><span>戰力　{hud.score}</span></section>
      {started && <div className="inventory-bar">
        <button><i>1</i><b>改造鋼管</b><span>Lv.{hud.weaponLevel}</span></button>
        <button onClick={useMedkit} disabled={hud.medkits <= 0}><i>2</i><b>逾期藥品</b><span>×{hud.medkits}</span></button>
        <button disabled={hud.keysOwned <= 0}><i>3</i><b>房門鑰匙</b><span>×{hud.keysOwned}</span></button>
        <button className="talent-button" onClick={useTalent} disabled={hud.skillCooldown > 0}><i>Q</i><b>{destiny.talent}</b><span>{hud.skillCooldown > 0 ? `${Math.ceil(hud.skillCooldown)}秒` : "可使用"}</span></button>
      </div>}
      {managementBroadcast ? <div key={message} className="mission"><small>管理室通知</small><span>{message}</span></div> : <div key={message} className="action-toast">{message}</div>}
      {started && <div className="demo-goal"><small>目前目標</small><b>{endingObjective?.[0] ?? (hud.bossB1 ? "前往 B2" : "前往 B1")}</b><em>{endingObjective?.[1] ?? (hud.bossB1 ? "調查底層核心區" : "清除底層異常源")}</em></div>}
      {hud.landlordTask && <div className="task-slip"><small>房東委託</small><b>清除追租異常</b><span>{hud.taskKills} / 2</span></div>}
      {started && <section className={`lease-status ${hud.debt > 0 ? "overdue" : ""}`}><h3>租約狀態</h3><dl><div><dt>欠款</dt><dd>{hud.debt} 租券</dd></div><div><dt>追租程序</dt><dd>{hud.debt > 0 ? "已啟動" : "未啟動"}</dd></div><div><dt>承租房保護</dt><dd>{debtStatus.protectionLost ? "失效" : "有效"}</dd></div><div><dt>公寓關注度</dt><dd>{Math.min(10,hud.attention)} / 10</dd></div><div><dt>監控狀態</dt><dd>{attentionLabel}</dd></div></dl></section>}
      {mortgageMarks.length > 0 && <div className="mortgage-status"><small>能力抵押／輪迴保留</small><b>{mortgageMarks.join("　")}</b></div>}
      {hud.day === 1 && <div className="desktop-help">WASD　移動　　Shift　奔跑　　Space　攻擊　　E　互動</div>}
      <div className="touch-controls">
        <div className="dpad"><button onPointerDown={() => joy(0,-1)} onPointerUp={() => joy(0,0)}>▲</button><button onPointerDown={() => joy(-1,0)} onPointerUp={() => joy(0,0)}>◀</button><button onPointerDown={() => joy(1,0)} onPointerUp={() => joy(0,0)}>▶</button><button onPointerDown={() => joy(0,1)} onPointerUp={() => joy(0,0)}>▼</button></div>
        <div className="actions"><button onPointerDown={attack}>攻擊</button><button onPointerDown={interact}>互動</button><button onPointerDown={useTalent}>天賦</button></div>
      </div>
      {paused && !logOpen && <section className="pause-menu"><div><small>無期租寓管理室</small><h2>暫停</h2><button onClick={() => dispatchFlow({type:"TOGGLE_PAUSE"})}>繼續遊戲</button><button onClick={() => setLogOpen(true)}>住戶紀錄</button><button onClick={() => setMuted(value => !value)}>{muted ? "開啟聲音" : "靜音"}</button><p>快捷鍵　WASD 移動　Shift 奔跑　Space 攻擊　E 互動　Q 天賦</p></div></section>}
      {logOpen && <section className="resident-log"><div><header><small>住戶個人文件</small><h2>住戶執行紀錄</h2><button onClick={() => setLogOpen(false)}>關閉</button></header><p>此處只記錄本輪住戶的行動與結果，不屬於管理室公告。</p><ol>{residentLog.length ? residentLog.map((entry,index)=><li key={`${entry}-${index}`}>{entry}</li>) : <li>本輪尚無執行紀錄。</li>}</ol></div></section>}
      {flow.screen === "title" && <div className={`start-screen ${titleTransitioning ? "is-leaving" : ""}`}><div className="start-copy"><p>無期租寓管理室</p><h1><img src="/logo-title-v1.png" alt="無期租寓"/></h1><blockquote className="title-slogan"><span>付得起租金，活得像人</span><span>付不起租金，歸於樓宇</span></blockquote><div className="title-actions">{availableSave && <button disabled={titleTransitioning} className="asset-button continue-run" onClick={continueSavedRun}>繼續入住<small>第 {availableSave.game.day} 日｜{availableSave.game.floor > 0 ? `${availableSave.game.floor}F` : availableSave.game.floor === 0 ? "B1" : "B2"}｜{availableSave.residentName || "未具名住戶"}</small></button>}<button disabled={titleTransitioning} className="asset-button" onClick={beginNewRegistration}>{titleTransitioning ? "管理室正在翻開租約…" : availableSave ? "建立新住戶" : "開始入住登記"}</button></div><small className="current-lease"><b>入住規約</b><span>按日繳租，維持居住權</span><em>{availableSave ? "偵測到未完成的本輪紀錄" : "建議配戴耳機"}</em></small></div><aside className="title-office-sign"><b>租寓管理室</b><small>訪客請先登記</small></aside><div className="title-notice"><b>通知單已送達</b><span>請至管理室完成登記</span><small>管理室　啟</small></div></div>}
      {introOpen && <section className="intro-screen"><article className="intro-contract"><small>租寓管理室｜入住通知單｜表單 01-A</small><h2>入寓抵債，萬事皆平</h2>{DEMO_OPENING.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<blockquote>「記憶歸零，債務留存。命運重擲，租約無期。」</blockquote><label className="intro-name"><span>本輪住戶姓名</span><input value={residentName} maxLength={18} autoComplete="off" onChange={event => setResidentName(event.target.value)} placeholder="請填寫姓名"/><small>管理室將先以登記編號稱呼你</small></label><div className="intro-gender"><span>本輪住戶性別</span><button className={destiny.gender === "male" ? "selected" : ""} onClick={() => setDestiny(value => ({...value, gender:"male"}))}>男性</button><button className={destiny.gender === "female" ? "selected" : ""} onClick={() => setDestiny(value => ({...value, gender:"female"}))}>女性</button></div><button disabled={!residentName.trim()} onClick={() => { setFilingStage("ready"); dispatchFlow({ type: "OPEN_DESTINY" }); sound("rent"); }}>交付通知單</button><small className="intro-rules">入住規約｜提交後，管理室將依登記資料建立本輪檔案。</small></article></section>}
      {!started && destinyOpen && <section className="destiny-screen">
        <nav className="filing-progress" aria-label="租約建檔進度"><span className={filingStage === "ready" || filingStage === "rolling" ? "active" : "done"}>骰子結果</span><i>›</i><span className={filingStage === "attributes" ? "active" : filingStage === "briefing" || filingStage === "result" || filingStage === "complete" ? "done" : ""}>選擇建檔</span><i>›</i><span className={filingStage === "briefing" || filingStage === "result" || filingStage === "complete" ? "active" : ""}>身份確認</span></nav>
        <div className="contract-head"><span>無期租寓管理室</span><small>輪迴入住登記表｜表單 17-B</small><h2>租約建檔</h2><p>{filingStage === "complete" ? "建檔程序已完成。你的身份已被管理室正式存檔。" : filingStage === "result" ? "請確認本輪最終建檔內容；確認後資料不可撤回。" : filingStage === "attributes" ? "六項骰面已完成記錄；可直接提交，或重新擲出裁定。" : "公寓正在決定你的本輪身份。"}</p><div className="dossier-rule"/><blockquote>{filingStage === "complete" ? "本輪居住權即刻生效。" : "在這裡，每一份檔案，都是你在這棟世界裡的存續證明。"}</blockquote><footer>◇ ROOM 17 ◇</footer></div>
        {(filingStage === "ready" || filingStage === "rolling") && <div className="filing-die"><header><small>骰子結果</small><h3>命運裁定</h3><p>六顆骰子將在同一個投擲場景中落定；落定後才更新六項屬性與建檔結果。</p></header><div className={`six-dice-tray ${filingStage === "rolling" ? "rolling" : ""}`}><DiceRollScene values={destiny.attributes} rolling={filingStage === "rolling"}/></div><p className="roll-instruction">請擲出本輪六項建檔結果。</p><button className="asset-button" disabled={filingStage === "rolling"} onClick={beginFiling}>{filingStage === "rolling" ? "裁定中…" : "擲出裁定"}<small>{filingStage === "rolling" ? "六骰正在同一場景中落定" : "六顆骰子將同時裁定"}</small></button></div>}
        {filingStage === "attributes" && <div className="filing-main"><header><h3>本輪骰子結果</h3><span>可直接提交，或重新擲出裁定</span></header><div className="dice-grid filing-values">
          {ATTRIBUTE_NAMES.map((name, index) => <article key={name} className="die">
            <small>{name}</small><strong style={{animationDelay:`${index * .42}s`}}>{destiny.attributes[index]}</strong><i>管理室建檔</i>
          </article>)}
        </div></div>}
        {filingStage === "result" && <div className="filing-main"><header><h3>確認你的最終建檔內容</h3><span>請確認資訊後完成建檔</span></header><div className="fate-details filing-result">
          <article><small>身份背景</small><b>{destiny.identity}</b><p className="detail">{IDENTITY_LORE[destiny.identity]}（Demo 僅保留背景敘述，專屬能力尚未實裝。）</p></article>
          <article title={TALENT_DESCRIPTIONS[destiny.talent]}><small>天賦技能</small><b>{destiny.talent}</b><p className="detail">{TALENT_DESCRIPTIONS[destiny.talent]}</p></article>
          <article className="defect" title={DEFECT_DESCRIPTIONS[destiny.defect]}><small>缺陷／詛咒</small><b>{destiny.defect}</b><p className="detail">{DEFECT_DESCRIPTIONS[destiny.defect]}</p></article>
          <article><small>初始承租房</small><b>{roomNumber(destiny.floor, destiny.roomSlot)}</b><p className="detail">本輪從此房間出生；只有你與獲得授權的玩家可以正常進入。</p></article>
        </div></div>}
        {filingStage === "attributes" && <div className="contract-actions"><button className="reroll" onClick={beginFiling}>再骰一次<small>重新獲得結果</small></button><button className="accept asset-button" onClick={confirmIdentity}>提交<small>依六骰結果建立身份</small></button></div>}
        {filingStage === "briefing" && <div className="hongyi-briefing" role="status" aria-live="polite"><small>租寓管理室｜紅怡</small><p>「{HONG_YI_LINES.registrationComplete}」</p><span>登記編號　17-B-{String(destiny.floor).padStart(2,"0")}{destiny.roomSlot}</span></div>}
        {filingStage === "result" && <div className="contract-actions"><button className="reroll" onClick={() => setFilingStage("attributes")}>返回修改</button><button className="accept" onClick={finishFiling}>確認建檔結果<small>建立正式檔案</small></button></div>}
        {filingStage === "complete" && <div className="filing-complete"><header><span>建檔完成</span><small>居住權已正式生效</small></header><article><small>租約建檔完成。<br/>居住權已生效。</small><strong><span>無退租。</span><span>無到期。</span><em>無例外。</em></strong><b>ROOM 17 — DOSSIER SEALED</b></article><div className="filing-summary"><span>身份背景<b>{destiny.identity}</b></span><span>天賦技能<b>{destiny.talent}</b></span><span>缺陷／詛咒<b>{destiny.defect}</b></span><span>初始租房<b>{roomNumber(destiny.floor, destiny.roomSlot)}</b></span></div><button className="enter-lease asset-button" onClick={reset}>進入 {roomNumber(destiny.floor, destiny.roomSlot)}<small>開始本輪入住</small></button></div>}
      </section>}
      {started && settlement && <section className="settlement-screen">
        <div className="settlement-paper">
          <header><small>無期租寓管理室｜日租結算通知</small><h2>第 {hud.day} 日</h2><strong>今日 {hud.rentDue} 租券</strong><p>舊債 {hud.debt} 租券，將先增加 5% 利息；你目前持有 {hud.rent} 張租券。</p></header>
          <p className="auto-choice">剩餘 {settlementCountdown} 秒；逾時未選擇將自動視為拒絕繳租。結算期間追租者不會停止。</p>
          <div className="settlement-options">
            <button disabled={hud.rent <= 0} onClick={() => resolveRent("pay")}><b>支付可用租券</b><span>最多支付 {hud.rent}，永遠從最舊欠款開始；不足時仍保留餘額</span></button>
            <button className="refuse" onClick={() => resolveRent("refuse")}><b>拒絕繳租</b><span>欠款完整結轉、失去租金保護；回到承租房後觸發侵蝕與追租者</span></button>
            <div className="mortgage-options"><header><b>抵押一層能力</b><span>{MANAGEMENT_COPY.mortgage}</span></header><button disabled={hud.mortgageLayers >= 10} onClick={() => resolveRent("mortgage")}><b>簽署第 {hud.mortgageLayers + 1} 層抵押</b><span>清除最舊一日欠款｜六項有效能力由 −{hud.mortgageLayers * 10}% 變為 −{Math.min(100, (hud.mortgageLayers + 1) * 10)}%</span></button></div>
          </div>
          <footer>承租房 {roomNumber(destiny.floor, destiny.roomSlot)} 今日租金已鎖定；不能預付。未清餘額會保留在逐日帳本。</footer>
        </div>
      </section>}
      {started && roomEvent !== null && <section className="room-event-screen"><div className="room-event-card">
        <small>{roomNumber(hud.floor, ROOMS[roomEvent].slot)} 號房｜未登記空間</small><h2>{ROOMS[roomEvent].title}</h2><p>{ROOMS[roomEvent].description}</p>
        <p className="auto-choice">離開探索物件的互動範圍會關閉事件窗；要離開房間請走回門口。</p>
        <div>{ROOMS[roomEvent].choices.map((choice, index) => <button key={choice} onClick={() => resolveRoom(index)}>{choice}</button>)}</div>
      </div></section>}
      {started && storageOpen && <section className="storage-screen"><div className="storage-panel"><header><small>{roomNumber(destiny.floor, destiny.roomSlot)}｜住戶寄存櫃</small><h2>{storageCapacity} 格寄存位</h2><p>點擊寄存位後，從背包選取要寄存的物品。租券沒有堆疊上限，存入與取出時自行填寫數量。</p></header><div className="storage-slots">{Array.from({ length: storageCapacity }, (_, index) => { const stack = storage.find(item => item.slot === index); return <button type="button" key={stack?.id ?? `empty-${index}`} className={`${stack ? "filled" : "empty"} ${selectedStorageSlot === index ? "selected" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { const kind = event.dataTransfer.getData("application/x-lease-item") as StorageKind; setSelectedStorageSlot(index); if (kind === "rent") setStorageAmount({slot:index,direction:"store",value:String(hud.rent)}); else if (kind) transferStorage(kind,"store",index,1); }} onClick={() => setSelectedStorageSlot(index)}><i>寄存位 {String(index + 1).padStart(2,"0")}</i>{stack ? <><b>{stack.kind === "rent" ? "租券" : stack.kind === "medkits" ? "過期藥品" : "房門鑰匙"}</b><strong>{stack.kind === "rent" ? stack.quantity : `×${stack.quantity}`}</strong><span>點擊管理</span></> : <span>目前空置</span>}</button>; })}</div>{selectedStorageSlot !== null && <div className="storage-backpack"><header><b>{storage.find(item => item.slot === selectedStorageSlot) ? "寄存位內容" : "住戶背包"}</b><button onClick={() => setSelectedStorageSlot(null)}>關閉</button></header>{(() => { const stack = storage.find(item => item.slot === selectedStorageSlot); if (stack) return <div className="stored-item"><b>{stack.kind === "rent" ? `租券 ${stack.quantity}` : stack.kind === "medkits" ? `過期藥品 ×${stack.quantity}` : `房門鑰匙 ×${stack.quantity}`}</b><button className="asset-button" onClick={() => stack.kind === "rent" ? setStorageAmount({slot:selectedStorageSlot,direction:"take",value:String(stack.quantity)}) : transferStorage(stack.kind,"take",selectedStorageSlot,1)}>取出</button></div>; return <div className="backpack-items"><button draggable disabled={hud.rent <= 0} onDragStart={event => event.dataTransfer.setData("application/x-lease-item","rent")} onClick={() => setStorageAmount({slot:selectedStorageSlot,direction:"store",value:String(hud.rent)})}>租券<b>{hud.rent}</b></button><button draggable disabled={hud.medkits <= 0} onDragStart={event => event.dataTransfer.setData("application/x-lease-item","medkits")} onClick={() => transferStorage("medkits","store",selectedStorageSlot,1)}>過期藥品<b>×{hud.medkits}</b></button><button draggable disabled={hud.keysOwned <= 0} onDragStart={event => event.dataTransfer.setData("application/x-lease-item","keys")} onClick={() => transferStorage("keys","store",selectedStorageSlot,1)}>房門鑰匙<b>×{hud.keysOwned}</b></button></div>; })()}</div>}{storageAmount && <div className="storage-amount-dialog" role="dialog" aria-modal="true"><label>{storageAmount.direction === "store" ? "存入" : "取出"}租券數量<input type="number" min="1" value={storageAmount.value} onChange={event => setStorageAmount({...storageAmount,value:event.target.value})}/></label><div><button onClick={() => setStorageAmount(null)}>取消</button><button className="asset-button" onClick={() => { transferStorage("rent",storageAmount.direction,storageAmount.slot,Number(storageAmount.value)); setStorageAmount(null); }}>確認</button></div></div>}<div className="storage-actions"><button className="close-storage asset-button" onClick={() => { setSelectedStorageSlot(null); setStorageAmount(null); dispatchFlow({ type: "CLOSE_OVERLAY", kind: "storage" }); }}>關閉櫃門</button></div></div></section>}
      {started && floorSelect && <section className={`floor-select-screen ${elevatorTarget ? "in-transit" : ""}`}><div className="elevator-console">
        <header><small>老式電梯控制盤</small><h2>請選擇目的樓層</h2><p>租金依承租樓層結算<br/>向下探索時，收益依樓層差衰減</p></header>
        <div className="floor-indicator"><small>樓層顯示</small><strong>{elevatorTarget ?? (game.current.activeBoss === "boss_b1" ? "B1" : game.current.activeBoss === "boss_b2" ? "B2" : hud.floor)}</strong><span>{elevatorTarget ? "運行中" : "待機"}</span></div>
        <div className="floor-buttons">
          {STARTING_FLOORS.map(floor => { const maxAccess = Math.min(9, destiny.floor + 3); const locked = !canAccessDemoFloor(floor, destiny.floor, demoEndingState); const current = !game.current.activeBoss && floor === hud.floor; const leased = floor === destiny.floor; const subtitle = floor === 6 && !locked && floor > maxAccess ? "特殊權限卡已開放管理室" : floor === 1 ? "資源收益較低" : floor === 2 ? leased ? `承租房 ${roomNumber(destiny.floor,destiny.roomSlot)}` : "低風險探索" : floor === 3 ? "異常強度較低" : floor === 4 ? "事件收益提升" : floor === 5 ? "異常強度提升" : `最高通行權限 ${maxAccess}F`; return <button key={floor} disabled={locked || current || Boolean(elevatorTarget)} className={`${locked ? "locked" : ""} ${current ? "current" : ""} ${leased ? "leased" : ""} ${elevatorTarget === `${floor}F` ? "pressed" : ""}`} onClick={() => beginElevatorTravel(floor)}><strong>{floor}F</strong>{leased && <i>承租</i>}<b>{locked ? "租約權限不足" : current ? "目前所在" : leased ? "承租樓層" : floor === 6 && floor > maxAccess ? "管理室特別通行" : floor <= 3 ? "安全避難層" : "博弈收益層"}</b><span>{subtitle}</span></button>; })}
          {demoEndingState !== "B2_ALIVE" && <button className="floor10-pending" disabled={Boolean(elevatorTarget) || ["KEYCARD_DELIVERED","POST_B2_FREE_ROAM","FLOOR10_NOTICE_DISCOVERED","DEMO_ENDING_STARTED","DEMO_COMPLETED"].includes(demoEndingState)} onClick={() => { const firstAttempt = floor10Attempts === 0; setFloor10Attempts(value => value + 1); if (demoEndingState === "CLEARANCE_REPORT_VIEWED") progressDemoEnding("FLOOR10_BUTTON_DISCOVERED"); setMessage(firstAttempt ? DEMO_ENDING_ZH_TW["demo.elevator.floor10.first_interaction"] : DEMO_ENDING_ZH_TW["demo.elevator.floor10.repeat_interaction"]); playVoice(firstAttempt ? 3 : 4); }}><strong>10F</strong><b>等待管理員核准</b><span>按鍵發出異常白光</span></button>}
          <button className={`boss-floor ${elevatorTarget === "B1" ? "pressed" : ""}`} disabled={hud.bossB1 || Boolean(elevatorTarget)} onClick={() => beginElevatorTravel("boss_b1")}><strong>B1</strong><b>{hud.bossB1 ? "今日已清除" : "底層異常源"}</b><span>目前主線目標</span></button>
          <button className={`boss-floor ${!hud.bossB1 ? "locked" : ""} ${elevatorTarget === "B2" ? "pressed" : ""}`} disabled={!hud.bossB1 || hud.bossB2 || Boolean(elevatorTarget)} onClick={() => beginElevatorTravel("boss_b2")}><strong>B2</strong><b>{hud.bossB2 ? "今日已清除" : hud.bossB1 ? "底層核心區" : "租約尚未允許"}</b><span>{hud.bossB1 ? "最終目標" : "須先清除 B1"}</span></button>
        </div>
        <aside><h3>租約狀態</h3><dl><div><dt>目前樓層</dt><dd>{game.current.activeBoss ? (game.current.activeBoss === "boss_b1" ? "B1" : "B2") : `${hud.floor}F`}</dd></div><div><dt>承租樓層</dt><dd>{destiny.floor}F</dd></div><div><dt>承租房號</dt><dd>{roomNumber(destiny.floor,destiny.roomSlot)}</dd></div><div><dt>今日租金</dt><dd>{hud.rentDue} 租券</dd></div><div><dt>欠租</dt><dd>{hud.debt > 0 ? `${hud.day - 1} 日` : "0 日"}</dd></div><div><dt>追租程序</dt><dd>{hud.debt > 0 ? "已啟動" : "未啟動"}</dd></div><div><dt>最高通行權限</dt><dd>{Math.min(9,destiny.floor+3)}F</dd></div></dl><p>日租倒數與追擊不中止</p></aside>
        {elevatorTarget && <div className="elevator-doors" aria-hidden="true"><i/><i/></div>}
      </div></section>}
      {started && clearanceReportOpen && <section className="clearance-report-screen"><article className="clearance-report"><header><small>{DEMO_ENDING_ZH_TW["demo.b2.clearance.header"]}</small><b>清剿紀錄：B2-{String(hud.day).padStart(2,"0")}-{String(destiny.roomSlot).padStart(2,"0")}</b></header><h2>{DEMO_ENDING_ZH_TW["demo.b2.clearance.title"]}</h2><h3>{DEMO_ENDING_ZH_TW["demo.b2.clearance.subtitle"]}</h3><p>{DEMO_ENDING_ZH_TW["demo.b2.clearance.body"]}</p><div className="clearance-status">{(["status_b1","status_b2","status_power","status_elevator","status_floor10"] as const).map((key,index)=><span key={key} style={{animationDelay:`${.2 + index * .18}s`}}>{DEMO_ENDING_ZH_TW[`demo.b2.clearance.${key}`]}<i>{key === "status_floor10" ? "待核准" : key === "status_power" ? "已登記" : key === "status_b1" ? "已封鎖" : "已清除"}</i></span>)}</div><blockquote>「{DEMO_ENDING_ZH_TW["demo.b2.clearance.hongyi_message"]}」<small>——管理員・紅怡</small></blockquote><footer><button onClick={() => { progressDemoEnding("CLEARANCE_REPORT_VIEWED"); setClearanceReportOpen(false); setMessage(DEMO_ENDING_ZH_TW["demo.return_office.description"]); }}>查看戰場</button><button className="asset-button" onClick={() => { progressDemoEnding("CLEARANCE_REPORT_VIEWED"); setClearanceReportOpen(false); setMessage(DEMO_ENDING_ZH_TW["demo.return_office.description"]); }}>返回管理室<small>將特殊權限卡交給紅怡</small></button></footer></article></section>}
      {started && managementDialogueStep !== null && <section className="hongyi-office-dialogue"><article><header><small>六樓｜租寓管理室</small><b>管理員・紅怡</b></header><p>「{[DEMO_ENDING_ZH_TW["demo.hongyi.keycard.intro"],DEMO_ENDING_ZH_TW["demo.hongyi.keycard.floor10"],DEMO_ENDING_ZH_TW["demo.hongyi.keycard.registration"],DEMO_ENDING_ZH_TW["demo.hongyi.keycard.conclusion"]][managementDialogueStep]}」</p><footer><span>特殊權限卡・10F</span><button className="asset-button" onClick={() => { if (managementDialogueStep < 2) { setManagementDialogueStep(managementDialogueStep + 1); return; } if (managementDialogueStep === 2) { progressDemoEnding("KEYCARD_DELIVERED"); setManagementDialogueStep(3); setMessage("特殊權限卡已由管理室登記；10F 仍待核准"); return; } leaveManagementOffice(); }}>{managementDialogueStep === 2 ? "交付並登記" : managementDialogueStep === 3 ? "離開管理室" : "繼續"}</button></footer></article></section>}
      {started && floor10NoticeOpen && <section className="floor10-notice-screen"><article><small>{DEMO_ENDING_ZH_TW["demo.floor10.notice.header"]}</small><h2>{DEMO_ENDING_ZH_TW["demo.floor10.notice.title"]}</h2><p>{DEMO_ENDING_ZH_TW["demo.floor10.notice.body"]}</p><blockquote>{DEMO_ENDING_ZH_TW["demo.floor10.notice.inspect"]}</blockquote><button className="asset-button" onClick={() => { progressDemoEnding("DEMO_ENDING_STARTED"); setFloor10NoticeOpen(false); setDemoEndingOpen(true); }}>翻閱通知單</button></article></section>}
      {started && demoEndingOpen && <section className="demo-ending-cinematic"><article><small>本輪紀錄｜已封存</small><h2>{DEMO_ENDING_ZH_TW["demo.ending.title"]}</h2><p>{DEMO_ENDING_ZH_TW["demo.ending.body"]}</p><strong>{DEMO_ENDING_ZH_TW["demo.ending.teaser"]}</strong><footer><button onClick={() => { setDemoEndingOpen(false); setLogOpen(true); }}>查看本輪紀錄</button><button className="asset-button" onClick={() => { progressDemoEnding("DEMO_COMPLETED"); setDemoEndingOpen(false); setFilingStage("ready"); window.localStorage.removeItem(RUN_SAVE_KEY); setAvailableSave(null); dispatchFlow({type:"COMPLETE_DEMO"}); dispatchFlow({type:"RETURN_TITLE"}); }}>返回標題</button></footer></article></section>}
      {dead && deathReady && <button className="death" onClick={() => { game.current.dead = false; setFilingStage("ready"); dispatchFlow({ type: "RESTART" }); setLocation("hallway"); setActiveRoom(null); setDestiny(createDestiny()); }}>你已融入公寓<br/><span>重新入住</span></button>}
      {complete && null}
    </main>
  );
}
