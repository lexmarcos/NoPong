const { http } = require("./http");
require("./websocket");

http.listen(3000, () => {
  console.log("Listening on *:3000");
});
