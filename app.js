/* =========================================================
   Underworld – Mafia Wars–style Web Game
   app.js (PART 1 of 2)
   Compatible with provided index.html + styles.css
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

const REGEN_INTERVAL = 5 * MS.MIN;
const BLACK_MARKET_REFRESH = 45 * MS.MIN;
const PROPERTY_OFFLINE_CAP = 4 * MS.HOUR;

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
      weapon: null,
      armor: null,
    },
    properties: {},
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

  s.player.energy = clamp(s.player.energy, 0, s.player.maxEnergy);
  s.player.health = clamp(s.player.health, 0, s.player.maxHealth);
  s.player.money = Math.max(0, s.player.money);
  s.player.level = Math.max(1, s.player.level);

  return s;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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

if (!state.player.specialization) {
  gate.hidden = false;
}

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

  xpText.textContent = `${state.player.xp} / ${state.player.level * 100}`;
  xpBar.style.width = `${(state.player.xp / (state.player.level * 100)) * 100}%`;

  energyText.textContent = `${state.player.energy}/${state.player.maxEnergy}`;
  energyBar.style.width =
    (state.player.energy / state.player.maxEnergy) * 100 + "%";

  healthText.textContent = `${state.player.health}/${state.player.maxHealth}`;
  healthBar.style.width =
    (state.player.health / state.player.maxHealth) * 100 + "%";

  statLevel.textContent = state.player.level;
  statAtk.textContent = state.player.attack;
  statDef.textContent = state.player.defense;
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
   MAIN RENDER LOOP
===================== */

function render() {
  applyRegen();
  updateTitle();
  renderHUD();
  renderProfile();

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

/* =====================
   END PART 2
===================== */

