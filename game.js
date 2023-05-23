const { Engine, World, Bodies, Body, Detector } = require("matter-js");
const { io } = require("./http");

const createEngine = () => {
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
  const paddleSpeed = 150;
  const maxPaddleY = engine.world.bounds.max.y - paddleHeight / 2;
  const minPaddleY = paddleHeight / 2;

  const ballSettings = {
    inertia: 0,
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0,
    restitution: 1.4,
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

  const detectorOfRightWall = Detector.create({
    bodies: [ball, rightWall],
  });

  const detectorOfLeftWall = Detector.create({
    bodies: [ball, leftWall],
  });

  const detectorPaddleA = Detector.create({
    bodies: [ball, paddleA],
  });

  const detectorPaddleB = Detector.create({
    bodies: [ball, paddleB],
  });

  return {
    engine: engine,
    paddleA: paddleA,
    paddleB: paddleB,
    ball: ball,
    gameStarted: false,
    leftWall,
    rightWall,
    topWall,
    bottomWall,
    paddleSpeed,
    maxPaddleY,
    minPaddleY,
    detectorOfRightWall,
    detectorOfLeftWall,
    detectorPaddleA,
    detectorPaddleB,
  };
};

function resetBall(ball) {
  Body.setPosition(ball, { x: 400, y: 300 });
  Body.setVelocity(ball, { x: 0, y: 0 });
}

function getRandomInitialForce() {
  const maxForce = 0.1; // Defina a força máxima aqui
  const minForce = 0.1; // Defina a força mínima aqui
  let xForce = Math.random() * (maxForce - minForce) + minForce;
  let yForce = Math.random() * (maxForce - minForce) + minForce;

  const xDirection = Math.random() < 0.5 ? 1 : -1;
  let yDirection = Math.random() < 0.5 ? 1 : -1;

  // Adiciona uma verificação para garantir que a força y não seja muito pequena
  while (Math.abs(yForce * yDirection) < minForce) {
    yForce = Math.random() * (maxForce - minForce) + minForce;
  }

  return { x: xForce * xDirection, y: yForce * yDirection };
}

const startGame = (engineData, roomName, players, gameState) => {
  let { engine, ball, detectorOfRightWall, detectorOfLeftWall, detectorPaddleA, detectorPaddleB } =
    engineData;
  let { firstRun, gameStarted, score, gamePaused, gameLoopInterval } = gameState;

  const maxSpeed = 15;

  function gameLoop() {
    let { gamePaused } = gameState;
    if (gameLoopInterval) {
      clearTimeout(gameLoopInterval);
    }
    if (players.length === 2 && !gameStarted) {
      gameStarted = true;
      gamePaused = false;
      gameState.state = "playing";
    }

    if (players.length < 2 && gameStarted) {
      console.log("game paused", players.length < 2 && gameStarted);
      io.to(roomName).emit("gameState", gameState);
      // Um dos jogadores não está pronto, então vamos pausar o jogo
      gamePaused = true; // Continue o loop, mas não faça nada neste quadro
      return setTimeout(gameLoop, 1000 / 60);
    }

    if (gameStarted && !gamePaused) {
      Engine.update(engine, 1000 / 60);
      console.log("game started");
      const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
      if (speed > maxSpeed) {
        // A bola está se movendo muito rápido! Reduzir a velocidade para o máximo.
        const scaleFactor = maxSpeed / speed; // Este é o fator pelo qual precisamos reduzir a velocidade para trazê-la de volta ao máximo
        Body.setVelocity(ball, {
          x: ball.velocity.x * scaleFactor,
          y: ball.velocity.y * scaleFactor,
        });
      }

      if (firstRun) {
        const initialForce = getRandomInitialForce();
        Body.applyForce(ball, ball.position, initialForce);
        firstRun = false;
      }

      const collisionsWithRightWall = Detector.collisions(detectorOfRightWall, engine);
      const collisionsWithLeftWall = Detector.collisions(detectorOfLeftWall, engine);
      const collisionsWithPaddleA = Detector.collisions(detectorPaddleA, engine);
      const collisionsWithPaddleB = Detector.collisions(detectorPaddleB, engine);

      if (collisionsWithPaddleA.length > 0) {
        gameState.isCollidingWithPaddleA = true;
      } else {
        gameState.isCollidingWithPaddleA = false;
      }

      if (collisionsWithPaddleB.length > 0) {
        gameState.isCollidingWithPaddleB = true;
      } else {
        gameState.isCollidingWithPaddleB = false;
      }

      if (collisionsWithRightWall.length > 0) {
        score.playerA += 1;
        resetBall(ball);
        firstRun = true;
      }

      if (collisionsWithLeftWall.length > 0) {
        score.playerB += 1;
        resetBall(ball);
        firstRun = true;
      }
      gameState.state = "playing";

      const lerp = (start, end, amount) => start + (end - start) * amount;
      const lerpSpeed = 0.1;

      Object.values(players).forEach((player) => {
        const targetY = player.targetY;
        if (targetY !== undefined) {
          const newY = lerp(player.paddle.position.y, targetY, lerpSpeed);
          Body.setPosition(player.paddle, { x: player.paddle.position.x, y: newY });
        }
      });
    }
    io.to(roomName).emit("gameState", gameState);
    gameLoopInterval = setTimeout(gameLoop, 1000 / 60);
  }
  if (!gameStarted) {
    gameLoop();
  }
};

module.exports = {
  createEngine,
  startGame,
};
