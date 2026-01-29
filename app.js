/* =========================================================
   Underworld – Mafia Wars–style Web Game
   app.js (Specializations DISABLED for now)

   FIXES INCLUDED (NO FEATURE CHANGES):
   - Removed stray adminGems crash line
   - Fixed doGym() braces / logic
   - Fixed Gems shop render corruption
   - buyGemItem moved to top-level
   - Fixed login() undefined variables
   - Fixed click handler gating + hard reset key

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

const ADMIN_USERNAME = "admin";

const MS = {
  MIN: 60 * 1000,
  HOUR: 60 * 60 * 1000,
};

const REGEN_INTERVAL = 5 * MS.MIN;
const BLACK_MARKET_REFRESH = 45 * MS.MIN;

const PROPERTY_OFFLINE_CAP = 4 * MS.HOUR;
const PROPERTY_UPGRADE_GROWTH = 1.35;

/* =====================
   TITLES
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
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function isAdmin() {
  return currentUser === ADMIN_USERNAME;
}

/* =====================
   CRIMES
===================== */

const CRIMES = [
  { id:"pickpocket", name:"Pickpocket", unlock:1, energy:2, success:0.86, jail:0.06, money:[40,90], xp:8, hpLoss:[0,1], jailMin:2, jailMax:3 },
  { id:"shoplift", name:"Shoplift", unlock:2, energy:2, success:0.83, jail:0.07, money:[55,120], xp:10, hpLoss:[0,2], jailMin:2, jailMax:4 },
  { id:"mug_tourist", name:"Mug a Tourist", unlock:3, energy:3, success:0.80, jail:0.08, money:[85,170], xp:12, hpLoss:[1,3], jailMin:3, jailMax:4 },
  { id:"carjacking", name:"Carjacking", unlock:4, energy:4, success:0.76, jail:0.10, money:[140,260], xp:16, hpLoss:[2,4], jailMin:3, jailMax:5 },
  { id:"home_burglary", name:"Home Burglary", unlock:5, energy:4, success:0.74, jail:0.11, money:[170,320], xp:18, hpLoss:[2,5], jailMin:4, jailMax:6 },
  { id:"street_scam", name:"Street Scam", unlock:6, energy:5, success:0.72, jail:0.12, money:[200,380], xp:20, hpLoss:[2,5], jailMin:4, jailMax:6 },
  { id:"armed_robbery", name:"Armed Robbery", unlock:7, energy:6, success:0.68, jail:0.14, money:[320,520], xp:26, hpLoss:[3,6], jailMin:5, jailMax:7 },
  { id:"bank_runner", name:"Bank Runner Job", unlock:8, energy:6, success:0.66, jail:0.15, money:[360,600], xp:28, hpLoss:[3,7], jailMin:5, jailMax:7 },
  { id:"warehouse_hit", name:"Warehouse Hit", unlock:9, energy:7, success:0.64, jail:0.16, money:[420,720], xp:30, hpLoss:[4,8], jailMin:6, jailMax:8 },
  { id:"vip_extortion", name:"VIP Extortion", unlock:10, energy:7, success:0.62, jail:0.17, money:[480,840], xp:32, hpLoss:[4,8], jailMin:6, jailMax:8 },
];

/* =====================
   DEFAULT STATE
===================== */

function defaultState() {
  const now = Date.now();
  return {
    schema: SCHEMA_VERSION,
    player: {
      name: "Player",
      gems: 0,
      avatar: "🙂",
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
    buffs: { adrenalineTrainLeft: 0 },
    blackMarket: { nextRefreshAt: now + BLACK_MARKET_REFRESH, offer: null },
    properties: { lastIncomeAt: now, owned: {} },
    missions: { cooldowns: {}, progress: {} },
    rivals: { defeatedCounts: {} },
    ui: { page: "crimes", profileView: "overview", log: [] },
  };
}

/* =====================
   LOAD / SAVE
===================== */

let state = load();

function load() {
  const key = getSaveKey();
  const raw = localStorage.getItem(key);
  if (!raw) {
    const fresh = defaultState();
    save(fresh);
    return fresh;
  }
  try { return sanitize(JSON.parse(raw)); }
  catch {
    const fresh = defaultState();
    save(fresh);
    return fresh;
  }
}

function save(s = state) {
  localStorage.setItem(getSaveKey(), JSON.stringify(s));
}

/* =====================
   SANITIZE
===================== */

function sanitize(s) {
  const d = defaultState();
  if (!s || !s.schema) return d;

  s.player = s.player || d.player;
  s.player.money = Math.max(0, s.player.money || 0);
  s.player.gems = Math.max(0, s.player.gems || 0);
  s.player.energy = clamp(s.player.energy ?? 0, 0, s.player.maxEnergy);
  s.player.health = clamp(s.player.health ?? 0, 0, s.player.maxHealth);

  s.inventory ||= {};
  s.gear ||= { weapons: [], armor: [] };
  s.equipment ||= { weapon: null, armor: null };
  s.buffs ||= { adrenalineTrainLeft: 0 };

  return s;
}
    state.player.energy = clamp(state.player.energy, 0, state.player.maxEnergy);
    state.player.health = clamp(state.player.health, 0, state.player.maxHealth);
  }
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

      // NOTE: kept as-is (your current behavior)
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
   ✅ FIXED: braces/logic so success + failure work correctly
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
    let gain = gym.gain[statKey]; // normally 1

    if ((state.buffs?.adrenalineTrainLeft || 0) > 0) {
      gain += 1; // makes it 2 per success
      state.buffs.adrenalineTrainLeft -= 1;
      addLog(`💉 Adrenaline boost! (${state.buffs.adrenalineTrainLeft} left)`);
    }

    state.player[statKey] += gain;
    state.player.xp += gym.xp;

    addLog(`🏋️ ${gym.name}: +${gain} ${statKey.toUpperCase()} (+${pct(bonus)}% bonus)`);
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
   PROFILE SUB-VIEWS
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
   SHOP PAGE (✅ FIXED: Gems + no broken template)
===================== */

function renderShopPage() {
  if (!pageShop) return;

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

    <div class="card" style="margin-top:12px;">
      <div class="section-title" style="margin-top:0;">💎 Gems</div>
      <div class="muted">Balance: 💎 ${state.player.gems}</div>
      <div class="hr"></div>
      <div class="list">
        ${GEM_ITEMS.map(it => `
          <div class="row">
            <div class="row__left">
              <div class="row__title">${it.name}</div>
              <div class="row__sub">${it.desc}</div>
            </div>
            <div class="row__right">
              <span class="tag">💎 ${it.priceGems}</span>
              <button class="btn btn--small btn--primary"
                data-action="buyGem"
                data-item="${it.id}"
                ${state.player.gems < it.priceGems ? "disabled" : ""}>
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
   ARMS DEALER PAGE
===================== */

function renderArmsPage() {
  if (!pageArms) return;

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
            • ${(offer.item.rarity || "normal").toUpperCase()}
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
   PROPERTIES PAGE
===================== */

function renderPropertiesPage() {
  if (!pageProperties) return;

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
                  Income: ${fmtMoney(p.baseIncomePerHour * (owned ? lvl : 1))}/hr
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
   PROFILE RENDER
===================== */

function renderProfile() {
  if (profileAvatar) profileAvatar.textContent = state.player.avatar;
  if (profileName) profileName.textContent = state.player.name;
  if (profileTitleBadge) profileTitleBadge.textContent = state.player.title;
  if (profileSpecBadge) profileSpecBadge.textContent = "No Specialization";

  // ✅ Admin panel shows only for admin
  if (adminPanel) adminPanel.hidden = !isAdmin();

  const xpNeed = xpNeededForLevel(state.player.level);

  if (xpText) xpText.textContent = `${state.player.xp} / ${xpNeed}`;
  if (xpBar) xpBar.style.width = `${clamp((state.player.xp / xpNeed) * 100, 0, 100)}%`;

  if (energyText) energyText.textContent = `${state.player.energy}/${state.player.maxEnergy}`;
  if (energyBar) energyBar.style.width = `${clamp((state.player.energy / state.player.maxEnergy) * 100, 0, 100)}%`;

  if (healthText) healthText.textContent = `${state.player.health}/${state.player.maxHealth}`;
  if (healthBar) healthBar.style.width = `${clamp((state.player.health / state.player.maxHealth) * 100, 0, 100)}%`;

  const gemsEl = document.getElementById("statGems");
  if (gemsEl) gemsEl.textContent = state.player.gems;

  if (statLevel) statLevel.textContent = state.player.level;
  if (statAtk) statAtk.textContent = state.player.attack;
  if (statDef) statDef.textContent = state.player.defense;
  if (statIncome) statIncome.textContent = `${fmtMoney(getTotalIncomePerHour())}/hr`;
  if (statJail) statJail.textContent = isJailed() ? "Yes" : "No";
  if (statKO) statKO.textContent = isKO() ? "Yes" : "No";

  if (activityLog) activityLog.innerHTML = (state.ui.log || []).join("<br>");

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

const topNav = document.getElementById("topNav");
if (topNav) {
  topNav.addEventListener("click", e => {
    const btn = e.target.closest(".nav__btn");
    if (!btn || btn.disabled) return;
    showPage(btn.dataset.route);
    render();
  });
}

/* =====================
   AUTH (✅ FIXED login)
===================== */

async function createAccount() {
  const u = (authUser?.value || "").trim();
  const p = (authPass?.value || "").trim();

  if (!u || u.length < 3) return openAuth("Username must be at least 3 characters.");
  if (!p || p.length < 4) return openAuth("Password must be at least 4 characters.");

  const accounts = loadAccounts();
  if (accounts[u]) return openAuth("That username already exists.");

  const passHash = await sha256Hex(p);
  accounts[u] = { passHash, createdAt: Date.now(), isAdmin: u === ADMIN_USERNAME };
  saveAccounts(accounts);

  localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u }));
  currentUser = u;

  state = load();
  addLog(`👤 Logged in as ${u}`);
  closeAuth();
  render();
}

async function login() {
  const u = (authUser?.value || "").trim();
  const p = (authPass?.value || "").trim();
  if (!u || !p) return openAuth("Enter username + password.");

  const accounts = loadAccounts();
  const rec = accounts[u];
  if (!rec) return openAuth("No account found. Create one first.");

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
  openAuth("Logged out. Log in to continue.");
}

/* =====================
   CLICK HANDLER
   ✅ FIXED:
     - buyGem works for everyone
     - admin actions gated correctly
     - hardReset uses correct per-account key
===================== */

document.body.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const a = btn.dataset.action;

  // AUTH
  if (a === "login") { login(); return; }
  if (a === "createAccount") { createAccount(); return; }
  if (a === "logout") { logout(); return; }

  // QUICK USE
  if (a === "openQuickUse") { openQuickUse(btn.dataset.kind); return; }
  if (a === "closeQuickUse") { closeQuickUse(); return; }
  if (a === "quickUseItem") { quickUseItem(btn.dataset.item); save(); render(); return; }

  // Profile sub views
  if (a === "openProfileView") { openProfileView(btn.dataset.view); save(); render(); return; }

  // Actions
  if (a === "doCrime") doCrime(btn.dataset.crime);
  if (a === "doFight") doFight(btn.dataset.kind, btn.dataset.fight);
  if (a === "doGym") doGym(btn.dataset.stat);
  if (a === "doMission") doMission(btn.dataset.mission);

  // Shop / inventory
  if (a === "buyShop") buyShopItem(btn.dataset.kind, btn.dataset.item);
  if (a === "useInv") invUse(btn.dataset.item);

  // Gems shop (everyone)
  if (a === "buyGem") buyGemItem(btn.dataset.item);

  // Arms / BM
  if (a === "buyArms") buyArms(btn.dataset.kind, btn.dataset.item);
  if (a === "buyBM") buyBlackMarketOffer();

  // Gear equip
  if (a === "equipWeapon") equipWeaponByIndex(+btn.dataset.idx);
  if (a === "equipArmor") equipArmorByIndex(+btn.dataset.idx);

  // Properties
  if (a === "buyProperty") buyProperty(btn.dataset.prop);
  if (a === "upgradeProperty") upgradeProperty(btn.dataset.prop);

  // Reset save (per-account)
  if (a === "hardReset" && confirm("Reset all progress?")) {
    localStorage.removeItem(getSaveKey());
    location.reload();
    return;
  }

  // Admin-only actions
  if (a === "adminMoney" || a === "adminXP" || a === "adminRefill" || a === "adminClearJail" || a === "adminGems") {
    if (!isAdmin()) return;
    if (a === "adminMoney") adminAddMoney();
    if (a === "adminXP") adminAddXP();
    if (a === "adminRefill") adminRefill();
    if (a === "adminClearJail") adminClearJail();
    if (a === "adminGems") adminAddGems();
  }

  save();
  render();
});

/* =====================
   MAIN RENDER LOOP
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
