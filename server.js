const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 25000,
    pingTimeout: 60000
});

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

let devices = new Map();

// /register - Device registration
app.post('/register', (req, res) => {
    const device = req.body;
    device.lastSeen = new Date();
    devices.set(device.deviceId, device);
    console.log(`✅ Device registered: ${device.model} (${device.deviceId})`);
    res.json({ success: true });
});

// /fetch - List all devices
app.get('/fetch', (req, res) => {
    const list = Array.from(devices.values()).map(d => ({
        ...d,
        online: (new Date() - new Date(d.lastSeen)) < 60000
    }));
    res.json(list);
});

// /device=ID - Control panel
app.get('/device=:deviceId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control.html'));
});

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('register', (data) => {
        socket.deviceId = data.deviceId;
        socket.join(`device_${data.deviceId}`);
        console.log(`📱 Device ${data.deviceId} joined`);
    });

    socket.on('layout', (layout) => {
        if (socket.deviceId) {
            socket.broadcast.to(`device_${socket.deviceId}`).emit('layout', layout);
        }
    });

    socket.on('heartbeat', (data) => {
        if (devices.has(data.deviceId)) {
            devices.get(data.deviceId).lastSeen = new Date();
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Devices: https://your-app.onrender.com/fetch`);
});
