const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map(); // deviceId -> ws

app.use(express.static('public'));

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const deviceId = url.searchParams.get('deviceId');
    
    if (deviceId) {
        clients.set(deviceId, ws);
        console.log(`✅ Device connected: ${deviceId}`);
        
        ws.on('message', (data) => {
            // Broadcast screen data to browser
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client.deviceId !== deviceId) {
                    client.send(JSON.stringify({
                        type: 'screen',
                        deviceId: deviceId,
                        data: data.toString('base64')
                    }));
                }
            });
        });
        
        ws.on('close', () => {
            clients.delete(deviceId);
            console.log(`❌ Device disconnected: ${deviceId}`);
        });
    } else {
        // Browser client
        ws.deviceId = 'browser';
        ws.on('message', (message) => {
            const cmd = JSON.parse(message);
            const targetDevice = clients.get(cmd.deviceId);
            if (targetDevice && targetDevice.readyState === WebSocket.OPEN) {
                targetDevice.send(JSON.stringify(cmd));
            }
        });
    }
});

server.listen(8080, () => {
    console.log('🚀 Server running on http://localhost:8080');
});
