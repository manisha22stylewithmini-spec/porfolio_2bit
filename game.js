/* Designer Quest — a tiny platformer about shipping a product.
   Run, jump, crawl and stop your way past everyday design obstacles. */
(() => {
const cv = document.getElementById('game');
if (!cv) return;
const ctx = cv.getContext('2d');
const box = document.getElementById('play');
const ov = document.getElementById('g-ov');
const card = document.getElementById('g-card');

const T = 24, ROWS = 13, H = ROWS * T, S = 3, GY = 11 * T, COLS = 150, LW = COLS * T;
const GRAV = 1800, JUMP = 640, STAND_H = 44, CRAWL_H = 22;
let W = 800, dpr = 1, Z = 1;

/* ---------- sprites (14px wide, scaled x3) ---------- */
const PAL = { k:'#1b1b1b', h:'#6b3b1f', c:'#e2476b', s:'#f4c29a', e:'#1b1b1b', m:'#d9546b', b:'#4a55e8', w:'#ffffff', p:'#2a2f4a', o:'#7a3a1c' };
const HEAD = ['.....ccccc....','....cccccccc..','...hcccccccccc','..hhhssssess..','.hhhhssssess..','.hhhhsssssss..','hhh..sssssms..','hh....ssss....'];
const BODY = ['.h..bbbbbbb...','...bbbbbbbbs..','..sbbbwbbbbs..','....bbbbbbb...'];
const BODYJ = ['.h..bbbbbbb.s.','...bbbbbbbbs..','..sbbbwbbbb...','....bbbbbbb...'];
const L0 = ['....ppppppp...','....ppp.ppp...','....ppp.ppp...','...ooo..ooo...'];
const L1 = ['....ppppppp...','...ppp..ppp...','..ppp....ppp..','.ooo......ooo.'];
const L2 = ['....ppppppp...','.....pppp.....','.....ppp......','....oooo......'];
const CRA = ['..........ccccc...','.........cccccccc.','.......hhccccccccc','.....hhhhsssssess.','...hhhhhhssssssss.','.pppbbbbbbbbbsss..','ppppbbbbbbbbbbs...'];
const CR1 = [...CRA,'oo.pppp...ss.s....','oo..pp....ss......'];
const CR2 = [...CRA,'oo.pppp....ss.s...','oo..pp.....ss.....'];
function spr(rows) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * S; c.height = rows.length * S;
  const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i * S, j * S, S, S); } }));
  return c;
}
const SP = {
  idle: spr([...HEAD, ...BODY, ...L0]), run1: spr([...HEAD, ...BODY, ...L1]), run2: spr([...HEAD, ...BODY, ...L2]),
  jump: spr([...HEAD, ...BODYJ, ...L1]), cr1: spr(CR1), cr2: spr(CR2),
};
// waving "hi" frames: the front arm is raised out beside her head and the palm flaps.
// Frames get 3px padding on both sides so the hand clears her face and stays centred.
function waveFrame(arm) {
  const rows = [...HEAD, ...BODY, ...L0].map(r => [...('...' + r + '...')]);
  const set = (r, c, ch) => { rows[r][c + 3] = ch; };
  set(9, 11, '.'); set(10, 11, '.');   // lift the resting hand
  set(6, 9, 'm'); set(6, 10, 'm');     // bigger smile
  arm.forEach(([r, c, ch]) => set(r, c, ch));
  return spr(rows.map(r => r.join('')));
}
SP.wave1 = waveFrame([[8, 11, 'b'], [7, 12, 'b'], [6, 13, 'b'], [5, 14, 's'], [4, 14, 's'], [4, 15, 's'], [3, 14, 's'], [3, 15, 's'], [2, 15, 's']]);
SP.wave2 = waveFrame([[8, 11, 'b'], [7, 12, 'b'], [6, 13, 'b'], [6, 14, 's'], [5, 15, 's'], [5, 16, 's'], [4, 15, 's'], [4, 16, 's'], [3, 16, 's']]);

const HELLO = [
  "Hey! 👋 I'm Manisha Baroliya, a Product Designer. Good wishes for your beautiful day! ✨",
  "Every obstacle ahead is one I've met at work. Let's ship this product together! 🚀",
  "Tip: hold ↓ to crawl under client feedback, and always stop at the red light. 🚦",
  "Thanks for stopping by. Take a deep breath, then let's run! 🌸",
];

/* ---------- scenery stickers (decoration only, no collision) ---------- */
const IMG = {};
['plant', 'sunflower', 'cone', 'box', 'duck', 'dog', 'lovebird', 'arcade', 'clover'].forEach(n => { const i = new Image(); i.src = `img/st/${n}.png`; IMG[n] = i; });
// [image, column, height in px]
const SCENERY = [
  ['arcade', 0.2, 40], ['plant', 6, 20], ['sunflower', 10.5, 34], ['clover', 15, 18], ['plant', 21, 18],
  ['sunflower', 33, 30], ['cone', 42.4, 22], ['plant', 49, 20], ['duck', 54.8, 30], ['sunflower', 60, 32],
  ['plant', 73, 18], ['cone', 90.4, 22], ['clover', 93.5, 18], ['sunflower', 100.5, 30], ['plant', 110.6, 20],
  ['sunflower', 121.4, 30], ['plant', 134, 20], ['box', 142.3, 30], ['dog', 146.6, 32], ['plant', 148.4, 18],
];
function drawScenery() {
  ctx.imageSmoothingEnabled = true;
  for (const [n, c, h] of SCENERY) {
    const im = IMG[n]; if (!im.complete || !im.naturalWidth) continue;
    const w = h * im.naturalWidth / im.naturalHeight, x = Math.round(c * T - camX);
    if (x < -w || x > W + 10) continue;
    ctx.drawImage(im, x, GY - h + 1, w, h);
  }
  ctx.imageSmoothingEnabled = false;
}

/* ---------- level ---------- */
let grid, qtips, coins, hazards, enemies, labels, pits, cp, flag, rocket, light, totalItems;
function build() {
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const ground = (a, b) => { for (let c = a; c <= b; c++) { grid[11][c] = '#'; grid[12][c] = '#'; } };
  const col = (c, h, t) => { for (let i = 0; i < h; i++) grid[10 - i][c] = t; };
  ground(0, 27); ground(31, 65); ground(68, 80); ground(85, COLS - 1);

  qtips = {};
  const q = (c, r, tip) => { grid[r][c] = '?'; qtips[c + ',' + r] = tip; };
  q(8, 7, 'User Research');
  col(17, 2, 'L'); col(18, 2, 'L');
  [44, 46, 48].forEach(c => grid[7][c] = 'B'); q(45, 7, 'Wireframes'); q(47, 7, 'Prototype');
  [62, 63, 64, 65].forEach((c, i) => col(c, i + 1, 'A'));
  [68, 69, 70, 71].forEach((c, i) => col(c, 4 - i, 'A'));
  grid[7][91] = 'B'; q(92, 7, 'Accessibility'); grid[7][93] = 'B';
  q(108, 7, 'Design System');
  for (let i = 0; i < 8; i++) col(112 + i, i + 1, 'B');

  coins = [];
  const cn = (c, r) => coins.push({ x: c * T + 12, y: r * T + 12, got: 0 });
  [12, 13, 14].forEach(c => cn(c, 8)); [28, 29, 30].forEach(c => cn(c, 7)); [34, 35, 36].forEach(c => cn(c, 10));
  [45, 46, 47].forEach(c => cn(c, 5)); [66, 67].forEach(c => cn(c, 5)); [74, 75, 76].forEach(c => cn(c, 10));
  [82, 83].forEach(c => cn(c, 6)); [96, 97, 98].forEach(c => cn(c, 8)); [103, 104, 105].forEach(c => cn(c, 10));
  [131, 132, 133].forEach(c => cn(c, 8));

  hazards = [];
  const ban = (c0, c1, text) => hazards.push({ t: 'banner', x: c0 * T + 6, y: 0, w: (c1 - c0 + 1) * T - 12, h: GY - 34, text });
  const dl = (c0, c1) => hazards.push({ t: 'dead', x: c0 * T + 2, y: GY - 15, w: (c1 - c0 + 1) * T - 4, h: 15 });
  ban(34, 36, 'Make the logo BIGGER!'); dl(40, 41); ban(74, 76, 'Can you make it pop?');
  dl(88, 89); ban(103, 105, 'Just one more change...');

  enemies = [];
  const en = (c, t) => enemies.push(t === 'rev'
    ? { t, x: c * T, y: GY - 26, w: 22, h: 26, vx: -45, vy: 0, alive: 1, dead: 0, act: 0 }
    : { t, x: c * T, y: GY - 22, w: 30, h: 22, vx: -32, vy: 0, alive: 1, dead: 0, act: 0 });
  en(23, 'rev'); en(51, 'scope'); en(58, 'rev'); en(95, 'rev'); en(99, 'scope');

  labels = [
    { x: 4 * T, y: GY - 70, text: '→ SHIP THE PRODUCT' },
    { x: 18 * T, y: 9 * T - 12, text: 'LOREM IPSUM WALL' },
    { x: 67 * T, y: 6 * T - 14, text: 'COMIC SANS' },
    { x: 116 * T, y: 2 * T - 4, text: 'FINAL PUSH' },
  ];
  pits = [{ c0: 28, c1: 30, text: 'HANDOFF GAP' }, { c0: 66, c1: 67, text: 'DEV BLOCKERS' }, { c0: 81, c1: 84, text: 'MISSING SPECS' }];
  // road crossing with a traffic light: stop on red, go on green
  light = { pole: 125 * T + 8, x: 126 * T, w: 4 * T, cycle: 7, green: 3.4, yellow: 1.2 };
  cp = { x: 56 * T, got: 0 };
  flag = { x: 140 * T, y: 2 * T + 8 };
  rocket = { x: 145 * T, y: 0, vy: 0, go: 0 };
  totalItems = coins.length + Object.keys(qtips).length;
}

/* ---------- state ---------- */
const keys = { left: 0, right: 0, jump: 0, down: 0, run: 0 };
let p, camX = 0, lives = 3, items = 0, score = 0, stomps = 0, time = 0, tA = 0, state = 'title';
let drift = 0, windDir = 1;
let popups = [], bumps = [], win = null, visible = false, raf = 0, last = 0, lightT = 0;
function reset() {
  build();
  p = { x: 2 * T, y: GY - STAND_H, w: 20, h: STAND_H, vx: 0, vy: 0, face: 1, onGround: 1, crawl: 0, inv: 0, anim: 0, coy: 0, jb: 0, hide: 0, idleT: 0, bt: 0, greet: 0 };
  camX = 0; lives = 3; items = 0; score = 0; stomps = 0; time = 0; lightT = 0; popups = []; bumps = []; win = null;
  for (const k in keys) keys[k] = 0;
}

/* ---------- helpers ---------- */
const SOLID = '#BLA?U';
const tileAt = (c, r) => (c < 0 || c >= COLS) ? '#' : (r < 0 || r >= ROWS) ? 0 : grid[r][c];
const solid = t => t && SOLID.includes(t);
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function overlapSolid(o) {
  for (let r = Math.floor(o.y / T); r <= Math.floor((o.y + o.h - 1) / T); r++)
    for (let c = Math.floor(o.x / T); c <= Math.floor((o.x + o.w - 1) / T); c++) if (solid(tileAt(c, r))) return true;
  return hazards.some(hz => hz.t === 'banner' && hit(o, hz));
}
function onFloor(o) {
  const r = Math.floor((o.y + o.h + 1) / T);
  for (let c = Math.floor(o.x / T); c <= Math.floor((o.x + o.w - 1) / T); c++) if (solid(tileAt(c, r))) return true;
  return false;
}
function moveX(o, dx) {
  o.x += dx;
  const r0 = Math.floor(o.y / T), r1 = Math.floor((o.y + o.h - 1) / T);
  if (dx > 0) { const c = Math.floor((o.x + o.w - 1) / T); for (let r = r0; r <= r1; r++) if (solid(tileAt(c, r))) { o.x = c * T - o.w; return true; } }
  else if (dx < 0) { const c = Math.floor(o.x / T); for (let r = r0; r <= r1; r++) if (solid(tileAt(c, r))) { o.x = (c + 1) * T; return true; } }
  return false;
}
function moveY(o, dy) {
  o.y += dy;
  const c0 = Math.floor(o.x / T), c1 = Math.floor((o.x + o.w - 1) / T);
  if (dy > 0) { const r = Math.floor((o.y + o.h - 1) / T); for (let c = c0; c <= c1; c++) if (solid(tileAt(c, r))) { o.y = r * T - o.h; return { dir: 1 }; } }
  else if (dy < 0) {
    const r = Math.floor(o.y / T), mid = Math.floor((o.x + o.w / 2) / T);
    const cs = [mid, c0, c1].filter(c => solid(tileAt(c, r)));
    if (cs.length) { o.y = (r + 1) * T; return { dir: -1, c: cs[0], r }; }
  }
  return null;
}
function pop(text, x, y, color = '#1d1d24', life = 1.4) { popups.push({ text, x, y, color, life, max: life }); }
function lightState() {
  const t = lightT % light.cycle;
  return t < light.green ? 'green' : t < light.green + light.yellow ? 'yellow' : 'red';
}

/* ---------- sound ---------- */
let actx = null, muted = false;
function beep(f1, f2, dur, type = 'square', vol = 0.04) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f1, n); o.frequency.exponentialRampToValueAtTime(f2, n + dur);
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    o.connect(g).connect(actx.destination); o.start(n); o.stop(n + dur);
  } catch (e) {}
}
const sfx = {
  jump: () => beep(380, 760, 0.14), coin: () => beep(880, 1500, 0.1), stomp: () => beep(320, 90, 0.15),
  hurt: () => beep(220, 60, 0.3, 'sawtooth'), block: () => beep(260, 520, 0.1),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, f * 1.01, 0.18), i * 130)),
};

/* ---------- damage ---------- */
const HINT = { dead: 'Jump over deadlines! (↑)', banner: 'Crawl under feedback! (↓)', rev: 'Stomp revisions from above!',
  scope: 'Jump on the scope creep!', pit: 'Mind the gap — jump! (↑)', light: 'STOP on red — wait for green!' };
const OVER = { dead: 'The deadline caught you.', banner: 'Buried under feedback.', rev: 'Lost in endless revisions.',
  scope: 'Scope creep took over the project.', pit: 'Lost in the handoff gap.', light: 'Rushed past the approval signal.' };
function hurt(type, src) {
  if (p.inv > 0 || state !== "play") return;
  lives--; sfx.hurt();
  pop(HINT[type], p.x + p.w / 2, p.y - 18, '#e2476b', 2);
  if (lives <= 0) return gameOver(type);
  p.inv = 1.6;
  const dir = src && (p.x + p.w / 2 < src.x + src.w / 2) ? -1 : 1;
  p.vx = dir * 230; p.vy = -380;
}
function fall() {
  lives--; sfx.hurt();
  if (lives <= 0) return gameOver('pit');
  const sx = cp.got ? cp.x + T : 2 * T;
  Object.assign(p, { x: sx, y: GY - STAND_H, h: STAND_H, crawl: 0, vx: 0, vy: 0, inv: 1.6 });
  pop(HINT.pit, p.x + p.w / 2, p.y - 18, '#e2476b', 2);
}

/* ---------- update ---------- */
function update(dt) {
  time += dt; lightT += dt;
  if (win) return updateWin(dt);

  // crawl / stand
  const wantCrawl = keys.down && (p.onGround || onFloor(p));
  if (wantCrawl && !p.crawl) { p.crawl = 1; p.y += STAND_H - CRAWL_H; p.h = CRAWL_H; }
  if (!wantCrawl && p.crawl) {
    const test = { x: p.x, y: p.y - (STAND_H - CRAWL_H), w: p.w, h: STAND_H };
    if (!overlapSolid(test)) { p.crawl = 0; p.y = test.y; p.h = STAND_H; }
  }

  // run / stop
  const max = p.crawl ? 160 : keys.run ? 330 : 220, acc = p.onGround ? 1500 : 900;
  if (keys.left && !keys.right) { p.vx = Math.max(p.vx - acc * dt, -max); p.face = -1; }
  else if (keys.right && !keys.left) { p.vx = Math.min(p.vx + acc * dt, max); p.face = 1; }
  else { const f = (p.onGround ? 1900 : 420) * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
  if (Math.abs(p.vx) > max && p.onGround) p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) - 2000 * dt);

  // jump (coyote time + buffer + variable height)
  p.coy = p.onGround ? 0.09 : p.coy - dt;
  p.jb -= dt;
  if (p.jb > 0 && p.coy > 0 && !p.crawl) { p.vy = -JUMP; p.coy = 0; p.jb = 0; p.onGround = 0; sfx.jump(); }
  if (!keys.jump && p.vy < -270) p.vy = -270;

  p.vy = Math.min(p.vy + GRAV * dt, 900);
  if (moveX(p, p.vx * dt)) p.vx = 0;
  p.x = Math.max(0, Math.min(LW - p.w, p.x));
  const ry = moveY(p, p.vy * dt);
  p.onGround = (ry && ry.dir > 0) || (p.vy >= 0 && onFloor(p)) ? 1 : 0;
  if (ry && ry.dir > 0) p.vy = 0;
  if (ry && ry.dir < 0) { p.vy = 40; bumpBlock(ry.c, ry.r); }
  if (p.y > H + 40) return fall();
  p.anim += Math.abs(p.vx) * dt;

  // standing still → wave and say hi
  const idle = p.onGround && !p.crawl && Math.abs(p.vx) < 4 && !keys.left && !keys.right && !keys.down && !keys.jump && p.inv <= 0;
  if (idle) {
    p.idleT += dt;
    if (p.idleT > 0.7) {
      p.bt += dt;
      if (p.bt > [...HELLO[p.greet]].length / 38 + 4.5) { p.greet = (p.greet + 1) % HELLO.length; p.bt = 0; }
    }
  } else {
    if (p.bt > 0) p.greet = (p.greet + 1) % HELLO.length;
    p.idleT = 0; p.bt = 0;
  }
  if (p.inv > 0) p.inv -= dt;

  // hazards
  for (const hz of hazards) if (hit(p, hz)) hurt(hz.t, hz);
  if (lightState() === 'red') {
    const zone = { x: light.x + 4, y: 0, w: light.w - 8, h: GY };
    if (hit(p, zone)) hurt('light', zone);
  }

  // enemies
  for (const e of enemies) {
    if (!e.alive) { e.dead -= dt; continue; }
    if (!e.act) { if (e.x < camX + W + 40) e.act = 1; else continue; }
    e.vy = Math.min(e.vy + GRAV * dt, 900);
    if (moveX(e, e.vx * dt)) e.vx *= -1;
    else {
      const ahead = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
      if (!solid(tileAt(Math.floor(ahead / T), Math.floor((e.y + e.h + 2) / T)))) e.vx *= -1;
    }
    // keep walkers out from under the feedback banners so crawling stays fair
    for (const hz of hazards) if (hz.t === 'banner' && e.x < hz.x + hz.w + 30 && e.x + e.w > hz.x - 30) {
      e.x -= e.vx * dt; e.vx = e.x + e.w / 2 < hz.x + hz.w / 2 ? -Math.abs(e.vx) : Math.abs(e.vx);
    }
    const ey = moveY(e, e.vy * dt); if (ey) e.vy = 0;
    if (e.y > H + 60) e.alive = 0;
    if (state !== 'play' || !hit(p, e)) continue;
    if (p.vy > 0 && p.y + p.h - e.y < 16) {
      e.alive = 0; e.dead = 0.6; p.vy = -420; score += 200; stomps++; sfx.stomp();
      pop(e.t === 'rev' ? 'Revision approved!' : 'Scope contained!', e.x + e.w / 2, e.y - 14, '#2f9a4a');
    } else hurt(e.t, e);
    if (state !== 'play') return;
  }

  // collectibles
  for (const c of coins) if (!c.got && Math.abs(c.x - (p.x + p.w / 2)) < 18 && c.y > p.y - 8 && c.y < p.y + p.h + 8) {
    c.got = 1; items++; score += 100; sfx.coin();
  }
  if (!cp.got && p.x > cp.x) { cp.got = 1; pop('Checkpoint — feedback saved', cp.x, GY - 80, '#4a55e8', 1.8); }
  if (p.x + p.w >= flag.x + T / 2 - 2) startWin();
}
function bumpBlock(c, r) {
  const t = tileAt(c, r);
  if (t !== '?' && t !== 'B') return;
  bumps.push({ c, r, t: 0.15 });
  if (t === '?') {
    grid[r][c] = 'U'; items++; score += 100; sfx.coin();
    pop('+ ' + qtips[c + ',' + r], c * T + T / 2, r * T - 12, '#7a4fe0', 1.8);
  } else sfx.block();
}
function startWin() {
  win = { phase: 'slide', t: 0, fy: flag.y };
  p.vx = 0; p.vy = 0; p.crawl = 0; p.h = STAND_H; p.x = flag.x + T / 2 - p.w - 2; p.face = 1;
  sfx.win();
}
function updateWin(dt) {
  win.t += dt;
  win.fy = Math.min(GY - 44, win.fy + 170 * dt);
  if (win.phase === 'slide') {
    p.y += 170 * dt;
    if (p.y + p.h >= GY) { p.y = GY - p.h; win.phase = 'walk'; }
  } else if (win.phase === 'walk') {
    p.x += 110 * dt; p.anim += 110 * dt; p.vx = 110; p.onGround = 1;
    if (p.x + p.w / 2 >= rocket.x) { p.hide = 1; win.phase = 'launch'; rocket.go = 1; }
  } else if (win.phase === 'launch') {
    rocket.vy -= 700 * dt; rocket.y += rocket.vy * dt;
    if (rocket.y < -H && !win.shown) { win.shown = 1; showWin(); }
  }
}

/* ---------- camera ---------- */
function updateCam(dt) {
  const target = (win && win.phase === 'launch' ? rocket.x : p.x + p.w / 2) - W * 0.4;
  camX += (Math.max(0, Math.min(LW - W, target)) - camX) * Math.min(1, dt * 8);
  if (LW <= W) camX = 0;
}

/* ---------- drawing ---------- */
function txt(s, x, y, size, color, align = 'center', font = 'Silkscreen') {
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function pill(s, cx, y, bg = '#1d1d24', fg = '#fff') {
  ctx.font = '8px Silkscreen';
  const w = Math.round(ctx.measureText(s).width + 12);
  ctx.fillStyle = bg; ctx.fillRect(Math.round(cx - w / 2), Math.round(y - 7), w, 14);
  txt(s, Math.round(cx), Math.round(y) + 0.5, 8, fg);
}
function bg() {
  ctx.fillStyle = 'rgba(120,196,120,.35)';
  for (let i = -1; i < W / 300 + 2; i++) {
    const x = i * 300 - ((camX * 0.3) % 300);
    for (let k = 0; k < 6; k++) ctx.fillRect(x + k * 12, GY - (k + 1) * 8, 170 - k * 24, 8);
  }
  // clouds drift with the wind, which blows the way she's heading
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  const off = ((drift % 420) + 420) % 420;
  for (let i = -1; i < W / 420 + 2; i++) {
    const x = i * 420 + 60 + off - 420, y = 36 + (((i % 2) + 2) % 2) * 34;
    ctx.fillRect(x, y + 8, 64, 12); ctx.fillRect(x + 10, y, 30, 10); ctx.fillRect(x + 36, y + 4, 18, 6);
  }
}
function drawTile(t, x, y, c, r) {
  if (t === '#') {
    ctx.fillStyle = '#9a4a26'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#7d3a1c'; ctx.fillRect(x, y + T / 2 - 1, T, 2);
    ctx.fillRect(x + (r % 2 ? 6 : 18), y, 2, T / 2); ctx.fillRect(x + (r % 2 ? 18 : 6), y + T / 2, 2, T / 2);
    if (tileAt(c, r - 1) !== '#') {
      ctx.fillStyle = '#5dc54a'; ctx.fillRect(x, y, T, 8);
      ctx.fillStyle = '#3f9e33'; ctx.fillRect(x, y + 8, T, 3);
      ctx.fillStyle = '#86e06f'; ctx.fillRect(x, y, T, 2);
    }
  } else if (t === 'B') {
    ctx.fillStyle = '#c8642e'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#8a3e18'; ctx.fillRect(x, y + 11, T, 2); ctx.fillRect(x + 11, y, 2, 11); ctx.fillRect(x + 5, y + 13, 2, 11); ctx.fillRect(x + 17, y + 13, 2, 11);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
  } else if (t === '?' || t === 'U') {
    ctx.fillStyle = t === '?' ? '#f5b52a' : '#9a6a3a'; ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
    ctx.fillStyle = t === '?' ? '#ffe28a' : '#7a5230';
    [[3, 3], [T - 6, 3], [3, T - 6], [T - 6, T - 6]].forEach(([a, b]) => ctx.fillRect(x + a, y + b, 3, 3));
    if (t === '?') { const bob = Math.round(Math.sin(tA * 5) * 1); txt('?', x + T / 2 + 1, y + T / 2 + 2 + bob, 12, '#8a4b10', 'center', '"Press Start 2P"'); txt('?', x + T / 2, y + T / 2 + 1 + bob, 12, '#fff', 'center', '"Press Start 2P"'); }
  } else if (t === 'L') {
    ctx.fillStyle = '#b9bcc6'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#8c90a0'; [5, 10, 15].forEach((yy, i) => ctx.fillRect(x + 4, y + yy, T - 8 - (i === 2 ? 6 : 0), 2));
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
  } else if (t === 'A') {
    ctx.fillStyle = '#f7d24a'; ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
    txt('Aa', x + T / 2, y + T / 2 + 1, 11, '#e2476b', 'center', '"Comic Sans MS", "Comic Sans", cursive');
  }
}
function drawHello() {
  if (state !== 'play' || win || p.hide || p.idleT <= 0.7) return;
  const msg = HELLO[p.greet], shown = Math.floor(p.bt * 38), font = '600 9.5px Inter, sans-serif';
  ctx.font = font;
  const out = []; let line = '';
  for (const w of msg.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > 176 && line) { out.push(line); line = w; } else line = t; }
  out.push(line);
  const bw = 196, bh = out.length * 13 + 16, hx = p.x + p.w / 2 - camX;
  const bx = Math.round(Math.max(6, Math.min(W - bw - 6, hx - 40))), by = Math.round(p.y - bh - 22);
  const pop = Math.min(1, p.bt * 6);
  ctx.save(); ctx.globalAlpha = pop;
  ctx.fillStyle = '#111'; ctx.fillRect(bx + 3, by + 3, bw, bh);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  ctx.fillStyle = '#4a55e8'; ctx.fillRect(bx + 2, by + 2, bw - 4, 3);
  // tail pointing at her head
  const tx = Math.max(bx + 12, Math.min(bx + bw - 14, hx));
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(tx - 6, by + bh - 1); ctx.lineTo(tx + 1, by + bh + 11); ctx.lineTo(tx + 7, by + bh - 1); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(tx - 3, by + bh - 2); ctx.lineTo(tx + 1, by + bh + 6); ctx.lineTo(tx + 4, by + bh - 2); ctx.fill();
  ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1d1d24';
  let left = shown;
  out.forEach((l, i) => {
    if (left <= 0) return;
    const ch = [...l], part = ch.slice(0, left).join(''); left -= ch.length + 1;
    ctx.fillText(part, bx + 10, by + 15 + i * 13);
  });
  if (shown < [...msg].length && Math.floor(tA * 6) % 2) { ctx.fillStyle = '#4a55e8'; ctx.fillRect(bx + bw - 14, by + bh - 10, 5, 5); }
  ctx.restore();
}
function wrap(s, maxW) {
  ctx.font = '8px Silkscreen';
  const out = []; let line = '';
  for (const w of s.split(' ')) { const tst = line ? line + ' ' + w : w; if (ctx.measureText(tst).width > maxW && line) { out.push(line); line = w; } else line = tst; }
  out.push(line); return out;
}
function drawBanner(hz) {
  const sway = Math.round(Math.sin(tA * 2 + hz.x) * 2), x = hz.x - camX + sway, top = hz.h - 58;
  ctx.fillStyle = '#333'; ctx.fillRect(x + 8, 0, 2, top); ctx.fillRect(x + hz.w - 10, 0, 2, top);
  ctx.fillStyle = '#ff6b8b'; ctx.fillRect(x, top, hz.w, 58);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, top + 1.5, hz.w - 3, 55);
  ctx.fillStyle = '#ff9ab0'; ctx.fillRect(x + 4, top + 4, hz.w - 8, 3);
  txt('CLIENT SAYS', x + hz.w / 2, top + 13, 8, '#ffe28a');
  wrap(hz.text, hz.w - 12).forEach((l, i, a) => txt(l, x + hz.w / 2, top + 32 + (i - (a.length - 1) / 2) * 11, 8, '#fff'));
}
function drawDeadline(hz) {
  const x = hz.x - camX;
  ctx.fillStyle = '#e2476b'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  for (let i = 0; i < hz.w; i += 10) {
    ctx.beginPath(); ctx.moveTo(x + i, GY); ctx.lineTo(x + i + 5, GY - hz.h); ctx.lineTo(x + i + 10, GY); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const cx = x + hz.w / 2, cy = GY - 32;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.fillRect(cx - 1, cy - 6, 2, 6);
  const a = tA * 6; ctx.fillRect(cx + Math.cos(a) * 4 - 1, cy + Math.sin(a) * 4 - 1, 3, 3);
  pill('DEADLINE', cx, GY - 52, '#e2476b');
}
function comp(x, y, sc) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, 1);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a4fe0';
  const d = (dx, dy) => { ctx.beginPath(); ctx.moveTo(dx, dy - 4); ctx.lineTo(dx + 4, dy); ctx.lineTo(dx, dy + 4); ctx.lineTo(dx - 4, dy); ctx.closePath(); ctx.fill(); };
  d(0, -5); d(5, 0); d(0, 5); d(-5, 0);
  ctx.restore();
}
function drawRev(e, x, y) {
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  if (!e.alive) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y + e.h - 7, e.w, 7); ctx.strokeRect(x + 1, y + e.h - 6, e.w - 2, 5); return; }
  const f = Math.floor(tA * 8) % 2;
  ctx.fillStyle = '#111'; ctx.fillRect(x + 2 + f, y + e.h - 4, 7, 4); ctx.fillRect(x + 13 - f, y + e.h - 4, 7, 4);
  const bh = e.h - 4;
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, e.w, bh); ctx.strokeRect(x + 1, y + 1, e.w - 2, bh - 2);
  ctx.fillStyle = '#cfd3e0'; ctx.beginPath(); ctx.moveTo(x + e.w - 8, y + 1); ctx.lineTo(x + e.w - 1, y + 8); ctx.lineTo(x + e.w - 8, y + 8); ctx.closePath(); ctx.fill();
  txt('v27', x + 9, y + 7, 8, '#e2476b');
  const lk = e.vx < 0 ? -1 : 1;
  ctx.fillStyle = '#111'; ctx.fillRect(x + 6 + lk, y + 12, 3, 4); ctx.fillRect(x + 13 + lk, y + 12, 3, 4);
  ctx.fillRect(x + 5, y + 9, 4, 2); ctx.fillRect(x + 13, y + 9, 4, 2);
  pill('FINAL_final', x + e.w / 2, y - 10, '#1d1d24');
}
function drawScope(e, x, y) {
  const cx = x + e.w / 2, by = y + e.h;
  ctx.strokeStyle = '#1f6b2a'; ctx.lineWidth = 2; ctx.fillStyle = '#5ac85a';
  if (!e.alive) { ctx.beginPath(); ctx.ellipse(cx, by - 3, e.w / 2 + 4, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); return; }
  const s = 1 + Math.sin(tA * 5 + e.x) * 0.08, ry = e.h / 2 * s, rx = (e.w / 2 + 2) * (2 - s);
  ctx.beginPath(); ctx.ellipse(cx, by - ry, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8fe08a'; ctx.fillRect(cx - rx / 2, by - ry * 1.6, 6, 3);
  const lk = p.x < e.x ? -1.5 : 1.5;
  [-6, 6].forEach(dx => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + dx, by - ry, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(cx + dx + lk - 1, by - ry - 1, 3, 3); });
  pill('SCOPE CREEP', cx, y - 12, '#2f9a4a');
}
function drawLight() {
  const st = lightState(), px = light.pole - camX, zx = light.x - camX;
  if (px < -200 || px > W + 200) return;
  // crosswalk stripes on the road
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(zx, GY, light.w, 6);
  ctx.fillStyle = '#fff'; for (let i = 4; i < light.w - 4; i += 12) ctx.fillRect(zx + i, GY + 1, 7, 4);
  // red: traffic streams through the crossing
  if (st === 'red') {
    ctx.fillStyle = 'rgba(226,71,107,.16)'; ctx.fillRect(zx, 0, light.w, GY);
    for (let k = 0; k < 2; k++) {
      const span = light.w + 70, off = ((tA * 420 + k * span / 2) % span) - 70, cx = zx + off, cy = GY - 20;
      ctx.save(); ctx.beginPath(); ctx.rect(zx, 0, light.w, GY); ctx.clip();
      ctx.fillStyle = k ? '#4a55e8' : '#ff8ab0'; ctx.fillRect(cx, cy, 60, 14); ctx.fillRect(cx + 12, cy - 10, 32, 11);
      ctx.fillStyle = '#bfe6ff'; ctx.fillRect(cx + 16, cy - 7, 11, 7); ctx.fillRect(cx + 30, cy - 7, 11, 7);
      ctx.fillStyle = '#111'; ctx.fillRect(cx + 8, cy + 12, 10, 8); ctx.fillRect(cx + 42, cy + 12, 10, 8);
      ctx.fillStyle = '#fff'; ctx.font = '7px Silkscreen'; ctx.textAlign = 'center'; ctx.fillText(k ? 'HOTFIX' : 'URGENT', cx + 30, cy + 7);
      ctx.restore();
    }
  }
  // pink pole + arm, like a candy-coloured street light
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.fillStyle = '#f08ad0'; ctx.fillRect(px - 4, 70, 8, GY - 70); ctx.strokeRect(px - 4, 70, 8, GY - 70);
  ctx.fillStyle = '#d765b6'; ctx.fillRect(px - 10, GY - 8, 20, 8);
  ctx.fillStyle = '#f08ad0'; ctx.fillRect(px, 84, light.w / 2 + 20, 5); ctx.strokeRect(px, 84, light.w / 2 + 20, 5);
  // housing
  const hx = px - 16, hy = 12;
  ctx.fillStyle = '#f39ad8'; ctx.fillRect(hx, hy, 32, 76); ctx.strokeRect(hx + 1, hy + 1, 30, 74);
  ctx.fillStyle = '#d765b6'; ctx.fillRect(hx + 26, hy + 3, 4, 70);
  const lamps = [['red', '#ff5a4f', 24], ['yellow', '#ffd23f', 50], ['green', '#7dff8a', 76]];
  lamps.forEach(([k, c, yy], i) => {
    const on = st === k, cy = hy + 13 + i * 25;
    ctx.fillStyle = '#e57bc4'; ctx.fillRect(hx + 3, cy - 12, 22, 4); // visor
    if (on) { ctx.fillStyle = c + '55'; ctx.beginPath(); ctx.arc(hx + 14, cy, 15, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = on ? c : '#f6d7ec'; ctx.beginPath(); ctx.arc(hx + 14, cy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (on) { ctx.fillStyle = '#ffffffaa'; ctx.fillRect(hx + 10, cy - 5, 3, 3); }
  });
  // small hanging light at the end of the arm
  const ax = px + light.w / 2 + 6;
  ctx.fillStyle = '#333'; ctx.fillRect(ax + 6, 89, 2, 6);
  ctx.fillStyle = '#f39ad8'; ctx.fillRect(ax, 95, 14, 38); ctx.strokeRect(ax + 1, 96, 12, 36);
  lamps.forEach(([k, c], i) => { ctx.fillStyle = st === k ? c : '#f6d7ec'; ctx.beginPath(); ctx.arc(ax + 7, 103 + i * 11, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  // a lovebird perched on the arm, watching the traffic
  const lb = IMG.lovebird;
  if (lb.complete && lb.naturalWidth) { ctx.imageSmoothingEnabled = true; ctx.drawImage(lb, px + 22, 84 - 22 + Math.round(Math.sin(tA * 3) * 1), 22 * lb.naturalWidth / lb.naturalHeight, 22); ctx.imageSmoothingEnabled = false; }
  // pixel smiley sign
  const sx = px + 12, sy = 96, sm = st === 'red' ? '#ff5a4f' : '#1d1d24';
  ctx.fillStyle = '#f7d24a'; ctx.fillRect(sx, sy, 34, 34); ctx.strokeRect(sx + 1, sy + 1, 32, 32);
  ctx.fillStyle = '#e2476b'; [[13, 5], [5, 13], [21, 13], [13, 21]].forEach(([a, b]) => ctx.fillRect(sx + a, sy + b, 8, 8));
  ctx.fillStyle = '#ffe28a'; ctx.fillRect(sx + 11, sy + 11, 12, 12);
  ctx.fillStyle = sm; ctx.fillRect(sx + 13, sy + 14, 2, 2); ctx.fillRect(sx + 19, sy + 14, 2, 2);
  if (st === 'red') ctx.fillRect(sx + 14, sy + 20, 6, 2); else { ctx.fillRect(sx + 13, sy + 19, 2, 2); ctx.fillRect(sx + 15, sy + 20, 4, 2); ctx.fillRect(sx + 19, sy + 19, 2, 2); }
  // label
  const lab = st === 'green' ? 'APPROVED — GO!' : st === 'yellow' ? 'REVIEW PENDING…' : 'STOP — WAIT FOR SIGN-OFF';
  pill(lab, zx + light.w / 2, 150, st === 'green' ? '#2f9a4a' : st === 'yellow' ? '#c98a12' : '#7a4fe0');
}
function drawHeart(x, y, full) {
  const P = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  ctx.fillStyle = full ? '#e2476b' : 'rgba(0,0,0,.18)';
  P.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'x') ctx.fillRect(x + i * 2, y + j * 2, 2, 2); }));
}
function hud() {
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(10, 8, 300, 24);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(10, 8, 300, 24);
  for (let i = 0; i < 3; i++) drawHeart(18 + i * 18, 14, i < lives);
  comp(88, 20, 0.8); txt('x' + String(items).padStart(2, '0'), 100, 21, 10, '#1d1d24', 'left');
  txt('SCORE ' + String(score).padStart(5, '0'), 140, 21, 10, '#1d1d24', 'left');
  txt('T ' + String(Math.floor(time)).padStart(3, '0'), 250, 21, 10, '#1d1d24', 'left');
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  bg();
  for (const pt of pits) { const cx = (pt.c0 + pt.c1 + 1) / 2 * T - camX; if (cx > -120 && cx < W + 120) pill(pt.text, cx, H - 16, '#e2476b'); }
  drawScenery();
  for (const hz of hazards) if (hz.t === 'banner' && hz.x - camX < W + 20 && hz.x + hz.w - camX > -20) drawBanner(hz);

  const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(COLS - 1, Math.ceil((camX + W) / T));
  for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
    const t = grid[r][c]; if (!t) continue;
    const b = bumps.find(b => b.c === c && b.r === r);
    drawTile(t, Math.round(c * T - camX), r * T - (b ? Math.round(Math.sin((0.15 - b.t) / 0.15 * Math.PI) * 6) : 0), c, r);
  }
  for (const l of labels) if (l.x - camX > -120 && l.x - camX < W + 120) pill(l.text, l.x - camX, l.y);
  for (const c of coins) if (!c.got) { const x = c.x - camX; if (x > -20 && x < W + 20) comp(x, c.y + Math.sin(tA * 4 + c.x) * 2, Math.max(0.2, Math.abs(Math.cos(tA * 3 + c.x / 50)))); }
  for (const hz of hazards) if (hz.t === 'dead' && hz.x - camX < W + 20 && hz.x + hz.w - camX > -20) drawDeadline(hz);
  drawLight();

  // checkpoint
  const cpx = cp.x - camX;
  if (cpx > -60 && cpx < W + 60) {
    ctx.fillStyle = '#555'; ctx.fillRect(cpx, GY - 64, 3, 64);
    ctx.fillStyle = cp.got ? '#4fbf6b' : '#b9bcc6'; ctx.beginPath(); ctx.moveTo(cpx + 3, GY - 64); ctx.lineTo(cpx + 25, GY - 56); ctx.lineTo(cpx + 3, GY - 48); ctx.closePath(); ctx.fill();
    pill(cp.got ? 'SAVED ✓' : 'CHECKPOINT', cpx + 2, GY - 76, cp.got ? '#2f9a4a' : '#1d1d24');
  }
  // goal flag
  const fx = flag.x + T / 2 - camX;
  if (fx > -80 && fx < W + 80) {
    ctx.fillStyle = '#8a8f9c'; ctx.fillRect(fx - 1, flag.y - 6, 3, GY - flag.y + 6);
    ctx.fillStyle = '#f7d24a'; ctx.beginPath(); ctx.arc(fx, flag.y - 8, 5, 0, Math.PI * 2); ctx.fill();
    const fy = win ? win.fy : flag.y;
    ctx.fillStyle = '#4a55e8'; ctx.fillRect(fx - 46, fy, 45, 22); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(fx - 45, fy + 1, 43, 20);
    txt('SHIPPED', fx - 24, fy + 11, 8, '#fff');
    ctx.fillStyle = '#555'; ctx.fillRect(fx - 8, GY - 8, 17, 8);
  }
  // launch rocket
  const rx = rocket.x - camX, ryb = GY + rocket.y;
  if (rx > -60 && rx < W + 60) {
    if (rocket.go) { ctx.fillStyle = Math.floor(tA * 20) % 2 ? '#ffd23f' : '#ff7a3d'; ctx.beginPath(); ctx.moveTo(rx - 7, ryb - 6); ctx.lineTo(rx, ryb + 16 + Math.random() * 8); ctx.lineTo(rx + 7, ryb - 6); ctx.fill(); }
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.fillStyle = '#e2476b'; ctx.fillRect(rx - 15, ryb - 20, 8, 14); ctx.fillRect(rx + 7, ryb - 20, 8, 14);
    ctx.fillStyle = '#fff'; ctx.fillRect(rx - 9, ryb - 52, 18, 46); ctx.strokeRect(rx - 9, ryb - 52, 18, 46);
    ctx.fillStyle = '#e2476b'; ctx.beginPath(); ctx.moveTo(rx - 9, ryb - 52); ctx.lineTo(rx, ryb - 68); ctx.lineTo(rx + 9, ryb - 52); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a55e8'; ctx.beginPath(); ctx.arc(rx, ryb - 38, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!rocket.go) pill('LAUNCH', rx, ryb - 82, '#4a55e8');
  }

  for (const e of enemies) {
    if (!e.alive && e.dead <= 0) continue;
    const x = Math.round(e.x - camX); if (x < -60 || x > W + 60) continue;
    e.t === 'rev' ? drawRev(e, x, Math.round(e.y)) : drawScope(e, x, Math.round(e.y));
  }

  // player
  if (!p.hide && !(p.inv > 0 && Math.floor(p.inv * 12) % 2)) {
    const fr = Math.floor(p.anim / 26) % 2;
    const waving = state === 'play' && !win && p.idleT > 0.5;
    const img = p.crawl ? (fr ? SP.cr2 : SP.cr1) : !p.onGround ? SP.jump : Math.abs(p.vx) > 15 ? (fr ? SP.run2 : SP.run1) : waving ? (Math.floor(tA * 5) % 2 ? SP.wave2 : SP.wave1) : SP.idle;
    ctx.save(); ctx.translate(Math.round(p.x + p.w / 2 - camX), Math.round(p.y + p.h));
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  drawHello();
  for (const o of popups) { ctx.globalAlpha = Math.min(1, o.life / 0.4); pill(o.text, o.x - camX, o.y - (o.max - o.life) * 26, o.color); ctx.globalAlpha = 1; }
  if (state !== 'title') hud();
}

/* ---------- overlays ---------- */
const CONTROLS = `<div class="ctl keys">
  <div class="c"><span class="k"><kbd>←</kbd><kbd>→</kbd></span><b>Run</b><small>Move left or right</small></div>
  <div class="c"><span class="k"><kbd>↑</kbd><i>or</i><kbd>Space</kbd></span><b>Jump</b><small>Hold longer to jump higher</small></div>
  <div class="c"><span class="k"><kbd>↓</kbd></span><b>Crawl</b><small>Slide under client banners</small></div>
  <div class="c"><span class="k"><kbd>Shift</kbd></span><b>Sprint</b><small>Hold it while running</small></div>
  <div class="c"><span class="k"><span class="hand">✋</span></span><b>Stop</b><small>Let go of every key</small></div>
  <div class="c"><span class="k"><kbd>P</kbd></span><b>Pause</b><small>Take a coffee break</small></div>
</div><div class="ctl touch">
  <div class="c"><span class="k"><kbd>◀</kbd><kbd>▶</kbd></span><b>Run</b><small>Hold to move</small></div>
  <div class="c"><span class="k"><kbd>▲</kbd></span><b>Jump</b><small>Hold to jump higher</small></div>
  <div class="c"><span class="k"><kbd>▼</kbd></span><b>Crawl</b><small>Slide under banners</small></div>
  <div class="c"><span class="k"><span class="hand">✋</span></span><b>Stop</b><small>Lift your finger</small></div>
  <div class="c"><span class="k"><kbd>⏸</kbd></span><b>Pause</b><small>Top-right button</small></div>
  <div class="c"><span class="k"><span class="hand">🚩</span></span><b>Goal</b><small>Reach the flag</small></div>
</div>`;
{ const slot = card.querySelector('.ctl-slot'); if (slot) { slot.insertAdjacentHTML('afterend', CONTROLS); slot.remove(); } }
function show(html) { card.innerHTML = html; ov.hidden = false; }
function start() { reset(); state = 'play'; ov.hidden = true; cv.focus({ preventScroll: true }); try { actx && actx.resume(); } catch (e) {} }
function pause() { if (state !== 'play') return; state = 'pause'; for (const k in keys) keys[k] = 0;
  show(`<h3>PAUSED</h3><p>Even designers need a coffee break ☕</p>${CONTROLS}<div class="g-btns"><button class="g-btn" data-act="resume">▶ RESUME</button><button class="g-btn alt" data-act="start">↺ RESTART</button></div>`); }
function resume() { state = 'play'; ov.hidden = true; last = 0; cv.focus({ preventScroll: true }); }
function gameOver(type) { state = 'over';
  show(`<h3>GAME OVER</h3><p><b>${OVER[type]}</b><br>Every designer has been there. Tip: ${HINT[type]}</p><div class="g-btns"><button class="g-btn" data-act="start">↺ TRY AGAIN</button></div>`); }
function showWin() {
  state = 'won';
  const bonus = Math.max(0, 3000 - Math.floor(time) * 20) + lives * 500; score += bonus;
  show(`<h3>PRODUCT SHIPPED! 🚀</h3><p>You beat the deadlines, dodged "make it pop", stomped endless revisions and waited for sign-off — just like Manisha does every sprint.</p>
  <div class="g-stats"><span><b>${items}/${totalItems}</b>skills &amp; components</span><span><b>${stomps}</b>problems solved</span><span><b>${Math.floor(time)}s</b>time</span><span><b>${score}</b>score</span></div>
  <div class="g-btns"><button class="g-btn" data-act="start">↺ PLAY AGAIN</button><a class="g-btn alt" href="#projects">▲ SEE THE PROJECTS</a></div>`);
}
ov.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  ({ start, resume })[b.dataset.act]();
});

/* ---------- input ---------- */
const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'run', ShiftRight: 'run' };
addEventListener('keydown', e => {
  if (state === 'play') {
    const k = MAP[e.code];
    if (k) { e.preventDefault(); if (k === 'jump' && !keys.jump) p.jb = 0.12; keys[k] = 1; }
    if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); pause(); }
  } else if (e.code === 'Enter' && visible && !ov.hidden) {
    const b = card.querySelector('[data-act]'); if (b) { e.preventDefault(); b.click(); }
  }
});
addEventListener('keyup', e => { const k = MAP[e.code]; if (k) keys[k] = 0; });
addEventListener('blur', pause);
document.getElementById('g-pause').onclick = () => state === 'play' ? pause() : state === 'pause' && resume();
const mute = document.getElementById('g-mute');
mute.onclick = () => { muted = !muted; mute.textContent = muted ? '🔇' : '🔊'; };
document.querySelectorAll('.g-pad [data-k]').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); if (state !== 'play') return; if (k === 'jump' && !keys.jump) p.jb = 0.12; keys[k] = 1; };
  const off = e => { e.preventDefault(); keys[k] = 0; };
  b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, off));
});

/* ---------- loop ---------- */
function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.033, last ? (ts - last) / 1000 : 0.016); last = ts;
  tA += dt;
  wind(dt);
  if (state === 'play' || state === 'won') {
    if (state === 'play') update(dt); else if (win && !win.shown) update(dt);
    if (state === 'won' && win && win.phase === 'launch') { rocket.vy -= 700 * dt; rocket.y += rocket.vy * dt; }
  }
  if (state === 'title') lightT += dt;
  for (const o of popups) o.life -= dt; popups = popups.filter(o => o.life > 0);
  for (const b of bumps) b.t -= dt; bumps = bumps.filter(b => b.t > 0);
  updateCam(dt);
  draw();
}
// the big CSS clouds in the section sky loop across it with the same wind
const sky = [...document.querySelectorAll('.comm .cloud')].map((el, i) => ({ el, f: [1, 0.7, 0.5, 0.85, 0.6][i % 5] }));
function wind(dt) {
  const moving = state === 'play' && !win && Math.abs(p.vx) > 15;
  if (moving) windDir = Math.sign(p.vx);
  drift += windDir * (moving ? Math.abs(p.vx) * 0.35 : 14) * dt;
  moveSky();
}
function moveSky() {
  const secW = box.parentElement.clientWidth;
  for (const c of sky) {
    const w = c.el.offsetWidth, base = c.el.offsetLeft, span = secW + w * 2;
    const x = (((base + w + drift * c.f * 1.3) % span) + span) % span - w;
    c.el.style.transform = `translateX(${Math.round(x - base)}px)`;
  }
}
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = cv.clientWidth || 800, ch = cv.clientHeight || H;
  Z = ch / H; W = cw / Z;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  ctx.setTransform(dpr * Z, 0, 0, dpr * Z, 0, 0); ctx.imageSmoothingEnabled = false;
  draw();
}
new IntersectionObserver(([en]) => {
  visible = en.isIntersecting;
  if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  if (!visible) { cancelAnimationFrame(raf); raf = 0; pause(); }
}).observe(box);
addEventListener('resize', resize);

// deterministic stepping for automated checks: open the page with ?dqtest
if (/dqtest/.test(location.search)) window.__dq = {
  keys, start, get p() { return p; }, get enemies() { return enemies; }, get popups() { return popups; }, jump() { p.jb = 0.12; },
  put(col) { p.x = col * T; p.y = GY - STAND_H; p.vx = p.vy = 0; camX = Math.max(0, p.x - W * 0.4); },
  step(n, dt = 1 / 60) {
    for (let i = 0; i < n; i++) {
      if (state === 'play') update(dt);
      tA += dt; wind(dt); for (const o of popups) o.life -= dt; popups = popups.filter(o => o.life > 0);
      for (const b of bumps) b.t -= dt; bumps = bumps.filter(b => b.t > 0); updateCam(dt);
    }
    draw();
    return { drift: Math.round(drift), sky: sky.map(c => c.el.style.transform), x: Math.round(p.x / T * 10) / 10, y: Math.round(p.y), lives, items, score, state, crawl: p.crawl, light: lightState(), win: win && win.phase };
  },
};

reset();
(document.fonts ? document.fonts.load('10px Silkscreen') : Promise.resolve()).finally(resize);
})();
