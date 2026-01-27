/* =========================================================
   Underworld – Mafia Wars–style Web Game
   app.js (Specializations DISABLED for now)
   Properties Step 1 + 2 + 3 + 4 INCLUDED
   Option 1 Step 1: Property Training Bonus ENABLED
   Missions Step 1 + Step 2 + Step 3:
     - Step 1: missions + cooldowns
     - Step 2: mission chains (multi-step lines)
     - Step 3: flavor text + random drops (inventory)
   FIXES:
     - Shop meds restored
     - Arms Dealer restored (weapons, armor, black market)
     - Properties list restored (buy/upgrade)
     - Profile inventory sub-tabs restored (overview/inventory/gear/props)
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
      {
        id: "runner_1",
        name: "📦 Bag Drop",
        energy: 4,
        success: 0.78,
        money: [180, 320],
        xp: 22,
        cooldownMin: 10,
        failHpLoss: [0, 3],
        failJailChance: 0.04,
        failJailMin: 2,
        failJailMax: 4,
        flavor: "A quiet handoff. Wrong turn and you’re cooked.",
      },
      {
        id: "runner_2",
        name: "🚗 Tail Check",
        energy: 5,
        success: 0.72,
        money: [260, 460],
        xp: 28,
        cooldownMin: 12,
        failHpLoss: [1, 4],
        failJailChance: 0.05,
        failJailMin: 3,
        failJailMax: 5,
        flavor: "Someone’s watching. Lose them without making noise.",
      },
      {
        id: "runner_3",
        name: "🏁 Final Hand-Off",
        energy: 6,
        success: 0.66,
        money: [420, 760],
        xp: 38,
        cooldownMin: 18,
        failHpLoss: [2, 6],
        failJailChance: 0.07,
        failJailMin: 4,
        failJailMax: 7,
        flavor: "Last stop. Get paid — and don’t get clipped.",
      },
    ],
  },
  {
    lineId: "line_collector",
    name: "💰 The Collector",
    unlock: 3,
    steps: [
      {
        id: "collector_1",
        name: "💰 Collection Run",
        energy: 5,
        success: 0.74,
        money: [260, 480],
        xp: 28,
        cooldownMin: 15,
        failHpLoss: [1, 4],
        failJailChance: 0.05,
        failJailMin: 3,
        failJailMax: 5,
        flavor: "They owe. You collect. Simple.",
      },
      {
        id: "collector_2",
        name: "📑 Ledger Cleanup",
        energy: 6,
        success: 0.68,
        money: [380, 720],
        xp: 36,
        cooldownMin: 18,
        failHpLoss: [2, 5],
        failJailChance: 0.06,
        failJailMin: 4,
        failJailMax: 6,
        flavor: "Paper trails are deadly. Make the numbers disappear.",
      },
      {
        id: "collector_3",
        name: "🏦 Drop at the Bank",
        energy: 7,
        success: 0.62,
        money: [650, 1150],
        xp: 46,
        cooldownMin: 25,
        failHpLoss: [3, 7],
        failJailChance: 0.09,
        failJailMin: 5,
        failJailMax: 9,
        flavor: "Big deposit. Big attention. Move like a ghost.",
      },
    ],
  },
  {
    lineId: "line_insider",
    name: "🕵️ The Insider",
    unlock: 6,
    steps: [
      {
        id: "insider_1",
        name: "🧰 Safecrack Job",
        energy: 6,
        success: 0.68,
        money: [420, 760],
        xp: 36,
        cooldownMin: 20,
        failHpLoss: [2, 6],
        failJailChance: 0.07,
        failJailMin: 4,
        failJailMax: 7,
        flavor: "Steel, sweat, and seconds. Don’t rush.",
      },
      {
        id: "insider_2",
        name: "🕵️ Inside Tip",
        energy: 7,
        success: 0.62,
        money: [650, 1150],
        xp: 44,
        cooldownMin: 30,
        failHpLoss: [3, 7],
        failJailChance: 0.09,
        failJailMin: 5,
        failJailMax: 9,
        flavor: "A friend whispers. The city listens.",
      },
      {
        id: "insider_3",
        name: "📡 Clean Extraction",
        energy: 8,
        success: 0.58,
        money: [900, 1600],
        xp: 56,
        cooldownMin: 35,
        failHpLoss: [4, 9],
        failJailChance: 0.11,
        failJailMin: 6,
        failJailMax: 10,
        flavor: "In and out. If it gets loud, it gets ugly.",
      },
    ],
  },
];

const MISSIONS = MISSION_LINES.flatMap(line => line.steps);

/* =====================
   INVENTORY: RANDOM DROPS (Missions Step 3)
===================== */

const MISSION_DROPS = [
  { id: "chips",  name: "🥔 Chips",        type: "food",    energy: 2, health: 0, chance: 0.10 },
  { id: "burger", name: "🍔 Burger",       type: "food",    energy: 4, health: 0, chance: 0.06 },
  { id: "bandage",name: "🩹 Bandage",      type: "healing", energy: 0, health: 3, chance: 0.10 },
  { id: "medkit", name: "🧰 Med Kit",      type: "healing", energy: 0, health: 6, chance: 0.05 },
];

function rollMissionDrop() {
  for (const d of MISSION_DROPS) {
    if (Math.random() < d.chance) return d;
  }
  return null;
}

/* =====================
   (PART 1 END)
===================== */
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

// Black Market: ONE item at a time, refresh 45 minutes
// 1% chance of GOLD weapon OR GOLD armor
function generateBlackMarketOffer() {
  const rollGold = Math.random() < 0.01;

  // choose whether offer is weapon or armor (slightly favor weapons)
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

  // armor offer
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
      // backward compat fields (if older saves exist)
      offerWeapon: null,
    };
  }

  const now = Date.now();

  // Backward compat: if an older save had offerWeapon, convert it once.
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

/* =====================
   PROPERTIES
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
   (PART 2 END)
===================== */
/* =====================
   ARMS DEALER PAGE (RESTORED)
   - Weapons
   - Armor
   - Black Market (1 item, 45m refresh, 1% GOLD)
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
            ${offer.kind === "weapon"
              ? `Attack +${offer.item.atk}`
              : `Defense +${offer.item.def}`}
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
   PROPERTIES PAGE (RESTORED LIST)
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
   PROFILE INVENTORY / GEAR / PROPS (SUB-TABS FIX)
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

  profileGearBox.innerHTML = `
    <div class="section-title">Weapons</div>
    <div class="list">
      ${state.gear.weapons.length ? state.gear.weapons.map((w,i) => `
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
      ${state.gear.armor.length ? state.gear.armor.map((a,i) => `
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

  const owned = Object.entries(state.properties.owned);
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
   PROFILE SUBVIEW NAV (FIX)
===================== */

function openProfileView(view) {
  document.querySelectorAll("[data-profile-view]").forEach(v => {
    v.hidden = v.dataset.profileView !== view;
  });
  state.ui.profileView = view;
}

/* =====================
   (PART 3 END)
===================== */
/* =====================
   SHOP PAGE (FIX: ADD HEALING SECTION BACK)
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
   BUY BLACK MARKET (FIX: SUPPORT WEAPON OR ARMOR OFFER)
===================== */

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

  // clear offer until next refresh / manual refresh
  state.blackMarket.offer = null;
}

/* =====================
   HUD RENDER (MISSING IN YOUR CURRENT FILE)
   (THIS IS WHY STUFF CAN ACT WEIRD / LOOK BROKEN)
===================== */

function renderHUD() {
  hudMoney.textContent = fmtMoney(state.player.money);
  hudLevel.textContent = `Lv ${state.player.level}`;
  hudTitle.textContent = state.player.title;
}

/* =====================
   PROFILE RENDER (FIX: KEEP SUBVIEW + CONTENT IN SYNC)
===================== */

function renderProfile() {
  profileAvatar.textContent = state.player.avatar;
  profileName.textContent = state.player.name;
  profileTitleBadge.textContent = state.player.title;
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
  statIncome.textContent = `${fmtMoney(getTotalIncomePerHour())}/hr`;
  statJail.textContent = isJailed() ? "Yes" : "No";
  statKO.textContent = isKO() ? "Yes" : "No";

  activityLog.innerHTML = state.ui.log.join("<br>");

  // Keep profile sub-tab visible after render
  openProfileView(state.ui.profileView || "overview");
}

/* =====================
   NAVIGATION (UNCHANGED BEHAVIOR)
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

/* =====================
   CLICK HANDLER (FIX: PROFILE SUB-TABS + BLACK MARKET BUY)
===================== */

document.body.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const a = btn.dataset.action;

  // PROFILE SUB-TABS (FIX)
  if (a === "openProfileView") openProfileView(btn.dataset.view);

  if (a === "doCrime") doCrime(btn.dataset.crime);
  if (a === "doFight") doFight(btn.dataset.kind, btn.dataset.fight);
  if (a === "doGym") doGym(btn.dataset.stat);
  if (a === "doMission") doMission(btn.dataset.mission);

  if (a === "buyShop") buyShopItem(btn.dataset.kind, btn.dataset.item);
  if (a === "useInv") invUse(btn.dataset.item);

  if (a === "buyArms") buyArms(btn.dataset.kind, btn.dataset.item);

  // BLACK MARKET (FIX)
  if (a === "buyBM") buyBlackMarketOffer();

  if (a === "equipWeapon") equipWeaponByIndex(+btn.dataset.idx);
  if (a === "equipArmor") equipArmorByIndex(+btn.dataset.idx);

  if (a === "buyProperty") buyProperty(btn.dataset.prop);
  if (a === "upgradeProperty") upgradeProperty(btn.dataset.prop);

  if (a === "hardReset" && confirm("Reset all progress?")) {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

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

  // PROFILE SUBPAGES (FIX)
  renderProfileInventory();
  renderProfileGear();
  renderProfileProps();

  // Tab gating: jail locks everything except profile (unchanged)
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

render();
setInterval(render, 1000);
