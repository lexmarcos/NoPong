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

socket.on("gameState", (data) => {
  console.log(data);
  if (data.state === "waitingForPlayers") {
    setWaitingForPlayers();
  } else {
    waitingPlayerDiv.style.display = "none";
  }
  previousState = currentState;
  currentState = data;
  stateReceivedAt = Date.now();
  setScore(data.score);
});

function drawRectangle(x, y, width, height) {
  ctx.fillStyle = "white";
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
}

function drawCircle(x, y, radius) {
  ctx.fillStyle = "white";
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

function render() {
  requestAnimationFrame(render);

  if (!currentState) return;

  const currentTime = Date.now();
  const elapsed = currentTime - stateReceivedAt;
  const alpha = Math.min(elapsed / (1000 / 60), 1);

  const interpolatedState = interpolateState(previousState, currentState, alpha);

  // Limpa o canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Desenha as raquetes e a bola
  drawRectangle(interpolatedState.paddleA.x, interpolatedState.paddleA.y, 20, 100);
  drawRectangle(interpolatedState.paddleB.x, interpolatedState.paddleB.y, 20, 100);
  drawCircle(interpolatedState.ball.x, interpolatedState.ball.y, 10);
}

// Inicia o loop de renderização
render();
