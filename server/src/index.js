import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';

export const app = express();

// Trust reverse proxy (for rate limiter and secure cookies behind proxy)
app.set('trust proxy', 1);

// CORS configuration matching frontend origin with credentials
app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5001', 'http://127.0.0.1:5001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'crea-ai-auth-server',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// Centralized 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

import { fileURLToPath } from 'url';

// Start listening only when executed directly (not when imported in tests)
if (process.argv[1] && process.argv[1].endsWith('src/index.js') || process.argv[1] && process.argv[1].endsWith('src\\index.js')) {
  app.listen(config.port, () => {
    console.log(`\n==================================================`);
    console.log(`CREA AI Auth Server running on http://127.0.0.1:${config.port}`);
    console.log(`Configured frontend origin: ${config.frontendUrl}`);
    console.log(`Health endpoint: http://127.0.0.1:${config.port}/health`);
    console.log(`==================================================\n`);
  });
}
