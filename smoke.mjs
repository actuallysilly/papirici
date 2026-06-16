import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

// ── Simulate the exact broken state the real user had ──────────────────────
// papirici_seeded = '1'  → old flag that prevented re-seeding
// papirici_v1 = empty   → missions never actually got seeded
// papirici_settings     → excludeAI:true (old poisoned key)
await page.goto('http://localhost:7342/', { waitUntil: 'load', timeout: 30000 });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('papirici_seeded', '1');
  localStorage.setItem('papirici_settings', JSON.stringify({ names:{ pink:'Ana', blue:'Marko' }, excludeAI: true }));
  // papirici_v1 intentionally NOT set
});
await page.reload({ waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'ss_01_player_select.png' });

// Speed up GSAP
await page.evaluate(() => { if (window.gsap) gsap.globalTimeline.timeScale(60); });

await page.click('.player-btn.pink');
await page.waitForTimeout(600);
const counts = {
  blue:  await page.textContent('#num-blue'),
  white: await page.textContent('#num-white'),
  pink:  await page.textContent('#num-pink'),
};
console.log('Counts (poisoned state):', counts);
if (counts.blue === '0' && counts.white === '0' && counts.pink === '0') {
  console.error('FAIL: all counts are 0 — seeding did not recover');
  process.exit(1);
}
await page.screenshot({ path: 'ss_02_main.png' });

// Draw
await page.click('#btn-draw');
await page.waitForSelector('#modal-reveal.open', { timeout: 12000 });
await page.screenshot({ path: 'ss_03_reveal.png' });

await page.click('#modal-reveal .btn-primary');
await page.waitForTimeout(400);
await page.screenshot({ path: 'ss_04_after_reveal.png' });

// Settings
await page.click('.icon-btn');
await page.waitForSelector('#modal-settings.open');
await page.fill('#name-pink', 'Ana');
await page.fill('#name-blue', 'Marko');
await page.click('#toggle-ai');
await page.screenshot({ path: 'ss_05_settings.png' });
await page.click('#modal-settings .btn-primary');
await page.waitForTimeout(300);

const pinkLbl = await page.textContent('#label-pink');
const blueLbl = await page.textContent('#label-blue');
console.log(`Names → pink:"${pinkLbl}" blue:"${blueLbl}"`);
await page.screenshot({ path: 'ss_06_named.png' });

// Add a custom mission
await page.click('.btn-secondary');
await page.waitForSelector('#modal-add.open');
await page.fill('#mission-text', 'Go to the cinema and share popcorn');
await page.click('.chip.pink-chip');
await page.screenshot({ path: 'ss_07_add.png' });
await page.click('#modal-add .btn-primary');
await page.waitForTimeout(300);

if (errors.length) { console.error('JS ERRORS:\n', errors.join('\n')); process.exit(1); }
console.log('✓ All OK');
await browser.close();
