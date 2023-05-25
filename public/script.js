const room = new URLSearchParams(window.location.search).get("room");
if (!room) {
  window.location.href = "/createRoom/createRoom.html";
}

const username = localStorage.getItem("username");

if (!username) {
  window.location.href = "/addusername/index.html?room=" + room;
}

const socket = io();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

socket.emit("joinRoom", { room, username });

// Função para enviar comandos de movimento
function sendMove(direction) {
  // Envia a direção do movimento e o identificador do jogador para o servidor
  socket.emit("move", { id: socket.id, direction, room });
}

let previousState = null;
let currentState = null;
let stateReceivedAt = 0;

function interpolateState(previous, current, alpha) {
  if (!previous) return current;

  const interpolated = {
    paddleA: {
      x: previous.paddleA.x + (current.paddleA.x - previous.paddleA.x) * alpha,
      y: previous.paddleA.y + (current.paddleA.y - previous.paddleA.y) * alpha,
    },
    paddleB: {
      x: previous.paddleB.x + (current.paddleB.x - previous.paddleB.x) * alpha,
      y: previous.paddleB.y + (current.paddleB.y - previous.paddleB.y) * alpha,
    },
    ball: {
      x: previous.ball.x + (current.ball.x - previous.ball.x) * alpha,
      y: previous.ball.y + (current.ball.y - previous.ball.y) * alpha,
    },
  };

  return interpolated;
}

let oldScore = {
  playerA: 0,
  playerB: 0,
};

waitingPlayerDiv = document.getElementById("waiting-player");

function setScore(score) {
  if (oldScore && (oldScore.playerA < score.playerA || oldScore.playerB < score.playerB)) {
    document.getElementById("playerA-score").innerHTML = score.playerA ;
    document.getElementById("playerB-score").innerHTML = score.playerB;
  }
}

function setWaitingForPlayers() {
  waitingPlayerDiv.innerHTML = "Waiting for players...";
}

let paddleATouched = false;
let paddleBTouched = false;

const paddleSound = new Audio("assets/block.mp3");
let ballTrail = [];
const maxTrailLength = 20;

function playPaddleSound(isCollidingWithPaddleA, isCollidingWithPaddleB) {
  if (isCollidingWithPaddleA || isCollidingWithPaddleB) {
    paddleSound.play();
  }
}

function handlePaddleTouch(isCollidingWithPaddleA, isCollidingWithPaddleB) {
  if (isCollidingWithPaddleA) {
    paddleATouched = true;
    setTimeout(() => {
      paddleATouched = false;
    }, 300);
  }
  if (isCollidingWithPaddleB) {
    paddleBTouched = true;
    setTimeout(() => {
      paddleBTouched = false;
    }, 300);
  }
}

function updateBallTrail(ball) {
  ballTrail.push(ball);
  if (ballTrail.length > maxTrailLength) {
    ballTrail.shift();
  }
}

function handleGameStates(state) {
  if (state === "waitingForPlayers") {
    setWaitingForPlayers();
  } else {
    waitingPlayerDiv.style.display = "none";
  }
}

function updateGameState(score, data) {
  previousState = currentState;
  currentState = data;
  stateReceivedAt = Date.now();
  setScore(score);
}

function checkIfHasWinner(gameState) {
  if (gameState.state === "winner") {
    const winner = gameState.winner;
    window.location.href = "/winner.html?winner=" + winner;
  }
}

socket.on("gameState", (data) => {
  const { isCollidingWithPaddleA, isCollidingWithPaddleB, ball, state, score } = data;
  checkIfHasWinner(data);
  playPaddleSound(isCollidingWithPaddleA, isCollidingWithPaddleB);
  handlePaddleTouch(isCollidingWithPaddleA, isCollidingWithPaddleB);
  updateBallTrail(ball);
  handleGameStates(state);
  updateGameState(score, data);
});

function drawRectangle(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.shadowBlur = 100; // Define o quão borrada a sombra será
  ctx.shadowColor = color; // Define a cor da sombra
  ctx.shadowOffsetX = 0; // Define o deslocamento horizontal da sombra
  ctx.shadowOffsetY = 0; // Define o deslocamento vertical da sombra
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
}

function drawCircle(x, y, radius) {
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0;
}

let moveUp = false;
let moveDown = false;

const controlsDown = {
  ArrowUp: () => (moveUp = true),
  ArrowDown: () => (moveDown = true),
};

const controlsUp = {
  ArrowUp: () => (moveUp = false),
  ArrowDown: () => (moveDown = false),
};

document.addEventListener("keydown", (event) => {
  controlsDown[event.code]?.();
});

document.addEventListener("keyup", (event) => {
  controlsUp[event.code]?.();
});

function computeAlpha() {
  const currentTime = Date.now();
  const elapsed = currentTime - stateReceivedAt;
  return Math.min(elapsed / (1000 / 60), 1);
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawGameElements(state) {
  const paddleAColor = paddleATouched ? "#FFFFFF" : "#00fa75";
  const paddleBColor = paddleBTouched ? "#FFFFFF" : "#ff007b";

  drawRectangle(state.paddleA.x, state.paddleA.y, 20, 100, paddleAColor);
  drawRectangle(state.paddleB.x, state.paddleB.y, 20, 100, paddleBColor);
  drawCircle(state.ball.x, state.ball.y, 10);
}

function drawBallTrail() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ballTrail.forEach((position, index) => {
    const opacity = (index + 1) / ballTrail.length;
    const sizeOfTrail = index / 2;
    const hue = (index / ballTrail.length) * 360; // Varia de 0 a 360
    ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${(index + 1) / ballTrail.length})`; // Use HSLA para definir a cor
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(position.x, position.y, sizeOfTrail, 0, 2 * Math.PI);
    ctx.fill();
  });
}

function render() {
  requestAnimationFrame(render);

  if (moveUp) {
    sendMove(-1);
  } else if (moveDown) {
    sendMove(1);
  }

  if (!currentState) return;

  const alpha = computeAlpha();
  const interpolatedState = interpolateState(previousState, currentState, alpha);

  clearCanvas();
  drawGameElements(interpolatedState);

  drawBallTrail();
}

// Inicia o loop de renderização
render();
