const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);

// 🔥 PERFECT SOCKET.IO CONFIG
const io = socketIo(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const devices = new Map();

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.values()));
});

io.on('connection', (socket) => {
    console.log('🔌 Connection:', socket.id);

    // 🔥 SCREEN FRAME HANDLER - MOST CRITICAL!
    socket.on('screen-frame', (frameData) => {
        try {
            const deviceId = frameData.deviceId;
            console.log(`📺 Frame from ${deviceId}: ${frameData.width}x${frameData.height}`);
            
            // ✅ Broadcast to ALL clients (phones send, browsers receive)
            socket.broadcast.emit('screen-update', frameData);
            console.log(`✅ Frame broadcasted to ${io.engine.clientsCount - 1} clients`);
            
        } catch (e) {
            console.error('Frame error:', e);
        }
    });

    // ✅ CONTROL HANDLER
    socket.on('control', (controlData) => {
        const deviceId = controlData.deviceId;
        console.log(`🎮 Control to ${deviceId}:`, controlData.action);
        socket.broadcast.emit('control', controlData);
    });

    // ✅ Device registration
    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        devices.set(deviceId, {
            id: deviceId,
            model: deviceInfo.model,
            brand: deviceInfo.brand,
            version: deviceInfo.version,
            connected: true,
            socketId: socket.id
        });
        io.emit('devices-update', Array.from(devices.values()));
        console.log(`📱 Device registered: ${deviceId}`);
    });

    socket.on('disconnect', () => {
        // Mark device offline
        for (let [id, device] of devices) {
            if (device.socketId === socket.id) {
                device.connected = false;
                break;
            }
        }
        io.emit('devices-update', Array.from(devices.values()));
        console.log('🔌 Disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 SERVER LIVE: http://0.0.0.0:${PORT}`);
    console.log(`📱 Phone APK → http://${require('os').networkInterfaces().wlan0?.[0]?.address || 'localhost'}:${PORT}`);
    console.log(`🌐 Browser → http://localhost:${PORT}\n`);
});
