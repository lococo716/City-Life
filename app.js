/* =========================================================
   Underworld – Mafia Wars–style Web Game
   app.js (Specializations DISABLED for now)
   Properties Step 1 + 2 + 3 + 4 INCLUDED
   Option 1 Step 1: Property Training Bonus ENABLED
   Missions Step 1 + Step 2 + Step 3:
     - Step 1: missions + cooldowns
     - Step 2: mission chains (multi-step lines)
     - Step 3: flavor text + random drops (inventory)

   FIXES INCLUDED (NO button visual changes):
     ✅ Tabs work again (removed duplicate const crash)
     ✅ Shop meds restored
     ✅ Arms Dealer restored (weapons, armor, black market 45m / 1% GOLD weapon or armor)
     ✅ Properties list restored (buy/upgrade)
     ✅ Profile inventory sub-tabs restored (overview/inventory/gear/props)

   Compatible with your index.html + styles.css
   ========================================================= */

"use strict";

/* =====================
   CONSTANTS & CONFIG
===================== */

const SAVE_KEY_BASE = "underworld_save_v1";
const ACCOUNTS_KEY = "underworld_accounts_v1";
const SESSION_KEY = "underworld_session_v1";
const SCHEMA_VERSION = 1;

let currentUser = null;

function getSaveKey() {
  // Each user gets a separate save slot
  return `${SAVE_KEY_BASE}::${currentUser || "guest"}`;
}

// local-only hash (NOT secure like a server)
async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function loadAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}"); }
  catch { return {}; }
}

function saveAccounts(obj) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(obj));
}
const ADMIN_USERNAME = "admin"; // change if you want



const MS = {
  MIN: 60 * 1000,
  HOUR: 60 * 60 * 1000,
};

const REGEN_INTERVAL = 5 * MS.MIN;             // 1 energy/health per 5 minutes
const BLACK_MARKET_REFRESH = 45 * MS.MIN;      // black market refresh every 45 min

// PROPERTIES
const PROPERTY_OFFLINE_CAP = 4 * MS.HOUR;      // offline income cap
const PROPERTY_UPGRADE_GROWTH = 1.35;          // upgrade cost multiplier per level

/* =====================
   TITLES / REPUTATION
===================== */

const TITLES = [
  { name: "Street Rat", points: 0 },
  { name: "Hustler", points: 50 },
  { name: "Enforcer", points: 130 },
  { name: "Made Man", points: 240 },
  { name: "Lieutenant", points: 380 },
  { name: "Capo", points: 550 },
  { name: "Underboss", points: 760 },
  { name: "Boss", points: 1020 },
  { name: "Kingpin", points: 1350 },
];

/* =====================
   UTIL
===================== */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pct(n) {
  return Math.round(n * 100);
}

function fmtMoney(n) {
  const v = Math.max(0, Math.floor(n || 0));
  return `$${v.toLocaleString()}`;
}

function msToClock(ms) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function isAdmin() {
  return currentUser === ADMIN_USERNAME;
}


/* =====================
   CRIMES (15)
===================== */

const CRIMES = [
  { id:"pickpocket",    name:"Pickpocket",          unlock:1, energy:2, success:0.86, jail:0.06, money:[40,90],      xp:8,  hpLoss:[0,1],  jailMin:2, jailMax:3 },
  { id:"shoplift",      name:"Shoplift",            unlock:2, energy:2, success:0.83, jail:0.07, money:[55,120],     xp:10, hpLoss:[0,2],  jailMin:2, jailMax:4 },
  { id:"mug_tourist",   name:"Mug a Tourist",       unlock:3, energy:3, success:0.80, jail:0.08, money:[85,170],     xp:12, hpLoss:[1,3],  jailMin:3, jailMax:4 },

  { id:"carjacking",    name:"Carjacking",          unlock:4, energy:4, success:0.76, jail:0.10, money:[140,260],    xp:16, hpLoss:[2,4],  jailMin:3, jailMax:5 },
  { id:"home_burglary", name:"Home Burglary",       unlock:5, energy:4, success:0.74, jail:0.11, money:[170,320],    xp:18, hpLoss:[2,5],  jailMin:4, jailMax:6 },
  { id:"street_scam",   name:"Street Scam",         unlock:6, energy:5, success:0.72, jail:0.12, money:[200,380],    xp:20, hpLoss:[2,5],  jailMin:4, jailMax:6 },

  { id:"armed_robbery", name:"Armed Robbery",       unlock:7, energy:6, success:0.68, jail:0.14, money:[320,520],    xp:26, hpLoss:[3,6],  jailMin:5, jailMax:7 },
  { id:"bank_runner",   name:"Bank Runner Job",     unlock:8, energy:6, success:0.66, jail:0.15, money:[360,600],    xp:28, hpLoss:[3,7],  jailMin:5, jailMax:7 },
  { id:"warehouse_hit", name:"Warehouse Hit",       unlock:9, energy:7, success:0.64, jail:0.16, money:[420,720],    xp:30, hpLoss:[4,8],  jailMin:6, jailMax:8 },
  { id:"vip_extortion", name:"VIP Extortion",       unlock:10,energy:7, success:0.62, jail:0.17, money:[480,840],    xp:32, hpLoss:[4,8],  jailMin:6, jailMax:8 },

  { id:"casino_scam",   name:"Casino Scam",         unlock:11,energy:8, success:0.60, jail:0.18, money:[650,1050],   xp:38, hpLoss:[5,9],  jailMin:7, jailMax:9 },
  { id:"armored_van",   name:"Armored Van Job",     unlock:12,energy:8, success:0.58, jail:0.20, money:[720,1200],   xp:40, hpLoss:[5,10], jailMin:7, jailMax:10 },
  { id:"dock_heist",    name:"Dockside Heist",      unlock:13,energy:9, success:0.56, jail:0.21, money:[820,1400],   xp:44, hpLoss:[6,10], jailMin:8, jailMax:10 },
  { id:"nightclub_take",name:"Nightclub Takeover",  unlock:14,energy:9, success:0.54, jail:0.22, money:[900,1600],   xp:46, hpLoss:[6,11], jailMin:8, jailMax:10 },

  { id:"high_society",  name:"High Society Sting",  unlock:16,energy:10,success:0.52, jail:0.24, money:[1100,1900],  xp:52, hpLoss:[7,12], jailMin:9, jailMax:10 },
];

/* =====================
   MISSIONS (Step 1/2/3)
===================== */

const MISSION_LINES = [
  {
    lineId: "line_runner",
    name: "📦 The Runner",
    unlock: 1,
    steps: [
      { id:"runner_1", name:"📦 Bag Drop",        energy:4, success:0.78, money:[180,320], xp:22, cooldownMin:10, failHpLoss:[0,3], failJailChance:0.04, failJailMin:2, failJailMax:4, flavor:"A quiet handoff. Wrong turn and you’re cooked." },
      { id:"runner_2", name:"🚗 Tail Check",      energy:5, success:0.72, money:[260,460], xp:28, cooldownMin:12, failHpLoss:[1,4], failJailChance:0.05, failJailMin:3, failJailMax:5, flavor:"Someone’s watching. Lose them without making noise." },
      { id:"runner_3", name:"🏁 Final Hand-Off",  energy:6, success:0.66, money:[420,760], xp:38, cooldownMin:18, failHpLoss:[2,6], failJailChance:0.07, failJailMin:4, failJailMax:7, flavor:"Last stop. Get paid — and don’t get clipped." },
    ],
  },
  {
    lineId: "line_collector",
    name: "💰 The Collector",
    unlock: 3,
    steps: [
      { id:"collector_1", name:"💰 Collection Run",  energy:5, success:0.74, money:[260,480], xp:28, cooldownMin:15, failHpLoss:[1,4], failJailChance:0.05, failJailMin:3, failJailMax:5, flavor:"They owe. You collect. Simple." },
      { id:"collector_2", name:"📑 Ledger Cleanup",  energy:6, success:0.68, money:[380,720], xp:36, cooldownMin:18, failHpLoss:[2,5], failJailChance:0.06, failJailMin:4, failJailMax:6, flavor:"Paper trails are deadly. Make the numbers disappear." },
      { id:"collector_3", name:"🏦 Drop at the Bank", energy:7, success:0.62, money:[650,1150],xp:46, cooldownMin:25, failHpLoss:[3,7], failJailChance:0.09, failJailMin:5, failJailMax:9, flavor:"Big deposit. Big attention. Move like a ghost." },
    ],
  },
  {
    lineId: "line_insider",
    name: "🕵️ The Insider",
    unlock: 6,
    steps: [
      { id:"insider_1", name:"🧰 Safecrack Job",    energy:6, success:0.68, money:[420,760], xp:36, cooldownMin:20, failHpLoss:[2,6], failJailChance:0.07, failJailMin:4, failJailMax:7, flavor:"Steel, sweat, and seconds. Don’t rush." },
      { id:"insider_2", name:"🕵️ Inside Tip",      energy:7, success:0.62, money:[650,1150],xp:44, cooldownMin:30, failHpLoss:[3,7], failJailChance:0.09, failJailMin:5, failJailMax:9, flavor:"A friend whispers. The city listens." },
      { id:"insider_3", name:"📡 Clean Extraction", energy:8, success:0.58, money:[900,1600],xp:56, cooldownMin:35, failHpLoss:[4,9], failJailChance:0.11,failJailMin:6, failJailMax:10,flavor:"In and out. If it gets loud, it gets ugly." },
    ],
  },
];

const MISSIONS = MISSION_LINES.flatMap(line => line.steps);

/* =====================
   FIGHTS: ENEMIES + RIVALS
===================== */

const ENEMIES = [
  { id:"thug",      name:"Street Thug",        unlock:1,  energy:3, atk:1, def:1, hp:6,  money:[60,120],   xp:10, rep:1 },
  { id:"brawler",   name:"Back-Alley Brawler", unlock:2,  energy:3, atk:2, def:1, hp:7,  money:[80,150],   xp:12, rep:1 },
  { id:"hustler",   name:"Corner Hustler",     unlock:3,  energy:4, atk:2, def:2, hp:8,  money:[110,200],  xp:14, rep:1 },
  { id:"enforcer",  name:"Local Enforcer",     unlock:5,  energy:4, atk:3, def:2, hp:10, money:[160,280],  xp:18, rep:2 },
  { id:"crew",      name:"Crew Muscle",        unlock:7,  energy:5, atk:4, def:3, hp:12, money:[220,380],  xp:24, rep:2 },
  { id:"hitman",    name:"Contract Hitman",    unlock:9,  energy:6, atk:5, def:4, hp:14, money:[300,520],  xp:30, rep:3 },
  { id:"captain",   name:"Gang Captain",       unlock:11, energy:6, atk:6, def:5, hp:16, money:[380,680],  xp:34, rep:3 },
  { id:"bossguard", name:"Boss Bodyguard",     unlock:13, energy:7, atk:7, def:6, hp:18, money:[520,900],  xp:40, rep:4 },
  { id:"underboss", name:"Underboss Shadow",   unlock:15, energy:7, atk:8, def:7, hp:20, money:[650,1100], xp:46, rep:4 },
];

const RIVALS = [
  { id:"vince", name:"Vince 'Knuckles' Romano", unlock:4,  energy:6, atk:5, def:4, hp:16, money:[260,520],   xp:32, repMilestone:[4,6,10] },
  { id:"nyla",  name:"Nyla 'Switchblade' Cruz", unlock:8,  energy:7, atk:7, def:6, hp:20, money:[420,780],   xp:44, repMilestone:[6,8,12] },
  { id:"marco", name:"Marco 'The Fixer' Valli", unlock:12, energy:8, atk:9, def:8, hp:24, money:[620,1100],  xp:58, repMilestone:[8,10,14] },
];

/* =====================
   GYM: NORMAL + JAIL
===================== */

const GYM = {
  normal: { name:"Gym",      energy:4, success:0.70, xp:18, failHpLoss:[0,2], gain:{ attack:1, defense:1 } },
  jail:   { name:"Jail Gym", energy:3, success:0.60, xp:14, failHpLoss:[0,2], gain:{ attack:1, defense:1 } },
};

/* =====================
   SHOP ITEMS
===================== */

const SHOP_FOOD = [
  { id:"chips",  name:"🥔 Chips",        desc:"+2 Energy",  price:60,  energy:2 },
  { id:"burger", name:"🍔 Burger",       desc:"+4 Energy",  price:120, energy:4 },
  { id:"taco",   name:"🌮 Taco",         desc:"+6 Energy",  price:180, energy:6 },
  { id:"pizza",  name:"🍕 Pizza Slice",  desc:"+8 Energy",  price:260, energy:8 },
  { id:"feast",  name:"🍱 Street Feast", desc:"+12 Energy", price:420, energy:12 },
];

const SHOP_HEALING = [
  { id:"bandage", name:"🩹 Bandage",       desc:"+3 Health",  price:70,  health:3 },
  { id:"medkit",  name:"🧰 Med Kit",       desc:"+6 Health",  price:140, health:6 },
  { id:"stims",   name:"💉 Stims",         desc:"+9 Health",  price:220, health:9 },
  { id:"clinic",  name:"🏥 Clinic Visit",  desc:"+12 Health", price:320, health:12 },
  { id:"surgery", name:"🧑‍⚕️ Surgery",      desc:"+18 Health", price:520, health:18 },
  { id:"revive",  name:"⚡ Revive Shot",   desc:"+25 Health", price:780, health:25 },
];

/* =====================
   ARMS DEALER + BLACK MARKET
===================== */

const WEAPONS = [
  { id:"shiv",   name:"🔪 Shiv",   price:120,  atk:1 },
  { id:"bat",    name:"🏏 Bat",    price:220,  atk:2 },
  { id:"knife",  name:"🗡️ Knife", price:360,  atk:3 },
  { id:"pistol", name:"🔫 Pistol", price:620,  atk:4 },
  { id:"smg",    name:"🧨 SMG",    price:980,  atk:6 },
  { id:"rifle",  name:"🎯 Rifle",  price:1400, atk:8 },
];

const ARMOR = [
  { id:"hoodie",  name:"🧥 Reinforced Hoodie", price:140,  def:1 },
  { id:"leather", name:"🧥 Leather Jacket",    price:260,  def:2 },
  { id:"vest",    name:"🦺 Kevlar Vest",       price:520,  def:4 },
  { id:"plate",   name:"🛡️ Plate Carrier",     price:980,  def:6 },
  { id:"riot",    name:"🛡️ Riot Armor",        price:1500, def:8 },
];

/* =====================
   PROPERTIES
===================== */

const PROPERTIES = [
  { id:"stash_house",  name:"🧳 Stash House",  desc:"Low-key income. Small training edge.", buyPrice:600,  baseIncomePerHour:35,  upgradeBaseCost:350,  trainingBoostPerLevel:0.005, maxLevel:10 },
  { id:"corner_store", name:"🏪 Corner Store", desc:"Steady cashflow with upgrades.",       buyPrice:1400, baseIncomePerHour:80,  upgradeBaseCost:700,  trainingBoostPerLevel:0.004, maxLevel:12 },
  { id:"nightclub",    name:"🪩 Nightclub",    desc:"Higher income. A bit riskier (later).",buyPrice:4200, baseIncomePerHour:220, upgradeBaseCost:1600, trainingBoostPerLevel:0.003, maxLevel:15 },
  { id:"warehouse",    name:"🏭 Warehouse",    desc:"Big operations, bigger income.",      buyPrice:9500, baseIncomePerHour:520, upgradeBaseCost:3200, trainingBoostPerLevel:0.002, maxLevel:18 },
];

/* =====================
   INVENTORY: RANDOM DROPS (Missions Step 3)
   (IMPORTANT: ONLY defined ONCE — fixes the crash that killed tabs)
===================== */

const MISSION_DROPS = [
  { id:"chips",   name:"🥔 Chips",   type:"food",    energy:2, health:0, chance:0.10 },
  { id:"burger",  name:"🍔 Burger",  type:"food",    energy:4, health:0, chance:0.06 },
  { id:"bandage", name:"🩹 Bandage", type:"healing", energy:0, health:3, chance:0.10 },
  { id:"medkit",  name:"🧰 Med Kit", type:"healing", energy:0, health:6, chance:0.05 },
];

function rollMissionDrop() {
  for (const d of MISSION_DROPS) {
    if (Math.random() < d.chance) return d;
  }
  return null;
}

/* =====================
   DEFAULT GAME STATE
===================== */

function defaultState() {
  const now = Date.now();
  return {
    schema: SCHEMA_VERSION,
    player: {
      name: "Player",
       gems: 0,
      avatar: "🙂",
      specialization: null, // disabled for now
      level: 1,
      xp: 0,
      money: 500,
      energy: 10,
      maxEnergy: 10,
      health: 10,
      maxHealth: 10,
      attack: 1,
      defense: 1,
      reputation: 0,
      title: "Street Rat",
    },
    timers: {
      lastEnergy: now,
      lastHealth: now,
      jailUntil: null,
    },
    inventory: {},
    equipment: { weapon: null, armor: null },
    gear: { weapons: [], armor: [] },

    blackMarket: {
      nextRefreshAt: now + BLACK_MARKET_REFRESH,
      offer: null,        // { kind:"weapon"|"armor", item:{...} }
      offerWeapon: null,  // backward compat if an old save exists
    },

    properties: {
      lastIncomeAt: now,
      owned: {}, // { propId: { level:number } }
    },

    missions: {
      cooldowns: {}, // { stepId: timestampMs }
      progress: {},  // { lineId: stepIndex } 0-based
    },

    rivals: { defeatedCounts: {} },
    ui: {
      page: "crimes",
      profileView: "overview",
      log: [],
    },
  };
}

/* =====================
   LOAD / SAVE
===================== */

let state = load();

function load() {
  // Must have a user to load a user-save
  const key = getSaveKey();

  // If user has no save yet, try migrating old single-save once
  const oldRaw = localStorage.getItem("underworld_save_v1"); // your old key name
  const raw = localStorage.getItem(key);

  if (!raw) {
    if (oldRaw) {
      // migrate old save into this user slot (only if user slot is empty)
      localStorage.setItem(key, oldRaw);
    } else {
      const fresh = defaultState();
      save(fresh);
      return fresh;
    }
  }

  try {
    return sanitize(JSON.parse(localStorage.getItem(key)));
  } catch {
    const fresh = defaultState();
    save(fresh);
    return fresh;
  }
}

function save(s = state) {
  const key = getSaveKey();
  localStorage.setItem(key, JSON.stringify(s));
}

/* =====================
   SANITIZE SAVE
===================== */

function sanitize(s) {
  const d = defaultState();
  if (!s || !s.schema) return d;

  s.player = s.player || d.player;
  s.player.level = Math.max(1, s.player.level || 1);
  s.player.xp = Math.max(0, s.player.xp || 0);
  s.player.money = Math.max(0, s.player.money || 0);
  s.player.gems = Math.max(0, s.player.gems || 0);

  s.player.maxEnergy = Math.max(1, s.player.maxEnergy || 10);
  s.player.maxHealth = Math.max(1, s.player.maxHealth || 10);

  s.player.energy = clamp(s.player.energy ?? 0, 0, s.player.maxEnergy);
  s.player.health = clamp(s.player.health ?? 0, 0, s.player.maxHealth);

  s.player.attack = Math.max(0, s.player.attack || 1);
  s.player.defense = Math.max(0, s.player.defense || 1);

  s.player.reputation = Math.max(0, s.player.reputation || 0);
  s.player.title = s.player.title || "Street Rat";

  s.inventory = s.inventory || {};

  s.gear = s.gear || { weapons: [], armor: [] };
  s.gear.weapons = Array.isArray(s.gear.weapons) ? s.gear.weapons : [];
  s.gear.armor = Array.isArray(s.gear.armor) ? s.gear.armor : [];

  s.equipment = s.equipment || { weapon: null, armor: null };

  // BLACK MARKET safety + backward compat
  s.blackMarket = s.blackMarket || {
    nextRefreshAt: Date.now() + BLACK_MARKET_REFRESH,
    offer: null,
    offerWeapon: null,
  };
  if (typeof s.blackMarket.nextRefreshAt !== "number") s.blackMarket.nextRefreshAt = Date.now() + BLACK_MARKET_REFRESH;
  if (s.blackMarket.offerWeapon && !s.blackMarket.offer) {
    s.blackMarket.offer = { kind: "weapon", item: s.blackMarket.offerWeapon };
    s.blackMarket.offerWeapon = null;
  }

  // PROPERTIES safety
  s.properties = s.properties || {};
  if (typeof s.properties.lastIncomeAt !== "number") s.properties.lastIncomeAt = Date.now();
  s.properties.owned = s.properties.owned || {};
  for (const p of PROPERTIES) {
    const entry = s.properties.owned[p.id];
    if (!entry) continue;
    entry.level = clamp(Math.floor(entry.level || 0), 0, p.maxLevel);
    if (entry.level <= 0) delete s.properties.owned[p.id];
  }

  // MISSIONS safety
  s.missions = s.missions || {};
  s.missions.cooldowns = s.missions.cooldowns || {};
  s.missions.progress = s.missions.progress || {};

  for (const step of MISSIONS) {
    const t = s.missions.cooldowns[step.id];
    if (t != null && typeof t !== "number") delete s.missions.cooldowns[step.id];
  }

  for (const line of MISSION_LINES) {
    let idx = s.missions.progress[line.lineId];
    if (idx == null) continue;
    if (typeof idx !== "number") {
      delete s.missions.progress[line.lineId];
      continue;
    }
    idx = clamp(Math.floor(idx), 0, line.steps.length - 1);
    s.missions.progress[line.lineId] = idx;
  }

  s.rivals = s.rivals || { defeatedCounts: {} };
  s.rivals.defeatedCounts = s.rivals.defeatedCounts || {};

  s.ui = s.ui || {};
  s.ui.page = s.ui.page || "crimes";
  s.ui.profileView = s.ui.profileView || "overview";
  s.ui.log = Array.isArray(s.ui.log) ? s.ui.log : [];

  s.timers = s.timers || {};
  s.timers.lastEnergy = s.timers.lastEnergy || Date.now();
  s.timers.lastHealth = s.timers.lastHealth || Date.now();
  s.timers.jailUntil = s.timers.jailUntil || null;

  return s;
}

/* =====================
   (PART 1 END)
===================== */
/* =====================
   REGEN (ENERGY + HEALTH)
===================== */

function applyRegen() {
  const now = Date.now();

  const eTicks = Math.floor((now - state.timers.lastEnergy) / REGEN_INTERVAL);
  if (eTicks > 0) {
    state.player.energy = clamp(state.player.energy + eTicks, 0, state.player.maxEnergy);
    state.timers.lastEnergy += eTicks * REGEN_INTERVAL;
  }

  const hTicks = Math.floor((now - state.timers.lastHealth) / REGEN_INTERVAL);
  if (hTicks > 0) {
    state.player.health = clamp(state.player.health + hTicks, 0, state.player.maxHealth);
    state.timers.lastHealth += hTicks * REGEN_INTERVAL;
  }
}

/* =====================
   STATUS HELPERS
===================== */

function isJailed() {
  return state.timers.jailUntil && Date.now() < state.timers.jailUntil;
}

function isKO() {
  return state.player.health <= 0;
}

/* =====================
   LOG + TOAST
===================== */

function addLog(text) {
  state.ui.log.unshift(text);
  state.ui.log = state.ui.log.slice(0, 20);
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 2200);
}

/* =====================
   INVENTORY HELPERS
===================== */

function invAdd(item) {
  if (!state.inventory[item.id]) {
    state.inventory[item.id] = { ...item, quantity: 0 };
  }
  state.inventory[item.id].quantity += 1;
}

function invUse(itemId) {
  const it = state.inventory[itemId];
  if (!it || it.quantity <= 0) return;

  if (it.energy) state.player.energy = clamp(state.player.energy + it.energy, 0, state.player.maxEnergy);
  if (it.health) state.player.health = clamp(state.player.health + it.health, 0, state.player.maxHealth);

  it.quantity -= 1;
  if (it.quantity <= 0) delete state.inventory[itemId];

  addLog(`Used ${it.name}`);
  toast("Item used");
}
/* =====================
   QUICK USE POPUP (TOP HUD +)
===================== */

let quickUseKind = null; // "energy" | "healing"

function openQuickUse(kind) {
  if (!quickUse || !quickUseTitle || !quickUseBody) return;

  quickUseKind = kind;

  quickUseTitle.textContent =
    kind === "energy" ? "Use Energy Items" : "Use Healing Items";

  renderQuickUseList();
  quickUse.hidden = false;
}

function closeQuickUse() {
  if (!quickUse) return;
  quickUse.hidden = true;
  quickUseKind = null;
}

function getQuickUseItems() {
  const items = Object.values(state.inventory || {});
  if (quickUseKind === "energy") {
    return items.filter(it => (it.energy || 0) > 0 && it.quantity > 0);
  }
  if (quickUseKind === "healing") {
    return items.filter(it => (it.health || 0) > 0 && it.quantity > 0);
  }
  return [];
}

function renderQuickUseList() {
  if (!quickUseBody) return;

  const items = getQuickUseItems();

  if (!items.length) {
    quickUseBody.innerHTML = `<div class="muted">No items available.</div>`;
    return;
  }

  quickUseBody.innerHTML = `
    <div class="list">
      ${items.map(it => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${it.name} ×${it.quantity}</div>
            <div class="row__sub">
              ${quickUseKind === "energy" ? `+${it.energy} Energy` : `+${it.health} Health`}
            </div>
          </div>
          <div class="row__right">
            <button class="btn btn--small btn--primary"
              data-action="quickUseItem"
              data-item="${it.id}">
              Use
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function quickUseItem(itemId) {
  invUse(itemId);

  // refresh the popup list (and auto-close if empty)
  if (quickUseKind) {
    renderQuickUseList();
    if (!getQuickUseItems().length) closeQuickUse();
  }
}

/* =====================
   SHOP BUY
===================== */

function buyShopItem(kind, itemId) {
  const list = kind === "food" ? SHOP_FOOD : kind === "healing" ? SHOP_HEALING : null;
  if (!list) return;

  const item = list.find(x => x.id === itemId);
  if (!item) return;

  if (state.player.money < item.price) return toast("Not enough money.");

  state.player.money -= item.price;

  invAdd({
    id: item.id,
    name: item.name,
    type: kind,
    energy: item.energy || 0,
    health: item.health || 0,
  });

  addLog(`🛒 Bought ${item.name} for $${item.price}`);
  toast("Purchased");
} 


function adminAddMoney() {
  state.player.money += 10000;
  addLog("🛠️ Admin: +$10,000");
  toast("Admin money added");
}

function adminAddXP() {
  state.player.xp += 500;
  tryLevelUp();
  addLog("🛠️ Admin: +500 XP");
  toast("Admin XP added");
}

function adminRefill() {
  state.player.energy = state.player.maxEnergy;
  state.player.health = state.player.maxHealth;
  addLog("🛠️ Admin: Energy & Health refilled");
  toast("Admin refill");
}

function adminClearJail() {
  state.timers.jailUntil = null;
  addLog("🛠️ Admin: Jail cleared");
  toast("Jail cleared");
}

/* =====================
   GEAR HELPERS
===================== */

function ownWeapon(item) {
  if (!state.gear) state.gear = { weapons: [], armor: [] };
  state.gear.weapons.push(item);
}

function ownArmor(item) {
  if (!state.gear) state.gear = { weapons: [], armor: [] };
  state.gear.armor.push(item);
}

function equipWeaponByIndex(idx) {
  const w = state.gear?.weapons?.[idx];
  if (!w) return;
  state.equipment.weapon = w;
  addLog(`🗡️ Equipped ${w.name}`);
  toast("Weapon equipped");
}

function equipArmorByIndex(idx) {
  const a = state.gear?.armor?.[idx];
  if (!a) return;
  state.equipment.armor = a;
  addLog(`🛡️ Equipped ${a.name}`);
  toast("Armor equipped");
}

/* =====================
   BLACK MARKET (45m refresh, 1% GOLD weapon OR armor)
===================== */

function generateBlackMarketOffer() {
  const rollGold = Math.random() < 0.01;
  const offerKind = Math.random() < 0.6 ? "weapon" : "armor";

  if (offerKind === "weapon") {
    const basePool = WEAPONS.slice(Math.max(0, WEAPONS.length - 3));
    const base = basePool[randInt(0, basePool.length - 1)];

    if (rollGold) {
      const boost = randInt(3, 6);
      return {
        kind: "weapon",
        item: {
          id: `gold_${base.id}_${Date.now()}`,
          name: `🟡 GOLD ${base.name.replace(/^🟡 GOLD\s+/, "")}`,
          atk: base.atk + boost,
          rarity: "gold",
          price: Math.round(base.price * 2.2),
        },
      };
    }

    const boost = randInt(1, 2);
    return {
      kind: "weapon",
      item: {
        id: `bm_${base.id}_${Date.now()}`,
        name: `🌑 ${base.name}`,
        atk: base.atk + boost,
        rarity: "blackmarket",
        price: Math.round(base.price * 1.4),
      },
    };
  }

  const armorPool = ARMOR.slice(Math.max(0, ARMOR.length - 3));
  const baseA = armorPool[randInt(0, armorPool.length - 1)];

  if (rollGold) {
    const boost = randInt(3, 6);
    return {
      kind: "armor",
      item: {
        id: `gold_${baseA.id}_${Date.now()}`,
        name: `🟡 GOLD ${baseA.name.replace(/^🟡 GOLD\s+/, "")}`,
        def: baseA.def + boost,
        rarity: "gold",
        price: Math.round(baseA.price * 2.2),
      },
    };
  }

  const boost = randInt(1, 2);
  return {
    kind: "armor",
    item: {
      id: `bm_${baseA.id}_${Date.now()}`,
      name: `🌑 ${baseA.name}`,
      def: baseA.def + boost,
      rarity: "blackmarket",
      price: Math.round(baseA.price * 1.4),
    },
  };
}

function refreshBlackMarketIfNeeded() {
  if (!state.blackMarket) {
    state.blackMarket = {
      nextRefreshAt: Date.now() + BLACK_MARKET_REFRESH,
      offer: null,
      offerWeapon: null,
    };
  }

  const now = Date.now();

  // backward compat -> convert once
  if (!state.blackMarket.offer && state.blackMarket.offerWeapon) {
    state.blackMarket.offer = { kind: "weapon", item: state.blackMarket.offerWeapon };
    state.blackMarket.offerWeapon = null;
  }

  if (!state.blackMarket.offer || now >= state.blackMarket.nextRefreshAt) {
    state.blackMarket.offer = generateBlackMarketOffer();
    state.blackMarket.nextRefreshAt = now + BLACK_MARKET_REFRESH;

    const isGold = state.blackMarket.offer.item.rarity === "gold";
    addLog(isGold ? "🟡 A GOLD item appeared in the Black Market!" : "🌑 Black Market refreshed.");
  }
}

function buyBlackMarketOffer() {
  refreshBlackMarketIfNeeded();
  const offer = state.blackMarket?.offer;
  if (!offer) return;

  const item = offer.item;
  if (state.player.money < item.price) return toast("Not enough money.");

  state.player.money -= item.price;

  if (offer.kind === "weapon") {
    ownWeapon({ id: item.id, name: item.name, atk: item.atk, rarity: item.rarity });
  } else {
    ownArmor({ id: item.id, name: item.name, def: item.def, rarity: item.rarity });
  }

  addLog(`🛒 Bought ${item.name} (Black Market) for $${item.price}`);
  toast("Purchased");

  state.blackMarket.offer = null;
}

/* =====================
   ARMS BUY
===================== */

function buyArms(kind, itemId) {
  const list = kind === "weapon" ? WEAPONS : kind === "armor" ? ARMOR : null;
  if (!list) return;

  const item = list.find(x => x.id === itemId);
  if (!item) return;

  if (state.player.money < item.price) return toast("Not enough money.");

  state.player.money -= item.price;

  if (kind === "weapon") ownWeapon({ id: item.id, name: item.name, atk: item.atk, rarity: "normal" });
  else ownArmor({ id: item.id, name: item.name, def: item.def, rarity: "normal" });

  addLog(`🛒 Bought ${item.name} for $${item.price}`);
  toast("Purchased");
}

/* =====================
   PROPERTIES — HELPERS
===================== */

function getOwnedPropertyLevel(propId) {
  return state.properties?.owned?.[propId]?.level || 0;
}

function isPropertyOwned(propId) {
  return getOwnedPropertyLevel(propId) > 0;
}

function getUpgradeCost(propId) {
  const p = PROPERTIES.find(x => x.id === propId);
  if (!p) return Infinity;
  const lvl = getOwnedPropertyLevel(propId);
  if (lvl <= 0) return Infinity;
  if (lvl >= p.maxLevel) return Infinity;
  const cost = p.upgradeBaseCost * Math.pow(PROPERTY_UPGRADE_GROWTH, Math.max(0, lvl - 1));
  return Math.round(cost);
}

function getTotalIncomePerHour() {
  let total = 0;
  for (const p of PROPERTIES) {
    const lvl = getOwnedPropertyLevel(p.id);
    if (lvl > 0) total += p.baseIncomePerHour * lvl;
  }
  return total;
}

function applyPropertyIncome() {
  if (!state.properties) return;

  const now = Date.now();
  const last = state.properties.lastIncomeAt || now;

  const elapsed = Math.min(Math.max(0, now - last), PROPERTY_OFFLINE_CAP);
  const wholeMinutes = Math.floor(elapsed / MS.MIN);
  if (wholeMinutes <= 0) return;

  const incomePerHour = getTotalIncomePerHour();
  if (incomePerHour <= 0) {
    state.properties.lastIncomeAt = last + wholeMinutes * MS.MIN;
    return;
  }

  const incomePerMinute = incomePerHour / 60;
  const payout = Math.floor(incomePerMinute * wholeMinutes);

  state.properties.lastIncomeAt = last + wholeMinutes * MS.MIN;

  if (payout > 0) {
    state.player.money += payout;
    if (wholeMinutes >= 5) addLog(`🏠 Property income: +$${payout} (${wholeMinutes} min)`);
  }
}

/* =====================
   PROPERTIES: BUY + UPGRADE
===================== */

function ensureProperties() {
  if (!state.properties) state.properties = { lastIncomeAt: Date.now(), owned: {} };
  if (!state.properties.owned) state.properties.owned = {};
}

function buyProperty(propId) {
  ensureProperties();
  const p = PROPERTIES.find(x => x.id === propId);
  if (!p) return;

  if (isPropertyOwned(propId)) return toast("Already owned.");
  if (state.player.money < p.buyPrice) return toast("Not enough money.");

  state.player.money -= p.buyPrice;
  state.properties.owned[propId] = { level: 1 };

  addLog(`🏠 Bought ${p.name} (Lv 1) for $${p.buyPrice}`);
  toast("Property purchased");
}

function upgradeProperty(propId) {
  ensureProperties();
  const p = PROPERTIES.find(x => x.id === propId);
  if (!p) return;

  const lvl = getOwnedPropertyLevel(propId);
  if (lvl <= 0) return toast("Buy it first.");
  if (lvl >= p.maxLevel) return toast("Max level.");

  const cost = getUpgradeCost(propId);
  if (!Number.isFinite(cost)) return toast("Can't upgrade.");
  if (state.player.money < cost) return toast("Not enough money.");

  state.player.money -= cost;
  state.properties.owned[propId].level = lvl + 1;

  addLog(`⬆️ Upgraded ${p.name} to Lv ${lvl + 1} for $${cost}`);
  toast("Upgraded");
}

/* =====================
   PROPERTY TRAINING BONUS
===================== */

function propertyTrainingBonus() {
  let bonus = 0;
  for (const p of PROPERTIES) {
    const lvl = getOwnedPropertyLevel(p.id);
    if (lvl > 0 && p.trainingBoostPerLevel) bonus += lvl * p.trainingBoostPerLevel;
  }
  return clamp(bonus, 0, 0.15);
}

/* =====================
   XP / LEVEL UPS
===================== */

function xpNeededForLevel(level) {
  return level * 100;
}

function tryLevelUp() {
  while (state.player.xp >= xpNeededForLevel(state.player.level)) {
    state.player.xp -= xpNeededForLevel(state.player.level);
    state.player.level += 1;

    if (state.player.level % 2 === 0) {
      state.player.maxEnergy += 1;
      state.player.maxHealth += 1;
    }

    addLog(`⭐ Leveled up to Lv ${state.player.level}!`);
    toast(`Level up! Lv ${state.player.level}`);
  }

  state.player.energy = clamp(state.player.energy, 0, state.player.maxEnergy);
  state.player.health = clamp(state.player.health, 0, state.player.maxHealth);
}

/* =====================
   EQUIPMENT BONUSES
===================== */

function equippedAttackBonus() {
  return state.equipment?.weapon?.atk || 0;
}

function equippedDefenseBonus() {
  return state.equipment?.armor?.def || 0;
}

function playerAtk() {
  return Math.max(0, state.player.attack + equippedAttackBonus());
}

function playerDef() {
  return Math.max(0, state.player.defense + equippedDefenseBonus());
}

/* =====================
   (PART 2 END)
===================== */
/* =====================
   CRIME ACTION
===================== */

function doCrime(crimeId) {
  const c = CRIMES.find(x => x.id === crimeId);
  if (!c) return;

  if (isJailed()) return toast("You're in jail.");
  if (isKO()) return toast("You're KO'd.");
  if (state.player.level < c.unlock) return toast(`Unlocks at Level ${c.unlock}.`);
  if (state.player.energy < c.energy) return toast("Not enough energy.");

  state.player.energy -= c.energy;

  if (Math.random() <= clamp(c.success, 0.05, 0.95)) {
    const cash = randInt(c.money[0], c.money[1]);
    state.player.money += cash;
    state.player.xp += c.xp;

    addLog(`✅ ${c.name}: +$${cash}, +${c.xp} XP`);
    toast(`Success! +$${cash}`);
    tryLevelUp();
    return;
  }

  const hpLoss = randInt(c.hpLoss[0], c.hpLoss[1]);
  state.player.health = clamp(state.player.health - hpLoss, 0, state.player.maxHealth);

  if (Math.random() <= c.jail) {
    const jailMins = randInt(c.jailMin, c.jailMax);
    state.timers.jailUntil = Date.now() + jailMins * MS.MIN;
    addLog(`🚔 ${c.name}: Jailed ${jailMins} min (-${hpLoss} HP)`);
    toast("Caught!");
  } else {
    addLog(`❌ ${c.name}: Failed (-${hpLoss} HP)`);
    toast("Failed");
  }
}

/* =====================
   FIGHTS
===================== */

function calcDamage(atk, def) {
  const base = atk - Math.floor(def * 0.6);
  return Math.max(1, base);
}

function doFight(kind, id) {
  if (isJailed()) return toast("You're in jail.");
  if (isKO()) return toast("You're KO'd.");

  let target = null;
  let isRival = false;

  if (kind === "enemy") target = ENEMIES.find(x => x.id === id);
  if (kind === "rival") {
    target = RIVALS.find(x => x.id === id);
    isRival = true;
  }
  if (!target) return;

  if (state.player.level < target.unlock) return toast(`Unlocks at Lv ${target.unlock}.`);
  if (state.player.energy < target.energy) return toast("Not enough energy.");

  state.player.energy -= target.energy;

  let enemyHP = target.hp;
  let playerHP = state.player.health;

  for (let i = 0; i < 6; i++) {
    enemyHP -= calcDamage(playerAtk(), target.def);
    if (enemyHP <= 0) break;

    playerHP -= calcDamage(target.atk, playerDef());
    if (playerHP <= 0) break;
  }

  const won = enemyHP <= 0 && playerHP > 0;
  state.player.health = clamp(playerHP, 0, state.player.maxHealth);

  if (won) {
    const cash = randInt(target.money[0], target.money[1]);
    state.player.money += cash;
    state.player.xp += target.xp;

    if (!isRival) {
      state.player.reputation += target.rep || 0;
    } else {
      const wins = (state.rivals?.defeatedCounts?.[id] || 0) + 1;
      state.rivals.defeatedCounts[id] = wins;

      // NOTE: This is your current behavior (kept as-is).
      if (wins === 1 || wins === 3 || wins === 5) {
        const idx = wins === 1 ? 0 : wins === 3 ? 1 : 2;
        const repGain = target.repMilestone?.[idx] || 0;
        state.player.reputation += repGain;
        addLog(`🏷️ Rival milestone! +${repGain} reputation.`);
      }
    }

    addLog(`🥊 Beat ${target.name} +$${cash}`);
    toast("Victory!");
    tryLevelUp();
  } else {
    state.player.xp += Math.floor(target.xp * 0.25);
    addLog(`💥 Lost vs ${target.name}`);
    toast("Defeated");
    tryLevelUp();
  }
}

/* =====================
   GYM ACTIONS (WITH PROPERTY BONUS)
===================== */

function doGym(statKey) {
  if (isKO()) return toast("You're KO'd.");

  const jailed = isJailed();
  const gym = jailed ? GYM.jail : GYM.normal;

  if (state.player.energy < gym.energy) return toast("Not enough energy.");
  if (!["attack", "defense"].includes(statKey)) return;

  state.player.energy -= gym.energy;

  const bonus = propertyTrainingBonus();
  const successChance = clamp(gym.success + bonus, 0.05, 0.95);

  if (Math.random() <= successChance) {
    state.player[statKey] += gym.gain[statKey];
    state.player.xp += gym.xp;

    addLog(`🏋️ ${gym.name}: +1 ${statKey.toUpperCase()} (+${pct(bonus)}% bonus)`);
    toast("Training success");
    tryLevelUp();
  } else {
    const hpLoss = randInt(gym.failHpLoss[0], gym.failHpLoss[1]);
    state.player.health = clamp(state.player.health - hpLoss, 0, state.player.maxHealth);
    state.player.xp += Math.floor(gym.xp * 0.25);

    addLog(`💥 ${gym.name}: Failed (-${hpLoss} HP)`);
    toast("Training failed");
    tryLevelUp();
  }
}

/* =====================
   MISSIONS — CHAINS + COOLDOWNS + DROPS
===================== */

function ensureMissions() {
  if (!state.missions) state.missions = { cooldowns: {}, progress: {} };
  if (!state.missions.cooldowns) state.missions.cooldowns = {};
  if (!state.missions.progress) state.missions.progress = {};
}

function missionCooldownEndsAt(stepId) {
  ensureMissions();
  return state.missions.cooldowns[stepId] || 0;
}

function isMissionOnCooldown(stepId) {
  return Date.now() < missionCooldownEndsAt(stepId);
}

function setMissionCooldown(stepId, minutes) {
  ensureMissions();
  state.missions.cooldowns[stepId] = Date.now() + minutes * MS.MIN;
}

function getMissionLineByStepId(stepId) {
  for (const line of MISSION_LINES) {
    const idx = line.steps.findIndex(s => s.id === stepId);
    if (idx !== -1) return { line, idx };
  }
  return null;
}

function getCurrentStepIndex(lineId) {
  ensureMissions();
  const idx = state.missions.progress[lineId];
  if (typeof idx !== "number") return 0;
  return clamp(
    Math.floor(idx),
    0,
    (MISSION_LINES.find(l => l.lineId === lineId)?.steps.length || 1) - 1
  );
}

function setCurrentStepIndex(lineId, idx) {
  ensureMissions();
  state.missions.progress[lineId] = idx;
}

function advanceMissionLine(lineId) {
  const line = MISSION_LINES.find(l => l.lineId === lineId);
  if (!line) return;

  const idx = getCurrentStepIndex(lineId);
  const next = Math.min(line.steps.length - 1, idx + 1);
  setCurrentStepIndex(lineId, next);
}

function resetMissionLine(lineId) {
  setCurrentStepIndex(lineId, 0);
}

function doMission(stepId) {
  const step = MISSIONS.find(x => x.id === stepId);
  if (!step) return;

  if (isJailed()) return toast("You're in jail. No missions right now.");
  if (isKO()) return toast("You're KO'd.");

  const link = getMissionLineByStepId(stepId);
  if (!link) return;

  if (state.player.level < (link.line.unlock || 1)) return toast("Line locked.");
  if (state.player.energy < step.energy) return toast("Not enough energy.");
  if (isMissionOnCooldown(step.id)) return toast("Mission step is on cooldown.");

  // Must be the current step for that line
  const currentIdx = getCurrentStepIndex(link.line.lineId);
  if (currentIdx !== link.idx) {
    toast("Finish the current step first.");
    return;
  }

  state.player.energy -= step.energy;
  setMissionCooldown(step.id, step.cooldownMin);

  if (step.flavor) addLog(`🗺️ ${step.name}: ${step.flavor}`);

  const successChance = clamp(step.success, 0.05, 0.95);

  if (Math.random() <= successChance) {
    const cash = randInt(step.money[0], step.money[1]);
    state.player.money += cash;
    state.player.xp += step.xp;

    addLog(`🎯 ${step.name}: Success. +$${cash}, +${step.xp} XP`);
    toast(`Mission success! +$${cash}`);
    tryLevelUp();

    const drop = rollMissionDrop();
    if (drop) {
      invAdd({
        id: drop.id,
        name: drop.name,
        type: drop.type,
        energy: drop.energy || 0,
        health: drop.health || 0,
      });
      addLog(`🎁 Found ${drop.name}! (added to inventory)`);
      toast("Drop found!");
    }

    const line = link.line;
    if (link.idx >= line.steps.length - 1) {
      resetMissionLine(line.lineId);
      addLog(`✅ Completed mission line: ${line.name}`);
    } else {
      advanceMissionLine(line.lineId);
      addLog(`➡️ Unlocked next step in: ${line.name}`);
    }
    return;
  }

  const hpLoss = randInt(step.failHpLoss[0], step.failHpLoss[1]);
  state.player.health = clamp(state.player.health - hpLoss, 0, state.player.maxHealth);

  const gotJailed = Math.random() < (step.failJailChance || 0);
  if (gotJailed) {
    const jailMins = randInt(step.failJailMin || 2, step.failJailMax || 4);
    state.timers.jailUntil = Date.now() + jailMins * MS.MIN;
    addLog(`🚔 ${step.name}: Failed. -${hpLoss} HP, jailed ${jailMins} min.`);
    toast("Mission failed — jailed!");
  } else {
    addLog(`❌ ${step.name}: Failed. -${hpLoss} HP.`);
    toast("Mission failed");
  }

  resetMissionLine(link.line.lineId);
}

/* =====================
   TITLE UPDATE
===================== */

function updateTitle() {
  for (let i = TITLES.length - 1; i >= 0; i--) {
    if (state.player.reputation >= TITLES[i].points) {
      state.player.title = TITLES[i].name;
      break;
    }
  }
}
/* =====================
   DOM REFERENCES (RESTORE)
===================== */

const hudMoney = document.getElementById("hudMoney");
const hudLevel = document.getElementById("hudLevel");
const hudTitle = document.getElementById("hudTitle");
// PATCH 4: Top HUD meters
const hudXpText = document.getElementById("hudXpText");
const hudXpBar  = document.getElementById("hudXpBar");

const hudEnergyText = document.getElementById("hudEnergyText");
const hudEnergyBar  = document.getElementById("hudEnergyBar");

const hudHealthText = document.getElementById("hudHealthText");
const hudHealthBar  = document.getElementById("hudHealthBar");


const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileTitleBadge = document.getElementById("profileTitleBadge");
const profileSpecBadge = document.getElementById("profileSpecBadge");

const xpText = document.getElementById("xpText");
const xpBar = document.getElementById("xpBar");
const energyText = document.getElementById("energyText");
const energyBar = document.getElementById("energyBar");
const healthText = document.getElementById("healthText");
const healthBar = document.getElementById("healthBar");

const statLevel = document.getElementById("statLevel");
const statAtk = document.getElementById("statAtk");
const statDef = document.getElementById("statDef");
const statIncome = document.getElementById("statIncome");
const statJail = document.getElementById("statJail");
const statKO = document.getElementById("statKO");

const activityLog = document.getElementById("activityLog");

const pageCrimes = document.getElementById("page-crimes");
const pageFights = document.getElementById("page-fights");
const pageGym = document.getElementById("page-gym");
const pageShop = document.getElementById("page-shop");
const pageArms = document.getElementById("page-arms");
const pageProperties = document.getElementById("page-properties");
const pageMissions = document.getElementById("page-missions");

const profileInventoryBox = document.getElementById("profileInventory");
const profileGearBox = document.getElementById("profileGear");
const profilePropsBox = document.getElementById("profileProps");
// NEW: TOP HUD METERS
// NEW: TOP HUD METERS (duplicate refs kept, renamed to avoid const crash)
const hudXpText2 = document.getElementById("hudXpText");
const hudXpBar2  = document.getElementById("hudXpBar");

const hudEnergyText2 = document.getElementById("hudEnergyText");
const hudEnergyBar2  = document.getElementById("hudEnergyBar");

const hudHealthText2 = document.getElementById("hudHealthText");
const hudHealthBar2  = document.getElementById("hudHealthBar");

const adminPanel = document.getElementById("adminPanel");


// NEW: QUICK USE POPUP
const quickUse = document.getElementById("quickUse");
const quickUseTitle = document.getElementById("quickUseTitle");
const quickUseBody = document.getElementById("quickUseBody");
// AUTH DOM
const auth = document.getElementById("auth");
const authMsg = document.getElementById("authMsg");
const authUser = document.getElementById("authUser");
const authPass = document.getElementById("authPass");

function openAuth(msg) {
  if (!auth) return;
  if (authMsg) authMsg.textContent = msg || "";
  auth.hidden = false;
}

function closeAuth() {
  if (!auth) return;
  auth.hidden = true;
  if (authPass) authPass.value = "";
}

/* =====================
   HUD RENDER (RESTORE)
===================== */

function renderHUD() {
  if (hudMoney) hudMoney.textContent = fmtMoney(state.player.money);
  if (hudLevel) hudLevel.textContent = `Lv ${state.player.level}`;
  if (hudTitle) hudTitle.textContent = state.player.title;

  // PATCH 4: keep top HUD bars synced + smooth animated fills
  const xpNeed = xpNeededForLevel(state.player.level);

  if (hudXpText) hudXpText.textContent = `${state.player.xp} / ${xpNeed}`;
  if (hudXpBar) hudXpBar.style.width = `${clamp((state.player.xp / xpNeed) * 100, 0, 100)}%`;

  if (hudEnergyText) hudEnergyText.textContent = `${state.player.energy}/${state.player.maxEnergy}`;
  if (hudEnergyBar) hudEnergyBar.style.width = `${clamp((state.player.energy / state.player.maxEnergy) * 100, 0, 100)}%`;

  if (hudHealthText) hudHealthText.textContent = `${state.player.health}/${state.player.maxHealth}`;
  if (hudHealthBar) hudHealthBar.style.width = `${clamp((state.player.health / state.player.maxHealth) * 100, 0, 100)}%`;
}


/* =====================
   PAGE RENDERS (RESTORE)
   (NO button visual changes)
===================== */

function renderCrimesPage() {
  if (!pageCrimes) return;

  const jailed = isJailed();
  const ko = isKO();

  pageCrimes.innerHTML = `
    <div class="card">
      <div class="section-title">Crimes</div>
      <div class="muted">Spend energy to commit crimes.</div>
      <div class="hr"></div>
      <div class="muted">Status: ${jailed ? "🚔 In Jail" : ko ? "💫 KO" : "✅ Free"}</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="list">
        ${CRIMES.map(c => {
          const locked = state.player.level < c.unlock;
          const disabled = jailed || ko || locked || state.player.energy < c.energy;

          return `
            <div class="row">
              <div class="row__left">
                <div class="row__title">${c.name}</div>
                <div class="row__sub">
                  +$${c.money[0]}–$${c.money[1]} • +${c.xp} XP •
                  Success ${pct(c.success)}% • Jail ${pct(c.jail)}%
                </div>
              </div>
              <div class="row__right">
                ${locked ? `<span class="tag">Unlock Lv ${c.unlock}</span>` : `<span class="tag">Energy ${c.energy}</span>`}
                <button class="btn btn--small btn--primary"
                  data-action="doCrime"
                  data-crime="${c.id}"
                  ${disabled ? "disabled" : ""}>
                  Do
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFightsPage() {
  if (!pageFights) return;

  const jailed = isJailed();
  const ko = isKO();

  pageFights.innerHTML = `
    <div class="card">
      <div class="section-title">Fights</div>
      <div class="muted">Enemies and Rivals.</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Enemies</div>
      <div class="list">
        ${ENEMIES.map(e => {
          const locked = state.player.level < e.unlock;
          const disabled = jailed || ko || locked || state.player.energy < e.energy;

          return `
            <div class="row">
              <div class="row__left">
                <div class="row__title">${e.name}</div>
                <div class="row__sub">+$${e.money[0]}–$${e.money[1]} • +${e.xp} XP</div>
              </div>
              <div class="row__right">
                ${locked ? `<span class="tag">Unlock Lv ${e.unlock}</span>` : `<span class="tag">Energy ${e.energy}</span>`}
                <button class="btn btn--small btn--primary"
                  data-action="doFight"
                  data-kind="enemy"
                  data-fight="${e.id}"
                  ${disabled ? "disabled" : ""}>
                  Fight
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Rivals</div>
      <div class="list">
        ${RIVALS.map(r => {
          const locked = state.player.level < r.unlock;
          const disabled = jailed || ko || locked || state.player.energy < r.energy;

          return `
            <div class="row">
              <div class="row__left">
                <div class="row__title">${r.name}</div>
                <div class="row__sub">+$${r.money[0]}–$${r.money[1]} • +${r.xp} XP</div>
              </div>
              <div class="row__right">
                ${locked ? `<span class="tag">Unlock Lv ${r.unlock}</span>` : `<span class="tag">Energy ${r.energy}</span>`}
                <button class="btn btn--small btn--primary"
                  data-action="doFight"
                  data-kind="rival"
                  data-fight="${r.id}"
                  ${disabled ? "disabled" : ""}>
                  Fight
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderGymPage() {
  if (!pageGym) return;

  const jailed = isJailed();
  const ko = isKO();
  const gym = jailed ? GYM.jail : GYM.normal;
  const bonus = propertyTrainingBonus();

  pageGym.innerHTML = `
    <div class="card">
      <div class="section-title">${gym.name}</div>
      <div class="muted">Cost: ${gym.energy} Energy • Success ${pct(clamp(gym.success + bonus, 0, 1))}%</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="grid grid--2">
        <button class="btn btn--primary"
          data-action="doGym"
          data-stat="attack"
          ${ko || state.player.energy < gym.energy ? "disabled" : ""}>
          Train Attack
        </button>
        <button class="btn btn--success"
          data-action="doGym"
          data-stat="defense"
          ${ko || state.player.energy < gym.energy ? "disabled" : ""}>
          Train Defense
        </button>
      </div>
    </div>
  `;
}

function renderMissionsPage() {
  if (!pageMissions) return;

  const jailed = isJailed();
  const ko = isKO();

  pageMissions.innerHTML = `
    <div class="card">
      <div class="section-title">Missions</div>
      <div class="muted">
        Mission lines progress step-by-step.
        ${jailed ? "<br><b>🚔 No missions while jailed.</b>" : ""}
      </div>
    </div>

    ${MISSION_LINES.map(line => {
      const currentIdx = getCurrentStepIndex(line.lineId);
      const step = line.steps[currentIdx];

      const onCd = isMissionOnCooldown(step.id);
      const cdLeft = Math.max(0, missionCooldownEndsAt(step.id) - Date.now());

      const disabled =
        jailed || ko || state.player.level < line.unlock ||
        onCd || state.player.energy < step.energy;

      return `
        <div class="card" style="margin-top:12px;">
          <div class="section-title">${line.name}</div>
          <div class="muted">Step ${currentIdx + 1} of ${line.steps.length}</div>
          <div class="hr"></div>

          <div class="row">
            <div class="row__left">
              <div class="row__title">${step.name}</div>
              <div class="row__sub">
                ${step.flavor || ""}<br>
                +$${step.money[0]}–$${step.money[1]} • +${step.xp} XP
              </div>
            </div>
            <div class="row__right">
              <span class="tag">Energy ${step.energy}</span>
              <span class="tag">${step.cooldownMin}m CD</span>
              ${onCd ? `<span class="tag">⏳ ${msToClock(cdLeft)}</span>` : ``}
              <button class="btn btn--small btn--primary"
                data-action="doMission"
                data-mission="${step.id}"
                ${disabled ? "disabled" : ""}>
                Run
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

/* =====================
   (PART 3 END)
===================== */
/* =====================
   PROFILE SUB-VIEWS (Inventory/Gear/Props)
   (Fixes “inventory tabs not working” inside Profile)
===================== */

function openProfileView(view) {
  document.querySelectorAll("[data-profile-view]").forEach(v => {
    v.hidden = v.dataset.profileView !== view;
  });
  state.ui.profileView = view;
}

function renderProfileInventory() {
  if (!profileInventoryBox) return;

  const inv = Object.values(state.inventory || {});
  if (!inv.length) {
    profileInventoryBox.innerHTML = `<div class="muted">Inventory empty.</div>`;
    return;
  }

  profileInventoryBox.innerHTML = `
    <div class="list">
      ${inv.map(it => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${it.name} ×${it.quantity}</div>
          </div>
          <div class="row__right">
            <button class="btn btn--small btn--primary"
              data-action="useInv"
              data-item="${it.id}">
              Use
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderProfileGear() {
  if (!profileGearBox) return;

  const weapons = state.gear?.weapons || [];
  const armor = state.gear?.armor || [];

  profileGearBox.innerHTML = `
    <div class="section-title">Weapons</div>
    <div class="list">
      ${weapons.length ? weapons.map((w,i) => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${w.name}</div>
            <div class="row__sub">Attack +${w.atk}</div>
          </div>
          <div class="row__right">
            <button class="btn btn--small btn--primary"
              data-action="equipWeapon"
              data-idx="${i}">
              Equip
            </button>
          </div>
        </div>
      `).join("") : `<div class="muted">No weapons owned.</div>`}
    </div>

    <div class="section-title" style="margin-top:12px;">Armor</div>
    <div class="list">
      ${armor.length ? armor.map((a,i) => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${a.name}</div>
            <div class="row__sub">Defense +${a.def}</div>
          </div>
          <div class="row__right">
            <button class="btn btn--small btn--primary"
              data-action="equipArmor"
              data-idx="${i}">
              Equip
            </button>
          </div>
        </div>
      `).join("") : `<div class="muted">No armor owned.</div>`}
    </div>
  `;
}

function renderProfileProps() {
  if (!profilePropsBox) return;

  const owned = Object.entries(state.properties?.owned || {});
  if (!owned.length) {
    profilePropsBox.innerHTML = `<div class="muted">No properties owned.</div>`;
    return;
  }

  profilePropsBox.innerHTML = `
    <div class="list">
      ${owned.map(([id,data]) => {
        const p = PROPERTIES.find(x => x.id === id);
        if (!p) return "";
        return `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${p.name}</div>
              <div class="row__sub">
                Level ${data.level} • ${fmtMoney(p.baseIncomePerHour * data.level)}/hr
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* =====================
   SHOP PAGE (FIX: MEDS BACK)
===================== */

function renderShopPage() {
  pageShop.innerHTML = `
    <div class="card">
      <div class="section-title">Shop</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Food</div>
      <div class="list">
        ${SHOP_FOOD.map(it => `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${it.name}</div>
              <div class="row__sub">${it.desc}</div>
            </div>
            <div class="row__right">
              <span class="tag">${fmtMoney(it.price)}</span>
              <button class="btn btn--small btn--primary"
                data-action="buyShop"
                data-kind="food"
                data-item="${it.id}"
                ${state.player.money < it.price ? "disabled" : ""}>
                Buy
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Medical</div>
      <div class="list">
        ${SHOP_HEALING.map(it => `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${it.name}</div>
              <div class="row__sub">${it.desc}</div>
            </div>
            <div class="row__right">
              <span class="tag">${fmtMoney(it.price)}</span>
              <button class="btn btn--small btn--primary"
                data-action="buyShop"
                data-kind="healing"
                data-item="${it.id}"
                ${state.player.money < it.price ? "disabled" : ""}>
                Buy
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* =====================
   BLACK MARKET (WEAPON OR ARMOR) + BUY
===================== */

function generateBlackMarketOffer() {
  const rollGold = Math.random() < 0.01;
  const offerKind = Math.random() < 0.6 ? "weapon" : "armor";

  if (offerKind === "weapon") {
    const basePool = WEAPONS.slice(Math.max(0, WEAPONS.length - 3));
    const base = basePool[randInt(0, basePool.length - 1)];

    if (rollGold) {
      const boost = randInt(3, 6);
      return {
        kind: "weapon",
        item: {
          id: `gold_${base.id}_${Date.now()}`,
          name: `🟡 GOLD ${base.name.replace(/^🟡 GOLD\s+/, "")}`,
          atk: base.atk + boost,
          rarity: "gold",
          price: Math.round(base.price * 2.2),
        },
      };
    }

    const boost = randInt(1, 2);
    return {
      kind: "weapon",
      item: {
        id: `bm_${base.id}_${Date.now()}`,
        name: `🌑 ${base.name}`,
        atk: base.atk + boost,
        rarity: "blackmarket",
        price: Math.round(base.price * 1.4),
      },
    };
  }

  const armorPool = ARMOR.slice(Math.max(0, ARMOR.length - 3));
  const baseA = armorPool[randInt(0, armorPool.length - 1)];

  if (rollGold) {
    const boost = randInt(3, 6);
    return {
      kind: "armor",
      item: {
        id: `gold_${baseA.id}_${Date.now()}`,
        name: `🟡 GOLD ${baseA.name.replace(/^🟡 GOLD\s+/, "")}`,
        def: baseA.def + boost,
        rarity: "gold",
        price: Math.round(baseA.price * 2.2),
      },
    };
  }

  const boost = randInt(1, 2);
  return {
    kind: "armor",
    item: {
      id: `bm_${baseA.id}_${Date.now()}`,
      name: `🌑 ${baseA.name}`,
      def: baseA.def + boost,
      rarity: "blackmarket",
      price: Math.round(baseA.price * 1.4),
    },
  };
}

function refreshBlackMarketIfNeeded() {
  if (!state.blackMarket) {
    state.blackMarket = {
      nextRefreshAt: Date.now() + BLACK_MARKET_REFRESH,
      offer: null,
      offerWeapon: null, // backward compat
    };
  }

  const now = Date.now();

  // backward compat: convert old offerWeapon once
  if (!state.blackMarket.offer && state.blackMarket.offerWeapon) {
    state.blackMarket.offer = { kind: "weapon", item: state.blackMarket.offerWeapon };
    state.blackMarket.offerWeapon = null;
  }

  if (!state.blackMarket.offer || now >= state.blackMarket.nextRefreshAt) {
    state.blackMarket.offer = generateBlackMarketOffer();
    state.blackMarket.nextRefreshAt = now + BLACK_MARKET_REFRESH;

    const isGold = state.blackMarket.offer.item.rarity === "gold";
    addLog(isGold ? "🟡 A GOLD item appeared in the Black Market!" : "🌑 Black Market refreshed.");
  }
}

function buyBlackMarketOffer() {
  refreshBlackMarketIfNeeded();
  const offer = state.blackMarket?.offer;
  if (!offer) return;

  const item = offer.item;
  if (state.player.money < item.price) return toast("Not enough money.");

  state.player.money -= item.price;

  if (offer.kind === "weapon") {
    ownWeapon({ id: item.id, name: item.name, atk: item.atk, rarity: item.rarity });
  } else {
    ownArmor({ id: item.id, name: item.name, def: item.def, rarity: item.rarity });
  }

  addLog(`🛒 Bought ${item.name} (Black Market) for $${item.price}`);
  toast("Purchased");

  state.blackMarket.offer = null;
}

/* =====================
   ARMS DEALER PAGE (FIX: WEAPONS + ARMOR + BLACK MARKET)
===================== */

function renderArmsPage() {
  refreshBlackMarketIfNeeded();

  const offer = state.blackMarket?.offer;
  const bmHtml = offer ? `
    <div class="card" style="margin-top:12px;">
      <div class="section-title">🌑 Black Market</div>
      <div class="row">
        <div class="row__left">
          <div class="row__title">${offer.item.name}</div>
          <div class="row__sub">
            ${offer.kind === "weapon" ? `Attack +${offer.item.atk}` : `Defense +${offer.item.def}`}
            • ${offer.item.rarity.toUpperCase()}
          </div>
        </div>
        <div class="row__right">
          <span class="tag">${fmtMoney(offer.item.price)}</span>
          <button class="btn btn--small btn--primary"
            data-action="buyBM"
            ${state.player.money < offer.item.price ? "disabled" : ""}>
            Buy
          </button>
        </div>
      </div>
      <div class="muted" style="margin-top:8px;">
        Refreshes every 45 minutes • 1% chance of GOLD weapon/armor
      </div>
    </div>
  ` : `
    <div class="card" style="margin-top:12px;">
      <div class="muted">No Black Market offer right now.</div>
    </div>
  `;

  pageArms.innerHTML = `
    <div class="card">
      <div class="section-title">Arms Dealer</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Weapons</div>
      <div class="list">
        ${WEAPONS.map(w => `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${w.name}</div>
              <div class="row__sub">Attack +${w.atk}</div>
            </div>
            <div class="row__right">
              <span class="tag">${fmtMoney(w.price)}</span>
              <button class="btn btn--small btn--primary"
                data-action="buyArms"
                data-kind="weapon"
                data-item="${w.id}"
                ${state.player.money < w.price ? "disabled" : ""}>
                Buy
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Armor</div>
      <div class="list">
        ${ARMOR.map(a => `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${a.name}</div>
              <div class="row__sub">Defense +${a.def}</div>
            </div>
            <div class="row__right">
              <span class="tag">${fmtMoney(a.price)}</span>
              <button class="btn btn--small btn--primary"
                data-action="buyArms"
                data-kind="armor"
                data-item="${a.id}"
                ${state.player.money < a.price ? "disabled" : ""}>
                Buy
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    ${bmHtml}
  `;
}

/* =====================
   PROPERTIES PAGE (FIX: LIST + BUY/UPGRADE)
===================== */

function renderPropertiesPage() {
  pageProperties.innerHTML = `
    <div class="card">
      <div class="section-title">Properties</div>
      <div class="muted">Passive income: ${fmtMoney(getTotalIncomePerHour())}/hr</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="list">
        ${PROPERTIES.map(p => {
          const lvl = getOwnedPropertyLevel(p.id);
          const owned = lvl > 0;
          const upgradeCost = owned ? getUpgradeCost(p.id) : null;

          return `
            <div class="row">
              <div class="row__left">
                <div class="row__title">${p.name}</div>
                <div class="row__sub">
                  ${p.desc}<br>
                  Income: ${fmtMoney(p.baseIncomePerHour * Math.max(1, lvl))}/hr
                  ${owned ? ` • Lv ${lvl}/${p.maxLevel}` : ""}
                </div>
              </div>
              <div class="row__right">
                ${!owned ? `
                  <span class="tag">${fmtMoney(p.buyPrice)}</span>
                  <button class="btn btn--small btn--primary"
                    data-action="buyProperty"
                    data-prop="${p.id}"
                    ${state.player.money < p.buyPrice ? "disabled" : ""}>
                    Buy
                  </button>
                ` : `
                  ${upgradeCost !== Infinity ? `
                    <span class="tag">${fmtMoney(upgradeCost)}</span>
                    <button class="btn btn--small btn--success"
                      data-action="upgradeProperty"
                      data-prop="${p.id}"
                      ${state.player.money < upgradeCost ? "disabled" : ""}>
                      Upgrade
                    </button>
                  ` : `<span class="tag">Max Level</span>`}
                `}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

/* =====================
   PROFILE RENDER (KEEP SUBVIEW)
===================== */

function renderProfile() {
  profileAvatar.textContent = state.player.avatar;
  profileName.textContent = state.player.name;
  profileTitleBadge.textContent = state.player.title;
  if (profileSpecBadge) profileSpecBadge.textContent = "No Specialization";
  if (adminPanel) {
  adminPanel.hidden = !isAdmin();
}

  const xpNeed = xpNeededForLevel(state.player.level);
  xpText.textContent = `${state.player.xp} / ${xpNeed}`;
  xpBar.style.width = `${(state.player.xp / xpNeed) * 100}%`;

  energyText.textContent = `${state.player.energy}/${state.player.maxEnergy}`;
  energyBar.style.width = `${(state.player.energy / state.player.maxEnergy) * 100}%`;

  healthText.textContent = `${state.player.health}/${state.player.maxHealth}`;
  healthBar.style.width = `${(state.player.health / state.player.maxHealth) * 100}%`;
// If you have a place to display it:
const gemsEl = document.getElementById("statGems");
if (gemsEl) gemsEl.textContent = state.player.gems;

  statLevel.textContent = state.player.level;
  statAtk.textContent = state.player.attack;
  statDef.textContent = state.player.defense;
  statIncome.textContent = `${fmtMoney(getTotalIncomePerHour())}/hr`;
  statJail.textContent = isJailed() ? "Yes" : "No";
  statKO.textContent = isKO() ? "Yes" : "No";

  activityLog.innerHTML = (state.ui.log || []).join("<br>");

  // keep the sub-tab visible + rendered
  openProfileView(state.ui.profileView || "overview");
}

/* =====================
   NAVIGATION
===================== */

const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".nav__btn");

function showPage(id) {
  pages.forEach(p => (p.hidden = p.dataset.page !== id));
  navButtons.forEach(b =>
    b.classList.toggle("nav__btn--active", b.dataset.route === id)
  );
  state.ui.page = id;
}

document.getElementById("topNav").addEventListener("click", e => {
  const btn = e.target.closest(".nav__btn");
  if (!btn || btn.disabled) return;
  showPage(btn.dataset.route);
  render();
});

async function createAccount() {
  const u = (authUser?.value || "").trim();
  const p = (authPass?.value || "").trim();

  if (!u || u.length < 3) return openAuth("Username must be at least 3 characters.");
  if (!p || p.length < 4) return openAuth("Password must be at least 4 characters.");

  const accounts = loadAccounts();
  if (accounts[u]) return openAuth("That username already exists.");

  const passHash = await sha256Hex(p);
  accounts[u] = { passHash, createdAt: Date.now() };
  saveAccounts(accounts);

  localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u }));
  currentUser = u;

  // load or create their save
  state = load();
  addLog(`👤 Logged in as ${u}`);
  closeAuth();
  render();
}

async function login() {
  const u = (authUser?.value || "").trim();
  const p = (authPass?.value || "").trim();
  if (!u || !p) return openAuth("Enter username + password.");

accounts[u] = {
  passHash,
  createdAt: Date.now(),
  isAdmin: u === ADMIN_USERNAME,
};


  const passHash = await sha256Hex(p);
  if (passHash !== rec.passHash) return openAuth("Wrong password.");

  localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u }));
  currentUser = u;

  state = load();
  addLog(`👤 Logged in as ${u}`);
  closeAuth();
  render();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  // keep state in memory but require auth again
  openAuth("Logged out. Log in to continue.");
}

/* =====================
   CLICK HANDLER (FIX: PROFILE SUB-TABS + BM BUY)
===================== */

document.body.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const a = btn.dataset.action;
  // QUICK USE (TOP HUD)
    // AUTH
  if (a === "login") { login(); return; }
  if (a === "createAccount") { createAccount(); return; }
  if (a === "logout") { logout(); return; }
  if (a === "openQuickUse") openQuickUse(btn.dataset.kind);
  if (a === "closeQuickUse") closeQuickUse();
  if (a === "quickUseItem") quickUseItem(btn.dataset.item);

  if (a === "openProfileView") openProfileView(btn.dataset.view);

  if (a === "doCrime") doCrime(btn.dataset.crime);
  if (a === "doFight") doFight(btn.dataset.kind, btn.dataset.fight);
  if (a === "doGym") doGym(btn.dataset.stat);
  if (a === "doMission") doMission(btn.dataset.mission);

  if (a === "buyShop") buyShopItem(btn.dataset.kind, btn.dataset.item);
  if (a === "useInv") invUse(btn.dataset.item);

  if (a === "buyArms") buyArms(btn.dataset.kind, btn.dataset.item);

  if (a === "buyBM") buyBlackMarketOffer();

  if (a === "equipWeapon") equipWeaponByIndex(+btn.dataset.idx);
  if (a === "equipArmor") equipArmorByIndex(+btn.dataset.idx);

  if (a === "buyProperty") buyProperty(btn.dataset.prop);
  if (a === "upgradeProperty") upgradeProperty(btn.dataset.prop);

  if (a === "hardReset" && confirm("Reset all progress?")) {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
 if (!isAdmin()) return;

 if (a === "adminMoney") adminAddMoney();
 if (a === "adminXP") adminAddXP();
 if (a === "adminRefill") adminRefill();
 if (a === "adminClearJail") adminClearJail();

  save();
  render();
});

/* =====================
   MAIN RENDER LOOP (FIX: PROFILE SUBPAGES CONTENT)
===================== */

function render() {
  applyRegen();
  applyPropertyIncome();
  updateTitle();

  renderHUD();
  renderProfile();

  renderCrimesPage();
  renderFightsPage();
  renderGymPage();
  renderShopPage();
  renderArmsPage();
  renderPropertiesPage();
  renderMissionsPage();

  // Profile subviews
  renderProfileInventory();
  renderProfileGear();
  renderProfileProps();

  // Tab gating: jail locks everything except profile
  navButtons.forEach(btn => {
    if (isJailed()) {
      btn.disabled = btn.dataset.route !== "profile";
      return;
    }
    if (["crimes","fights","missions","gym"].includes(btn.dataset.route)) {
      btn.disabled = isKO();
    } else {
      btn.disabled = false;
    }
  });

  showPage(state.ui.page);
  save();
}

/* =====================
   BOOT
===================== */
// AUTH boot
(function bootAuth() {
  try {
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    currentUser = sess?.user || null;
  } catch {
    currentUser = null;
  }

  if (!currentUser) {
    openAuth("Log in or create an account to play.");
    return;
  }

  state = load();
  render();
  setInterval(render, 1000);
})();


/* =====================
   (PART 4 END)
===================== */
