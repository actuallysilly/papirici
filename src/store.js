const KEY = 'papirici_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function save(missions) {
  localStorage.setItem(KEY, JSON.stringify(missions));
}

export function addMission(text, color) {
  const missions = load();
  missions.push({ id: Date.now() + Math.random(), text: text.trim(), color, drawnAt: null });
  save(missions);
}

export function drawMission(playerColor) {
  const missions = load();
  const pool = missions.filter(m => !m.drawnAt && (m.color === playerColor || m.color === 'white'));
  if (!pool.length) return null;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  missions.find(m => m.id === picked.id).drawnAt = Date.now();
  save(missions);
  return picked;
}

export function getCounts() {
  const avail = load().filter(m => !m.drawnAt);
  return {
    blue:  avail.filter(m => m.color === 'blue').length,
    pink:  avail.filter(m => m.color === 'pink').length,
    white: avail.filter(m => m.color === 'white').length,
  };
}
