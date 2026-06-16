import { initScene, animateDraw, closeLid } from './scene.js';
import { addMission, drawMission, getCounts } from './store.js';

// ── State ──────────────────────────────────────────────────────
let currentPlayer  = null;
let selectedColor  = 'white';
let typeTimer      = null;

// ── Boot ───────────────────────────────────────────────────────
initScene(document.getElementById('canvas'));

document.getElementById('mission-text').addEventListener('input', e => {
  document.getElementById('char-count').textContent = e.target.value.length;
});

// ── Public API (called from HTML onclick) ──────────────────────
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
    const mission = drawMission(currentPlayer);
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
    closeLid();
  },

  closeEmpty() { closeModal('modal-empty'); },
};

// ── UI Helpers ─────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function updatePlayerBadge() {
  const el = document.getElementById('player-indicator');
  if (currentPlayer === 'pink') {
    el.className = 'pink';
    el.textContent = '🌸 Her';
  } else {
    el.className = 'blue';
    el.textContent = '💙 Him';
  }
}

function updateCounts() {
  const { blue, pink, white } = getCounts();
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

function showReveal(mission) {
  const sheet = document.getElementById('paper-sheet');
  sheet.className = 'paper-sheet ' + mission.color + '-paper';

  const labels = { blue: '💙 His mission', pink: '💗 Her mission', white: '🤍 Shared mission' };
  document.getElementById('reveal-label').textContent = labels[mission.color] ?? '';

  const textEl = document.getElementById('reveal-text');
  textEl.textContent = '';
  textEl.classList.remove('done');

  // Force reflow so the unfold animation restarts
  void sheet.offsetWidth;

  openModal('modal-reveal');

  clearInterval(typeTimer);
  let i = 0;
  typeTimer = setInterval(() => {
    if (i < mission.text.length) {
      textEl.textContent += mission.text[i++];
    } else {
      clearInterval(typeTimer);
      textEl.classList.add('done');
    }
  }, 38);
}
