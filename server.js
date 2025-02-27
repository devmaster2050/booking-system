require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const apiRoutes = require('./routes/api');
const userRoutes = require('./routes/user');
const { scheduleReviewRequests } = require('./utils/scheduler');
// const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8080; // AWS Elastic Beanstalk uses dynamic ports


// Cors
// app.use(cors({ 
//     origin: "https://tripssource.net", 
//     credentials: true 
// }));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/users', userRoutes);

// Scheduler for review messages at the end of tours
scheduleReviewRequests();

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Use environment variable for security
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Change to `true` if using HTTPS
}));

// Serve frontend for unknown routes (Important for Single Page Applications)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});