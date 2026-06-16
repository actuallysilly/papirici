import { initScene, animateDraw, closeLid } from './scene.js';
import { addMission, drawMission, getCounts, seedDefaults } from './store.js';
import { getSettings, saveSettings, getNames, getExcludeAI } from './settings.js';
import { defaultMissions } from './defaults.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
seedDefaults(defaultMissions);
initScene(document.getElementById('canvas'));

// ── State ─────────────────────────────────────────────────────────────────────
let currentPlayer  = null;
let selectedColor  = 'white';
let typeTimer      = null;
let pendingAI      = false; // temp toggle state inside settings modal

// Char counter
document.getElementById('mission-text').addEventListener('input', e => {
  document.getElementById('char-count').textContent = e.target.value.length;
});

// Apply saved names on load
refreshNames();

// ── Public API (called from HTML onclick) ─────────────────────────────────────
window.app = {

  selectPlayer(player) {
    currentPlayer = player;
    updatePlayerBadge();
    updateCounts();
    showScreen('main');
  },

  switchPlayer() {
    currentPlayer = currentPlayer === 'pink' ? 'blue' : 'pink';
    updatePlayerBadge();
    updateCounts();
  },

  draw() {
    if (!currentPlayer) return;
    const mission = drawMission(currentPlayer, getExcludeAI());
    if (!mission) { openModal('modal-empty'); return; }
    updateCounts();
    animateDraw(mission.color, () => showReveal(mission));
  },

  openAddModal() {
    setColor('white');
    document.getElementById('mission-text').value = '';
    document.getElementById('char-count').textContent = '0';
    openModal('modal-add');
    setTimeout(() => document.getElementById('mission-text').focus(), 340);
  },
  closeAddModal() { closeModal('modal-add'); },

  selectColor(color) { setColor(color); },

  submitMission() {
    const text = document.getElementById('mission-text').value.trim();
    if (!text) { document.getElementById('mission-text').focus(); return; }
    addMission(text, selectedColor);
    closeModal('modal-add');
    updateCounts();
  },

  closeReveal() {
    closeModal('modal-reveal');
    clearInterval(typeTimer);
    document.getElementById('reveal-text').classList.remove('done');
    document.getElementById('paper-sheet').classList.remove('shimmer');
    closeLid();
  },

  closeEmpty() { closeModal('modal-empty'); },

  // ── Settings ──────────────────────────────────────────────────────────────
  openSettings() {
    const s = getSettings();
    document.getElementById('name-pink').value = s.names.pink || '';
    document.getElementById('name-blue').value = s.names.blue || '';
    pendingAI = s.excludeAI;
    applyToggleUI(pendingAI);
    openModal('modal-settings');
  },

  closeSettings() { closeModal('modal-settings'); },

  toggleAI() {
    pendingAI = !pendingAI;
    applyToggleUI(pendingAI);
  },

  saveSettings() {
    const namePink = document.getElementById('name-pink').value.trim() || 'Her';
    const nameBlue = document.getElementById('name-blue').value.trim() || 'Him';
    saveSettings({ names: { pink: namePink, blue: nameBlue }, excludeAI: pendingAI });
    closeModal('modal-settings');
    refreshNames();
    updatePlayerBadge();
    updateCounts();
  },
};

// ── UI Helpers ────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.getElementById('ui').classList.add('modal-active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.modal.open')) {
    document.getElementById('ui').classList.remove('modal-active');
  }
}

function updatePlayerBadge() {
  const el = document.getElementById('player-indicator');
  const names = getNames();
  if (currentPlayer === 'pink') {
    el.className = 'pink';
    el.textContent = '🌸 ' + names.pink;
  } else {
    el.className = 'blue';
    el.textContent = '💙 ' + names.blue;
  }
}

function updateCounts() {
  const { blue, pink, white } = getCounts(getExcludeAI());
  document.getElementById('num-blue').textContent  = blue;
  document.getElementById('num-pink').textContent  = pink;
  document.getElementById('num-white').textContent = white;

  const canDraw = currentPlayer === 'blue' ? (blue + white > 0) : (pink + white > 0);
  document.getElementById('btn-draw').disabled = !canDraw;
}

function setColor(color) {
  selectedColor = color;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.color === color);
  });
}

function refreshNames() {
  const names = getNames();
  document.getElementById('label-pink').textContent = names.pink;
  document.getElementById('label-blue').textContent = names.blue;
  document.getElementById('chip-pink').textContent  = names.pink;
  document.getElementById('chip-blue').textContent  = names.blue;
}

function applyToggleUI(on) {
  document.getElementById('toggle-ai').classList.toggle('on', on);
}

function showReveal(mission) {
  const sheet  = document.getElementById('paper-sheet');
  const textEl = document.getElementById('reveal-text');

  sheet.className = 'paper-sheet ' + mission.color + '-paper';
  sheet.classList.remove('shimmer');

  const names = getNames();
  document.getElementById('reveal-label').textContent = {
    blue:  '💙 ' + names.blue  + "'s mission",
    pink:  '💗 ' + names.pink  + "'s mission",
    white: '🤍 Shared mission',
  }[mission.color] ?? '';

  textEl.textContent = '';
  textEl.classList.remove('done');

  openModal('modal-reveal');

  // ── GSAP paper unfold ─────────────────────────────────────────────────────
  gsap.killTweensOf(sheet);
  gsap.set(sheet, {
    transformPerspective: 700,
    transformOrigin: '50% 0%',
    rotateX: -115,
    scaleY: 0.06,
    opacity: 0,
  });

  gsap.timeline({ onComplete: startTypewriter.bind(null, mission.text) })
    // Phase 1 – spring open from folded
    .to(sheet, { opacity: 1, duration: 0.12, ease: 'none' })
    .to(sheet, { rotateX: 10, scaleY: 1.04, duration: 0.40, ease: 'power3.out' }, 0)
    // Phase 2 – overshoot bounce
    .to(sheet, { rotateX: -5, scaleY: 0.98, duration: 0.14, ease: 'power1.in' })
    .to(sheet, { rotateX: 2,  scaleY: 1.01, duration: 0.10, ease: 'power1.out' })
    // Phase 3 – settle flat
    .to(sheet, { rotateX: 0, scaleY: 1, duration: 0.10, ease: 'power2.out' })
    // Phase 4 – shine sweep
    .call(() => sheet.classList.add('shimmer'));
}

function startTypewriter(text) {
  const textEl = document.getElementById('reveal-text');
  clearInterval(typeTimer);
  let i = 0;
  typeTimer = setInterval(() => {
    if (i < text.length) {
      textEl.textContent += text[i++];
    } else {
      clearInterval(typeTimer);
      textEl.classList.add('done');
    }
  }, 36);
}
