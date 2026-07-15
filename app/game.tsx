"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { DEFECT_DESCRIPTIONS, DEMO_OPENING, DEMO_ROOMS, IDENTITY_LORE, MANAGEMENT_COPY, TALENT_DESCRIPTIONS } from "./game/demo-content";
import { gameFlowReducer, INITIAL_GAME_FLOW } from "./game/flow-state";
import type { DebtEntry, Destiny, Enemy, FloorState, Location, Pickup, StorageKind, StorageStack } from "./game/model";

const ATTRIBUTE_NAMES = ["體魄", "反應", "意志", "感知", "交涉", "異常親和"];
const IDENTITIES = ["清潔工", "醫師", "逃犯", "房仲", "靈媒", "前住戶"];
const TALENTS = ["租緩", "窺層", "偽居", "契語", "蝕耐"] as const;
const DEFECTS = ["貪息", "幻聽", "無家", "輕厄", "直白", "寡眠"] as const;
const STARTING_FLOORS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const d6 = () => Math.floor(Math.random() * 6) + 1;
const createDestiny = (previous?: Destiny, lockedDie: number | null = null): Destiny => {
  return {
    attributes: ATTRIBUTE_NAMES.map((_, index) => index === lockedDie && previous ? previous.attributes[index] : d6()),
    gender: previous?.gender ?? "male",
    identity: IDENTITIES[Math.floor(Math.random() * IDENTITIES.length)],
    talent: TALENTS[Math.floor(Math.random() * TALENTS.length)],
    defect: DEFECTS[Math.floor(Math.random() * DEFECTS.length)],
    floor: STARTING_FLOORS[Math.floor(Math.random() * STARTING_FLOORS.length)],
    roomSlot: 1 + Math.floor(Math.random() * 9),
  };
};
const INITIAL_DESTINY: Destiny = { attributes: [3, 3, 3, 3, 3, 3], gender: "male", identity: "清潔工", talent: "租緩", defect: "貪息", floor: 3, roomSlot: 4 };
const destinyPower = (destiny: Destiny) => destiny.attributes.reduce((sum, value) => sum + value * 9, 24) + (destiny.attributes[5] >= 5 ? 18 : 0);
const ROOMS = DEMO_ROOMS;

const WORLD_W = 1800;
const WORLD_H = 760;
const ROOM_W = 1000;
const ELEVATOR_W = 420;
const DOORS = Array.from({ length: 9 }, (_, index) => ({ slot: index + 1, x: 165 + index * 180 }));
const roomNumber = (floor: number, slot: number) => `${floor}${String(slot).padStart(2, "0")}`;
const zoneName = (floor: number) => floor >= 20 ? "高級住戶區" : floor >= 10 ? "中層交易區" : "廉價住戶區";
const baseRentForFloor = (floor: number, attention: number, negotiation: number) => Math.ceil((10 + 1.8 * floor + .11 * floor * floor) * (1 + attention * .06) * (1 - Math.min(.2, negotiation * .025)));
const debtTotal = (ledger: DebtEntry[]) => ledger.reduce((total, entry) => total + entry.remainingBalance, 0);
const phaseName = (time: number) => {
  const elapsed = 720 - time;
  return elapsed < 240 ? "白晝" : elapsed < 420 ? "黃昏" : elapsed < 630 ? "宵禁深夜" : "臨晨詭時";
};
const formatTime = (seconds: number) => { const whole = Math.ceil(seconds); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`; };
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
  const touch = useRef({ x: 0, y: 0 });
  const audio = useRef<AudioContext | null>(null);
  const storageId = useRef(1);
  const game = useRef({
    player: { x: 150, y: 390, hp: 100, stamina: 100, facing: 1, attack: 0, invuln: 0 },
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
  const [lockedDie, setLockedDie] = useState<number | null>(null);
  const [rerolls, setRerolls] = useState(2);
  const paused = flow.paused;
  const settlement = flow.overlay.kind === "settlement";
  const [settlementCountdown, setSettlementCountdown] = useState(8);
  const roomEvent = flow.overlay.kind === "roomEvent" ? flow.overlay.roomId : null;
  const floorSelect = flow.overlay.kind === "floorSelect";
  const [location, setLocation] = useState<"hallway" | "room" | "elevator">("hallway");
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [mortgageMarks, setMortgageMarks] = useState<string[]>([]);
  const [debtStatus, setDebtStatus] = useState({ arrears: 0, protectionLost: false });
  const [storage, setStorage] = useState<StorageStack[]>([]);
  const [storageCapacity, setStorageCapacity] = useState(5);
  const storageOpen = flow.overlay.kind === "storage";
  const [message, setMessage] = useState("找到電梯，並在催租前湊齊 50 租券");
  const [hud, setHud] = useState({ hp: 100, stamina: 100, rent: 38, time: 720, score: 182, day: 1, rentDue: 50, debt: 0, mortgageLayers: 0, taskKills: 0, landlordTask: false, floor: 7, attention: 0, weaponLevel: 1, medkits: 1, keysOwned: 0, skillCooldown: 0, bossB1: false, bossB2: false });
  const ambience = useRef<HTMLAudioElement | null>(null);
  const elevatorAudio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  const sound = useCallback((kind: "dice" | "attack" | "pickup" | "hurt" | "rent") => {
    if (typeof window === "undefined") return;
    const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    const context = audio.current || new AudioClass();
    audio.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const settings = {
      dice: [190, 90, 0.12], attack: [110, 45, 0.09], pickup: [420, 680, 0.16], hurt: [75, 38, 0.2], rent: [52, 31, 0.35],
    }[kind];
    oscillator.type = kind === "pickup" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(settings[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2]);
    gain.gain.setValueAtTime(kind === "rent" ? 0.1 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings[2]);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(now); oscillator.stop(now + settings[2]);
  }, []);

  const startAmbience = useCallback(() => {
    if (!ambience.current) {
      ambience.current = new Audio("/audio/abandoned-passages-cc0.ogg");
      ambience.current.loop = true;
      ambience.current.volume = .24;
    }
    ambience.current.muted = muted;
    void ambience.current.play().catch(() => undefined);
  }, [muted]);

  useEffect(() => {
    if (ambience.current) ambience.current.muted = muted;
  }, [muted]);

  useEffect(() => () => {
    ambience.current?.pause();
    elevatorAudio.current?.pause();
    void audio.current?.close();
  }, []);

  const reset = useCallback(() => {
    const power = destinyPower(destiny);
    const lowPowerBonus = power < 230 ? 12 : 0;
    const maxHp = 76 + destiny.attributes[0] * 5;
    const maxStamina = 72 + destiny.attributes[1] * 5;
    const initialFloorState = createFloorState(destiny.floor, 1);
    game.current = {
      player: { x: 155, y: 390, hp: maxHp, stamina: maxStamina, facing: 1, attack: 0, invuln: 0 },
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
    setMessage(`${MANAGEMENT_COPY.checkIn} 承租房：${roomNumber(destiny.floor, destiny.roomSlot)}`);
    setLocation("room");
    setActiveRoom(destiny.roomSlot);
    setMortgageMarks([]);
    setDebtStatus({ arrears: 0, protectionLost: false });
    storageId.current = 1;
    setStorage([]);
    setStorageCapacity(5);
    dispatchFlow({ type: "START_RUN" });
    startAmbience();
  }, [destiny, startAmbience]);

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

    g.floor = floor; g.activeBoss = null; g.player.x = 150; g.player.y = 390; g.camera = 0;
    g.enemies = targetState.enemies;
    g.pickups = targetState.pickups;
    g.visitedRooms = targetState.visitedRooms;
    setMessage(firstVisit ? `首次抵達 ${floor}F：本輪樓層資源與裝備已生成，拾取後不會補生` : `返回 ${floor}F：載入原有樓層狀態；經過 ${elapsedDays} 日，新增 ${additions} 個異常`);
    dispatchFlow({ type: "CLOSE_OVERLAY", kind: "floorSelect" }); setLocation("hallway"); setActiveRoom(null); sound("dice");
    setHud({ hp: g.player.hp, stamina: g.player.stamina, rent: g.rent, time: g.time, score: g.score, day: g.day, rentDue: g.rentDue, debt: debtTotal(g.debtLedger), mortgageLayers: g.mortgageLayers, taskKills: g.taskKills, landlordTask: g.landlordTask, floor: g.floor, attention: g.attention, weaponLevel: g.weaponLevel, medkits: g.medkits, keysOwned: g.keysOwned, skillCooldown: g.skillCooldown, bossB1: g.defeatedBosses.includes("boss_b1"), bossB2: g.defeatedBosses.includes("boss_b2") });
  }, [sound]);

  const enterBoss = useCallback((boss: "boss_b1" | "boss_b2") => {
    const g = game.current;
    if (boss === "boss_b2" && !g.defeatedBosses.includes("boss_b1")) {
      setMessage("B2 的按鍵沒有亮起：租約要求先清除 B1 異常源");
      return;
    }
    const hp = boss === "boss_b1" ? 90 : 130;
    g.activeBoss = boss;
    g.floor = boss === "boss_b1" ? 0 : -1;
    g.player.x = 150; g.player.y = 390; g.camera = 0;
    g.enemies = [{ x: 1220, y: 390, hp, maxHp: hp, phase: 0, location: "hallway", followsIndoors: false, kind: boss }];
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

  const useMedkit = useCallback(() => {
    const g = game.current;
    const maxHp = 76 + destiny.attributes[0] * 5;
    if (!started || g.medkits <= 0 || g.player.hp >= maxHp || g.dead) return;
    g.medkits -= 1; g.player.hp = Math.min(maxHp, g.player.hp + (destiny.talent === "急救常識" ? 55 : 38));
    setMessage(destiny.talent === "急救常識" ? "急救常識生效：生命大幅恢復" : "使用藥品：生命恢復"); sound("pickup");
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

  const transferStorage = useCallback((kind: StorageKind, direction: "store" | "take") => {
    const g = game.current;
    const maxStack = kind === "rent" ? 99 : 5;
    const inventoryAmount = () => kind === "rent" ? g.rent : kind === "medkits" ? g.medkits : g.keysOwned;
    const changeInventory = (amount: number) => {
      if (kind === "rent") g.rent += amount;
      if (kind === "medkits") g.medkits += amount;
      if (kind === "keys") g.keysOwned += amount;
    };
    setStorage(current => {
      const next = current.map(stack => ({ ...stack }));
      if (direction === "store") {
        const amount = Math.min(kind === "rent" ? 10 : 1, inventoryAmount());
        if (amount <= 0) return current;
        let stack = next.find(item => item.kind === kind && item.quantity < maxStack);
        if (!stack) {
          if (next.length >= storageCapacity) return current;
          stack = { id: storageId.current++, kind, quantity: 0 };
          next.push(stack);
        }
        const moved = Math.min(amount, maxStack - stack.quantity);
        stack.quantity += moved; changeInventory(-moved);
      } else {
        const stack = next.find(item => item.kind === kind);
        if (!stack) return current;
        const moved = Math.min(kind === "rent" ? 10 : 1, stack.quantity);
        stack.quantity -= moved; changeInventory(moved);
        if (stack.quantity === 0) next.splice(next.findIndex(item => item.id === stack.id), 1);
      }
      setHud(value => ({ ...value, rent: g.rent, medkits: g.medkits, keysOwned: g.keysOwned }));
      return next;
    });
  }, [storageCapacity]);

  const rollAgain = useCallback(() => {
    if (rerolls <= 0) return;
    sound("dice");
    setDestiny(previous => createDestiny(previous, lockedDie));
    setRerolls(value => value - 1);
  }, [lockedDie, rerolls, sound]);

  const attack = useCallback(() => {
    const p = game.current.player;
    const staminaCost = Math.max(8, 16 - destiny.attributes[1]);
    if (p.attack <= 0 && p.stamina >= staminaCost && !game.current.dead) {
      p.attack = 0.28;
      p.stamina -= staminaCost;
      sound("attack");
    }
  }, [destiny.attributes, sound]);

  const interact = useCallback(() => {
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
          setHud(value => ({ ...value, rent: g.rent, score: g.score, medkits: g.medkits, keysOwned: g.keysOwned, weaponLevel: g.weaponLevel }));
          return;
        }
      }
      const nearbyDoor = g.activeBoss ? undefined : DOORS.find(door => Math.abs(door.x - g.player.x) < 43 + destiny.attributes[3] * 5);
      if (nearbyDoor) {
        const isOwnRoom = g.floor === destiny.floor && nearbyDoor.slot === destiny.roomSlot;
        const eventRoom = ROOMS.find(room => room.slot === nearbyDoor.slot);
        if (!isOwnRoom && !eventRoom) {
          setMessage(`${roomNumber(g.floor, nearbyDoor.slot)} 屬於其他住戶；多人模式需由屋主邀請、授權或使用特殊規則才能進入`);
          return;
        }
        const doorX = nearbyDoor.x;
        g.player.x = 145; g.camera = 0;
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
        setActiveRoom(nearbyDoor.slot); setLocation("room");
        setMessage(entryMessage); sound("rent");
        return;
      }
      if (g.player.x > 1690) {
        g.player.x = 105; g.player.y = 390; g.camera = 0;
        g.enemies.forEach((enemy, index) => {
          if (enemy.hp > 0 && enemy.location === "hallway" && enemy.followsIndoors && enemy.x > 1320) {
            enemy.location = "elevator"; enemy.roomSlot = undefined; enemy.x = 55 + index * 28; enemy.y = 350 + (index % 2) * 95;
          }
        });
        keys.current = {};
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
      g.player.x = returnX; g.camera = clamp(returnX - 420, 0, WORLD_W - 900);
      keys.current = {};
      dispatchFlow({ type: "CLOSE_OVERLAY" }); setLocation("hallway"); setActiveRoom(null);
      setMessage("返回公共走廊");
      return;
    }
    const interactionX = location === "elevator" ? 330 : 790;
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
  }, [activeRoom, destiny.attributes, destiny.defect, destiny.floor, destiny.roomSlot, location, sound, spawnRentPursuers]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
  }, [attack, dead, floorSelect, interact, roomEvent, storageOpen, useMedkit, useTalent]);

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
      room: Object.assign(new Image(), { src: "/scene-home-v1.png" }),
      elevator: Object.assign(new Image(), { src: "/scene-elevator-v1.png" }),
      player: Object.assign(new Image(), { src: "/sprite-player-v1.png" }),
      playerFemale: Object.assign(new Image(), { src: "/sprite-player-female-v1.png" }),
      wall: Object.assign(new Image(), { src: "/sprite-wall-resident-v1.png" }),
      light: Object.assign(new Image(), { src: "/sprite-light-warden-v1.png" }),
      receipt: Object.assign(new Image(), { src: "/sprite-receipt-collector-v1.png" }),
      pursuer: Object.assign(new Image(), { src: "/sprite-rent-pursuer-v1.png" }),
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
      if (flow.screen === "run" && !paused && !g.dead) {
        const localWorldWidth = location === "hallway" ? WORLD_W : location === "elevator" ? ELEVATOR_W : ROOM_W;
        const dx = (keys.current.d || keys.current.arrowright ? 1 : 0) - (keys.current.a || keys.current.arrowleft ? 1 : 0) + touch.current.x;
        const dy = (keys.current.s || keys.current.arrowdown ? 1 : 0) - (keys.current.w || keys.current.arrowup ? 1 : 0) + touch.current.y;
        const len = Math.hypot(dx, dy) || 1;
        const sprint = keys.current.shift && p.stamina > 0 ? 1.55 : 1;
        const moveSpeed = 150 + destiny.attributes[1] * 15;
        p.x = clamp(p.x + (dx / len) * moveSpeed * sprint * dt, 55, localWorldWidth - 55);
        p.y = location === "elevator" ? clamp(p.y + (dy / len) * moveSpeed * .72 * sprint * dt, 315, 520) : clamp(p.y + (dy / len) * moveSpeed * .72 * sprint * dt, 190, WORLD_H - 90);
        const interactionX = location === "elevator" ? 330 : 790;
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
        const elapsed = 720 - g.time;
        const nextPhase = elapsed < 240 ? 0 : elapsed < 420 ? 1 : elapsed < 630 ? 2 : 3;
        if (nextPhase !== g.phaseIndex) {
          g.phaseIndex = nextPhase;
          g.phaseFlash = .55;
          if (!g.activeBoss && g.floor > 0) {
            g.pickups = createFloorState(g.floor, g.day).pickups;
            const floorState = g.floorStates[g.floor];
            if (floorState) floorState.pickups = g.pickups;
          }
          setMessage(`日光燈連閃三次：已進入${["白晝", "黃昏", "宵禁深夜", "臨晨詭時"][nextPhase]}，普通地面物品重新生成`);
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
          const baseSpeed = e.kind === "receipt" ? 145 : e.kind === "light" ? 105 : isBoss ? 52 : 90;
          if (dist < (isBoss ? 620 : e.kind === "receipt" ? 550 : e.kind === "light" ? 450 : 330) || e.elite) { const speed = e.elite ? 68 + (e.threat ?? 1) * 8 + g.attention * 2 : baseSpeed; e.x += ((p.x - e.x) / safeDist) * speed * dt; e.y += ((p.y - e.y) / safeDist) * (speed * .78) * dt; }
          if (p.attack > .10 && dist < 125) { e.hp -= (95 + g.weaponLevel * 24) * dt; if (e.hp <= 0) {
            if (isBoss) {
              const bossId = e.kind as "boss_b1" | "boss_b2";
              if (!g.defeatedBosses.includes(bossId)) g.defeatedBosses.push(bossId);
              g.rent += bossId === "boss_b1" ? 18 : 26;
              g.score += bossId === "boss_b1" ? 120 : 180;
              setMessage(`${bossId === "boss_b1" ? "B1" : "B2"} 底層異常源已清除；特殊權限物已登記`);
              sound("rent");
              if (bossId === "boss_b2" && g.defeatedBosses.includes("boss_b1")) {
                dispatchFlow({ type: "COMPLETE_DEMO" });
                setMessage("清剿底層異常源完成：Demo 通關");
              }
              continue;
            }
            const rawReward = e.elite ? 6 + (e.threat ?? 1) * 2 : 7;
            const reward = Math.max(1, Math.floor(rawReward * escapeYieldMultiplier(g.floor, destiny.floor, "monster")));
            g.rent += reward; g.score += e.elite ? 28 + (e.threat ?? 1) * 7 : 21;
            const enemyName = e.kind === "light" ? "巡燈殘影" : e.kind === "receipt" ? "拾單游魂" : "滲牆住戶";
            setMessage(e.elite ? `追租者已清除：掉落租券 +${reward}；欠租債務不會因此減少` : `${enemyName}已清除：租券 +${reward}`);
          } }
          if (dist < (isBoss ? 62 : 48) && p.invuln === 0) { const baseDamage = e.kind === "boss_b2" ? 14 : e.kind === "boss_b1" ? 10 : e.kind === "wall" ? 14 : e.kind === "receipt" ? 11 : 10; p.hp -= Math.max(1, baseDamage + (e.elite ? (e.threat ?? 1) * 2 : 0) - Math.floor(destiny.attributes[5] / 2)); p.invuln = .8; sound("hurt"); }
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
      const sceneImage = sceneImages[location];
      if (sceneImage.complete && sceneImage.naturalWidth > 0) {
        ctx.drawImage(sceneImage, 0, 0, sceneWidth, h);
        ctx.fillStyle = "rgba(4,7,6,.12)";
        ctx.fillRect(0, 0, sceneWidth, h);
      }
      if (location === "hallway") {
      for (const door of DOORS) {
        const own = g.floor === destiny.floor && door.slot === destiny.roomSlot;
        const eventRoom = ROOMS.find(room => room.slot === door.slot);
        ctx.fillStyle = own ? "rgba(182,154,87,.13)" : eventRoom ? "rgba(103,82,63,.09)" : "transparent";
        ctx.fillRect(door.x - 50, h * .28, 100, h * .47);
        ctx.strokeStyle = own ? "#b69a57" : eventRoom ? "#776452" : "rgba(80,84,76,.35)"; ctx.lineWidth = own ? 3 : 1; ctx.strokeRect(door.x - 50, h * .28, 100, h * .47);
        ctx.fillStyle = own ? "#dfca8d" : "#c5b99b"; ctx.font = "600 13px serif"; ctx.fillText(roomNumber(g.floor, door.slot), door.x - 18, h * .325);
        ctx.font = "11px serif";
        ctx.fillText(own ? "你的房間｜E" : eventRoom ? "可探索｜E" : "其他住戶", door.x - 35, h * .75);
      }
      ctx.fillStyle = "#d1c3a1"; ctx.font = "700 18px serif"; ctx.fillText("電梯｜E", 1705, h * .35);

      for (const item of g.pickups) if (!item.taken) {
        const bob = Math.sin(now / 300 + item.x) * 4;
        ctx.fillStyle = item.type === "租券" ? "#c0ad75" : item.type === "藥品" ? "#758e78" : item.type === "裝備" ? "#8b5e4e" : "#b79a61";
        ctx.beginPath(); ctx.arc(item.x, item.y + bob, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(220,205,155,.7)"; ctx.font = "12px serif"; ctx.fillText(item.type, item.x - 18, item.y - 22 + bob);
      }
      } else if (location === "room") {
        const activeEvent = ROOMS.find(room => room.slot === activeRoom);
        const own = activeRoom !== null && g.floor === destiny.floor && activeRoom === destiny.roomSlot;
        ctx.fillStyle = "rgba(9,12,10,.72)"; ctx.fillRect(15, h * .22, 125, 34);
        ctx.fillStyle = "#d0c29d"; ctx.font = "700 14px serif"; ctx.fillText("E 返回走廊", 25, h * .255);
        ctx.fillStyle = "rgba(9,12,10,.72)"; ctx.fillRect(705, h * .38, 180, 64);
        ctx.fillStyle = "#d0c29d"; ctx.font = "700 16px serif"; ctx.fillText(own ? "個人儲物櫃" : activeEvent?.id === 0 ? "發霉冰箱" : activeEvent?.id === 1 ? "封鎖牆面" : "住戶診療台", 720, h * .43);
        ctx.font = "13px serif"; ctx.fillText(own ? "靠近按 E 整理" : "靠近按 E 探索", 720, h * .47);
      } else {
        ctx.fillStyle = "rgba(9,12,10,.75)"; ctx.fillRect(12, h * .25, 80, 30); ctx.fillRect(286, h * .63, 110, 34);
        ctx.fillStyle = "#d0c29d"; ctx.font = "700 12px serif"; ctx.fillText("E 離開", 24, h * .28); ctx.fillText("控制盤｜E 操作", 297, h * .67);
      }
      for (const e of g.enemies) if (e.hp > 0 && e.location === location && (location !== "room" || e.roomSlot === activeRoom)) {
        const pulse = Math.sin(now / 420 + e.phase) * 5;
        const isBoss = e.kind === "boss_b1" || e.kind === "boss_b2";
        ctx.fillStyle = e.elite || isBoss ? "rgba(124,38,34,.38)" : e.kind === "light" ? "rgba(168,202,194,.24)" : "rgba(170,166,146,.28)"; ctx.beginPath(); ctx.ellipse(e.x, e.y, (e.elite || isBoss ? 48 : 35) + pulse, e.elite || isBoss ? 86 : 68, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(e.x, e.y + 64); ctx.scale(p.x > e.x ? -1 : 1, 1);
        const enemyImage = e.kind === "light" ? sceneImages.light : e.kind === "receipt" ? sceneImages.receipt : e.elite || e.kind === "pursuer" || e.kind === "boss_b2" ? sceneImages.pursuer : sceneImages.wall;
        const spriteW = isBoss ? 150 : e.elite ? 120 : 100;
        const spriteH = isBoss ? 220 : e.elite ? 178 : 154;
        if (enemyImage.complete) ctx.drawImage(enemyImage, -spriteW / 2, -spriteH + 10, spriteW, spriteH);
        ctx.restore();
        ctx.fillStyle = e.elite || isBoss ? "#8f302b" : "#321f1d"; ctx.fillRect(e.x - (isBoss ? 55 : 28), e.y - (isBoss ? 132 : 92), (isBoss ? 110 : 56) * clamp(e.hp / (e.maxHp ?? 60), 0, 1), isBoss ? 8 : e.elite ? 6 : 4);
        if (e.elite) { ctx.fillStyle="#bda888";ctx.font="11px serif";ctx.fillText(`追租者 Lv.${e.threat ?? 1}`,e.x-28,e.y-104); }
        if (isBoss) { ctx.fillStyle="#d0b58f";ctx.font="700 14px serif";ctx.fillText(e.kind === "boss_b1" ? "B1｜底層異常源" : "B2｜底層異常源",e.x-58,e.y-145); }
      }
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.facing, 1);
      if (p.invuln > 0) ctx.globalAlpha = .45 + Math.sin(now / 35) * .25;
      const playerImage = destiny.gender === "female" ? sceneImages.playerFemale : sceneImages.player;
      if (playerImage.complete) ctx.drawImage(playerImage, -47, -99, 94, 142);
      if (p.attack > 0) { ctx.strokeStyle = "rgba(205,184,137,.6)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(5, -26, 68, -.75, .4); ctx.stroke(); }
      ctx.restore();
      ctx.restore();

      if (g.debtMode) { const v = ctx.createRadialGradient(w / 2, h / 2, h * .1, w / 2, h / 2, h * .72); v.addColorStop(0, "transparent"); v.addColorStop(1, "rgba(112,10,10,.46)"); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
      if (g.phaseFlash > 0) { ctx.fillStyle = `rgba(215,228,216,${Math.abs(Math.sin(g.phaseFlash * 46)) * .32})`; ctx.fillRect(0, 0, w, h); }
      ctx.fillStyle = "rgba(255,255,255,.035)"; for (let i = 0; i < 60; i++) ctx.fillRect((i * 89 + frame * 3) % w, (i * 47) % h, 1, 1);
      frame++; animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resize); };
  }, [activeRoom, flow.screen, paused, floorSelect, roomEvent, storageOpen, location, destiny.attributes, destiny.floor, destiny.roomSlot, destiny.gender, destiny.talent, destiny.defect, sound]);

  const joy = (x: number, y: number) => { touch.current = { x, y }; };

  return (
    <main className={`game-shell ${started ? "is-started" : "is-menu"}`}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="無期租寓可玩遊戲區" />
      <div className="film" />
      <header className="topbar"><span>無期租寓</span><b>第 {hud.day} 日｜{game.current.activeBoss ? `${game.current.activeBoss === "boss_b1" ? "B1" : "B2"} 底層異常區` : `${hud.floor}F ${location === "hallway" ? `${zoneName(hud.floor)}走廊` : location === "elevator" ? "老式電梯轎廂" : activeRoom !== null ? `${roomNumber(hud.floor, activeRoom)} 號房內部` : "房間內部"}`}</b><button className="sound-toggle" onClick={() => setMuted(value => !value)}>{muted ? "開啟聲音" : "靜音"}</button><button disabled={flow.overlay.kind !== "none" || dead || complete} onClick={() => dispatchFlow({ type: "TOGGLE_PAUSE" })}>{paused ? "繼續" : "暫停"}</button></header>
      {started && <div className="profile-strip"><b>{destiny.gender === "female" ? "女性" : "男性"}｜{destiny.identity}</b><span>{destiny.talent}</span><em>承租房 {roomNumber(destiny.floor, destiny.roomSlot)}</em></div>}
      <section className="rent-card"><small>{phaseName(hud.time)}｜今日房租</small><strong>NT$ {hud.rentDue}</strong><em>{formatTime(hud.time)} 後結算{hud.debt > 0 ? `｜舊債 ${hud.debt}` : ""}</em></section>
      <section className="vitals"><label>生命 <i style={{ width: `${clamp(hud.hp / (76 + destiny.attributes[0] * 5) * 100, 0, 100)}%` }} /></label><label>體力 <i style={{ width: `${clamp(hud.stamina / (72 + destiny.attributes[1] * 5) * 100, 0, 100)}%` }} /></label></section>
      <section className="score-card"><small>戰力</small><strong>{hud.score}</strong><span>租券 {hud.rent}</span></section>
      {started && <div className="inventory-bar">
        <button><i>1</i><b>改造鋼管</b><span>Lv.{hud.weaponLevel}</span></button>
        <button onClick={useMedkit} disabled={hud.medkits <= 0}><i>2</i><b>過期藥品</b><span>×{hud.medkits}</span></button>
        <button disabled={hud.keysOwned <= 0}><i>3</i><b>房門鑰匙</b><span>×{hud.keysOwned}</span></button>
        <button className="talent-button" onClick={useTalent} disabled={hud.skillCooldown > 0}><i>Q</i><b>{destiny.talent}</b><span>{hud.skillCooldown > 0 ? `${Math.ceil(hud.skillCooldown)}秒` : "可使用"}</span></button>
      </div>}
      <div className="mission">住戶公告｜{message}</div>
      {started && <div className="demo-goal"><small>Demo 主線</small><span className={hud.bossB1 ? "done" : ""}>B1</span><i>→</i><span className={hud.bossB2 ? "done" : ""}>B2</span><b>{hud.bossB2 ? "完成" : hud.bossB1 ? "前往 B2" : "前往電梯 B1"}</b></div>}
      {hud.landlordTask && <div className="task-slip"><small>房東委託</small><b>清除追租異常</b><span>{hud.taskKills} / 2</span></div>}
      {hud.attention > 0 && <div className="attention">公寓關注度　{"●".repeat(Math.min(5, hud.attention))}</div>}
      {mortgageMarks.length > 0 && <div className="mortgage-status"><small>能力抵押／輪迴保留</small><b>{mortgageMarks.join("　")}</b></div>}
      {debtStatus.protectionLost && <div className="rent-protection"><small>租金保護失效</small><b>欠款 {debtStatus.arrears}</b><span>承租房內持續受到牆膜侵蝕</span></div>}
      <div className="desktop-help">WASD 移動　SHIFT 奔跑　SPACE 攻擊　E 互動　Q 天賦　2 藥品</div>
      <div className="touch-controls">
        <div className="dpad"><button onPointerDown={() => joy(0,-1)} onPointerUp={() => joy(0,0)}>▲</button><button onPointerDown={() => joy(-1,0)} onPointerUp={() => joy(0,0)}>◀</button><button onPointerDown={() => joy(1,0)} onPointerUp={() => joy(0,0)}>▶</button><button onPointerDown={() => joy(0,1)} onPointerUp={() => joy(0,0)}>▼</button></div>
        <div className="actions"><button onPointerDown={attack}>攻擊</button><button onPointerDown={interact}>互動</button><button onPointerDown={useTalent}>天賦</button></div>
      </div>
      {flow.screen === "title" && <div className="start-screen"><div className="start-copy"><p>無期租約｜第 17 次輪迴</p><h1>無期租寓</h1><blockquote>付得起租金，活得像人。<br/>付不起租金，歸於樓宇。</blockquote><button onClick={() => { startAmbience(); sound("rent"); dispatchFlow({ type: "OPEN_INTRO" }); }}>走進公寓，撿起租屋字條</button><small>Demo 目標：依序清除 B1、B2 底層異常源｜建議開啟聲音</small></div></div>}
      {introOpen && <section className="intro-screen"><article className="intro-contract"><small>無期租寓管理室｜無期租約</small><h2>入寓抵債，萬事皆平</h2>{DEMO_OPENING.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<blockquote>「記憶歸零，債務留存。命運重擲，租約無期。」</blockquote><button onClick={() => { setDestiny(createDestiny()); dispatchFlow({ type: "OPEN_DESTINY" }); sound("dice"); }}>接受條款，進行命運擲骰</button></article></section>}
      {!started && destinyOpen && <section className="destiny-screen">
        <div className="contract-head"><span>無期租寓管理室</span><small>輪迴入住登記表｜表單 17-B</small><h2>命運擲骰</h2><p>點選一顆骰子鎖定，再決定是否重擲其餘結果。</p></div>
        <div className="dice-grid">
          {ATTRIBUTE_NAMES.map((name, index) => <button key={name} className={lockedDie === index ? "die locked" : "die"} onClick={() => setLockedDie(value => value === index ? null : index)}>
            <small>{name}</small><strong>{destiny.attributes[index]}</strong><i>{lockedDie === index ? "已鎖定" : "點擊鎖定"}</i>
          </button>)}
        </div>
        <div className="fate-details">
          <article><small>身份背景</small><b>{destiny.identity}</b><p className="detail">{IDENTITY_LORE[destiny.identity]}（Demo 僅保留背景敘述，專屬能力尚未實裝。）</p></article>
          <article title={TALENT_DESCRIPTIONS[destiny.talent]}><small>天賦技能</small><b>{destiny.talent}</b><p className="detail">{TALENT_DESCRIPTIONS[destiny.talent]}</p></article>
          <article className="defect" title={DEFECT_DESCRIPTIONS[destiny.defect]}><small>缺陷／詛咒</small><b>{destiny.defect}</b><p className="detail">{DEFECT_DESCRIPTIONS[destiny.defect]}</p></article>
          <article><small>初始承租房</small><b>{roomNumber(destiny.floor, destiny.roomSlot)}</b><p className="detail">本輪從此房間出生；只有你與獲得授權的玩家可以正常進入。</p></article>
          <article className="gender-card"><small>住戶性別／開場角色</small><b>{destiny.gender === "female" ? "女性住戶" : "男性住戶"}</b><div><button className={destiny.gender === "male" ? "selected" : ""} onClick={() => setDestiny(value => ({ ...value, gender: "male" }))}>男性</button><button className={destiny.gender === "female" ? "selected" : ""} onClick={() => setDestiny(value => ({ ...value, gender: "female" }))}>女性</button></div><p className="detail">只切換角色外觀與開場呈現，不改變能力、身份或租金。</p></article>
        </div>
        <div className="power-review"><span>管理處戰力評比</span><strong>{destinyPower(destiny)}</strong><p>{destinyPower(destiny) < 230 ? "低戰力路線：資源拾取與隱藏事件獲得補償" : "一般住戶路線：無額外補償"}</p></div>
        <div className="contract-actions"><button className="reroll" disabled={rerolls <= 0} onClick={rollAgain}>重擲其餘結果（剩餘 {rerolls} 次）</button><button className="accept" onClick={reset}>接受命運並入住</button></div>
      </section>}
      {started && settlement && <section className="settlement-screen">
        <div className="settlement-paper">
          <header><small>無期租寓管理室｜日租結算通知</small><h2>第 {hud.day} 日</h2><strong>今日 NT$ {hud.rentDue}</strong><p>舊債 {hud.debt}，將先增加 5% 利息；你目前持有 {hud.rent} 張租券。</p></header>
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
      {started && storageOpen && <section className="storage-screen"><div className="storage-panel"><header><small>{roomNumber(destiny.floor, destiny.roomSlot)}｜個人儲物櫃</small><h2>{storageCapacity} 格收納空間</h2><p>相同物品可堆疊；租券每格最多 99，藥品與鑰匙每格最多 5。容量只隨正式換房規則變更，本 Demo 不提供獨立付費擴充。</p></header><div className="storage-slots">{Array.from({ length: storageCapacity }, (_, index) => { const stack = storage[index]; return <article key={stack?.id ?? `empty-${index}`} className={stack ? "filled" : "empty"}><i>{index + 1}</i>{stack ? <><b>{stack.kind === "rent" ? "租券" : stack.kind === "medkits" ? "過期藥品" : "房門鑰匙"}</b><strong>×{stack.quantity}</strong><button onClick={() => transferStorage(stack.kind, "take")}>取出</button></> : <span>空格</span>}</article>; })}</div><div className="storage-actions"><button onClick={() => transferStorage("rent", "store")} disabled={hud.rent <= 0}>存入 10 租券</button><button onClick={() => transferStorage("medkits", "store")} disabled={hud.medkits <= 0}>存入 1 藥品</button><button onClick={() => transferStorage("keys", "store")} disabled={hud.keysOwned <= 0}>存入 1 鑰匙</button><button className="close-storage" onClick={() => dispatchFlow({ type: "CLOSE_OVERLAY", kind: "storage" })}>關閉櫃門</button></div></div></section>}
      {started && floorSelect && <section className="floor-select-screen"><div className="elevator-panel"><header><small>老式電梯控制盤</small><h2>選擇樓層</h2><p>租金只看承租樓層；向下逃生合法，但低於承租樓層時收益會衰減。日租倒數與追擊不會停止。</p></header><div>
        {STARTING_FLOORS.map(floor => { const locked = floor > Math.min(9, destiny.floor + 3); return <button key={floor} disabled={locked} className={floor >= 7 ? "danger" : ""} onClick={() => travelToFloor(floor)}><strong>{floor}F</strong><b>{locked ? "權限不足" : floor === destiny.floor ? "承租樓層" : floor <= 3 ? "安全避難層" : floor <= 6 ? "博弈收益層" : "地獄高壓層"}</b><span>{locked ? `最高權限 ${Math.min(9, destiny.floor + 3)}F` : floor === destiny.floor ? `${roomNumber(destiny.floor, destiny.roomSlot)}｜返回你的房間` : floor < destiny.floor ? "向下逃生｜資源收益衰減" : "滿額收益｜異常更強"}</span></button>; })}
        <button className="boss-floor" disabled={hud.bossB1} onClick={() => enterBoss("boss_b1")}><strong>B1</strong><b>{hud.bossB1 ? "今日已清除" : "底層異常源"}</b><span>Demo 主線第一目標</span></button>
        <button className="boss-floor" disabled={!hud.bossB1 || hud.bossB2} onClick={() => enterBoss("boss_b2")}><strong>B2</strong><b>{hud.bossB2 ? "今日已清除" : hud.bossB1 ? "底層異常源" : "須先清除 B1"}</b><span>Demo 主線最終目標</span></button>
      </div></div></section>}
      {dead && <button className="death" onClick={() => { game.current.dead = false; dispatchFlow({ type: "RESTART" }); setLocation("hallway"); setActiveRoom(null); setDestiny(createDestiny()); setLockedDie(null); setRerolls(2); }}>你已融入公寓<br/><span>重新擲骰，開始下一輪迴</span></button>}
      {complete && <section className="demo-complete"><div><small>無期租寓管理室｜Demo 通關紀錄</small><h2>底層異常源，清剿完成</h2><p>B1 與 B2 已依序停止活動。電梯控制盤上，一枚從未亮過的「10F」按鍵短暫發出白光。</p><blockquote>特殊權限卡與鑰匙已登記。真正的租約，仍在十樓以上。</blockquote><button onClick={() => { dispatchFlow({ type: "RESTART" }); setDestiny(createDestiny()); setLockedDie(null); setRerolls(2); }}>以新住戶再次入住</button></div></section>}
    </main>
  );
}
