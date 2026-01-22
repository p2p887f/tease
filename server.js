const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

let devices = {}; // device_id -> socket.id

app.get("/devices", (req, res) => {
  res.json(Object.keys(devices));
});

io.on("connection", socket => {

  socket.on("register", data => {
    devices[data.device_id] = socket.id;
    io.emit("device_list", Object.keys(devices));
  });

  socket.on("offer", d => {
    io.to(devices[d.device_id]).emit("offer", d);
  });

  socket.on("answer", d => {
    io.to(devices[d.device_id]).emit("answer", d);
  });

  socket.on("ice", d => {
    io.to(devices[d.device_id]).emit("ice", d);
  });

  socket.on("control", d => {
    io.to(devices[d.device_id]).emit("control", d);
  });

  socket.on("disconnect", () => {
    for (let k in devices)
      if (devices[k] === socket.id) delete devices[k];
    io.emit("device_list", Object.keys(devices));
  });

});

server.listen(3000, () => console.log("Server running"));
