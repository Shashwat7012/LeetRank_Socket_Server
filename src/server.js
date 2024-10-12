const express = require("express"); // Import express
const { createServer } = require("http"); // Import http
const { Server } = require("socket.io"); // Import socket.io
const Redis = require('ioredis'); // Import Redis client
const bodyParser = require('body-parser');

const app = express(); // Create express app
app.use(bodyParser.json()); // Add body parser middleware
const httpServer = createServer(app); // Create HTTP server using express app

const redisCache = new Redis(); // Create Redis client

// Check if Redis connection is working
redisCache.on('connect', () => {
    console.log('Redis connected');
});

redisCache.on('error', (err) => {
    console.error('Redis connection error:', err);
});

const io = new Server(httpServer, { 
    cors: {
        origin: "http://localhost:5500", // Allow frontend from this origin
        methods: ["GET", "POST"]
    }
}); // Create socket.io server

// Handle socket connections
io.on("connection", (socket) => {
    console.log("A user connected with socket ID:", socket.id);

    // Event to set the userId and associate it with the socketId in Redis
    socket.on("setUserId", async (userId) => {
        try {
            await redisCache.set(userId, socket.id);
            console.log(`Successfully set user id ${userId} to socket id ${socket.id}`);
        } catch (err) {
            console.error("Error setting user id in Redis:", err);
        }
    });

    // Event to retrieve the connectionId (socketId) for a given userId
    socket.on('getConnectionId', async (userId) => {
        try {
            const connId = await redisCache.get(userId);
            console.log(`Getting connection id for user id: ${userId}. Result: ${connId}`);
            socket.emit('connectionId', connId); // Send the connectionId back to the client

            // For debugging, show all Redis keys
            const allKeys = await redisCache.keys('*');
            console.log("All keys in Redis:", allKeys);
        } catch (err) {
            console.error("Error retrieving connection id from Redis:", err);
        }
    });

    // Handle socket disconnection
    socket.on('disconnect', () => {
        console.log(`User with socket ID ${socket.id} disconnected`);
    });
});

// HTTP route to send a payload to a user by their userId
app.post('/sendPayload', async (req, res) => {
    console.log("Received payload request:", req.body);
    
    const { userId, payload } = req.body;

    if (!userId || !payload) {
        return res.status(400).send("Invalid request: missing userId or payload");
    }

    try {
        const socketId = await redisCache.get(userId);
        console.log("Socket ID from Redis for userId:", socketId);

        if (socketId) {
            io.to(socketId).emit('submissionPayloadResponse', payload); // Send payload to the user's socket
            console.log(`Payload sent to socket ID ${socketId}:`, payload);
            return res.send("Payload sent successfully");
        } else {
            return res.status(404).send("User not connected or not found");
        }
    } catch (err) {
        console.error("Error sending payload:", err);
        return res.status(500).send("Internal server error");
    }
});

// Start the server
httpServer.listen(3004, () => {
    console.log("Server is running on port 3004");
});
