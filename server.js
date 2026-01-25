const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

// Devices storage
let devices = {};
let activeDevices = [];

io.on('connection', (socket) => {
    console.log('🔥 Socket connected:', socket.id);

    socket.on('register-device', (deviceInfo) => {
        devices[deviceInfo.deviceId] = {
            id: deviceInfo.deviceId,
            socketId: socket.id,
            model: deviceInfo.model,
            brand: deviceInfo.brand,
            status: deviceInfo.status,
            screenWidth: deviceInfo.screenWidth,
            screenHeight: deviceInfo.screenHeight,
            timestamp: Date.now()
        };
        activeDevices = Object.values(devices);
        console.log('📱 Device registered:', deviceInfo.deviceId);
        io.emit('devices-updated', activeDevices);
    });

    socket.on('screen-frame', (frameData) => {
        const deviceId = frameData.deviceId;
        if (devices[deviceId]) {
            devices[deviceId].timestamp = Date.now();
            devices[deviceId].frameData = frameData;
            
            // 🔥 LAYOUT DATA SAVE
            devices[deviceId].layout = frameData.layout || [];
            
            // Broadcast to all clients
            socket.broadcast.emit('screen-frame', {
                deviceId: deviceId,
                frameData: frameData
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected:', socket.id);
        // Remove disconnected devices
        activeDevices = activeDevices.filter(device => device.socketId !== socket.id);
        io.emit('devices-updated', activeDevices);
    });
});

// Control commands
io.on('connection', (socket) => {
    socket.on('send-control', (controlData) => {
        const device = activeDevices.find(d => d.id === controlData.deviceId);
        if (device) {
            io.to(device.socketId).emit('control', controlData);
            console.log('🎮 Control sent:', controlData);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
