const gameArea = document.getElementById("gameArea");
const player = document.getElementById("player");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const soundToggleBtn = document.getElementById("soundToggle");
const scoreEl = document.getElementById("score");
const distanceEl = document.getElementById("distance");
const bestEl = document.getElementById("best");
const finalStats = document.getElementById("finalStats");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");

const state = {
  running: false,
  roadSpeed: 4,
  worldSpeed: 4,
  maxSpeed: 11,
  distance: 0,
  score: 0,
  best: Number(localStorage.getItem("arcade-racing-best") || 0),
  playerX: 0,
  playerY: 0,
  steerLeft: false,
  steerRight: false,
  entities: [],
  spawnTimer: 0,
  spawnRate: 950,
  lastTime: 0,
  audioEnabled: true,
};

bestEl.textContent = state.best;

const ROAD_MARGIN = 16;
const PLAYER_SPEED = 420;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function createTone({ freq = 200, duration = 0.12, type = "sine", volume = 0.06, slideTo }) {
  if (!state.audioEnabled) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) {
    osc.frequency.linearRampToValueAtTime(slideTo, now + duration);
  }
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

let engineOsc = null;
let engineGain = null;
let engineOscLayer = null;
let engineFilter = null;

function startEngineSound() {
  if (!state.audioEnabled || engineOsc) return;
  engineOsc = audioCtx.createOscillator();
  engineOscLayer = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  engineFilter = audioCtx.createBiquadFilter();

  engineOsc.type = "triangle";
  engineOscLayer.type = "sine";

  engineOsc.frequency.value = 88;
  engineOscLayer.frequency.value = 44;

  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 420;
  engineFilter.Q.value = 0.6;

  engineGain.gain.value = 0.022;

  engineOsc.connect(engineFilter);
  engineOscLayer.connect(engineFilter);
  engineFilter.connect(engineGain).connect(audioCtx.destination);

  engineOsc.start();
  engineOscLayer.start();
}

function stopEngineSound() {
  if (!engineOsc) return;
  engineOsc.stop();
  engineOscLayer.stop();
  engineOsc.disconnect();
  engineOscLayer.disconnect();
  engineFilter.disconnect();
  engineGain.disconnect();
  engineOsc = null;
  engineOscLayer = null;
  engineFilter = null;
  engineGain = null;
}

function updateEnginePitch() {
  if (!engineOsc) return;
  const pitch = 84 + state.worldSpeed * 11;
  engineOsc.frequency.setTargetAtTime(pitch, audioCtx.currentTime, 0.08);
  engineOscLayer.frequency.setTargetAtTime(pitch * 0.5, audioCtx.currentTime, 0.1);
  engineFilter.frequency.setTargetAtTime(360 + state.worldSpeed * 28, audioCtx.currentTime, 0.12);
}

function resetGame() {
  state.roadSpeed = 4;
  state.worldSpeed = 4;
  state.distance = 0;
  state.score = 0;
  state.spawnRate = 950;
  state.spawnTimer = 0;
  state.entities.forEach((entity) => entity.el.remove());
  state.entities = [];

  const areaWidth = gameArea.clientWidth;
  const areaHeight = gameArea.clientHeight;
  state.playerX = areaWidth / 2 - player.offsetWidth / 2;
  state.playerY = areaHeight - player.offsetHeight - 20;
  player.style.left = `${state.playerX}px`;
  player.style.top = `${state.playerY}px`;

  renderHud();
}

function renderHud() {
  scoreEl.textContent = Math.floor(state.score);
  distanceEl.textContent = `${Math.floor(state.distance)} m`;
  bestEl.textContent = state.best;
}

function spawnEntity() {
  const makeOpponent = Math.random() > 0.45;
  const el = document.createElement("div");

  if (makeOpponent) {
    el.className = "opponent";
  } else {
    el.className = "flag";
  }

  const roadLeft = ROAD_MARGIN;
  const roadRight = gameArea.clientWidth - ROAD_MARGIN - el.offsetWidth;
  const x = roadLeft + Math.random() * Math.max(roadRight - roadLeft, 1);

  el.style.left = `${x}px`;
  el.style.top = `${-100}px`;
  gameArea.appendChild(el);

  state.entities.push({
    type: makeOpponent ? "opponent" : "flag",
    x,
    y: -100,
    width: el.offsetWidth,
    height: el.offsetHeight,
    el,
  });
}

function intersects(a, b) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

function handleCollision() {
  createTone({ freq: 240, duration: 0.2, type: "square", volume: 0.09, slideTo: 80 });
  createTone({ freq: 140, duration: 0.32, type: "triangle", volume: 0.08, slideTo: 50 });
  gameOver();
}

function gameOver() {
  state.running = false;
  stopEngineSound();
  createTone({ freq: 330, duration: 0.25, type: "triangle", volume: 0.08, slideTo: 120 });

  if (state.score > state.best) {
    state.best = Math.floor(state.score);
    localStorage.setItem("arcade-racing-best", String(state.best));
  }

  renderHud();
  finalStats.textContent = `Score: ${Math.floor(state.score)} | Distance: ${Math.floor(state.distance)} m`;
  gameOverScreen.classList.add("visible");
}

function update(deltaMs) {
  const delta = deltaMs / 1000;

  if (state.steerLeft) state.playerX -= PLAYER_SPEED * delta;
  if (state.steerRight) state.playerX += PLAYER_SPEED * delta;

  const minX = ROAD_MARGIN;
  const maxX = gameArea.clientWidth - player.offsetWidth - ROAD_MARGIN;
  state.playerX = Math.max(minX, Math.min(maxX, state.playerX));
  player.style.left = `${state.playerX}px`;

  state.worldSpeed = Math.min(state.maxSpeed, state.worldSpeed + delta * 0.16);
  state.roadSpeed = state.worldSpeed;
  const road = document.querySelector(".road");
  road.style.animationDuration = `${Math.max(0.25, 1.05 - state.worldSpeed * 0.07)}s`;

  state.distance += state.worldSpeed * 1.5;
  state.score += state.worldSpeed * 2.1;
  state.spawnRate = Math.max(280, state.spawnRate - delta * 10);

  state.spawnTimer += deltaMs;
  if (state.spawnTimer >= state.spawnRate) {
    state.spawnTimer = 0;
    spawnEntity();
  }

  const playerRect = {
    x: state.playerX,
    y: state.playerY,
    width: player.offsetWidth,
    height: player.offsetHeight,
  };

  for (let i = state.entities.length - 1; i >= 0; i -= 1) {
    const entity = state.entities[i];
    entity.y += state.worldSpeed * (entity.type === "opponent" ? 105 : 120) * delta;
    entity.el.style.top = `${entity.y}px`;

    const entityRect = {
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    };

    if (intersects(playerRect, entityRect)) {
      handleCollision();
      return;
    }

    if (entity.y > gameArea.clientHeight + 120) {
      entity.el.remove();
      state.entities.splice(i, 1);
      state.score += entity.type === "opponent" ? 18 : 11;
    }
  }

  updateEnginePitch();
  renderHud();
}

function loop(timestamp) {
  if (!state.running) return;
  const deltaMs = Math.min(40, timestamp - (state.lastTime || timestamp));
  state.lastTime = timestamp;
  update(deltaMs);
  requestAnimationFrame(loop);
}

function startGame() {
  audioCtx.resume();
  resetGame();
  state.running = true;
  state.lastTime = 0;
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  createTone({ freq: 260, duration: 0.1, type: "square", volume: 0.07, slideTo: 520 });
  createTone({ freq: 520, duration: 0.16, type: "triangle", volume: 0.06, slideTo: 860 });
  startEngineSound();
  requestAnimationFrame(loop);
}

function setSteer(left, right) {
  state.steerLeft = left;
  state.steerRight = right;
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "a"].includes(key)) state.steerLeft = true;
  if (["arrowright", "d"].includes(key)) state.steerRight = true;
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "a"].includes(key)) state.steerLeft = false;
  if (["arrowright", "d"].includes(key)) state.steerRight = false;
});

function bindHoldButton(btn, direction) {
  const down = () => {
    if (direction === "left") setSteer(true, false);
    else setSteer(false, true);
  };
  const up = () => setSteer(false, false);

  btn.addEventListener("mousedown", down);
  btn.addEventListener("mouseup", up);
  btn.addEventListener("mouseleave", up);
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    down();
  }, { passive: false });
  btn.addEventListener("touchend", up);
}

bindHoldButton(leftBtn, "left");
bindHoldButton(rightBtn, "right");

soundToggleBtn.addEventListener("click", () => {
  state.audioEnabled = !state.audioEnabled;
  soundToggleBtn.classList.toggle("off", !state.audioEnabled);
  soundToggleBtn.textContent = state.audioEnabled ? "🔊 Sound" : "🔈 Sound";

  if (!state.audioEnabled) {
    stopEngineSound();
  } else if (state.running) {
    audioCtx.resume();
    startEngineSound();
  }
});

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

window.addEventListener("resize", () => {
  if (!state.running) {
    const areaWidth = gameArea.clientWidth;
    const areaHeight = gameArea.clientHeight;
    state.playerX = areaWidth / 2 - player.offsetWidth / 2;
    state.playerY = areaHeight - player.offsetHeight - 20;
    player.style.left = `${state.playerX}px`;
    player.style.top = `${state.playerY}px`;
  }
});

resetGame();
