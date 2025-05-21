// checkers_server.js
// Basic Node.js WebSocket server for a networked checkers game.

// Instructions:
// 1. Install Node.js if you haven't already.
// 2. Install the 'ws' library:
//    npm install ws
// 3. Run the server from your terminal:
//    node checkers_server.js

const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// Create a new WebSocket server
const wss = new WebSocket.Server({ port: PORT });

// Store all connected clients
const clients = new Set();

wss.on('listening', () => {
    console.log(`WebSocket server started and listening on port ${PORT}`);
});

wss.on('connection', (ws) => {
    // Add new client to our set
    clients.add(ws);
    console.log(`Client connected. Total clients: ${clients.size}`);

    // Optional: Assign a unique ID to the client for easier tracking
    // ws.id = Math.random().toString(36).substring(2, 15);
    // console.log(`Client ${ws.id} connected.`);

    // Handle messages from this client
    ws.on('message', (message) => {
        let parsedMessage;
        try {
            // Try to parse the message as JSON, assuming client sends stringified JSON
            parsedMessage = JSON.parse(message);
            console.log('Received message:', parsedMessage);
        } catch (e) {
            // If not JSON, treat as raw message (string)
            parsedMessage = message.toString(); // Ensure it's a string if it was a Buffer
            console.log('Received raw message:', parsedMessage);
        }


        // Broadcast the message to all *other* connected clients
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                try {
                    // If the original message was an object (parsed from JSON), stringify it again before sending
                    const messageToSend = (typeof parsedMessage === 'object' && parsedMessage !== null)
                                          ? JSON.stringify(parsedMessage)
                                          : parsedMessage;
                    client.send(messageToSend);
                    // console.log(`Message sent to client ${client.id || '[unknown]'}`);
                } catch (error) {
                    console.error('Failed to send message to a client:', error);
                }
            }
        });

        // For a strict 2-player game, you might manage "rooms" or pairs.
        // If exactly two clients are connected, this broadcast logic effectively relays messages between them.
        if (clients.size === 1) {
            // Optionally send a message back to the sender if they are the only one
            // ws.send(JSON.stringify({ type: 'info', message: 'You are the only one connected.' }));
            console.log('Only one client connected, message not broadcast further.');
        }
    });

    // Handle client disconnection
    ws.on('close', (code, reason) => {
        clients.delete(ws);
        // console.log(`Client ${ws.id || '[unknown]'} disconnected. Reason: ${reason || 'N/A'}, Code: ${code || 'N/A'}`);
        console.log(`Client disconnected. Total clients: ${clients.size}`);
    });

    // Handle client errors
    ws.on('error', (error) => {
        // console.error(`Error from client ${ws.id || '[unknown]'}:`, error);
        console.error('Error from a client:', error.message);
        // The 'close' event will usually follow an error that causes disconnection.
    });

});

// Handle server errors
wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please choose a different port or close the existing application on this port.`);
    }
});

console.log('Checkers server script is running. Attempting to start WebSocket server...');

// Keep the server running
process.on('SIGINT', () => {
    console.log('Server shutting down...');
    wss.close(() => {
        console.log('WebSocket server closed.');
        process.exit(0);
    });
});
