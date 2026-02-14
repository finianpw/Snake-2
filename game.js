const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gridSize = 30;
const cols = canvas.width / gridSize;
const rows = canvas.height / gridSize;

const hudLevel = document.getElementById("hudLevel");
const hudApples = document.getElementById("hudApples");
const hudSpeed = document.getElementById("hudSpeed");
const hudStatus = document.getElementById("hudStatus");

const brightnessInput = document.getElementById("brightness");
const brightnessValue = document.getElementById("brightnessValue");
const snakeSkinSelect = document.getElementById("snakeSkin");
const levelButtonsContainer = document.getElementById("levelButtons");
const startBtn = document.getElementById("startBtn");
const resumeBtn = document.getElementById("resumeBtn");
const exitBtn = document.getElementById("exitBtn");

const levelConfigs = [
  { name: "Wnętrze wulkanu", palette: ["#180608", "#4e1408", "#cf3300"], obstacle: "lavaRock" },
  { name: "Las elfów", palette: ["#06140a", "#123622", "#2b6b45"], obstacle: "pine" },
  { name: "Kosmos", palette: ["#02020b", "#100b3d", "#2a51b8"], obstacle: "asteroid" },
  { name: "Zimowe góry", palette: ["#9bc3e0", "#466a8e", "#f2fbff"], obstacle: "ice" },
  { name: "Tropikalna wyspa", palette: ["#0c4c5e", "#2f9b8f", "#f4d08b"], obstacle: "palm" },
  { name: "Fabryka lodów", palette: ["#ffd9f4", "#d2b0ff", "#8f72bf"], obstacle: "machine" },
  { name: "Stadion piłkarski", palette: ["#0d3d16", "#1f772b", "#ddf7d8"], obstacle: "goal" },
  { name: "Miasteczko westernowe", palette: ["#613d24", "#ad713a", "#edcba4"], obstacle: "barrel" },
  { name: "Statek wycieczkowy", palette: ["#07345a", "#2d73b9", "#e6f4ff"], obstacle: "deck" },
  { name: "Zamek smoka", palette: ["#11121f", "#352742", "#9b80b8"], obstacle: "armor" }
];

const skins = {
  emerald: ["#2bbf5d", "#8af3aa", "#0c3115"],
  desert: ["#b3863a", "#ffe0a1", "#5f3f18"],
  shadow: ["#5f6a8f", "#d0dbff", "#20283f"]
};

let unlockedLevel = Number(localStorage.getItem("snakeUnlocked") || 1);
let selectedLevel = 1;
let running = false;
let paused = false;
let tickMs = 150;
let applesCollected = 0;
let currentLevel = 1;
const scoreTarget = 10;
let lastMove = 0;
let snake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let apple = { x: 10, y: 10 };
let obstacles = [];
let fireTiles = [];
let firePatternIndex = 0;
let fireTimer = 0;
let levelSpeedMultiplier = 1;
let animTime = 0;

function cellCenter(x, y) {
  return { x: x * gridSize + gridSize / 2, y: y * gridSize + gridSize / 2 };
}

function initSnake() {
  snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
}

function inSnake(x, y) {
  return snake.some((s) => s.x === x && s.y === y);
}
function inObstacles(x, y) {
  return obstacles.some((o) => o.x === x && o.y === y);
}
function inFire(x, y) {
  return fireTiles.some((f) => f.x === x && f.y === y);
}

function spawnApple() {
  let x;
  let y;
  do {
    x = Math.floor(Math.random() * cols);
    y = Math.floor(Math.random() * rows);
  } while (inSnake(x, y) || inObstacles(x, y) || inFire(x, y));
  apple = { x, y };
}

function buildObstacles(level) {
  const list = [];
  const padding = 2;
  const count = 8 + level * 2;
  for (let i = 0; i < count; i += 1) {
    const x = ((i * 3 + level * 7) % (cols - padding * 2)) + padding;
    const y = ((i * 5 + level * 4) % (rows - padding * 2)) + padding;
    if ((x < 8 && y === 10) || (x === apple.x && y === apple.y)) continue;
    list.push({ x, y });
  }
  return list;
}

function setupLevel(level) {
  currentLevel = level;
  applesCollected = 0;
  levelSpeedMultiplier = 1 + (level - 1) * 0.1;
  tickMs = Math.max(68, 150 - (level - 1) * 8);
  initSnake();
  obstacles = buildObstacles(level);
  fireTiles = [];
  firePatternIndex = 0;
  fireTimer = 0;
  spawnApple();
  updateHud();
}

function updateHud() {
  hudLevel.textContent = `Poziom: ${currentLevel} — ${levelConfigs[currentLevel - 1].name}`;
  hudApples.textContent = `Jabłka: ${applesCollected}/${scoreTarget}`;
  hudSpeed.textContent = `Prędkość: ${levelSpeedMultiplier.toFixed(1)}x`;
}

function createLevelButtons() {
  levelButtonsContainer.innerHTML = "";
  levelConfigs.forEach((lvl, i) => {
    const id = i + 1;
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.textContent = `${id}. ${lvl.name}`;
    btn.disabled = id > unlockedLevel;
    if (id === selectedLevel) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      selectedLevel = id;
      document.querySelectorAll(".level-btn").forEach((el) => el.classList.remove("selected"));
      btn.classList.add("selected");
      hudStatus.textContent = `Status: wybrano poziom ${id}`;
    });
    levelButtonsContainer.appendChild(btn);
  });
}

function levelComplete() {
  running = false;
  if (currentLevel < 10 && currentLevel >= unlockedLevel) {
    unlockedLevel = currentLevel + 1;
    localStorage.setItem("snakeUnlocked", String(unlockedLevel));
  }
  hudStatus.textContent = currentLevel === 10
    ? "Status: Wygrałeś całą kampanię!"
    : `Status: poziom ${currentLevel} ukończony! Odblokowano ${Math.min(10, unlockedLevel)}.`;
  createLevelButtons();
}

function drawStarfield90s(t) {
  for (let i = 0; i < 150; i += 1) {
    const x = (i * 61 + t * (0.004 + (i % 4) * 0.001)) % canvas.width;
    const y = (i * 39 + (i % 7) * 11) % canvas.height;
    const glow = 1 + Math.sin(t * 0.003 + i) * 0.8;
    ctx.fillStyle = `rgba(255,255,255,${0.45 + glow * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + (i % 3) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 4; i += 1) {
    const cx = ((i * 220 + t * 0.17) % (canvas.width + 140)) - 120;
    const cy = 110 + i * 110 + Math.sin(t * 0.002 + i) * 14;
    const tail = ctx.createLinearGradient(cx - 140, cy + 35, cx, cy);
    tail.addColorStop(0, "rgba(255,120,0,0)");
    tail.addColorStop(0.5, "rgba(255,160,70,0.5)");
    tail.addColorStop(1, "rgba(255,255,180,0.95)");
    ctx.strokeStyle = tail;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(cx - 120, cy + 32);
    ctx.quadraticCurveTo(cx - 40, cy + 10, cx, cy);
    ctx.stroke();

    const headGlow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 24);
    headGlow.addColorStop(0, "#fff5d0");
    headGlow.addColorStop(0.5, "#ffcf77");
    headGlow.addColorStop(1, "rgba(255,100,20,0)");
    ctx.fillStyle = headGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawElfForest(t) {
  for (let i = 0; i < 13; i += 1) {
    const x = i * 75 + 25;
    const trunkHeight = 70 + (i % 3) * 12;
    ctx.strokeStyle = "#42220f";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, 598);
    ctx.lineTo(x, 598 - trunkHeight);
    ctx.stroke();

    ctx.fillStyle = "#0d8c39";
    for (let k = 0; k < 3; k += 1) {
      const width = 46 - k * 8;
      const y = 545 - k * 20 + Math.sin(t * 0.001 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 30);
      ctx.lineTo(x - width, y + 10);
      ctx.lineTo(x + width, y + 10);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "rgba(130,255,170,0.18)";
    ctx.beginPath();
    ctx.arc(x, 525, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWinterMountains(t) {
  ctx.fillStyle = "rgba(80,112,145,0.65)";
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.lineTo(120, 240);
  ctx.lineTo(260, 420);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(190, 430);
  ctx.lineTo(390, 180);
  ctx.lineTo(620, 430);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(500, 420);
  ctx.lineTo(760, 220);
  ctx.lineTo(900, 420);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(245,255,255,0.95)";
  [[120, 240], [390, 180], [760, 220]].forEach(([mx, my]) => {
    ctx.beginPath();
    ctx.moveTo(mx - 48, my + 52);
    ctx.lineTo(mx, my);
    ctx.lineTo(mx + 48, my + 52);
    ctx.closePath();
    ctx.fill();
  });

  for (let i = 0; i < 120; i += 1) {
    const x = (i * 33 + t * 0.04) % canvas.width;
    const y = (i * 19 + t * 0.08) % canvas.height;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackground(level, t) {
  const [c1, c2, c3] = levelConfigs[level - 1].palette;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(0.55, c2);
  gradient.addColorStop(1, c3);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (level === 1) {
    for (let i = 0; i < 10; i += 1) {
      const x = (i * 120 + t * 0.05) % (canvas.width + 120) - 80;
      const y = 560 - (i % 3) * 60;
      const lava = ctx.createRadialGradient(x, y, 4, x, y, 45);
      lava.addColorStop(0, "rgba(255,240,90,0.8)");
      lava.addColorStop(1, "rgba(255,70,0,0)");
      ctx.fillStyle = lava;
      ctx.beginPath();
      ctx.arc(x, y, 45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (level === 2) drawElfForest(t);
  if (level === 3) drawStarfield90s(t);
  if (level === 4) drawWinterMountains(t);

  if (level === 5) {
    for (let i = 0; i < 7; i += 1) {
      const x = i * 130 + 40;
      ctx.strokeStyle = "#4a2f15";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, 598);
      ctx.lineTo(x + Math.sin(t * 0.001 + i) * 10, 520);
      ctx.stroke();
      ctx.fillStyle = "#2fb651";
      ctx.beginPath();
      ctx.arc(x + 6, 510, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawObstacleShape(o, type, t) {
  const c = cellCenter(o.x, o.y);
  if (type === "pine") {
    ctx.fillStyle = "#12320f";
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 13);
    ctx.lineTo(c.x - 12, c.y + 10);
    ctx.lineTo(c.x + 12, c.y + 10);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (type === "asteroid") {
    ctx.fillStyle = "#7f84b5";
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const r = 10 + Math.sin(a * 3 + o.x + o.y + t * 0.001) * 2;
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#84584c";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 11, 9, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawObstacles(t) {
  obstacles.forEach((o) => drawObstacleShape(o, levelConfigs[currentLevel - 1].obstacle, t));
}

function drawApple() {
  const c = cellCenter(apple.x, apple.y);
  const grad = ctx.createRadialGradient(c.x - 4, c.y - 6, 2, c.x, c.y, 12);
  grad.addColorStop(0, "#ffe4e4");
  grad.addColorStop(1, "#c50324");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#422f18";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 11);
  ctx.lineTo(c.x + 2, c.y - 18);
  ctx.stroke();
}

function drawSnake() {
  const colors = skins[snakeSkinSelect.value];
  snake.forEach((part, idx) => {
    const c = cellCenter(part.x, part.y);
    const r = idx === 0 ? 13 : 11;
    const grad = ctx.createRadialGradient(c.x - 4, c.y - 4, 2, c.x, c.y, r);
    grad.addColorStop(0, colors[1]);
    grad.addColorStop(1, colors[0]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r - 2, Math.sin(animTime * 0.002 + idx) * 0.26, 0, Math.PI * 2);
    ctx.fill();

    if (idx === 0) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(c.x - 4, c.y - 4, 2.6, 0, Math.PI * 2);
      ctx.arc(c.x + 4, c.y - 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(c.x - 4, c.y - 4, 1, 0, Math.PI * 2);
      ctx.arc(c.x + 4, c.y - 4, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function updateDragonFire(deltaMs) {
  if (currentLevel !== 10) return;
  fireTimer += deltaMs;
  if (fireTimer > 10000) {
    fireTimer = 0;
    firePatternIndex = (firePatternIndex + 1) % 4;
  }
  const dragon = { x: cols - 4, y: 3 };
  const patterns = [
    [{ x: -1, y: 0 }, { x: -2, y: 0 }, { x: -3, y: 0 }],
    [{ x: -1, y: -1 }, { x: -2, y: -1 }, { x: -3, y: -1 }],
    [{ x: -1, y: 1 }, { x: -2, y: 1 }, { x: -3, y: 1 }],
    [{ x: -1, y: 0 }, { x: -2, y: 1 }, { x: -3, y: -1 }]
  ];
  fireTiles = patterns[firePatternIndex]
    .map((p) => ({ x: dragon.x + p.x, y: dragon.y + p.y }))
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows);
}

function drawDragonBoss() {
  if (currentLevel !== 10) return;
  const c = cellCenter(cols - 4, 3);

  ctx.fillStyle = "#4a6a2f";
  ctx.beginPath();
  ctx.ellipse(c.x - 10, c.y + 2, 22, 14, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5a7d36";
  ctx.beginPath();
  ctx.arc(c.x + 14, c.y - 8, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ceda8d";
  ctx.beginPath();
  ctx.moveTo(c.x + 22, c.y - 8);
  ctx.lineTo(c.x + 33, c.y - 5);
  ctx.lineTo(c.x + 22, c.y - 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#354c23";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c.x - 18, c.y - 2);
  ctx.quadraticCurveTo(c.x - 40, c.y - 24, c.x - 48, c.y - 7);
  ctx.moveTo(c.x - 12, c.y + 6);
  ctx.quadraticCurveTo(c.x - 34, c.y + 28, c.x - 49, c.y + 10);
  ctx.stroke();

  fireTiles.forEach((tile) => {
    const f = cellCenter(tile.x, tile.y);
    const flame = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 16);
    flame.addColorStop(0, "#fff8b8");
    flame.addColorStop(0.5, "#ff9c2a");
    flame.addColorStop(1, "rgba(220,30,0,0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 16, 0, Math.PI * 2);
    ctx.fill();
  });
}

function gameOver(reason) {
  running = false;
  hudStatus.textContent = `Status: porażka (${reason})`;
}

function updateGame(timestamp) {
  const deltaMs = timestamp - animTime;
  animTime = timestamp;

  drawBackground(currentLevel, timestamp);
  updateDragonFire(deltaMs);

  if (running && !paused && timestamp - lastMove >= tickMs) {
    lastMove = timestamp;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) gameOver("uderzenie w ścianę");
    else if (inSnake(head.x, head.y)) gameOver("zderzenie z ogonem");
    else if (inObstacles(head.x, head.y)) gameOver("przeszkoda");
    else if (inFire(head.x, head.y)) gameOver("smoczy ogień");

    if (running) {
      snake.unshift(head);
      if (head.x === apple.x && head.y === apple.y) {
        applesCollected += 1;
        if (applesCollected >= scoreTarget) levelComplete();
        else spawnApple();
      } else snake.pop();
      updateHud();
    }
  }

  drawObstacles(timestamp);
  drawApple();
  drawSnake();
  drawDragonBoss();

  if (paused && running) {
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 52px sans-serif";
    ctx.fillText("PAUZA", canvas.width / 2 - 92, canvas.height / 2);
  }

  requestAnimationFrame(updateGame);
}

function startGame() {
  setupLevel(selectedLevel);
  running = true;
  paused = false;
  lastMove = performance.now();
  hudStatus.textContent = `Status: grasz na poziomie ${selectedLevel}`;
}

function resumeGame() {
  if (!running) {
    running = true;
    paused = false;
    lastMove = performance.now();
    hudStatus.textContent = `Status: wznowiono poziom ${currentLevel}`;
  }
}

function applyBrightness() {
  const val = Number(brightnessInput.value);
  canvas.style.setProperty("--brightness", `${val / 100}`);
  brightnessValue.textContent = `${val}%`;
}

function handleDirection(dx, dy) {
  if (-dx === dir.x && -dy === dir.y) return;
  nextDir = { x: dx, y: dy };
}

document.addEventListener("keydown", (e) => {
  if (["ArrowUp", "w", "W"].includes(e.key)) handleDirection(0, -1);
  if (["ArrowDown", "s", "S"].includes(e.key)) handleDirection(0, 1);
  if (["ArrowLeft", "a", "A"].includes(e.key)) handleDirection(-1, 0);
  if (["ArrowRight", "d", "D"].includes(e.key)) handleDirection(1, 0);
  if (e.key === " ") {
    paused = !paused;
    hudStatus.textContent = paused ? "Status: pauza" : "Status: gra";
  }
});

brightnessInput.addEventListener("input", applyBrightness);
startBtn.addEventListener("click", startGame);
resumeBtn.addEventListener("click", resumeGame);
exitBtn.addEventListener("click", () => {
  running = false;
  paused = false;
  hudStatus.textContent = "Status: zakończono grę";
});

createLevelButtons();
applyBrightness();
setupLevel(1);
requestAnimationFrame(updateGame);
