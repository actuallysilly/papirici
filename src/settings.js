const KEY = 'papirici_settings';

const DEFAULTS = {
  names: { pink: 'Her', blue: 'Him' },
  excludeAI: false,
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
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
