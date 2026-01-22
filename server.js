const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));
const server = http.createServer(app);
const io = new Server(server);

let devices = {}; // deviceId -> socketId

app.get("/devices", (_, res) => res.json(Object.keys(devices)));

io.on("connection", socket => {
  socket.on("register", d => {
    devices[d.device_id] = socket.id;
    io.emit("device_list", Object.keys(devices));
  });

  socket.on("start", id => io.to(devices[id]).emit("start_stream"));
  socket.on("offer", d => io.to(devices[d.device_id]).emit("offer", d));
  socket.on("answer", d => io.to(devices[d.device_id]).emit("answer", d));
  socket.on("ice", d => io.to(devices[d.device_id]).emit("ice", d));

  socket.on("control", d => io.to(devices[d.device_id]).emit("control", d));

  socket.on("disconnect", () => {
    for (const k in devices) if (devices[k] === socket.id) delete devices[k];
    io.emit("device_list", Object.keys(devices));
  });
});

server.listen(3000, () => console.log("Server running :3000"));
