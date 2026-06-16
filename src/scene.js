import * as THREE from 'three';

const COLOR_HEX = { blue: 0x99c4ff, pink: 0xffb6c1, white: 0xf0eaff };

let renderer, scene, camera, clock;
let boxGroup, lidGroup;
let decorPapers = [];
let particles, particleVel;
let isAnimating = false;

export function initScene(canvas) {
  clock = new THREE.Clock();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07050f, 0.025);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.2, 7.5);
  camera.lookAt(0, -0.2, 0);

  buildLights();
  buildBox();
  buildGround();
  buildParticles();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  loop();
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0x6633aa, 2.5));

  const pink = new THREE.PointLight(0xff55aa, 12, 18);
  pink.position.set(-3.5, 3, 2.5);
  pink.castShadow = true;
  scene.add(pink);

  const blue = new THREE.PointLight(0x55aaff, 12, 18);
  blue.position.set(3.5, 3, 2.5);
  blue.castShadow = true;
  scene.add(blue);

  // Front-fill light so the box face is clearly lit
  const front = new THREE.PointLight(0xfff0e8, 8, 12);
  front.position.set(0, 1.5, 5);
  scene.add(front);

  const spot = new THREE.SpotLight(0xfff8e8, 5, 18, Math.PI / 8, 0.4);
  spot.position.set(0, 8, 2);
  spot.castShadow = true;
  spot.shadow.mapSize.setScalar(1024);
  scene.add(spot);
  scene.add(spot.target);
}

function buildBox() {
  boxGroup = new THREE.Group();
  boxGroup.position.set(0, -0.5, 0);
  scene.add(boxGroup);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa01830, roughness: 0.55, metalness: 0.12 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.2), bodyMat);
  base.castShadow = true;
  base.receiveShadow = true;
  boxGroup.add(base);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc89020,
    roughness: 0.18,
    metalness: 0.7,
    emissive: 0x3a2200,
    emissiveIntensity: 0.4,
  });

  // Ribbons on base (cross pattern)
  const rH = new THREE.Mesh(new THREE.BoxGeometry(2.26, 1.54, 0.1), goldMat);
  boxGroup.add(rH);
  const rV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.54, 2.26), goldMat);
  boxGroup.add(rV);

  // Lid group — pivot at back edge so it opens like a real box lid
  lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.83, -1.12);
  boxGroup.add(lidGroup);

  const lidMat = new THREE.MeshStandardMaterial({ color: 0xb01e36, roughness: 0.55, metalness: 0.12 });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.13, 2.26), lidMat);
  lid.position.set(0, 0.065, 1.12);
  lid.castShadow = true;
  lidGroup.add(lid);

  const rLH = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.15, 0.1), goldMat);
  rLH.position.set(0, 0.14, 1.12);
  lidGroup.add(rLH);

  const rLV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 2.3), goldMat);
  rLV.position.set(0, 0.14, 1.12);
  lidGroup.add(rLV);

  // Bow loops
  const bowMat = new THREE.MeshStandardMaterial({
    color: 0xf0bf28,
    roughness: 0.12,
    metalness: 0.75,
    emissive: 0x402a00,
    emissiveIntensity: 0.5,
  });

  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.042, 10, 22, Math.PI), bowMat);
    loop.rotation.set(0, 0, s * 0.48);
    loop.position.set(s * 0.16, 0.29, 1.12);
    loop.castShadow = true;
    lidGroup.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), bowMat);
  knot.position.set(0, 0.24, 1.12);
  knot.castShadow = true;
  lidGroup.add(knot);

  // Decorative papers peeking out of the box
  const peeks = [
    { color: 'blue',  x: -0.42, z:  0.1,  rz:  0.18 },
    { color: 'white', x:  0.04, z: -0.18, rz: -0.08 },
    { color: 'pink',  x:  0.44, z:  0.14, rz:  0.22 },
  ];

  decorPapers = [];
  peeks.forEach(({ color, x, z, rz }) => {
    const mat = new THREE.MeshStandardMaterial({ color: COLOR_HEX[color], roughness: 0.88, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.56), mat);
    mesh.position.set(x, 0.89, z);
    mesh.rotation.z = rz;
    mesh.userData.baseY = 0.89;
    decorPapers.push(mesh);
    boxGroup.add(mesh);
  });
}

function buildGround() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x080510, roughness: 1 });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat);
  g.rotation.x = -Math.PI / 2;
  g.position.y = -1.28;
  g.receiveShadow = true;
  scene.add(g);
}

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
    particleVel[i3 + 1] = Math.random() * 0.0045 + 0.001;
    particleVel[i3 + 2] = (Math.random() - 0.5) * 0.002;

    if      (i % 3 === 0) { col[i3] = 1.0; col[i3+1] = 0.35; col[i3+2] = 0.6;  } // pink
    else if (i % 3 === 1) { col[i3] = 0.3; col[i3+1] = 0.55; col[i3+2] = 1.0;  } // blue
    else                  { col[i3] = 0.9; col[i3+1] = 0.85; col[i3+2] = 1.0;  } // white
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

  particles = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.055,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  scene.add(particles);
}

let t = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = clock.getDelta();
  t += dt;

  if (!isAnimating) {
    boxGroup.position.y = -0.5 + Math.sin(t * 0.75) * 0.065;
    boxGroup.rotation.y = Math.sin(t * 0.28) * 0.04;
    decorPapers.forEach((p, i) => {
      p.position.y = p.userData.baseY + Math.sin(t * 0.9 + i * 1.5) * 0.04;
    });
  }

  // Drift particles
  const pos = particles.geometry.attributes.position;
  const arr = pos.array;
  for (let i = 0; i < pos.count; i++) {
    const i3 = i * 3;
    arr[i3]     += particleVel[i3];
    arr[i3 + 1] += particleVel[i3 + 1];
    arr[i3 + 2] += particleVel[i3 + 2];
    if (arr[i3 + 1] > 11) arr[i3 + 1] = -4;
    if (arr[i3] >  14)    arr[i3] = -14;
    if (arr[i3] < -14)    arr[i3] =  14;
  }
  pos.needsUpdate = true;

  renderer.render(scene, camera);
}

// ── Draw Animation ──────────────────────────────────────
export function animateDraw(missionColor, onReveal) {
  if (isAnimating) return;
  isAnimating = true;

  // Flying paper — created in world space at box top
  const flyMat = new THREE.MeshStandardMaterial({
    color: COLOR_HEX[missionColor] ?? 0xffffff,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const flyPaper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.025), flyMat);
  flyPaper.position.set(0, 0.62, 0);
  scene.add(flyPaper);

  // Confetti burst mesh
  const confettiCount = 120;
  const cGeo = new THREE.BufferGeometry();
  const cPos = new Float32Array(confettiCount * 3);
  const cCol = new Float32Array(confettiCount * 3);
  const cVel = [];
  for (let i = 0; i < confettiCount; i++) {
    const i3 = i * 3;
    cPos[i3] = 0; cPos[i3+1] = 0.62; cPos[i3+2] = 0;
    cVel.push(
      (Math.random() - 0.5) * 0.12,
      Math.random() * 0.1 + 0.04,
      (Math.random() - 0.5) * 0.12
    );
    if (i % 2 === 0) { cCol[i3] = 1; cCol[i3+1] = 0.4; cCol[i3+2] = 0.6; }
    else             { cCol[i3] = 0.4; cCol[i3+1] = 0.6; cCol[i3+2] = 1; }
  }
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  const confetti = new THREE.Points(cGeo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(confetti);

  let confettiActive = false;
  let confettiAge = 0;

  const burstTick = () => {
    if (!confettiActive) return;
    confettiAge += 0.016;
    const cp = confetti.geometry.attributes.position.array;
    for (let i = 0; i < confettiCount; i++) {
      const i3 = i * 3;
      cp[i3]     += cVel[i3];
      cp[i3 + 1] += cVel[i3 + 1] - confettiAge * 0.006;
      cp[i3 + 2] += cVel[i3 + 2];
    }
    confetti.geometry.attributes.position.needsUpdate = true;
    confetti.material.opacity = Math.max(0, 1 - confettiAge * 0.7);
  };

  gsap.ticker.add(burstTick);

  const tl = gsap.timeline({
    onComplete: () => {
      isAnimating = false;
      gsap.ticker.remove(burstTick);
      scene.remove(confetti);
    },
  });

  // 1. Shake
  tl.to(boxGroup.rotation, { z:  0.08, duration: 0.065, ease: 'none' })
    .to(boxGroup.rotation, { z: -0.08, duration: 0.065, ease: 'none' })
    .to(boxGroup.rotation, { z:  0.07, duration: 0.065, ease: 'none' })
    .to(boxGroup.rotation, { z: -0.07, duration: 0.065, ease: 'none' })
    .to(boxGroup.rotation, { z:  0.05, duration: 0.06,  ease: 'none' })
    .to(boxGroup.rotation, { z:  0,    duration: 0.08,  ease: 'none' });

  // 2. Box hop
  tl.to(boxGroup.position, { y: -0.28, duration: 0.15, ease: 'power2.out' }, '-=0.05')
    .to(boxGroup.position, { y: -0.50, duration: 0.22, ease: 'bounce.out' });

  // 3. Lid swings open
  tl.to(lidGroup.rotation, { x: -Math.PI * 0.8, duration: 0.55, ease: 'back.out(1.3)' }, '+=0.1');

  // 4. Paper rises
  tl.to(flyPaper.position, { y: 2.8, duration: 0.42, ease: 'power2.out' }, '+=0.18')
    .to(flyPaper.rotation, { z: Math.PI * 2, y: Math.PI * 1.5, duration: 0.75, ease: 'power1.inOut' }, '-=0.35')
    .to(flyPaper.position, { z: 2.5, x: 0, y: 2.0, duration: 0.38, ease: 'power2.inOut' }, '-=0.25')
    .to(flyPaper.scale,    { x: 2.6, y: 2.6,        duration: 0.32, ease: 'power2.out' }, '-=0.2');

  // 5. Confetti burst + paper vanishes
  tl.call(() => {
    confettiActive = true;
    confetti.material.opacity = 1;
  })
    .to(flyPaper.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.22, ease: 'power2.in' })
    .call(() => {
      scene.remove(flyPaper);
      if (onReveal) onReveal();
    });
}

// Called when reveal modal is closed
export function closeLid() {
  gsap.to(lidGroup.rotation, { x: 0, duration: 0.62, ease: 'back.in(1.5)' });
}
