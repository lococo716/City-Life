/* =========================================================
   Underworld – Mafia Wars–style Web Game
   app.js (Specializations DISABLED for now)
   Properties Step 1 + Step 2 INCLUDED
   Compatible with your index.html + styles.css
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

const REGEN_INTERVAL = 5 * MS.MIN;             // 1 energy/health per 5 minutes
const BLACK_MARKET_REFRESH = 45 * MS.MIN;      // black market refresh every 45 min

// PROPERTIES
const PROPERTY_OFFLINE_CAP = 4 * MS.HOUR;      // offline income cap

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
   PROPERTIES (Step 1)
===================== */

const PROPERTIES = [
  {
    id: "stash_house",
    name: "🧳 Stash House",
    desc: "Low-key income. Small training edge.",
    buyPrice: 600,
    baseIncomePerHour: 35,
    upgradeBaseCost: 350,
    trainingBoostPerLevel: 0.005,
    maxLevel: 10,
  },
  {
    id: "corner_store",
    name: "🏪 Corner Store",
    desc: "Steady cashflow with upgrades.",
    buyPrice: 1400,
    baseIncomePerHour: 80,
    upgradeBaseCost: 700,
    trainingBoostPerLevel: 0.004,
    maxLevel: 12,
  },
  {
    id: "nightclub",
    name: "🪩 Nightclub",
    desc: "Higher income. A bit riskier (later).",
    buyPrice: 4200,
    baseIncomePerHour: 220,
    upgradeBaseCost: 1600,
    trainingBoostPerLevel: 0.003,
    maxLevel: 15,
  },
  {
    id: "warehouse",
    name: "🏭 Warehouse",
    desc: "Big operations, bigger income.",
    buyPrice: 9500,
    baseIncomePerHour: 520,
    upgradeBaseCost: 3200,
    trainingBoostPerLevel: 0.002,
    maxLevel: 18,
  },
];

/* =====================
   PROPERTIES — INCOME ENGINE (Step 2)
===================== */

function getOwnedPropertyLevel(propId) {
  return state.properties?.owned?.[propId]?.level || 0; // 0 = not owned
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
    if (wholeMinutes >= 5) {
      addLog(`🏠 Property income: +$${payout} (${wholeMinutes} min)`);
    }
  }
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

    // PROPERTIES (Step 1)
    properties: {
      lastIncomeAt: now,
      owned: {},
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

  s.blackMarket = s.blackMarket || {
    nextRefreshAt: Date.now() + BLACK_MARKET_REFRESH,
    offerWeapon: null,
  };

  // PROPERTIES (Step 1 + Step 2 safety)
  s.properties = s.properties || {};
  if (typeof s.properties.lastIncomeAt !== "number") s.properties.lastIncomeAt = Date.now();
  s.properties.owned = s.properties.owned || {};

  s.rivals = s.rivals || { defeatedCounts: {} };

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
   REGEN (ENERGY + HEALTH)
===================== */

function applyRegen() {
  const now = Date.now();

  const eTicks = Math.floor((now - state.timers.lastEnergy) / REGEN_INTERVAL);
  if (eTicks > 0) {
    state.player.energy = clamp(
      state.player.energy + eTicks,
      0,
      state.player.maxEnergy
    );
    state.timers.lastEnergy += eTicks * REGEN_INTERVAL;
  }

  const hTicks = Math.floor((now - state.timers.lastHealth) / REGEN_INTERVAL);
  if (hTicks > 0) {
    state.player.health = clamp(
      state.player.health + hTicks,
      0,
      state.player.maxHealth
    );
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
    state.inventory[item.id] = {
      ...item,
      quantity: 0,
    };
  }
  state.inventory[item.id].quantity += 1;
}

function invUse(itemId) {
  const it = state.inventory[itemId];
  if (!it || it.quantity <= 0) return;

  if (it.energy) {
    state.player.energy = clamp(
      state.player.energy + it.energy,
      0,
      state.player.maxEnergy
    );
  }
  if (it.health) {
    state.player.health = clamp(
      state.player.health + it.health,
      0,
      state.player.maxHealth
    );
  }

  it.quantity -= 1;
  if (it.quantity <= 0) delete state.inventory[itemId];

  addLog(`Used ${it.name}`);
  toast("Item used");
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

  const successChance = clamp(c.success, 0.05, 0.95);
  const jailChance = clamp(c.jail, 0.0, 0.95);

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

  let enemyHP = target.hp;
  let playerHP = state.player.health;

  for (let round = 0; round < 6; round++) {
    const pDmg = calcDamage(playerAtk(), target.def);
    enemyHP -= pDmg;
    if (enemyHP <= 0) break;

    const eDmg = calcDamage(target.atk, playerDef());
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
  return 0; // training boost later
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

  const energyCost = gym.energy;
  const successChance = clamp(gym.success + propertyTrainingBonus(), 0.05, 0.95);

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
   PAGE RENDERS (RESTORED)
   These were missing, causing tabs to appear blank.
===================== */

function renderCrimesPage() {
  const jailed = isJailed();
  const ko = isKO();

  pageCrimes.innerHTML = `
    <div class="card">
      <div class="section-title">Crimes</div>
      <div class="muted">Spend energy to commit crimes. Higher crimes are riskier.</div>
      <div class="hr"></div>
      <div class="muted">Status: ${jailed ? `🚔 In Jail` : ko ? `💫 KO (heal first)` : `✅ Free`}</div>
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
  const jailed = isJailed();
  const ko = isKO();

  const enemyList = ENEMIES.map(e => {
    const locked = state.player.level < e.unlock;
    const disabled = jailed || ko || locked || state.player.energy < e.energy;
    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">🥊 ${e.name}</div>
          <div class="row__sub">
            +$${e.money[0]}–$${e.money[1]} • +${e.xp} XP • Rep +${e.rep || 0}
          </div>
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
  }).join("");

  const rivalList = RIVALS.map(r => {
    const locked = state.player.level < r.unlock;
    const disabled = jailed || ko || locked || state.player.energy < r.energy;
    const wins = state.rivals?.defeatedCounts?.[r.id] || 0;

    return `
      <div class="row">
        <div class="row__left">
          <div class="row__title">👑 ${r.name}</div>
          <div class="row__sub">
            Wins: ${wins} • +$${r.money[0]}–$${r.money[1]} • +${r.xp} XP
          </div>
        </div>
        <div class="row__right">
          ${locked ? `<span class="tag">Unlock Lv ${r.unlock}</span>` : `<span class="tag">Energy ${r.energy}</span>`}
          <button class="btn btn--small btn--gold"
            data-action="doFight"
            data-kind="rival"
            data-fight="${r.id}"
            ${disabled ? "disabled" : ""}>
            Rival
          </button>
        </div>
      </div>
    `;
  }).join("");

  pageFights.innerHTML = `
    <div class="card">
      <div class="section-title">Fights</div>
      <div class="muted">Battle enemies for cash, XP, and reputation. Rivals give milestone rep.</div>
      <div class="hr"></div>
      <div class="muted">Status: ${jailed ? `🚔 In Jail` : ko ? `💫 KO (heal first)` : `✅ Free`}</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Enemies</div>
      <div class="list">${enemyList}</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Rivals</div>
      <div class="list">${rivalList}</div>
    </div>
  `;
}

function renderGymPage() {
  const jailed = isJailed();
  const ko = isKO();

  const activeGym = jailed ? GYM.jail : GYM.normal;

  pageGym.innerHTML = `
    <div class="card">
      <div class="section-title">${activeGym.name}</div>
      <div class="muted">
        Train to increase Attack / Defense.
        ${jailed ? `<br><b>Jail Gym is only visible while jailed.</b>` : ``}
      </div>
      <div class="hr"></div>
      <div class="muted">
        Cost: ${activeGym.energy} Energy • Success: ${pct(activeGym.success + propertyTrainingBonus())}% • +${activeGym.xp} XP
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="grid grid--2">
        <button class="btn btn--primary"
          data-action="doGym"
          data-stat="attack"
          ${ko || state.player.energy < activeGym.energy ? "disabled" : ""}>
          Train Attack (+1)
        </button>

        <button class="btn btn--success"
          data-action="doGym"
          data-stat="defense"
          ${ko || state.player.energy < activeGym.energy ? "disabled" : ""}>
          Train Defense (+1)
        </button>
      </div>

      ${jailed ? `
        <div class="hr"></div>
        <div class="muted">
          Time left in jail: <b>${msToClock((state.timers.jailUntil || 0) - Date.now())}</b>
        </div>
      ` : ``}
    </div>
  `;
}

function renderShopPage() {
  pageShop.innerHTML = `
    <div class="card">
      <div class="section-title">Shop</div>
      <div class="muted">Food goes to your inventory (Energy). Healing items restore Health.</div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">Food (Energy)</div>
      <div class="list">
        ${SHOP_FOOD.map(it => `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${it.name}</div>
              <div class="row__sub">${it.desc}</div>
            </div>
            <div class="row__right">
              <span class="tag">$${it.price}</span>
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
      <div class="section-title" style="margin-top:0;">Healing</div>
      <div class="list">
        ${SHOP_HEALING.map(it => `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${it.name}</div>
              <div class="row__sub">${it.desc}</div>
            </div>
            <div class="row__right">
              <span class="tag">$${it.price}</span>
              <button class="btn btn--small btn--success"
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

function renderArmsPage() {
  refreshBlackMarketIfNeeded();

  const bm = state.blackMarket?.offerWeapon;
  const bmTimer = Math.max(0, (state.blackMarket?.nextRefreshAt || 0) - Date.now());

  pageArms.innerHTML = `
    <div class="card">
      <div class="section-title">Arms Dealer</div>
      <div class="muted">Weapons and armor boost your Attack/Defense. Equip from Profile → Weapons & Armor.</div>
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
              <span class="tag">$${w.price}</span>
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
              <span class="tag">$${a.price}</span>
              <button class="btn btn--small btn--success"
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

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">🌑 Black Market</div>
      <div class="muted">Refreshes every 45 minutes • 1% chance of a GOLD weapon</div>
      <div class="hr"></div>

      ${bm ? `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${bm.name} ${bm.rarity === "gold" ? `<span class="tag tag--gold">GOLD</span>` : ``}</div>
            <div class="row__sub">Attack +${bm.atk}</div>
          </div>
          <div class="row__right">
            <span class="tag">$${bm.price}</span>
            <button class="btn btn--small ${bm.rarity === "gold" ? "btn--gold" : "btn--primary"}"
              data-action="buyBM"
              ${state.player.money < bm.price ? "disabled" : ""}>
              Buy
            </button>
          </div>
        </div>
      ` : `
        <div class="muted">No offer right now. Next refresh in <b>${msToClock(bmTimer)}</b>.</div>
      `}
      <div class="hint">Next refresh in <b>${msToClock(bmTimer)}</b>.</div>
    </div>
  `;
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

const profileInventoryBox = document.getElementById("profileInventory");
const profileGearBox = document.getElementById("profileGear");
const profilePropsBox = document.getElementById("profileProps");

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

const topNav = document.getElementById("topNav");
topNav.addEventListener("click", e => {
  const btn = e.target.closest(".nav__btn");
  if (!btn || btn.disabled) return;
  showPage(btn.dataset.route);
  render();
});

/* =====================
   PROFILE SUBVIEWS
===================== */

function openProfileView(view) {
  document.querySelectorAll("[data-profile-view]").forEach(v => {
    v.hidden = v.dataset.profileView !== view;
  });
  state.ui.profileView = view;
  save();
}

/* =====================
   CLICK HANDLER
===================== */

document.body.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const a = btn.dataset.action;

  if (a === "openProfileView") {
    openProfileView(btn.dataset.view);
  }
  if (a === "doCrime") doCrime(btn.dataset.crime);
  if (a === "doFight") doFight(btn.dataset.kind, btn.dataset.fight);
  if (a === "doGym") doGym(btn.dataset.stat);
  if (a === "buyShop") buyShopItem(btn.dataset.kind, btn.dataset.item);
  if (a === "useInv") invUse(btn.dataset.item);
  if (a === "buyArms") buyArms(btn.dataset.kind, btn.dataset.item);
  if (a === "buyBM") buyArms("weapon", null, "blackmarket");
  if (a === "equipWeapon") equipWeaponByIndex(+btn.dataset.idx);
  if (a === "equipArmor") equipArmorByIndex(+btn.dataset.idx);

  if (a === "hardReset" && confirm("Reset all progress?")) {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  save();
  render();
});

/* =====================
   RENDER HUD + PROFILE
===================== */

function renderHUD() {
  hudMoney.textContent = `$${state.player.money}`;
  hudLevel.textContent = `Lv ${state.player.level}`;
  hudTitle.textContent = state.player.title;
}

function renderProfile() {
  profileAvatar.textContent = state.player.avatar;
  profileName.textContent = state.player.name;
  profileTitleBadge.textContent = state.player.title;

  // safe: if element exists, set it
  if (profileSpecBadge) profileSpecBadge.textContent = "No Specialization";

  const xpNeed = xpNeededForLevel(state.player.level);
  xpText.textContent = `${state.player.xp} / ${xpNeed}`;
  xpBar.style.width = `${(state.player.xp / xpNeed) * 100}%`;

  energyText.textContent = `${state.player.energy}/${state.player.maxEnergy}`;
  energyBar.style.width = `${(state.player.energy / state.player.maxEnergy) * 100}%`;

  healthText.textContent = `${state.player.health}/${state.player.maxHealth}`;
  healthBar.style.width = `${(state.player.health / state.player.maxHealth) * 100}%`;

  statLevel.textContent = state.player.level;
  statAtk.textContent = state.player.attack;
  statDef.textContent = state.player.defense;

  // PROPERTIES (Step 2)
  statIncome.textContent = `$${getTotalIncomePerHour()}/hr`;

  statJail.textContent = isJailed() ? "Yes" : "No";
  statKO.textContent = isKO() ? "Yes" : "No";

  activityLog.innerHTML = state.ui.log.join("<br>");
  openProfileView(state.ui.profileView);
}

/* =====================
   PLACEHOLDER: PROPERTIES PAGE
===================== */

function renderPropertiesPage() {
  pageProperties.innerHTML = `
    <div class="card">
      <div class="section-title">Properties</div>
      <div class="muted">
        Buy and upgrade properties for passive income.<br>
        (Income engine is live. Buying/Upgrading comes next.)
      </div>
    </div>
  `;
}

/* =====================
   PROFILE INVENTORY / GEAR / PROPERTIES
===================== */

function renderProfileInventory() {
  if (!profileInventoryBox) return;
  const inv = Object.values(state.inventory);

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
              data-action="useInv" data-item="${it.id}">
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
  const eqW = state.equipment?.weapon;
  const eqA = state.equipment?.armor;

  profileGearBox.innerHTML = `
    <div class="section-title" style="margin-top:0;">Equipped</div>
    <div class="muted">
      Weapon: <b>${eqW ? `${eqW.name} (+${eqW.atk})` : "None"}</b><br>
      Armor: <b>${eqA ? `${eqA.name} (+${eqA.def})` : "None"}</b>
    </div>
    <div class="hr"></div>

    <div class="section-title" style="margin-top:0;">Weapons</div>
    <div class="list">
      ${weapons.length ? weapons.map((w, idx) => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${w.name}</div>
            <div class="row__sub">Attack +${w.atk}</div>
          </div>
          <div class="row__right">
            ${w.rarity === "gold" ? `<span class="tag tag--gold">GOLD</span>` : ``}
            <button class="btn btn--small btn--secondary"
              data-action="equipWeapon" data-idx="${idx}">
              Equip
            </button>
          </div>
        </div>
      `).join("") : `<div class="muted">No weapons owned yet.</div>`}
    </div>

    <div class="hr"></div>

    <div class="section-title" style="margin-top:0;">Armor</div>
    <div class="list">
      ${armor.length ? armor.map((a, idx) => `
        <div class="row">
          <div class="row__left">
            <div class="row__title">${a.name}</div>
            <div class="row__sub">Defense +${a.def}</div>
          </div>
          <div class="row__right">
            <button class="btn btn--small btn--secondary"
              data-action="equipArmor" data-idx="${idx}">
              Equip
            </button>
          </div>
        </div>
      `).join("") : `<div class="muted">No armor owned yet.</div>`}
    </div>
  `;
}

function renderProfileProps() {
  if (!profilePropsBox) return;

  const owned = state.properties?.owned || {};
  const ownedList = PROPERTIES.filter(p => (owned[p.id]?.level || 0) > 0);

  if (!ownedList.length) {
    profilePropsBox.innerHTML = `<div class="muted">No properties owned yet.</div>`;
    return;
  }

  profilePropsBox.innerHTML = `
    <div class="list">
      ${ownedList.map(p => {
        const lvl = owned[p.id].level;
        return `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${p.name}</div>
              <div class="row__sub">Level ${lvl} • $${p.baseIncomePerHour * lvl}/hr</div>
            </div>
            <div class="row__right">
              <span class="tag">$${p.baseIncomePerHour}/hr per level</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* =====================
   MAIN RENDER LOOP
===================== */

function render() {
  applyRegen();

  // PROPERTIES (Step 2)
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

  renderProfileInventory();
  renderProfileGear();
  renderProfileProps();

  navButtons.forEach(btn => {
    if (btn.dataset.route === "crimes" || btn.dataset.route === "fights") {
      btn.disabled = isJailed() || isKO();
    } else if (btn.dataset.route === "gym") {
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

render();
setInterval(render, 1000);
