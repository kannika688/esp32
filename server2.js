const express = require('express');
const os = require('os');
const app = express();

app.use(express.json());

let ledState = "OFF";
let lastSeen = 0;

// ===== GET LOCAL IP =====
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (let name in interfaces) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "localhost";
}

// ===== CHECK CONNECTION =====
function isESP32Connected() {
    return (Date.now() - lastSeen) < 10000;
}

// ===== UI PAGE =====
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>ESP32 Control</title>
        </head>
        <body style="text-align:center; font-family:Arial;">
            <h1>ESP32 LED Control</h1>

            <h2 id="status">Status: Connecting...</h2>
            <h2 id="state">State: OFF</h2>

            <button id="onBtn" onclick="setLED('on')" style="padding:15px;">ON</button>
            <button id="offBtn" onclick="setLED('off')" style="padding:15px;">OFF</button>

            <script>
                const evtSource = new EventSource('/events');

                evtSource.onmessage = function(event) {
                    const data = JSON.parse(event.data);

                    document.getElementById('state').innerText = "State: " + data.led;

                    if (data.connected) {
                        document.getElementById('status').innerText = "Status: Connected";
                        document.getElementById('onBtn').disabled = false;
                        document.getElementById('offBtn').disabled = false;
                    } else {
                        document.getElementById('status').innerText = "Status: Disconnected";
                        document.getElementById('onBtn').disabled = true;
                        document.getElementById('offBtn').disabled = true;
                    }
                };

                function setLED(val) {
                    fetch('/set?led=' + val);
                }
            </script>
        </body>
        </html>
    `);
});

// ===== BUTTON CONTROL =====
app.get('/set', (req, res) => {

    const cmd = req.query.led;

    if (cmd === "on" && ledState !== "ON") {
        ledState = "ON";
        console.log("LED is ON");
        
    }
    else if (cmd === "off" && ledState !== "OFF") {
        ledState = "OFF";
        console.log("LED is OFF");
        
    }

    res.send("OK");
});

// ===== ESP32 COMMUNICATION =====
app.post('/update', (req, res) => {
    // console.log("ESP32 connected");
    lastSeen = Date.now();
    res.json({ led: ledState });
});

// ===== REAL-TIME EVENTS =====
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const interval = setInterval(() => {
        const data = JSON.stringify({
            led: ledState,
            connected: isESP32Connected()
        });

        res.write(`data: ${data}\n\n`);
    }, 1000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

// ===== START SERVER =====
app.listen(3000, '0.0.0.0', () => {
    const ip = getLocalIP();

    console.log("\nConnected!");
    console.log("Server IP: http://" + ip + ":3000\n");
});