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
  { name: "Wnętrze wulkanu", palette: ["#230000", "#7a1400", "#ff6a00"], obstacle: "lavaRock" },
  { name: "Las elfów", palette: ["#0b1f0e", "#1f6b2b", "#93ea8f"], obstacle: "tree" },
  { name: "Kosmos", palette: ["#050718", "#1f2674", "#7a7fff"], obstacle: "asteroid" },
  { name: "Zimowe góry", palette: ["#b7d4ec", "#4f7199", "#ffffff"], obstacle: "ice" },
  { name: "Tropikalna wyspa", palette: ["#0e4e58", "#38a58d", "#f7d37e"], obstacle: "palm" },
  { name: "Fabryka lodów", palette: ["#ffe0f3", "#d3a2ff", "#7d52af"], obstacle: "machine" },
  { name: "Stadion piłkarski", palette: ["#114415", "#2b7f31", "#def5d8"], obstacle: "goal" },
  { name: "Miasteczko westernowe", palette: ["#7a4a2b", "#bc7d3a", "#f4d3a4"], obstacle: "barrel" },
  { name: "Statek wycieczkowy", palette: ["#09325c", "#2e6db5", "#f7fdff"], obstacle: "deck" },
  { name: "Zamek smoka", palette: ["#1f1f2f", "#4e3854", "#baa0d9"], obstacle: "armor" }
];

const skins = {
  emerald: ["#2bbf5d", "#7ce48f", "#11471f"],
  desert: ["#b3863a", "#f2d292", "#5f3f18"],
  shadow: ["#5f6a8f", "#a8b3d9", "#20283f"]
};

let unlockedLevel = Number(localStorage.getItem("snakeUnlocked") || 1);
let selectedLevel = 1;
let running = false;
let paused = false;
let tickMs = 150;
let applesCollected = 0;
let currentLevel = 1;
let scoreTarget = 10;
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

function initSnake() {
  snake = [
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 }
  ];
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
  const seed = level * 3;

  for (let i = 0; i < 8 + level * 2; i += 1) {
    const x = (i * 3 + seed) % (cols - padding * 2) + padding;
    const y = (i * 2 + seed * 2) % (rows - padding * 2) + padding;
    if ((x < 8 && y === 10) || (x === apple.x && y === apple.y)) continue;
    list.push({ x, y });

    if (i % 3 === 0 && x + 1 < cols - 1) list.push({ x: x + 1, y });
    if (i % 4 === 0 && y + 1 < rows - 1) list.push({ x, y: y + 1 });
  }

  if (level === 3) {
    for (let i = 1; i < cols - 1; i += 4) list.push({ x: i, y: (i % 5) + 2 });
  }

  return list;
}

function setupLevel(level, resetScore = true) {
  currentLevel = level;
  applesCollected = resetScore ? 0 : applesCollected;
  levelSpeedMultiplier = 1 + (level - 1) * 0.1;
  tickMs = Math.max(70, 150 - (level - 1) * 7);
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

  if (currentLevel === 10) {
    hudStatus.textContent = "Status: Wygrałeś całą kampanię!";
  } else {
    hudStatus.textContent = `Status: poziom ${currentLevel} ukończony! Odblokowano ${Math.min(10, unlockedLevel)}.`;
  }
  createLevelButtons();
  resumeBtn.disabled = false;
}

function drawCell3D(x, y, colorTop, colorSide, radius = 0.18) {
  const px = x * gridSize;
  const py = y * gridSize;

  ctx.fillStyle = colorSide;
  ctx.beginPath();
  ctx.roundRect(px + 2, py + 7, gridSize - 5, gridSize - 7, gridSize * radius);
  ctx.fill();

  ctx.fillStyle = colorTop;
  ctx.beginPath();
  ctx.roundRect(px + 2, py + 2, gridSize - 5, gridSize - 9, gridSize * radius);
  ctx.fill();
}

function drawBackground(level, t) {
  const [c1, c2, c3] = levelConfigs[level - 1].palette;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(0.6, c2);
  gradient.addColorStop(1, c3);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (level === 1) {
    for (let i = 0; i < 14; i += 1) {
      ctx.fillStyle = `rgba(255, ${80 + i * 6}, 0, 0.2)`;
      const x = ((i * 130 + t * 0.04) % (canvas.width + 80)) - 80;
      ctx.beginPath();
      ctx.ellipse(x, 540 - (i % 3) * 70, 60, 25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (level === 3) {
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 73 + t * 0.01) % canvas.width;
      const y = (i * 41) % canvas.height;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 4; i += 1) {
      const x = ((i * 220 + t * 0.16) % (canvas.width + 100)) - 100;
      const y = 120 + i * 100;
      ctx.strokeStyle = "rgba(184,227,255,0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 65, y + 20);
      ctx.stroke();
    }
  }

  if (level === 4) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 120; i += 1) {
      const x = (i * 31 + t * 0.04) % canvas.width;
      const y = (i * 17 + t * 0.09) % canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  if (level === 5) {
    for (let i = 0; i < 6; i += 1) {
      const baseX = i * 150 + 40;
      ctx.strokeStyle = "#40270e";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(baseX, 590);
      ctx.lineTo(baseX + Math.sin(t * 0.001 + i) * 8, 520);
      ctx.stroke();
      ctx.fillStyle = "#29b34b";
      ctx.beginPath();
      ctx.arc(baseX + 5, 510, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 4; i += 1) {
      const x = i * 220 + 100;
      const y = 560 + Math.sin(t * 0.004 + i) * 10;
      ctx.fillStyle = "#ff6be5";
      ctx.fillRect(x, y, 12, 24);
      ctx.fillStyle = "#f4d37e";
      ctx.beginPath();
      ctx.arc(x + 6, y - 6, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawObstacles() {
  const key = levelConfigs[currentLevel - 1].obstacle;
  const map = {
    lavaRock: ["#51311f", "#a6582d"],
    tree: ["#4a2f1f", "#4ab04f"],
    asteroid: ["#31334d", "#949ad2"],
    ice: ["#b8ebff", "#5da1d0"],
    palm: ["#5c3820", "#5ec866"],
    machine: ["#7d6fb8", "#d4bef4"],
    goal: ["#d8d8d8", "#343434"],
    barrel: ["#915726", "#e0a060"],
    deck: ["#7c97b8", "#dde9f7"],
    armor: ["#6f6f86", "#b3b3cb"]
  };
  const [side, top] = map[key];
  obstacles.forEach((o) => drawCell3D(o.x, o.y, top, side, 0.12));
}

function drawApple() {
  const px = apple.x * gridSize + gridSize / 2;
  const py = apple.y * gridSize + gridSize / 2;
  const grad = ctx.createRadialGradient(px - 4, py - 5, 4, px, py, 13);
  grad.addColorStop(0, "#ffdbdb");
  grad.addColorStop(1, "#d20721");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3f2d0f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py - 11);
  ctx.lineTo(px + 2, py - 18);
  ctx.stroke();
}

function drawSnake() {
  const colors = skins[snakeSkinSelect.value];
  snake.forEach((part, idx) => {
    const centerX = part.x * gridSize + gridSize / 2;
    const centerY = part.y * gridSize + gridSize / 2;
    const isHead = idx === 0;
    const r = isHead ? 13 : 11;

    const grad = ctx.createRadialGradient(centerX - 4, centerY - 4, 3, centerX, centerY, r);
    grad.addColorStop(0, colors[1]);
    grad.addColorStop(1, colors[0]);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, r, r - 2, Math.sin(idx + animTime * 0.002) * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors[2];
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (isHead) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(centerX - 4, centerY - 4, 2.5, 0, Math.PI * 2);
      ctx.arc(centerX + 4, centerY - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(centerX - 4, centerY - 4, 1, 0, Math.PI * 2);
      ctx.arc(centerX + 4, centerY - 4, 1, 0, Math.PI * 2);
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

  const dragon = { x: cols - 3, y: 2 };
  const patterns = [
    [{ x: -1, y: 0 }, { x: -2, y: 0 }, { x: -3, y: 0 }],
    [{ x: -1, y: 1 }, { x: -2, y: 1 }, { x: -3, y: 1 }],
    [{ x: -1, y: -1 }, { x: -2, y: -1 }, { x: -3, y: -1 }],
    [{ x: -1, y: 0 }, { x: -2, y: 1 }, { x: -3, y: -1 }]
  ];

  fireTiles = patterns[firePatternIndex]
    .map((p) => ({ x: dragon.x + p.x, y: dragon.y + p.y }))
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows);
}

function drawDragonBoss() {
  if (currentLevel !== 10) return;

  const x = cols - 3;
  const y = 2;
  drawCell3D(x, y, "#7f4229", "#3a1d12", 0.3);
  drawCell3D(x + 1, y, "#91512f", "#3a1d12", 0.2);

  fireTiles.forEach((tile) => {
    drawCell3D(tile.x, tile.y, "#ff9f2d", "#be3500", 0.14);
    ctx.fillStyle = "rgba(255, 220, 120, 0.7)";
    ctx.beginPath();
    ctx.arc(tile.x * gridSize + gridSize / 2, tile.y * gridSize + gridSize / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function gameOver(reason) {
  running = false;
  hudStatus.textContent = `Status: porażka (${reason})`;
  resumeBtn.disabled = false;
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

    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
      gameOver("uderzenie w ścianę");
    } else if (inSnake(head.x, head.y)) {
      gameOver("zderzenie z ogonem");
    } else if (inObstacles(head.x, head.y)) {
      gameOver("przeszkoda");
    } else if (inFire(head.x, head.y)) {
      gameOver("smoczy ogień");
    }

    if (running) {
      snake.unshift(head);
      if (head.x === apple.x && head.y === apple.y) {
        applesCollected += 1;
        if (applesCollected >= scoreTarget) {
          levelComplete();
        } else {
          spawnApple();
        }
      } else {
        snake.pop();
      }
      updateHud();
    }
  }

  drawObstacles();
  drawApple();
  drawSnake();
  drawDragonBoss();

  if (paused && running) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText("PAUZA", canvas.width / 2 - 95, canvas.height / 2);
  }

  requestAnimationFrame(updateGame);
}

function startGame() {
  setupLevel(selectedLevel, true);
  running = true;
  paused = false;
  lastMove = performance.now();
  resumeBtn.disabled = false;
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
  if (!window.close()) {
    alert("Gra została zatrzymana. Możesz zamknąć kartę.");
  }
});

createLevelButtons();
applyBrightness();
setupLevel(1);
requestAnimationFrame(updateGame);
