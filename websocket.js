const { createEngine, startGame } = require("./game");
const { io } = require("./http");

let rooms = new Map();

const getPlayerPaddle = (numbersOfPlayers, engineDataOfRoom) => {
  if (numbersOfPlayers === 0) {
    return engineDataOfRoom.paddleA;
  }
  return engineDataOfRoom.paddleB;
};

const joinRoom = (socket, room) => {
  if (!rooms.has(room)) {
    rooms.set(room, {
      players: [],
      engineData: createEngine(room),
      gameState: {
        firstRun: true,
        gameStarted: false,
        score: {
          playerA: 0,
          playerB: 0,
        },
      },
    });
  }

  const roomData = rooms.get(room);
  const engineDataOfRoom = roomData.engineData;
  const players = roomData.players;
  const gameState = roomData.gameState;
  const numbersOfPlayers = players.length;

  if (numbersOfPlayers == 2) {
    console.log("room is full");
    return;
  }

  players.push({
    id: socket.id,
    paddle: getPlayerPaddle(numbersOfPlayers, engineDataOfRoom),
    score: 0,
  });

  startGame(engineDataOfRoom, room, players, gameState);

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
      players.splice(playerIndex, 1);
      if (players.length === 0) {
        rooms.delete(room);
        console.log(`Room ${room} is empty and has been deleted.`);
      }
    }
  }
};

io.on("connection", (socket) => {
  socket.on("joinRoom", (data) => {
    const room = data.room;
    joinRoom(socket, room);
  });

  socket.on("move", (data) => {
    movePlayer(socket, data);
  });

  socket.on("disconnect", () => {
    disconnectPlayer(socket);
  });
});
