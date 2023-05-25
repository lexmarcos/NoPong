const { createEngine, startGame } = require("./game");
const { io } = require("./http");

let rooms = new Map();

const getPlayerPaddle = (numbersOfPlayers, engineDataOfRoom) => {
  if (numbersOfPlayers === 0) {
    return engineDataOfRoom.paddleA;
  }
  return engineDataOfRoom.paddleB;
};

const joinRoom = (socket, room, username) => {
  if (!rooms.has(room)) {
    const engineData = createEngine(room);
    rooms.set(room, {
      players: [],
      engineData,
      gameState: {
        gameLoopInterval: null,
        paddleA: engineData.paddleA.position,
        paddleB: engineData.paddleB.position,
        ball: engineData.ball.position,
        state: "waitingForPlayers",
        firstRun: true,
        winner: null,
        playersNames: [],
        score: {
          playerA: 0,
          playerB: 0,
        },
      },
    });
  }

  let roomData = rooms.get(room);
  let engineDataOfRoom = roomData.engineData;
  let players = roomData.players;
  let gameState = roomData.gameState;

  if (players.length == 2) {
    console.log("room is full");
    return;
  }

  players.push({
    id: socket.id,
    paddle: getPlayerPaddle(players.length, engineDataOfRoom),
    score: 0,
    username,
  });

  gameState.playersNames.push(username);

  if (players.length === 1 && gameState.state !== "playing") {
    startGame(engineDataOfRoom, room, players, gameState);
  }

  if (players.length === 2) {
    gameState.state = "playing";
  }

  if (players.length === 2 && gameState.state === "paused") {
    gameState.state = "playing";
  }

  socket.join(room);
  console.log("user joined room", room);
};

const movePlayer = (socket, data) => {
  const room = data.room;
  const roomData = rooms.get(room);
  const roomEngineData = roomData.engineData;
  const players = roomData.players;
  const player = players.find((player) => player.id === socket.id);

  const targetY = player.paddle.position.y + data.direction * roomEngineData.paddleSpeed;
  player.targetY = Math.min(
    Math.max(targetY, roomEngineData.minPaddleY),
    roomEngineData.maxPaddleY
  );
};

const disconnectPlayer = (socket) => {
  console.log("user disconnected", socket.id);
  for (const [room, roomData] of rooms) {
    const players = roomData.players;
    const playerIndex = players.findIndex((player) => player.id === socket.id);
    if (playerIndex !== -1) {
      rooms.get(room).gameState.state = "paused";
      players.splice(playerIndex, 1);
      if (players.length === 0) {
        rooms.get(room).gameState.state = "waitingForPlayers";
        rooms.delete(room);
        console.log(`Room ${room} is empty and has been deleted.`);
      }
    }
  }
};

io.on("connection", (socket) => {
  socket.on("joinRoom", (data) => {
    const room = data.room;
    const username = data.username;
    joinRoom(socket, room, username);
  });

  socket.on("move", (data) => {
    movePlayer(socket, data);
  });

  socket.on("disconnect", () => {
    disconnectPlayer(socket);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("user reconnected");
  });
});
