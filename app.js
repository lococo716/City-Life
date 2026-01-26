/* =========================================================
   Underworld – Mafia Wars–style Web Game
   app.js (Complete up through PATCH F6)
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
const BLACK_MARKET_REFRESH = 45 * MS.MIN;      // (later)
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

// random int inclusive
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
  // Tier 1 (Lv 1–3)
  { id:"pickpocket",    name:"Pickpocket",          unlock:1, energy:2, success:0.86, jail:0.06, money:[40,90],    xp:8,  hpLoss:[0,1],  jailMin:2, jailMax:3 },
  { id:"shoplift",      name:"Shoplift",            unlock:2, energy:2, success:0.83, jail:0.07, money:[55,120],   xp:10, hpLoss:[0,2],  jailMin:2, jailMax:4 },
  { id:"mug_tourist",   name:"Mug a Tourist",       unlock:3, energy:3, success:0.80, jail:0.08, money:[85,170],   xp:12, hpLoss:[1,3],  jailMin:3, jailMax:4 },

  // Tier 2 (Lv 4–6)
  { id:"carjacking",    name:"Carjacking",          unlock:4, energy:4, success:0.76, jail:0.10, money:[140,260],  xp:16, hpLoss:[2,4],  jailMin:3, jailMax:5 },
  { id:"home_burglary", name:"Home Burglary",       unlock:5, energy:4, success:0.74, jail:0.11, money:[170,320],  xp:18, hpLoss:[2,5],  jailMin:4, jailMax:6 },
  { id:"street_scam",   name:"Street Scam",         unlock:6, energy:5, success:0.72, jail:0.12, money:[200,380],  xp:20, hpLoss:[2,5],  jailMin:4, jailMax:6 },

  // Tier 3 (Lv 7–10)
  { id:"armed_robbery", name:"Armed Robbery",       unlock:7, energy:6, success:0.68, jail:0.14, money:[320,520],  xp:26, hpLoss:[3,6],  jailMin:5, jailMax:7 },
  { id:"bank_runner",   name:"Bank Runner Job",     unlock:8, energy:6, success:0.66, jail:0.15, money:[360,600],  xp:28, hpLoss:[3,7],  jailMin:5, jailMax:7 },
  { id:"warehouse_hit", name:"Warehouse Hit",       unlock:9, energy:7, success:0.64, jail:0.16, money:[420,720],  xp:30, hpLoss:[4,8],  jailMin:6, jailMax:8 },
  { id:"vip_extortion", name:"VIP Extortion",       unlock:10,energy:7, success:0.62, jail:0.17, money:[480,840],  xp:32, hpLoss:[4,8],  jailMin:6, jailMax:8 },

  // Tier 4 (Lv 11–15)
  { id:"casino_scam",   name:"Casino Scam",         unlock:11,energy:8, success:0.60, jail:0.18, money:[650,1050], xp:38, hpLoss:[5,9],  jailMin:7, jailMax:9 },
  { id:"armored_van",   name:"Armored Van Job",     unlock:12,energy:8, success:0.58, jail:0.20, money:[720,1200], xp:40, hpLoss:[5,10], jailMin:7, jailMax:10 },
  { id:"dock_heist",    name:"Dockside Heist",      unlock:13,energy:9, success:0.56, jail:0.21, money:[820,1400], xp:44, hpLoss:[6,10], jailMin:8, jailMax:10 },
  { id:"nightclub_take",name:"Nightclub Takeover",  unlock:14,energy:9, success:0.54, jail:0.22, money:[900,1600], xp:46, hpLoss:[6,11], jailMin:8, jailMax:10 },

  // Tier 5 (Lv 16+)
  { id:"high_society",  name:"High Society Sting",  unlock:16,energy:10,success:0.52, jail:0.24, money:[1100,1900],xp:52, hpLoss:[7,12], jailMin:9, jailMax:10 },
];

/* =====================
   FIGHTS: ENEMIES + RIVALS (PvE, no jail)
===================== */

const ENEMIES = [
  // Early (Lv 1–5)
  { id:"thug",      name:"Street Thug",            unlock:1,  energy:3, atk:1, def:1, hp:6,  money:[60,120],  xp:10, rep:1 },
  { id:"brawler",   name:"Back-Alley Brawler",     unlock:2,  energy:3, atk:2, def:1, hp:7,  money:[80,150],  xp:12, rep:1 },
  { id:"hustler",   name:"Corner Hustler",         unlock:3,  energy:4, atk:2, def:2, hp:8,  money:[110,200], xp:14, rep:1 },
  { id:"enforcer",  name:"Local Enforcer",         unlock:5,  energy:4, atk:3, def:2, hp:10, money:[160,280], xp:18, rep:2 },

  // Mid (Lv 6–12)
  { id:"crew",      name:"Crew Muscle",            unlock:7,  energy:5, atk:4, def:3, hp:12, money:[220,380], xp:24, rep:2 },
  { id:"hitman",    name:"Contract Hitman",        unlock:9,  energy:6, atk:5, def:4, hp:14, money:[300,520], xp:30, rep:3 },
  { id:"captain",   name:"Gang Captain",           unlock:11, energy:6, atk:6, def:5, hp:16, money:[380,680], xp:34, rep:3 },

  // Late (Lv 13+)
  { id:"bossguard", name:"Boss Bodyguard",         unlock:13, energy:7, atk:7, def:6, hp:18, money:[520,900], xp:40, rep:4 },
  { id:"underboss", name:"Underboss Shadow",       unlock:15, energy:7, atk:8, def:7, hp:20, money:[650,1100],xp:46, rep:4 },
];

const RIVALS = [
  // Rival milestones at 1/3/5 wins
  { id:"vince", name:"Vince 'Knuckles' Romano",    unlock:4,  energy:6, atk:5, def:4, hp:16, money:[260,520],  xp:32, repMilestone:[4,6,10] },
  { id:"nyla",  name:"Nyla 'Switchblade' Cruz",    unlock:8,  energy:7, atk:7, def:6, hp:20, money:[420,780],  xp:44, repMilestone:[6,8,12] },
  { id:"marco", name:"Marco 'The Fixer' Valli",    unlock:12, energy:8, atk:9, def:8, hp:24, money:[620,1100], xp:58, repMilestone:[8,10,14] },
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
      blackMarket: now,
      propertyIncome: now,
    },
    inventory: {},
    equipment: {
      weapon: null, // later: { id,name,atk,rarity }
      armor: null,  // later: { id,name,def,rarity }
    },
    properties: {},
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
   SANITIZE
===================== */

function sanitize(s) {
  const d = defaultState();
  if (!s.schema) return d;

  // ensure nested objects exist
  s.rivals = s.rivals || { defeatedCounts: {} };
  s.rivals.defeatedCounts = s.rivals.defeatedCounts || {};

  s.ui = s.ui || {};
  s.ui.log = Array.isArray(s.ui.log) ? s.ui.log : [];
  s.ui.profileView = s.ui.profileView || "overview";
  s.ui.page = s.ui.page || "crimes";

  s.player.energy = clamp(s.player.energy ?? 0, 0, s.player.maxEnergy ?? 10);
  s.player.health = clamp(s.player.health ?? 0, 0, s.player.maxHealth ?? 10);
  s.player.money = Math.max(0, s.player.money ?? 0);
  s.player.level = Math.max(1, s.player.level ?? 1);
  s.player.xp = Math.max(0, s.player.xp ?? 0);
  s.player.reputation = Math.max(0, s.player.reputation ?? 0);

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
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 2200);
}

/* =====================
   XP / LEVEL UPS
===================== */

function xpNeededForLevel(level) {
  return level * 100; // easy v1 curve
}

function tryLevelUp() {
  while (state.player.xp >= xpNeededForLevel(state.player.level)) {
    state.player.xp -= xpNeededForLevel(state.player.level);
    state.player.level += 1;

    // mild growth: every 2 levels +1 max energy and max health
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
   CRIME ACTION
===================== */

function doCrime(crimeId) {
  const c = CRIMES.find(x => x.id === crimeId);
  if (!c) return;

  if (isJailed()) {
    toast("You're in jail. Wait it out.");
    return;
  }
  if (isKO()) {
    toast("You're KO'd. Heal up first.");
    return;
  }
  if (state.player.level < c.unlock) {
    toast(`Unlocks at Level ${c.unlock}.`);
    return;
  }
  if (state.player.energy < c.energy) {
    toast("Not enough energy.");
    return;
  }

  state.player.energy -= c.energy;

  const spec = state.player.specialization ? SPECIALIZATIONS[state.player.specialization] : null;
  const crimeSuccessMod = spec?.mods?.crimeSuccess ? spec.mods.crimeSuccess : 0;
  const jailRiskMod = spec?.mods?.jailRisk ? spec.mods.jailRisk : 0;

  const successChance = clamp(c.success + crimeSuccessMod, 0.05, 0.95);
  const jailChance = clamp(c.jail + jailRiskMod, 0.00, 0.95);

  const roll = Math.random();
  if (roll <= successChance) {
    const cash = randInt(c.money[0], c.money[1]);
    state.player.money += cash;
    state.player.xp += c.xp;

    addLog(`✅ ${c.name}: Success. +$${cash}, +${c.xp} XP`);
    toast(`Success! +$${cash}`);

    tryLevelUp();
    return;
  }

  // Failure: can lose health and/or go to jail
  const hpLoss = randInt(c.hpLoss[0], c.hpLoss[1]);
  if (hpLoss > 0) {
    state.player.health = clamp(state.player.health - hpLoss, 0, state.player.maxHealth);
  }

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
   FIGHT HELPERS + ACTION
===================== */

function getSpecMods() {
  const specId = state.player.specialization;
  if (!specId) return {};
  return SPECIALIZATIONS[specId]?.mods || {};
}

// Equipment hooks (later)
function equippedAttackBonus() {
  const w = state.equipment?.weapon;
  return w?.atk || 0;
}
function equippedDefenseBonus() {
  const a = state.equipment?.armor;
  return a?.def || 0;
}

function playerAtk() {
  return Math.max(0, state.player.attack + equippedAttackBonus());
}
function playerDef() {
  return Math.max(0, state.player.defense + equippedDefenseBonus());
}

// Simple damage model (min 1)
function calcDamage(attackerAtk, defenderDef) {
  const base = attackerAtk - Math.floor(defenderDef * 0.6);
  return Math.max(1, base);
}

function doFight(kind, id) {
  if (isJailed()) {
    toast("You're in jail. No fights right now.");
    return;
  }
  if (isKO()) {
    toast("You're KO'd. Heal up first.");
    return;
  }

  const spec = getSpecMods();

  let target = null;
  let isRival = false;

  if (kind === "enemy") {
    target = ENEMIES.find(x => x.id === id);
  } else if (kind === "rival") {
    target = RIVALS.find(x => x.id === id);
    isRival = true;
  }
  if (!target) return;

  if (state.player.level < target.unlock) {
    toast(`Unlocks at Level ${target.unlock}.`);
    return;
  }
  if (state.player.energy < target.energy) {
    toast("Not enough energy.");
    return;
  }

  state.player.energy -= target.energy;

  const dmgOutMod = spec.fightDmgOut || 0;
  const dmgInMod = spec.fightDmgIn || 0;

  let enemyHP = target.hp;
  let playerHP = state.player.health;

  // Resolve instantly in up to 6 rounds
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
    return;
  }

  // Loss: small consolation XP
  const consolationXP = Math.floor(target.xp * 0.25);
  state.player.xp += consolationXP;

  addLog(`💥 Lost vs ${target.name}. +${consolationXP} XP`);
  toast("You lost the fight");
  tryLevelUp();
}

/* =====================
   END PART 1
===================== */
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

navButtons.forEach(btn => {
  btn.onclick = () => {
    if (btn.disabled) return;
    showPage(btn.dataset.route);
  };
});

/* =====================
   SPECIALIZATION GATE
===================== */

const gate = document.getElementById("specGate");
if (!state.player.specialization) gate.hidden = false;

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
    gate.hidden = true;
    addLog(`Chose specialization: ${SPECIALIZATIONS[spec].name}`);
    toast("Specialization locked in");
    save();
    render();
  }

  if (action === "openProfileView") {
    openProfileView(btn.dataset.view);
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

  if (action === "hardReset") {
    if (confirm("Reset all progress?")) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  }
});

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
   HUD + PROFILE RENDER
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
  profileSpecBadge.textContent =
    SPECIALIZATIONS[state.player.specialization]?.name || "None";

  const xpNeed = state.player.level * 100;
  xpText.textContent = `${state.player.xp} / ${xpNeed}`;
  xpBar.style.width = `${clamp((state.player.xp / xpNeed) * 100, 0, 100)}%`;

  energyText.textContent = `${state.player.energy}/${state.player.maxEnergy}`;
  energyBar.style.width =
    (state.player.energy / state.player.maxEnergy) * 100 + "%";

  healthText.textContent = `${state.player.health}/${state.player.maxHealth}`;
  healthBar.style.width =
    (state.player.health / state.player.maxHealth) * 100 + "%";

  statLevel.textContent = state.player.level;
  statAtk.textContent = state.player.attack;
  statDef.textContent = state.player.defense;
  statIncome.textContent = "$0/hr";
  statJail.textContent = isJailed() ? "Yes" : "No";
  statKO.textContent = isKO() ? "Yes" : "No";

  activityLog.innerHTML = state.ui.log.join("<br>");
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
   CRIMES PAGE RENDER
===================== */

function renderCrimesPage() {
  const jailed = isJailed();
  const ko = isKO();

  let header = `
    <div class="card">
      <div class="section-title">Crimes</div>
      <div class="muted">Spend energy to commit crimes. Higher crimes are riskier.</div>
      <div class="hr"></div>
      <div class="muted">
        Status: ${
          jailed ? "🚔 In Jail" : ko ? "💫 KO (heal first)" : "✅ Free"
        }
      </div>
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
      <div class="card">
        <div class="list">${rows}</div>
      </div>
    </div>
  `;
}

/* =====================
   FIGHTS PAGE RENDER
===================== */

function renderFightsPage() {
  const jailed = isJailed();
  const ko = isKO();

  const statusText = jailed
    ? "🚔 In Jail (Fights locked)"
    : ko
      ? "💫 KO (Heal first)"
      : "✅ Ready";

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

/* =====================
   MAIN RENDER LOOP
===================== */

function render() {
  applyRegen();
  updateTitle();
  renderHUD();
  renderProfile();

  renderCrimesPage();
  renderFightsPage();

  // disable tabs if jailed / KO
  navButtons.forEach(btn => {
    if (["crimes", "fights", "gym"].includes(btn.dataset.route)) {
      btn.disabled = isJailed() || isKO();
    }
  });

  save();
}

render();
setInterval(render, 1000);

