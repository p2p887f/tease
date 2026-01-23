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
app.use(express.json({ limit: '100mb' }));
app.use(express.static('public'));

let devices = new Map();
let deviceLayouts = new Map();

// API Routes
app.post('/register', (req, res) => {
    const device = req.body;
    device.lastSeen = new Date();
    devices.set(device.deviceId, device);
    console.log(`✅ ${device.model || device.deviceId} registered`);
    res.json({ success: true });
});

app.get('/devices', (req, res) => {
    const deviceList = Array.from(devices.values())
        .map(d => ({ ...d, online: Date.now() - (new Date(d.lastSeen).getTime()) < 60000 }));
    res.json(deviceList);
});

app.get('/device/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control.html'));
});

// Socket.IO
io.on('connection', (socket) => {
    console.log('🔌 Connection:', socket.id);
    
    socket.on('register', (data) => {
        socket.deviceId = data.deviceId;
        const device = devices.get(data.deviceId);
        if (device) {
            device.socketId = socket.id;
            device.lastSeen = new Date();
        }
    });
    
    socket.on('layout', (layout) => {
        if (socket.deviceId) {
            deviceLayouts.set(socket.deviceId, {
                data: layout,
                timestamp: new Date()
            });
            // Broadcast to control clients
            socket.broadcast.to(`control_${socket.deviceId}`).emit('layout', layout);
        }
    });
    
    socket.on('disconnect', () => {
        if (socket.deviceId) {
            const device = devices.get(socket.deviceId);
            if (device) device.status = 'offline';
        }
    });
});

// Control room join
app.get('/control/:deviceId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server: http://0.0.0.0:${PORT}`);
    console.log(`📱 Devices: http://localhost:${PORT}/devices`);
});
