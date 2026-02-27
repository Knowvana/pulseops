// ============================================================================
// Express Application Factory — PulseOps API
//
// PURPOSE: Creates and configures the Express application with all middleware,
// routes, and Swagger UI. Exported as a factory for testability.
//
// ARCHITECTURE: Middleware chain: helmet → cors → rate-limit → json parser →
// request logger → routes → swagger → error handler. All config from JSON.
// ============================================================================
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { createRequire } from 'module';

import requestLogger from '#core/middleware/requestLogger.js';
import errorHandler from '#core/middleware/errorHandler.js';

import healthRoutes from '#core/routes/healthRoutes.js';
import authRoutes from '#core/routes/authRoutes.js';
import databaseRoutes from '#core/routes/databaseRoutes.js';
import userRoutes from '#core/routes/userRoutes.js';
import configRoutes from '#core/routes/configRoutes.js';
import logsRoutes from '#core/routes/logsRoutes.js';
import moduleRoutes from '#core/routes/moduleRoutes.js';
import rosterRoutes from '#modules/roster/routes/rosterRoutes.js';
import servicenowRoutes from '#modules/servicenow/routes/servicenowRoutes.js';

const require = createRequire(import.meta.url);
const appConfig = require('#config/app.json');
const swaggerConfig = require('#config/swagger.json');

export default function createApp() {
  const app = express();

  // --- Security ---
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: appConfig.cors.origin,
    credentials: appConfig.cors.credentials,
  }));

  // --- Rate Limiting ---
  app.use(rateLimit({
    windowMs: appConfig.rateLimit.windowMs,
    max: appConfig.rateLimit.max,
    message: { success: false, error: { message: appConfig.rateLimit.message, code: 'RATE_LIMIT' } },
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // --- Body Parsing ---
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --- Request Logging ---
  app.use(requestLogger);

  // --- API Routes ---
  const prefix = appConfig.apiPrefix;
  app.use(`${prefix}/health`, healthRoutes);
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/database`, databaseRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/config`, configRoutes);
  app.use(`${prefix}/logs`, logsRoutes);
  app.use(`${prefix}/modules`, moduleRoutes);
  app.use(`${prefix}/roster`, rosterRoutes);
  app.use(`${prefix}/servicenow`, servicenowRoutes);

  // --- Swagger UI ---
  const swaggerSpec = swaggerJsdoc(swaggerConfig);
  app.use(`${prefix}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'PulseOps API Docs',
  }));
  app.get(`${prefix}/docs.json`, (req, res) => res.json(swaggerSpec));

  // --- Global Error Handler ---
  app.use(errorHandler);

  return app;
}
