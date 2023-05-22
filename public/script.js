const socket = io();

const room = new URLSearchParams(window.location.search).get("room");
if (!room) {
  window.location.href = "/createRoom.html";
}
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

socket.emit("joinRoom", { room });

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
    document.getElementById("score").innerHTML = `${score.playerA} | ${score.playerB}`;
    oldScore = score;
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

socket.on("gameState", (data) => {
  const { isCollidingWithPaddleA, isCollidingWithPaddleB, ball, state, score } = data;
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
}

document.addEventListener("keydown", (event) => {
  if (event.code === "ArrowUp") {
    sendMove(-1);
  } else if (event.code === "ArrowDown") {
    sendMove(1);
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "ArrowUp" || event.code === "ArrowDown") {
    sendMove(0);
  }
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
  const paddleAColor = paddleATouched ? "#FFFFFF" : "#59ffa7";
  const paddleBColor = paddleBTouched ? "#FFFFFF" : "#69acff";

  drawRectangle(state.paddleA.x, state.paddleA.y, 20, 100, paddleAColor);
  drawRectangle(state.paddleB.x, state.paddleB.y, 20, 100, paddleBColor);
  drawCircle(state.ball.x, state.ball.y, 10);
}

function drawBallTrail() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; // Ajuste a cor e a opacidade conforme necessário
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

  if (!currentState) return;

  const alpha = computeAlpha();

  const interpolatedState = interpolateState(previousState, currentState, alpha);

  clearCanvas();
  if (paddleATouched || paddleBTouched) {
    console.log("paddle touched");
  }
  drawGameElements(interpolatedState);

  drawBallTrail();
}

// Inicia o loop de renderização
render();
