const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(compression());
app.use(express.static(__dirname));
app.use('/css', express.static(path.join(__dirname, 'style.css')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const devices = new Map();
const deviceLayouts = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = message.toString();
            if (data.startsWith('REGISTER:')) {
                const deviceId = data.split(':')[1];
                devices.set(deviceId, ws);
                console.log(`Device registered: ${deviceId}`);
                ws.deviceId = deviceId;
            } else {
                const parsed = JSON.parse(data);
                if (parsed.type === 'LAYOUT') {
                    deviceLayouts.set(parsed.deviceId, parsed.layout);
                    broadcastLayout(parsed.deviceId, parsed.layout);
                }
            }
        } catch (e) {
            console.error('Message error:', e);
        }
    });

    ws.on('close', () => {
        if (ws.deviceId) {
            devices.delete(ws.deviceId);
            deviceLayouts.delete(ws.deviceId);
            console.log(`Device disconnected: ${ws.deviceId}`);
        }
    });
});

function broadcastLayout(deviceId, layout) {
    // Broadcast to web clients
    wss.clients.forEach(client => {
        if (!client.deviceId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'LAYOUT_UPDATE',
                deviceId,
                layout: JSON.parse(layout)
            }));
        }
    });
}

function sendControl(deviceId, action, params) {
    const ws = devices.get(deviceId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action, params }));
    }
}

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
