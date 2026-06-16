import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto('http://localhost:7342/', { waitUntil: 'load', timeout: 30000 });
// Give Three.js + GSAP CDN time to finish loading
await page.waitForTimeout(5000);
await page.screenshot({ path: 'ss_01_player_select.png' });

// Speed up GSAP so animations finish instantly in headless
await page.evaluate(() => { if (window.gsap) gsap.globalTimeline.timeScale(60); });

await page.click('.player-btn.pink');
await page.waitForTimeout(600);
const counts = {
  blue:  await page.textContent('#num-blue'),
  white: await page.textContent('#num-white'),
  pink:  await page.textContent('#num-pink'),
};
console.log('Counts:', counts);
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
