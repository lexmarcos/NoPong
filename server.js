const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const { Engine, World, Bodies, Body, Detector } = require("matter-js");

app.use(express.static("public"));

http.listen(3000, () => {
  console.log("Listening on *:3000");
});

// Inicialização do motor de física (Matter.JS)
const engine = Engine.create();

const worldBounds = {
  min: { x: 0, y: 0 },
  max: { x: 800, y: 600 },
};

engine.world.bounds = worldBounds;
engine.gravity.y = 0;

// Configuração dos objetos do jogo
const paddleWidth = 20;
const paddleHeight = 100;
const paddleSpeed = 80;
const maxPaddleY = engine.world.bounds.max.y - paddleHeight / 2;
const minPaddleY = paddleHeight / 2;

const ballSettings = {
  inertia: 0,
  friction: 0,
  frictionStatic: 0,
  frictionAir: 0,
  restitution: 1.05,
  render: {
    fillStyle: "#f00",
  },
};

const ball = Bodies.circle(400, 300, 10, ballSettings);
ball.render.fillStyle = "red";
const wallSettings = {
  isStatic: true,
  render: {
    visible: false,
  },
};

const paddleA = Bodies.rectangle(
  paddleWidth / 2,
  engine.world.bounds.max.y / 2,
  paddleWidth,
  paddleHeight,
  { isStatic: true, inertia: 0, friction: 0, frictionStatic: 0, frictionAir: 0 }
);

const paddleB = Bodies.rectangle(
  engine.world.bounds.max.x - paddleWidth / 2,
  engine.world.bounds.max.y / 2,
  paddleWidth,
  paddleHeight,
  { isStatic: true, inertia: 0, friction: 0, frictionStatic: 0, frictionAir: 0 }
);

const leftWall = Bodies.rectangle(-5, 300, 10, 600, wallSettings);
const rightWall = Bodies.rectangle(805, 300, 10, 600, wallSettings);
const topWall = Bodies.rectangle(400, -5, 800, 10, wallSettings);
const bottomWall = Bodies.rectangle(400, 605, 800, 10, wallSettings);

World.add(engine.world, [paddleA, paddleB, ball, leftWall, rightWall, topWall, bottomWall]);

function resetBall() {
  Body.setPosition(ball, { x: 400, y: 300 });
  Body.setVelocity(ball, { x: 0, y: 0 });
  firstRun = true;
}

function getRandomInitialForce() {
  const minForce = 0.0082;
  const maxForce = 0.0084;

  const xForce = minForce + Math.random() * (maxForce - minForce);
  const yForce = minForce + Math.random() * (maxForce - minForce);

  const xDirection = Math.random() < 0.5 ? 1 : -1;
  const yDirection = Math.random() < 0.5 ? 1 : -1;

  return { x: xForce * xDirection, y: yForce * yDirection };
}

let players = {};

io.on("connection", (socket) => {
  const numbersOfPlayers = Object.keys(players).length;
  if (numbersOfPlayers < 2) {
    players[socket.id] = {
      paddle: numbersOfPlayers === 0 ? paddleA : paddleB,
      score: 0,
    };
  } else {
    console.log("a user tried to connect", socket.id);
  }

  socket.on("move", (data) => {
    const targetY = players[socket.id].paddle.position.y + data.direction * paddleSpeed;
    players[socket.id].targetY = Math.min(Math.max(targetY, minPaddleY), maxPaddleY);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    console.log("user disconnected", socket.id);
  });
});

let firstRun = true;

const detectorOfRightWall = Detector.create({
  bodies: [ball, rightWall],
});

const detectorOfLeftWall = Detector.create({
  bodies: [ball, leftWall],
});

let score = {
  playerA: 0,
  playerB: 0,
};

let gameStarted = false;
function gameLoop() {
  const gameState = {
    paddleA: paddleA.position,
    paddleB: paddleB.position,
    ball: ball.position,
    score: score,
    state: "waitingForPlayers",
  };
  if (Object.keys(players).length === 2 && !gameStarted) {
    gameStarted = true;
    gameState.state = "playing";
  }

  if (gameStarted) {
    Engine.update(engine, 1000 / 60);

    if (firstRun) {
      const initialForce = getRandomInitialForce();
      Body.applyForce(ball, ball.position, initialForce);
      firstRun = false;
    }

    const collisionsWithRightWall = Detector.collisions(detectorOfRightWall, engine);
    const collisionsWithLeftWall = Detector.collisions(detectorOfLeftWall, engine);

    if (collisionsWithRightWall.length > 0) {
      score.playerA += 1;
      resetBall();
    }

    if (collisionsWithLeftWall.length > 0) {
      score.playerB += 1;
      resetBall();
    }
    gameState.state = "playing";

    const lerp = (start, end, amount) => start + (end - start) * amount;
    const lerpSpeed = 0.2; // Ajuste este valor para controlar a velocidade da interpolação (valores entre 0 e 1)

    Object.values(players).forEach((player) => {
      const targetY = player.targetY;
      if (targetY !== undefined) {
        const newY = lerp(player.paddle.position.y, targetY, lerpSpeed);
        Body.setPosition(player.paddle, { x: player.paddle.position.x, y: newY });
      }
    });
  }
  io.emit("gameState", gameState);
  setTimeout(gameLoop, 1000 / 60);
}
gameLoop();
