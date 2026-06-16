const KEY        = 'papirici_settings_v2'; // bumped — old key had excludeAI:true for many users
const LEGACY_KEY = 'papirici_settings';

const DEFAULTS = {
  names:     { pink: 'Her', blue: 'Him' },
  excludeAI: false,
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return { ...DEFAULTS, ...JSON.parse(raw) };
    // First load after key bump: carry names forward, reset excludeAI to false
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
    return { ...DEFAULTS, names: { ...DEFAULTS.names, ...(legacy.names || {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const current = getSettings();
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}

export function getNames()     { return getSettings().names; }
export function getExcludeAI() { return getSettings().excludeAI; }
