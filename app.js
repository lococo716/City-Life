/* =========================================================
   Underworld – Mafia Wars–style Web Game
   app.js (FULL, up through Arms Dealer + fixes)
   Compatible with your index.html + styles.css
   GitHub Pages safe (localStorage only)
   ========================================================= */

"use strict";

/* =====================
   CONSTANTS & CONFIG
===================== */

const SAVE_KEY = "underworld_save_v1";
const SCHEMA_VERSION = 1;

const MS = {
  MIN: 60 * 1000,
  HOUR: 60 * 60 * 1000,
};

const REGEN_INTERVAL = 5 * MS.MIN;             // 1 per 5 minutes
const BLACK_MARKET_REFRESH = 45 * MS.MIN;      // black market refresh
const PROPERTY_OFFLINE_CAP = 4 * MS.HOUR;      // (later)

/* =====================
   SPECIALIZATIONS
===================== */

const SPECIALIZATIONS = {
  enforcer: {
    name: "Enforcer",
    mods: { fightDmgOut: 0.1, fightDmgIn: -0.05 },
  },
  mastermind: {
    name: "Mastermind",
    mods: { crimeSuccess: 0.06, jailRisk: -0.06 },
  },
  tycoon: {
    name: "Tycoon",
    mods: { propertyIncome: 0.1, propertyUpgradeDiscount: 0.08 },
  },
  athlete: {
    name: "Athlete",
    mods: { gymSuccess: 0.08, gymEnergyDiscount: 1 },
  },
};

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

/* =====================
   CRIMES (15) — level unlocked, higher = riskier
===================== */

const CRIMES = [
  { id:"pickpocket",    name:"Pickpocket",          unlock:1, energy:2, success:0.86, jail:0.06, money:[40,90],     xp:8,  hpLoss:[0,1],  jailMin:2, jailMax:3 },
  { id:"shoplift",      name:"Shoplift",            unlock:2, energy:2, success:0.83, jail:0.07, money:[55,120],    xp:10, hpLoss:[0,2],  jailMin:2, jailMax:4 },
  { id:"mug_tourist",   name:"Mug a Tourist",       unlock:3, energy:3, success:0.80, jail:0.08, money:[85,170],    xp:12, hpLoss:[1,3],  jailMin:3, jailMax:4 },

  { id:"carjacking",    name:"Carjacking",          unlock:4, energy:4, success:0.76, jail:0.10, money:[140,260],   xp:16, hpLoss:[2,4],  jailMin:3, jailMax:5 },
  { id:"home_burglary", name:"Home Burglary",       unlock:5, energy:4, success:0.74, jail:0.11, money:[170,320],   xp:18, hpLoss:[2,5],  jailMin:4, jailMax:6 },
  { id:"street_scam",   name:"Street Scam",         unlock:6, energy:5, success:0.72, jail:0.12, money:[200,380],   xp:20, hpLoss:[2,5],  jailMin:4, jailMax:6 },

  { id:"armed_robbery", name:"Armed Robbery",       unlock:7, energy:6, success:0.68, jail:0.14, money:[320,520],   xp:26, hpLoss:[3,6],  jailMin:5, jailMax:7 },
  { id:"bank_runner",   name:"Bank Runner Job",     unlock:8, energy:6, success:0.66, jail:0.15, money:[360,600],   xp:28, hpLoss:[3,7],  jailMin:5, jailMax:7 },
  { id:"warehouse_hit", name:"Warehouse Hit",       unlock:9, energy:7, success:0.64, jail:0.16, money:[420,720],   xp:30, hpLoss:[4,8],  jailMin:6, jailMax:8 },
  { id:"vip_extortion", name:"VIP Extortion",       unlock:10,energy:7, success:0.62, jail:0.17, money:[480,840],   xp:32, hpLoss:[4,8],  jailMin:6, jailMax:8 },

  { id:"casino_scam",   name:"Casino Scam",         unlock:11,energy:8, success:0.60, jail:0.18, money:[650,1050],  xp:38, hpLoss:[5,9],  jailMin:7, jailMax:9 },
  { id:"armored_van",   name:"Armored Van Job",     unlock:12,energy:8, success:0.58, jail:0.20, money:[720,1200],  xp:40, hpLoss:[5,10], jailMin:7, jailMax:10 },
  { id:"dock_heist",    name:"Dockside Heist",      unlock:13,energy:9, success:0.56, jail:0.21, money:[820,1400],  xp:44, hpLoss:[6,10], jailMin:8, jailMax:10 },
  { id:"nightclub_take",name:"Nightclub Takeover",  unlock:14,energy:9, success:0.54, jail:0.22, money:[900,1600],  xp:46, hpLoss:[6,11], jailMin:8, jailMax:10 },

  { id:"high_society",  name:"High Society Sting",  unlock:16,energy:10,success:0.52, jail:0.24, money:[1100,1900], xp:52, hpLoss:[7,12], jailMin:9, jailMax:10 },
];

/* =====================
   FIGHTS: ENEMIES + RIVALS
===================== */

const ENEMIES = [
  { id:"thug",      name:"Street Thug",        unlock:1,  energy:3, atk:1, def:1, hp:6,  money:[60,120],  xp:10, rep:1 },
  { id:"brawler",   name:"Back-Alley Brawler", unlock:2,  energy:3, atk:2, def:1, hp:7,  money:[80,150],  xp:12, rep:1 },
  { id:"hustler",   name:"Corner Hustler",     unlock:3,  energy:4, atk:2, def:2, hp:8,  money:[110,200], xp:14, rep:1 },
  { id:"enforcer",  name:"Local Enforcer",     unlock:5,  energy:4, atk:3, def:2, hp:10, money:[160,280], xp:18, rep:2 },
  { id:"crew",      name:"Crew Muscle",        unlock:7,  energy:5, atk:4, def:3, hp:12, money:[220,380], xp:24, rep:2 },
  { id:"hitman",    name:"Contract Hitman",    unlock:9,  energy:6, atk:5, def:4, hp:14, money:[300,520], xp:30, rep:3 },
  { id:"captain",   name:"Gang Captain",       unlock:11, energy:6, atk:6, def:5, hp:16, money:[380,680], xp:34, rep:3 },
  { id:"bossguard", name:"Boss Bodyguard",     unlock:13, energy:7, atk:7, def:6, hp:18, money:[520,900], xp:40, rep:4 },
  { id:"underboss", name:"Underboss Shadow",   unlock:15, energy:7, atk:8, def:7, hp:20, money:[650,1100],xp:46, rep:4 },
];

const RIVALS = [
  { id:"vince", name:"Vince 'Knuckles' Romano", unlock:4,  energy:6, atk:5, def:4, hp:16, money:[260,520],  xp:32, repMilestone:[4,6,10] },
  { id:"nyla",  name:"Nyla 'Switchblade' Cruz", unlock:8,  energy:7, atk:7, def:6, hp:20, money:[420,780],  xp:44, repMilestone:[6,8,12] },
  { id:"marco", name:"Marco 'The Fixer' Valli", unlock:12, energy:8, atk:9, def:8, hp:24, money:[620,1100], xp:58, repMilestone:[8,10,14] },
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
  { id:"bandage", name:"🩹 Bandage",      desc:"+3 Health",  price:70,  health:3 },
  { id:"medkit",  name:"🧰 Med Kit",      desc:"+6 Health",  price:140, health:6 },
  { id:"stims",   name:"💉 Stims",        desc:"+9 Health",  price:220, health:9 },
  { id:"clinic",  name:"🏥 Clinic Visit", desc:"+12 Health", price:320, health:12 },
  { id:"surgery", name:"🧑‍⚕️ Surgery",     desc:"+18 Health", price:520, health:18 },
  { id:"revive",  name:"⚡ Revive Shot",  desc:"+25 Health", price:780, health:25 },
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
   DEFAULT GAME STATE
===================== */

function defaultState() {
  const now = Date.now();
  return {
    schema: SCHEMA_VERSION,
    player: {
      name: "Player",
      avatar: "🙂",
      specialization: null,
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
      propertyIncome: now,
    },
    inventory: {},
    equipment: {
      weapon: null,
      armor: null,
    },
    gear: {
      weapons: [],
      armor: [],
    },
    blackMarket: {
      nextRefreshAt: now + BLACK_MARKET_REFRESH,
      offerWeapon: null,
    },
    properties: {}, // later
    rivals: { defeatedCounts: {} },
    ui: {
      page: "crimes",
      profileView: "overview",
      log: [],
    },
  };
}

/* =====================
   LOAD / SAVE / SANITIZE
===================== */

let state = load();

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    const fresh = defaultState();
    save(fresh);
    return fresh;
  }
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    const fresh = defaultState();
    save(fresh);
    return fresh;
  }
}

function save(s = state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}

function sanitize(s) {
  const d = defaultState();
  if (!s || !s.schema) return d;

  s.rivals = s.rivals || { defeatedCounts: {} };
  s.rivals.defeatedCounts = s.rivals.defeatedCounts || {};

  s.ui = s.ui || {};
  s.ui.log = Array.isArray(s.ui.log) ? s.ui.log : [];
  s.ui.profileView = s.ui.profileView || "overview";
  s.ui.page = s.ui.page || "crimes";

  s.inventory = s.inventory || {};
  s.equipment = s.equipment || { weapon: null, armor: null };

  s.gear = s.gear || { weapons: [], armor: [] };
  s.gear.weapons = Array.isArray(s.gear.weapons) ? s.gear.weapons : [];
  s.gear.armor = Array.isArray(s.gear.armor) ? s.gear.armor : [];

  s.blackMarket = s.blackMarket || { nextRefreshAt: Date.now() + BLACK_MARKET_REFRESH, offerWeapon: null };
  if (typeof s.blackMarket.nextRefreshAt !== "number") s.blackMarket.nextRefreshAt = Date.now() + BLACK_MARKET_REFRESH;

  s.player = s.player || d.player;
  s.player.level = Math.max(1, s.player.level ?? 1);
  s.player.xp = Math.max(0, s.player.xp ?? 0);
  s.player.money = Math.max(0, s.player.money ?? 0);

  s.player.maxEnergy = Math.max(1, s.player.maxEnergy ?? 10);
  s.player.maxHealth = Math.max(1, s.player.maxHealth ?? 10);

  s.player.energy = clamp(s.player.energy ?? 0, 0, s.player.maxEnergy);
  s.player.health = clamp(s.player.health ?? 0, 0, s.player.maxHealth);

  s.player.attack = Math.max(0, s.player.attack ?? 1);
  s.player.defense = Math.max(0, s.player.defense ?? 1);

  s.player.reputation = Math.max(0, s.player.reputation ?? 0);
  s.player.title = s.player.title || "Street Rat";

  s.timers = s.timers || {};
  const now = Date.now();
  s.timers.lastEnergy = s.timers.lastEnergy || now;
  s.timers.lastHealth = s.timers.lastHealth || now;

  return s;
}

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
   JAIL / KO
===================== */

function isJailed() {
  return state.timers.jailUntil && Date.now() < state.timers.jailUntil;
}

function isKO() {
  return state.player.health <= 0;
}

/* =====================
   LOG / TOAST
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

function ensureInventory() {
  if (!state.inventory) state.inventory = {};
}

function invAdd(item) {
  ensureInventory();
  if (!state.inventory[item.id]) {
    state.inventory[item.id] = {
      id: item.id,
      name: item.name,
      type: item.type,
      energy: item.energy || 0,
      health: item.health || 0,
      quantity: 0,
    };
  }
  state.inventory[item.id].quantity += 1;
}

function invUse(itemId) {
  ensureInventory();
  const it = state.inventory[itemId];
  if (!it || it.quantity <= 0) return;

  if (it.energy > 0) {
    const before = state.player.energy;
    state.player.energy = clamp(state.player.energy + it.energy, 0, state.player.maxEnergy);
    const gained = state.player.energy - before;
    addLog(`🍽️ Used ${it.name}. +${gained} Energy`);
    toast(`+${gained} Energy`);
  }

  if (it.health > 0) {
    const before = state.player.health;
    state.player.health = clamp(state.player.health + it.health, 0, state.player.maxHealth);
    const gained = state.player.health - before;
    addLog(`🩺 Used ${it.name}. +${gained} Health`);
    toast(`+${gained} Health`);
  }

  it.quantity -= 1;
  if (it.quantity <= 0) delete state.inventory[itemId];
}

/* =====================
   SHOP BUY
===================== */

function buyShopItem(kind, itemId) {
  const list = kind === "food" ? SHOP_FOOD : kind === "healing" ? SHOP_HEALING : null;
  if (!list) return;

  const item = list.find(x => x.id === itemId);
  if (!item) return;

  if (state.player.money < item.price) {
    toast("Not enough money.");
    return;
  }

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
/* =====================
   GEAR HELPERS + BLACK MARKET
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

function generateBlackMarketWeapon() {
  const basePool = WEAPONS.slice(Math.max(0, WEAPONS.length - 3));
  const base = basePool[randInt(0, basePool.length - 1)];

  const rollGold = Math.random() < 0.01;
  if (rollGold) {
    const boost = randInt(3, 6);
    return {
      id: `gold_${base.id}_${Date.now()}`,
      name: `🟡 GOLD ${base.name.replace(/^🟡 GOLD\s+/, "")}`,
      atk: base.atk + boost,
      rarity: "gold",
      price: Math.round(base.price * 2.2),
    };
  }

  const boost = randInt(1, 2);
  return {
    id: `bm_${base.id}_${Date.now()}`,
    name: `🌑 ${base.name}`,
    atk: base.atk + boost,
    rarity: "blackmarket",
    price: Math.round(base.price * 1.4),
  };
}

function refreshBlackMarketIfNeeded() {
  if (!state.blackMarket) {
    state.blackMarket = { nextRefreshAt: Date.now() + BLACK_MARKET_REFRESH, offerWeapon: null };
  }

  const now = Date.now();
  if (!state.blackMarket.offerWeapon || now >= state.blackMarket.nextRefreshAt) {
    state.blackMarket.offerWeapon = generateBlackMarketWeapon();
    state.blackMarket.nextRefreshAt = now + BLACK_MARKET_REFRESH;

    const isGold = state.blackMarket.offerWeapon.rarity === "gold";
    addLog(isGold ? "🟡 A GOLD weapon appeared in the Black Market!" : "🌑 Black Market refreshed.");
  }
}

/* =====================
   ARMS BUY
===================== */

function buyArms(kind, itemId, source = "arms") {
  const list = kind === "weapon" ? WEAPONS : kind === "armor" ? ARMOR : null;
  if (!list) return;

  let item = null;

  if (source === "blackmarket") {
    item = state.blackMarket?.offerWeapon;
    if (!item) return;
    if (kind !== "weapon") return;

    if (state.player.money < item.price) {
      toast("Not enough money.");
      return;
    }
    state.player.money -= item.price;

    ownWeapon({ id: item.id, name: item.name, atk: item.atk, rarity: item.rarity });
    addLog(`🛒 Bought ${item.name} (Black Market) for $${item.price}`);
    toast("Purchased");

    state.blackMarket.offerWeapon = null;
    return;
  }

  item = list.find(x => x.id === itemId);
  if (!item) return;

  if (state.player.money < item.price) {
    toast("Not enough money.");
    return;
  }

  state.player.money -= item.price;

  if (kind === "weapon") {
    ownWeapon({ id: item.id, name: item.name, atk: item.atk, rarity: "normal" });
  } else {
    ownArmor({ id: item.id, name: item.name, def: item.def, rarity: "normal" });
  }

  addLog(`🛒 Bought ${item.name} for $${item.price}`);
  toast("Purchased");
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
   SPECIALIZATION MODS + EQUIPMENT HOOKS
===================== */

function getSpecMods() {
  const specId = state.player.specialization;
  if (!specId) return {};
  return SPECIALIZATIONS[specId]?.mods || {};
}

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
   CRIME ACTION
===================== */

function doCrime(crimeId) {
  const c = CRIMES.find(x => x.id === crimeId);
  if (!c) return;

  if (isJailed()) return toast("You're in jail. Wait it out.");
  if (isKO()) return toast("You're KO'd. Heal up first.");
  if (state.player.level < c.unlock) return toast(`Unlocks at Level ${c.unlock}.`);
  if (state.player.energy < c.energy) return toast("Not enough energy.");

  state.player.energy -= c.energy;

  const spec = getSpecMods();
  const successChance = clamp(c.success + (spec.crimeSuccess || 0), 0.05, 0.95);
  const jailChance = clamp(c.jail + (spec.jailRisk || 0), 0.0, 0.95);

  if (Math.random() <= successChance) {
    const cash = randInt(c.money[0], c.money[1]);
    state.player.money += cash;
    state.player.xp += c.xp;

    addLog(`✅ ${c.name}: Success. +$${cash}, +${c.xp} XP`);
    toast(`Success! +$${cash}`);
    tryLevelUp();
    return;
  }

  const hpLoss = randInt(c.hpLoss[0], c.hpLoss[1]);
  state.player.health = clamp(state.player.health - hpLoss, 0, state.player.maxHealth);

  const gotJailed = Math.random() <= jailChance;
  if (gotJailed) {
    const jailMins = randInt(c.jailMin, c.jailMax);
    state.timers.jailUntil = Date.now() + jailMins * MS.MIN;
    addLog(`🚔 ${c.name}: Caught! -${hpLoss} HP, jailed for ${jailMins} min.`);
    toast(`Caught! Jailed ${jailMins} min`);
  } else {
    addLog(`❌ ${c.name}: Failed. -${hpLoss} HP (you got away).`);
    toast("Failed (got away)");
  }
}

/* =====================
   FIGHTS
===================== */

function calcDamage(attackerAtk, defenderDef) {
  const base = attackerAtk - Math.floor(defenderDef * 0.6);
  return Math.max(1, base);
}

function doFight(kind, id) {
  if (isJailed()) return toast("You're in jail. No fights right now.");
  if (isKO()) return toast("You're KO'd. Heal up first.");

  let target = null;
  let isRival = false;

  if (kind === "enemy") target = ENEMIES.find(x => x.id === id);
  if (kind === "rival") { target = RIVALS.find(x => x.id === id); isRival = true; }
  if (!target) return;

  if (state.player.level < target.unlock) return toast(`Unlocks at Level ${target.unlock}.`);
  if (state.player.energy < target.energy) return toast("Not enough energy.");

  state.player.energy -= target.energy;

  const spec = getSpecMods();
  const dmgOutMod = spec.fightDmgOut || 0;
  const dmgInMod = spec.fightDmgIn || 0;

  let enemyHP = target.hp;
  let playerHP = state.player.health;

  for (let round = 0; round < 6; round++) {
    const pDmgBase = calcDamage(playerAtk(), target.def);
    const pDmg = Math.max(1, Math.floor(pDmgBase * (1 + dmgOutMod)));
    enemyHP -= pDmg;
    if (enemyHP <= 0) break;

    const eDmgBase = calcDamage(target.atk, playerDef());
    const eDmg = Math.max(1, Math.floor(eDmgBase * (1 + dmgInMod)));
    playerHP -= eDmg;
    if (playerHP <= 0) break;
  }

  const won = enemyHP <= 0 && playerHP > 0;
  state.player.health = clamp(playerHP, 0, state.player.maxHealth);

  if (won) {
    const cash = randInt(target.money[0], target.money[1]);
    state.player.money += cash;
    state.player.xp += target.xp;

    if (!isRival) {
      state.player.reputation += (target.rep || 0);
    } else {
      const wins = (state.rivals?.defeatedCounts?.[id] || 0) + 1;
      state.rivals.defeatedCounts[id] = wins;

      if (wins === 1 || wins === 3 || wins === 5) {
        const idx = wins === 1 ? 0 : wins === 3 ? 1 : 2;
        const repGain = target.repMilestone?.[idx] || 0;
        state.player.reputation += repGain;
        addLog(`🏷️ Rival milestone! +${repGain} reputation.`);
      }
    }

    addLog(`🥊 Won vs ${target.name}. +$${cash}, +${target.xp} XP`);
    toast(`Win! +$${cash}`);
    tryLevelUp();
  } else {
    const consolationXP = Math.floor(target.xp * 0.25);
    state.player.xp += consolationXP;
    addLog(`💥 Lost vs ${target.name}. +${consolationXP} XP`);
    toast("You lost the fight");
    tryLevelUp();
  }
}

/* =====================
   GYM ACTIONS
===================== */

function propertyTrainingBonus() {
  return 0; // later
}

function msToClock(ms) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function doGym(statKey) {
  if (isKO()) return toast("You're KO'd. Heal first.");

  const jailed = isJailed();
  const gym = jailed ? GYM.jail : GYM.normal;

  const specMods = getSpecMods();
  const successMod = specMods.gymSuccess || 0;
  const energyDiscount = specMods.gymEnergyDiscount || 0;

  const energyCost = Math.max(1, gym.energy - energyDiscount);
  const successChance = clamp(gym.success + successMod + propertyTrainingBonus(), 0.05, 0.95);

  if (state.player.energy < energyCost) return toast("Not enough energy.");
  if (statKey !== "attack" && statKey !== "defense") return;

  state.player.energy -= energyCost;

  if (Math.random() <= successChance) {
    state.player[statKey] += gym.gain[statKey];
    state.player.xp += gym.xp;
    addLog(`🏋️ ${gym.name}: Success. +${gym.gain[statKey]} ${statKey.toUpperCase()}, +${gym.xp} XP`);
    toast("Training success!");
    tryLevelUp();
    return;
  }

  const hpLoss = randInt(gym.failHpLoss[0], gym.failHpLoss[1]);
  state.player.health = clamp(state.player.health - hpLoss, 0, state.player.maxHealth);

  const consolationXP = Math.floor(gym.xp * 0.25);
  state.player.xp += consolationXP;

  addLog(`💥 ${gym.name}: Failed. -${hpLoss} HP, +${consolationXP} XP`);
  toast("Training failed");
  tryLevelUp();
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
   DOM REFERENCES
===================== */

const hudMoney = document.getElementById("hudMoney");
const hudLevel = document.getElementById("hudLevel");
const hudTitle = document.getElementById("hudTitle");

const systemBanner = document.getElementById("systemBanner");

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

const profileInventoryBox = document.getElementById("profileInventory");
const profileGearBox = document.getElementById("profileGear");

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
  save();
}

/* Reliable nav: event delegation */
const topNav = document.getElementById("topNav");
if (topNav) {
  topNav.addEventListener("click", (e) => {
    const b = e.target.closest(".nav__btn");
    if (!b) return;
    if (b.disabled) return;
    const route = b.dataset.route;
    if (!route) return;
    showPage(route);
    render();
  });
}

/* =====================
   SPECIALIZATION GATE
===================== */

const gate = document.getElementById("specGate");
if (gate) gate.hidden = !!state.player.specialization;

/* =====================
   PROFILE SUBVIEWS
===================== */

function openProfileView(view) {
  document
    .querySelectorAll("[data-profile-view]")
    .forEach(v => (v.hidden = v.dataset.profileView !== view));
  state.ui.profileView = view;
  save();
}

/* =====================
   CLICK HANDLER (ACTIONS)
===================== */

document.body.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "pickSpec") {
    const spec = btn.dataset.spec;
    state.player.specialization = spec;

    // hard-hide gate immediately + keep hidden on render
    const g = document.getElementById("specGate");
    if (g) g.hidden = true;

    addLog(`Chose specialization: ${SPECIALIZATIONS[spec].name}`);
    toast("Specialization locked in");

    // feels responsive: send them to Crimes
    showPage("crimes");

    save();
    render();
  }

  if (action === "openProfileView") {
    openProfileView(btn.dataset.view);
    render();
  }

  if (action === "doCrime") {
    doCrime(btn.dataset.crime);
    save();
    render();
  }

  if (action === "doFight") {
    doFight(btn.dataset.kind, btn.dataset.fight);
    save();
    render();
  }

  if (action === "doGym") {
    doGym(btn.dataset.stat);
    save();
    render();
  }

  if (action === "buyShop") {
    buyShopItem(btn.dataset.kind, btn.dataset.item);
    save();
    render();
  }

  if (action === "useInv") {
    invUse(btn.dataset.item);
    save();
    render();
  }

  if (action === "buyArms") {
    buyArms(btn.dataset.kind, btn.dataset.item, "arms");
    save();
    render();
  }

  if (action === "buyBM") {
    buyArms("weapon", null, "blackmarket");
    save();
    render();
  }

  if (action === "equipWeapon") {
    equipWeaponByIndex(Number(btn.dataset.idx));
    save();
    render();
  }

  if (action === "equipArmor") {
    equipArmorByIndex(Number(btn.dataset.idx));
    save();
    render();
  }

  if (action === "hardReset") {
    if (confirm("Reset all progress?")) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  }
});

/* =====================
   HUD + PROFILE RENDER
===================== */

function renderHUD() {
  if (hudMoney) hudMoney.textContent = `$${state.player.money}`;
  if (hudLevel) hudLevel.textContent = `Lv ${state.player.level}`;
  if (hudTitle) hudTitle.textContent = state.player.title;
}

function renderProfile() {
  if (profileAvatar) profileAvatar.textContent = state.player.avatar;
  if (profileName) profileName.textContent = state.player.name;
  if (profileTitleBadge) profileTitleBadge.textContent = state.player.title;
  if (profileSpecBadge) profileSpecBadge.textContent =
    SPECIALIZATIONS[state.player.specialization]?.name || "None";

  const xpNeed = state.player.level * 100;
  if (xpText) xpText.textContent = `${state.player.xp} / ${xpNeed}`;
  if (xpBar) xpBar.style.width = `${clamp((state.player.xp / xpNeed) * 100, 0, 100)}%`;

  if (energyText) energyText.textContent = `${state.player.energy}/${state.player.maxEnergy}`;
  if (energyBar) energyBar.style.width = (state.player.energy / state.player.maxEnergy) * 100 + "%";

  if (healthText) healthText.textContent = `${state.player.health}/${state.player.maxHealth}`;
  if (healthBar) healthBar.style.width = (state.player.health / state.player.maxHealth) * 100 + "%";

  if (statLevel) statLevel.textContent = state.player.level;
  if (statAtk) statAtk.textContent = state.player.attack;
  if (statDef) statDef.textContent = state.player.defense;
  if (statIncome) statIncome.textContent = "$0/hr";
  if (statJail) statJail.textContent = isJailed() ? "Yes" : "No";
  if (statKO) statKO.textContent = isKO() ? "Yes" : "No";

  if (activityLog) activityLog.innerHTML = state.ui.log.join("<br>");

  // restore profile subview selection
  openProfileView(state.ui.profileView || "overview");
}

/* =====================
   PROFILE: INVENTORY + GEAR RENDER
===================== */

function renderProfileInventory() {
  const inv = state.inventory || {};
  const ids = Object.keys(inv);

  if (!profileInventoryBox) return;

  if (ids.length === 0) {
    profileInventoryBox.innerHTML = `<div class="muted">Your inventory is empty.</div>`;
    return;
  }

  const rows = ids
    .map(id => inv[id])
    .sort((a, b) => (a.type > b.type ? 1 : -1))
    .map(it => {
      const canUse =
        (it.energy > 0 && state.player.energy < state.player.maxEnergy) ||
        (it.health > 0 && state.player.health < state.player.maxHealth);

      return `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${it.name} ×${it.quantity}</div>
            <div class="row__sub">
              ${it.energy ? `+${it.energy} Energy` : ""}${it.energy && it.health ? " • " : ""}${it.health ? `+${it.health} Health` : ""}
            </div>
          </div>
          <div class="row__right">
            <span class="tag">${it.type}</span>
            <button class="btn ${canUse ? "btn--primary" : "btn--secondary"} btn--small"
              data-action="useInv" data-item="${it.id}" ${canUse ? "" : "disabled"}>
              Use
            </button>
          </div>
        </div>
      `;
    }).join("");

  profileInventoryBox.innerHTML = `<div class="list">${rows}</div>`;
}

function renderProfileGear() {
  if (!profileGearBox) return;

  const eqW = state.equipment?.weapon;
  const eqA = state.equipment?.armor;

  const weapons = state.gear?.weapons || [];
  const armor = state.gear?.armor || [];

  const equippedHtml = `
    <div class="row">
      <div class="row__left">
        <div class="row__title">Equipped Weapon</div>
        <div class="row__sub">${eqW ? `${eqW.name} • ATK +${eqW.atk}` : "None"}</div>
      </div>
      <div class="row__right">
        ${eqW?.rarity === "gold" ? `<span class="tag tag--gold">GOLD</span>` : eqW?.rarity ? `<span class="tag">${eqW.rarity}</span>` : ``}
      </div>
    </div>
    <div class="row">
      <div class="row__left">
        <div class="row__title">Equipped Armor</div>
        <div class="row__sub">${eqA ? `${eqA.name} • DEF +${eqA.def}` : "None"}</div>
      </div>
      <div class="row__right">
        ${eqA?.rarity === "gold" ? `<span class="tag tag--gold">GOLD</span>` : eqA?.rarity ? `<span class="tag">${eqA.rarity}</span>` : ``}
      </div>
    </div>
  `;

  const weaponRows = weapons.length
    ? weapons.map((w, idx) => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${w.name}</div>
            <div class="row__sub">ATK +${w.atk}</div>
          </div>
          <div class="row__right">
            ${w.rarity === "gold" ? `<span class="tag tag--gold">GOLD</span>` : `<span class="tag">${w.rarity}</span>`}
            <button class="btn btn--primary btn--small" data-action="equipWeapon" data-idx="${idx}">Equip</button>
          </div>
        </div>
      `).join("")
    : `<div class="muted">No weapons owned yet.</div>`;

  const armorRows = armor.length
    ? armor.map((a, idx) => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${a.name}</div>
            <div class="row__sub">DEF +${a.def}</div>
          </div>
          <div class="row__right">
            <span class="tag">${a.rarity}</span>
            <button class="btn btn--success btn--small" data-action="equipArmor" data-idx="${idx}">Equip</button>
          </div>
        </div>
      `).join("")
    : `<div class="muted">No armor owned yet.</div>`;

  profileGearBox.innerHTML = `
    <div class="list">
      ${equippedHtml}
      <div class="hr"></div>
      <div class="section-title">Owned Weapons</div>
      ${weaponRows}
      <div class="hr"></div>
      <div class="section-title">Owned Armor</div>
      ${armorRows}
    </div>
  `;
}

/* =====================
   PAGES RENDER (Crimes/Fights/Gym/Shop/Arms)
===================== */

function renderCrimesPage() {
  const jailed = isJailed();
  const ko = isKO();

  const header = `
    <div class="card">
      <div class="section-title">Crimes</div>
      <div class="muted">Spend energy to commit crimes. Higher crimes are riskier.</div>
      <div class="hr"></div>
      <div class="muted">Status: ${jailed ? "🚔 In Jail" : ko ? "💫 KO (heal first)" : "✅ Free"}</div>
    </div>
  `;

  const rows = CRIMES.map(c => {
    const locked = state.player.level < c.unlock;
    const disabled = jailed || ko || locked || state.player.energy < c.energy;

    const tag = locked
      ? `<span class="tag">Unlock Lv ${c.unlock}</span>`
      : `<span class="tag">Energy ${c.energy}</span>`;

    const risk = `<span class="tag">Success ${pct(c.success)}%</span>
                  <span class="tag">Jail ${pct(c.jail)}%</span>`;

    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${c.name}</div>
          <div class="row__sub">+$${c.money[0]}–$${c.money[1]} • +${c.xp} XP • HP loss on fail</div>
        </div>
        <div class="row__right">
          ${tag}
          ${risk}
          <button class="btn ${disabled ? "btn--secondary" : "btn--danger"} btn--small"
                  data-action="doCrime" data-crime="${c.id}"
                  ${disabled ? "disabled" : ""}>
            Do Crime
          </button>
        </div>
      </div>
    `;
  }).join("");

  pageCrimes.innerHTML = `
    <div class="grid">
      ${header}
      <div class="card"><div class="list">${rows}</div></div>
    </div>
  `;
}

function renderFightsPage() {
  const jailed = isJailed();
  const ko = isKO();

  const statusText = jailed ? "🚔 In Jail (Fights locked)" : ko ? "💫 KO (Heal first)" : "✅ Ready";

  const enemyRows = ENEMIES.map(e => {
    const locked = state.player.level < e.unlock;
    const disabled = jailed || ko || locked || state.player.energy < e.energy;

    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${e.name}</div>
          <div class="row__sub">Lv ${e.unlock}+ • Enemy A/D ${e.atk}/${e.def} • HP ${e.hp}</div>
        </div>
        <div class="row__right">
          ${locked ? `<span class="tag">Unlock Lv ${e.unlock}</span>` : `<span class="tag">Energy ${e.energy}</span>`}
          <span class="tag">+$${e.money[0]}–$${e.money[1]}</span>
          <span class="tag">+${e.xp} XP</span>
          <button class="btn ${disabled ? "btn--secondary" : "btn--primary"} btn--small"
            data-action="doFight" data-kind="enemy" data-fight="${e.id}" ${disabled ? "disabled" : ""}>
            Fight
          </button>
        </div>
      </div>
    `;
  }).join("");

  const rivalRows = RIVALS.map(r => {
    const wins = state.rivals?.defeatedCounts?.[r.id] || 0;
    const locked = state.player.level < r.unlock;
    const disabled = jailed || ko || locked || state.player.energy < r.energy;

    const milestoneTag =
      wins >= 5 ? `<span class="tag tag--gold">Dominated</span>` :
      wins >= 3 ? `<span class="tag">Milestone 3/5</span>` :
      wins >= 1 ? `<span class="tag">Milestone 1/5</span>` :
      `<span class="tag">New Rival</span>`;

    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${r.name}</div>
          <div class="row__sub">Lv ${r.unlock}+ • Rival A/D ${r.atk}/${r.def} • HP ${r.hp} • Wins: ${wins}</div>
        </div>
        <div class="row__right">
          ${locked ? `<span class="tag">Unlock Lv ${r.unlock}</span>` : `<span class="tag">Energy ${r.energy}</span>`}
          ${milestoneTag}
          <span class="tag">+$${r.money[0]}–$${r.money[1]}</span>
          <span class="tag">+${r.xp} XP</span>
          <button class="btn ${disabled ? "btn--secondary" : "btn--danger"} btn--small"
            data-action="doFight" data-kind="rival" data-fight="${r.id}" ${disabled ? "disabled" : ""}>
            Challenge
          </button>
        </div>
      </div>
    `;
  }).join("");

  pageFights.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="section-title">Fights</div>
        <div class="muted">Earn money/XP, but you’ll lose health. No jail from fights.</div>
        <div class="hr"></div>
        <div class="muted">Status: ${statusText}</div>
      </div>

      <div class="card">
        <div class="section-title">Street Fights</div>
        <div class="list">${enemyRows}</div>
      </div>

      <div class="card">
        <div class="section-title">Rivals</div>
        <div class="muted">Beat rivals multiple times for reputation milestones.</div>
        <div class="hr"></div>
        <div class="list">${rivalRows}</div>
      </div>
    </div>
  `;
}

function renderGymPage() {
  const jailed = isJailed();
  const ko = isKO();

  const gym = jailed ? GYM.jail : GYM.normal;

  const specMods = getSpecMods();
  const energyDiscount = specMods.gymEnergyDiscount || 0;
  const successMod = specMods.gymSuccess || 0;

  const energyCost = Math.max(1, gym.energy - energyDiscount);
  const successChance = clamp(gym.success + successMod + propertyTrainingBonus(), 0.05, 0.95);

  const jailMsg = jailed
    ? `<div class="muted">🚔 In Jail — time left: <b>${msToClock(state.timers.jailUntil - Date.now())}</b></div><div class="hr"></div>`
    : "";

  const statusText = ko ? "💫 KO (Heal first)" : (jailed ? "🚔 Jail Gym Available" : "✅ Normal Gym Available");

  const disabled = ko || state.player.energy < energyCost;

  pageGym.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="section-title">${gym.name}</div>
        ${jailMsg}
        <div class="muted">Train Attack or Defense. Costs energy. Failing can cost health.</div>
        <div class="hr"></div>
        <div class="muted">Status: ${statusText}</div>
      </div>

      <div class="card">
        <div class="list">
          <div class="row">
            <div class="row__left">
              <div class="row__title">Train Attack</div>
              <div class="row__sub">Success ${pct(successChance)}% • +${gym.gain.attack} ATK • +${gym.xp} XP</div>
            </div>
            <div class="row__right">
              <span class="tag">Energy ${energyCost}</span>
              <button class="btn ${disabled ? "btn--secondary" : "btn--success"} btn--small"
                data-action="doGym" data-stat="attack" ${disabled ? "disabled" : ""}>
                Train
              </button>
            </div>
          </div>

          <div class="row">
            <div class="row__left">
              <div class="row__title">Train Defense</div>
              <div class="row__sub">Success ${pct(successChance)}% • +${gym.gain.defense} DEF • +${gym.xp} XP</div>
            </div>
            <div class="row__right">
              <span class="tag">Energy ${energyCost}</span>
              <button class="btn ${disabled ? "btn--secondary" : "btn--success"} btn--small"
                data-action="doGym" data-stat="defense" ${disabled ? "disabled" : ""}>
                Train
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderShopPage() {
  const foodRows = SHOP_FOOD.map(it => {
    const disabled = state.player.money < it.price;
    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${it.name}</div>
          <div class="row__sub">${it.desc}</div>
        </div>
        <div class="row__right">
          <span class="tag">$${it.price}</span>
          <button class="btn ${disabled ? "btn--secondary" : "btn--primary"} btn--small"
            data-action="buyShop" data-kind="food" data-item="${it.id}" ${disabled ? "disabled" : ""}>
            Buy
          </button>
        </div>
      </div>
    `;
  }).join("");

  const healRows = SHOP_HEALING.map(it => {
    const disabled = state.player.money < it.price;
    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${it.name}</div>
          <div class="row__sub">${it.desc}</div>
        </div>
        <div class="row__right">
          <span class="tag">$${it.price}</span>
          <button class="btn ${disabled ? "btn--secondary" : "btn--success"} btn--small"
            data-action="buyShop" data-kind="healing" data-item="${it.id}" ${disabled ? "disabled" : ""}>
            Buy
          </button>
        </div>
      </div>
    `;
  }).join("");

  pageShop.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="section-title">Shop</div>
        <div class="muted">Food restores Energy. Healing restores Health. Purchases go to your Inventory.</div>
      </div>

      <div class="card">
        <div class="section-title">Food (Energy)</div>
        <div class="list">${foodRows}</div>
      </div>

      <div class="card">
        <div class="section-title">Healing</div>
        <div class="list">${healRows}</div>
      </div>
    </div>
  `;
}

function renderArmsPage() {
  refreshBlackMarketIfNeeded();

  const weaponRows = WEAPONS.map(w => {
    const disabled = state.player.money < w.price;
    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${w.name}</div>
          <div class="row__sub">Attack +${w.atk}</div>
        </div>
        <div class="row__right">
          <span class="tag">$${w.price}</span>
          <button class="btn ${disabled ? "btn--secondary" : "btn--primary"} btn--small"
            data-action="buyArms" data-kind="weapon" data-item="${w.id}" ${disabled ? "disabled" : ""}>
            Buy
          </button>
        </div>
      </div>
    `;
  }).join("");

  const armorRows = ARMOR.map(a => {
    const disabled = state.player.money < a.price;
    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${a.name}</div>
          <div class="row__sub">Defense +${a.def}</div>
        </div>
        <div class="row__right">
          <span class="tag">$${a.price}</span>
          <button class="btn ${disabled ? "btn--secondary" : "btn--success"} btn--small"
            data-action="buyArms" data-kind="armor" data-item="${a.id}" ${disabled ? "disabled" : ""}>
            Buy
          </button>
        </div>
      </div>
    `;
  }).join("");

  const offer = state.blackMarket?.offerWeapon;
  const msLeft = Math.max(0, (state.blackMarket?.nextRefreshAt || 0) - Date.now());

  const bmHtml = offer
    ? `
      <div class="row">
        <div class="row__left">
          <div class="row__title">${offer.name} ${offer.rarity === "gold" ? `<span class="tag tag--gold">GOLD</span>` : ""}</div>
          <div class="row__sub">Attack +${offer.atk} • Rare Black Market weapon</div>
        </div>
        <div class="row__right">
          <span class="tag">$${offer.price}</span>
          <button class="btn ${state.player.money < offer.price ? "btn--secondary" : (offer.rarity === "gold" ? "btn--gold" : "btn--danger")} btn--small"
            data-action="buyBM" ${state.player.money < offer.price ? "disabled" : ""}>
            Buy
          </button>
        </div>
      </div>
    `
    : `<div class="muted">No offer right now (someone bought it). Next refresh will bring a new weapon.</div>`;

  pageArms.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="section-title">Arms Dealer</div>
        <div class="muted">Buy weapons and armor. Equip gear from Profile → Weapons & Armor.</div>
      </div>

      <div class="card">
        <div class="section-title">Weapons</div>
        <div class="list">${weaponRows}</div>
      </div>

      <div class="card">
        <div class="section-title">Armor</div>
        <div class="list">${armorRows}</div>
      </div>

      <div class="card">
        <div class="section-title">🌑 Black Market</div>
        <div class="muted">Refreshes every 45 minutes. 1% chance for a <b>GOLD</b> weapon.</div>
        <div class="hr"></div>
        <div class="muted">Next refresh: <b>${Math.ceil(msLeft / 60000)} min</b></div>
        <div class="hr"></div>
        <div class="list">${bmHtml}</div>
      </div>
    </div>
  `;
}

/* =====================
   MAIN RENDER LOOP (Fixes included)
===================== */

function render() {
  applyRegen();
  updateTitle();

  // FIX: Always enforce specialization gate visibility
  const g = document.getElementById("specGate");
  if (g) g.hidden = !!state.player.specialization;

  renderHUD();
  renderProfile();

  renderCrimesPage();
  renderFightsPage();
  renderGymPage();
  renderShopPage();
  renderArmsPage();

  renderProfileInventory();
  renderProfileGear();

  // TAB LOCK RULES:
  // - Crimes + Fights disabled if jailed OR KO
  // - Gym disabled only if KO (Gym stays usable in jail)
  // - Everything else enabled
  navButtons.forEach(btn => {
    const route = btn.dataset.route;

    if (route === "crimes" || route === "fights") {
      btn.disabled = isJailed() || isKO();
      return;
    }

    if (route === "gym") {
      btn.disabled = isKO();
      return;
    }

    btn.disabled = false;
  });

  // Restore last page on load
  showPage(state.ui.page || "crimes");

  save();
}

/* =====================
   BOOT
===================== */

render();
setInterval(render, 1000);

