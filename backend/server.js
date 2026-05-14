require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dns = require('node:dns');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const hpp = require('hpp');

const supabase = require('./config/supabase');
const { startMqttClient } = require('./services/mqttService');
const { setIo } = require('./services/geofenceService');
const { startCleanupJobs } = require('./services/cleanup');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const trackerRoutes = require('./routes/tracker');
const infoRoutes = require('./routes/info');
const reportRoutes = require('./routes/reports');

dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
    }
});

app.set('io', io);
setIo(io);

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdn.socket.io", "https://www.google-analytics.com", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],
            workerSrc: ["'self'", "blob:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.USE_HTTPS === 'true' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(hpp());

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10kb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'bipol_secret_key_change_me',
    name: 'bipol.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.USE_HTTPS === 'true',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

app.use((req, res, next) => {
    res.set('X-Permitted-Cross-Domain-Policies', 'none');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
    next();
});

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
    maxAge: '1y',
    immutable: true
}));

app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Service-Worker-Allowed', '/');
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});



app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0,
    etag: true
}));

app.use('/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', trackerRoutes);
app.use('/api', infoRoutes);
app.use('/api', reportRoutes);
app.use('/', reportRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: io.engine.clientsCount
    });
});

app.get('/api/health/ready', async (req, res) => {
    try {
        const { error } = await supabase.from('bipol_tracker').select('id').limit(1);
        if (error) throw error;
        res.json({ status: 'ready', database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'not ready', database: 'disconnected', error: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/driver/dashboard', (req, res) => {
    if (!req.session || !req.session.driver) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});



app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
});

const mqttClient = startMqttClient(io);
startCleanupJobs();

io.on('connection', (socket) => {
    logger.socket.connect(socket.id);
    socket.on('disconnect', (reason) => {
        logger.socket.disconnect(socket.id, reason);
    });
});

process.on('SIGTERM', () => {
    logger.server.shutdown();
    server.close(() => {
        if (mqttClient) mqttClient.end();
        logger.server.closed();
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: String(reason) });
});

server.listen(PORT, () => {
    logger.server.start(PORT);
    const retention = parseInt(process.env.DATA_RETENTION_HOURS) || 24;
    logger.server.cleanup(retention);
    logger.server.security();
});