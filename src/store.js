const KEY = 'papirici_v1';
const SEEDED_KEY = 'papirici_seeded';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function save(missions) {
  localStorage.setItem(KEY, JSON.stringify(missions));
}

export function seedDefaults(list) {
  if (localStorage.getItem(SEEDED_KEY)) return;
  const missions = load();
  if (missions.length === 0) {
    const seeded = list.map(m => ({
      id: Math.random(),
      text: m.text,
      color: m.color,
      aiGenerated: true,
      drawnAt: null,
    }));
    save(seeded);
  }
  localStorage.setItem(SEEDED_KEY, '1');
}

export function addMission(text, color) {
  const missions = load();
  missions.push({ id: Date.now() + Math.random(), text: text.trim(), color, aiGenerated: false, drawnAt: null });
  save(missions);
}

export function drawMission(playerColor, excludeAI = false) {
  const missions = load();
  let pool = missions.filter(m => !m.drawnAt && (m.color === playerColor || m.color === 'white'));
  if (excludeAI) pool = pool.filter(m => !m.aiGenerated);
  if (!pool.length) return null;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  missions.find(m => m.id === picked.id).drawnAt = Date.now();
  save(missions);
  return picked;
}

export function getCounts(excludeAI = false) {
  let avail = load().filter(m => !m.drawnAt);
  if (excludeAI) avail = avail.filter(m => !m.aiGenerated);
  return {
    blue:  avail.filter(m => m.color === 'blue').length,
    pink:  avail.filter(m => m.color === 'pink').length,
    white: avail.filter(m => m.color === 'white').length,
  };
}
