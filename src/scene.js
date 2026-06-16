import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COLOR_HEX = { blue: 0x99c4ff, pink: 0xffb6c1, white: 0xf0eaff };

// ── Minecraft block dimensions ────────────────────────────────────────────────
const SIZE = 2.4;          // cube side length
const HALF = SIZE / 2;     // 1.2
const B    = 0.10;         // frame-bar thickness (Minecraft border)
const LID_Y = HALF;        // lid resting y in jarGroup local space

let renderer, scene, camera, clock;
let jarGroup, lidGroup;
let decorPapers = [];
let particles, particleVel;
let isAnimating = false;

// Rotation state
let isDragging = false;
let prevMouseX = 0;
let rotVelY    = 0.003;

export function initScene(canvas) {
  clock = new THREE.Clock();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07050f, 0.016);

  // Environment map → beautiful reflections on glass faces
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.4, 8.5);
  camera.lookAt(0, 0.2, 0);

  buildLights();
  buildBlock();
  buildGround();
  buildParticles();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Mouse / Touch rotation ──────────────────────────────────────────────────
  canvas.addEventListener('mousedown', e => { isDragging = true; prevMouseX = e.clientX; rotVelY = 0; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const d = e.clientX - prevMouseX;
    prevMouseX = e.clientX;
    rotVelY = d * 0.009;
    jarGroup.rotation.y += rotVelY;
  });
  canvas.addEventListener('mouseup',    () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  canvas.addEventListener('touchstart', e => {
    isDragging = true; prevMouseX = e.touches[0].clientX; rotVelY = 0;
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const d = e.touches[0].clientX - prevMouseX;
    prevMouseX = e.touches[0].clientX;
    rotVelY = d * 0.009;
    jarGroup.rotation.y += rotVelY;
  }, { passive: true });
  canvas.addEventListener('touchend', () => { isDragging = false; });

  loop();
}

// ── Lights ──────────────────────────────────────────────────────────────────
function buildLights() {
  scene.add(new THREE.AmbientLight(0x6633aa, 2));

  const pink = new THREE.PointLight(0xff55aa, 10, 18);
  pink.position.set(-4, 3.5, 2.5);
  pink.castShadow = true;
  scene.add(pink);

  const blue = new THREE.PointLight(0x55aaff, 10, 18);
  blue.position.set(4, 3.5, 2.5);
  blue.castShadow = true;
  scene.add(blue);

  const front = new THREE.PointLight(0xfff0e8, 7, 12);
  front.position.set(0, 1, 5);
  scene.add(front);

  const spot = new THREE.SpotLight(0xfff8e8, 4, 20, Math.PI / 9, 0.4);
  spot.position.set(0, 9, 2);
  spot.castShadow = true;
  spot.shadow.mapSize.setScalar(1024);
  scene.add(spot);
  scene.add(spot.target);
}

// ── Minecraft Glass Block ────────────────────────────────────────────────────
function buildBlock() {
  jarGroup = new THREE.Group();
  jarGroup.position.set(0, 0.2, 0);
  scene.add(jarGroup);

  // Glass face material — classic Minecraft glass tint
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x78cce0,
    emissive: 0x002233,
    emissiveIntensity: 0.06,
    metalness: 0,
    roughness: 0.0,
    transmission: 0.90,
    thickness: 0.35,
    ior: 1.5,
    transparent: true,
    opacity: 0.70,
    side: THREE.FrontSide,
    envMapIntensity: 2.5,
    attenuationColor: new THREE.Color(0x55aabb),
    attenuationDistance: 1.8,
  });

  // Inner surface gives depth/fill
  const innerMat = glassMat.clone();
  innerMat.side = THREE.BackSide;
  innerMat.opacity = 0.22;
  innerMat.transmission = 0.4;
  innerMat.emissiveIntensity = 0;

  // ─── Main glass cube body ────────────────────────────────────────────────
  const cubeGeo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
  const cube = new THREE.Mesh(cubeGeo, glassMat);
  cube.castShadow = true;
  cube.renderOrder = 1;
  jarGroup.add(cube);

  const inner = new THREE.Mesh(cubeGeo, innerMat);
  inner.renderOrder = 0;
  jarGroup.add(inner);

  // ─── Edge frame bars (12 edges, Minecraft border look) ───────────────────
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0b1a24,
    roughness: 0.55,
    metalness: 0.05,
    envMapIntensity: 0.4,
  });

  // Helper: add one bar
  const bar = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    m.position.set(x, y, z);
    jarGroup.add(m);
  };

  // 4 vertical bars (Y-axis) at four X-Z corners
  for (const [x, z] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
    bar(B, SIZE, B, x, 0, z);
  }
  // 4 bottom horizontal bars — X direction (front/back edge at bottom)
  for (const z of [-HALF, HALF]) bar(SIZE - B * 2, B, B, 0, -HALF, z);
  // 4 bottom horizontal bars — Z direction (left/right edge at bottom)
  for (const x of [-HALF, HALF]) bar(B, B, SIZE - B * 2, x, -HALF, 0);

  // ─── Lid group ───────────────────────────────────────────────────────────
  lidGroup = new THREE.Group();
  lidGroup.position.set(0, LID_Y, 0);
  jarGroup.add(lidGroup);

  // Lid glass face (horizontal plane)
  const lidFace = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), glassMat.clone());
  lidFace.rotation.x = -Math.PI / 2;
  lidFace.renderOrder = 2;
  lidGroup.add(lidFace);

  // Lid top edge bars — X and Z direction (the top border of the block)
  for (const z of [-HALF, HALF]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(SIZE - B * 2, B, B), frameMat.clone());
    b.position.set(0, 0, z);
    lidGroup.add(b);
  }
  for (const x of [-HALF, HALF]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(B, B, SIZE - B * 2), frameMat.clone());
    b.position.set(x, 0, 0);
    lidGroup.add(b);
  }
  // Corner caps (where lid bars meet vertical bars)
  for (const [x, z] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(B, B, B), frameMat.clone());
    b.position.set(x, 0, z);
    lidGroup.add(b);
  }

  // ─── Papers inside the cube ───────────────────────────────────────────────
  buildPapersInJar();
}

function buildPapersInJar() {
  const configs = [
    { color: 'pink',  x:  0.20, y: -0.40, z:  0.25, ry:  0.5,  rz:  0.28, sx: 0.55, sy: 0.70 },
    { color: 'blue',  x: -0.28, y: -0.62, z: -0.10, ry: -0.4,  rz: -0.22, sx: 0.52, sy: 0.68 },
    { color: 'white', x:  0.05, y:  0.08, z:  0.20, ry:  0.2,  rz:  0.18, sx: 0.50, sy: 0.65 },
    { color: 'blue',  x:  0.30, y:  0.50, z: -0.18, ry:  0.8,  rz:  0.30, sx: 0.52, sy: 0.70 },
    { color: 'pink',  x: -0.28, y:  0.28, z:  0.12, ry: -0.6,  rz: -0.26, sx: 0.53, sy: 0.68 },
    { color: 'white', x: -0.08, y: -0.78, z: -0.08, ry:  0.1,  rz:  0.10, sx: 0.50, sy: 0.65 },
  ];

  decorPapers = [];
  configs.forEach(cfg => {
    const mat = new THREE.MeshStandardMaterial({
      color: COLOR_HEX[cfg.color],
      roughness: 0.88,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.sx, cfg.sy), mat);
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    mesh.rotation.set(0, cfg.ry, cfg.rz);
    mesh.userData.baseY  = cfg.y;
    mesh.userData.baseRZ = cfg.rz;
    decorPapers.push(mesh);
    jarGroup.add(mesh);
  });
}

// ── Ground ───────────────────────────────────────────────────────────────────
function buildGround() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x080510, roughness: 1 });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat);
  g.rotation.x = -Math.PI / 2;
  g.position.y = -2.0;
  g.receiveShadow = true;
  scene.add(g);
}

// ── Particles ─────────────────────────────────────────────────────────────────
function buildParticles() {
  const N = 280;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  particleVel = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    pos[i3]     = (Math.random() - 0.5) * 24;
    pos[i3 + 1] = (Math.random() - 0.5) * 14 + 3;
    pos[i3 + 2] = (Math.random() - 0.5) * 12 - 1;
    particleVel[i3]     = (Math.random() - 0.5) * 0.003;
    particleVel[i3 + 1] = Math.random() * 0.004 + 0.001;
    particleVel[i3 + 2] = (Math.random() - 0.5) * 0.002;
    if      (i % 3 === 0) { col[i3] = 1.0; col[i3+1] = 0.35; col[i3+2] = 0.6;  }
    else if (i % 3 === 1) { col[i3] = 0.3; col[i3+1] = 0.55; col[i3+2] = 1.0;  }
    else                  { col[i3] = 0.9; col[i3+1] = 0.85; col[i3+2] = 1.0;  }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  particles = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.055, vertexColors: true, transparent: true,
    opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(particles);
}

// ── Render Loop ───────────────────────────────────────────────────────────────
let t = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = clock.getDelta();
  t += dt;

  if (!isAnimating) {
    if (!isDragging) {
      rotVelY += (0.003 - rotVelY) * 0.015;
      jarGroup.rotation.y += rotVelY;
    } else {
      rotVelY *= 0.85;
    }
    // Gentle float
    jarGroup.position.y = 0.2 + Math.sin(t * 0.65) * 0.07;
    // Papers bob
    decorPapers.forEach((p, i) => {
      p.position.y = p.userData.baseY  + Math.sin(t * 0.8 + i * 1.3) * 0.04;
      p.rotation.z = p.userData.baseRZ + Math.sin(t * 0.5 + i * 0.9) * 0.018;
    });
  }

  const pa = particles.geometry.attributes.position.array;
  for (let i = 0; i < particles.geometry.attributes.position.count; i++) {
    const i3 = i * 3;
    pa[i3]     += particleVel[i3];
    pa[i3 + 1] += particleVel[i3 + 1];
    pa[i3 + 2] += particleVel[i3 + 2];
    if (pa[i3 + 1] > 11) pa[i3 + 1] = -4;
    if (pa[i3]  >  14)   pa[i3]  = -14;
    if (pa[i3]  < -14)   pa[i3]  =  14;
  }
  particles.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}

// ── Draw Animation ────────────────────────────────────────────────────────────
export function animateDraw(missionColor, onReveal) {
  if (isAnimating) return;
  isAnimating = true;

  const flyMat = new THREE.MeshStandardMaterial({
    color: COLOR_HEX[missionColor] ?? 0xffffff, roughness: 0.82, side: THREE.DoubleSide,
  });
  const flyPaper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.025), flyMat);
  // Start just above the block lid (world space)
  flyPaper.position.set(0, jarGroup.position.y + LID_Y, 0);
  scene.add(flyPaper);

  // Confetti
  const N = 130;
  const startY = jarGroup.position.y + LID_Y;
  const cPos = new Float32Array(N * 3);
  const cCol = new Float32Array(N * 3);
  const cVel = [];
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    cPos[i3] = 0; cPos[i3+1] = startY; cPos[i3+2] = 0;
    cVel.push((Math.random()-0.5)*0.13, Math.random()*0.11+0.04, (Math.random()-0.5)*0.13);
    if (i % 2 === 0) { cCol[i3] = 1; cCol[i3+1] = 0.4; cCol[i3+2] = 0.62; }
    else             { cCol[i3] = 0.4; cCol[i3+1] = 0.6; cCol[i3+2] = 1; }
  }
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cGeo.setAttribute('color',    new THREE.BufferAttribute(cCol, 3));
  const confetti = new THREE.Points(cGeo, new THREE.PointsMaterial({
    size: 0.075, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(confetti);

  let confettiActive = false;
  let confettiAge = 0;
  let revealed = false;

  // Safety fallback: fire onReveal even if GSAP stalls (headless/hidden tab)
  const revealTimeout = setTimeout(() => {
    if (!revealed && onReveal) { revealed = true; onReveal(); }
  }, 5000);

  const burstTick = () => {
    if (!confettiActive) return;
    confettiAge += 0.016;
    const cp = confetti.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      cp[i3]     += cVel[i3];
      cp[i3 + 1] += cVel[i3 + 1] - confettiAge * 0.007;
      cp[i3 + 2] += cVel[i3 + 2];
    }
    confetti.geometry.attributes.position.needsUpdate = true;
    confetti.material.opacity = Math.max(0, 1 - confettiAge * 0.65);
  };
  gsap.ticker.add(burstTick);

  const tl = gsap.timeline({
    onComplete: () => {
      isAnimating = false;
      gsap.ticker.remove(burstTick);
      scene.remove(confetti);
    },
  });

  // 1. Block shakes side-to-side
  tl.to(jarGroup.rotation, { z:  0.07, duration: 0.065, ease: 'none' })
    .to(jarGroup.rotation, { z: -0.07, duration: 0.065, ease: 'none' })
    .to(jarGroup.rotation, { z:  0.06, duration: 0.065, ease: 'none' })
    .to(jarGroup.rotation, { z: -0.06, duration: 0.065, ease: 'none' })
    .to(jarGroup.rotation, { z:  0,    duration: 0.08,  ease: 'none' });

  // 2. Lid lifts straight up (Minecraft block top pops off)
  tl.to(lidGroup.position, { y: LID_Y + 5, duration: 0.55, ease: 'power2.out' }, '+=0.1');

  // 3. Paper rises from inside, tumbles toward camera
  tl.to(flyPaper.position, { y: startY + 2.0, duration: 0.38, ease: 'power2.out' }, '+=0.15')
    .to(flyPaper.rotation, { z: Math.PI * 2, y: Math.PI * 1.5, duration: 0.72, ease: 'power1.inOut' }, '-=0.28')
    .to(flyPaper.position, { z: 2.5, x: 0, y: startY + 1.2, duration: 0.36, ease: 'power2.inOut' }, '-=0.22')
    .to(flyPaper.scale,    { x: 2.6, y: 2.6,                 duration: 0.28, ease: 'power2.out' },   '-=0.18')

  // 4. Burst + vanish
    .call(() => { confettiActive = true; confetti.material.opacity = 1; })
    .to(flyPaper.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.22, ease: 'power2.in' })
    .call(() => {
      scene.remove(flyPaper);
      clearTimeout(revealTimeout);
      if (!revealed) { revealed = true; if (onReveal) onReveal(); }
    });
}

// Called when the reveal modal is dismissed
export function closeLid() {
  gsap.to(lidGroup.position, { y: LID_Y, duration: 0.65, ease: 'power2.inOut' });
}
