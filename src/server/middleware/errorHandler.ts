/**
 * Centralized Error Handling Middleware.
 * Captures all express endpoint errors, logs details, and returns structured JSON responses.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "An unexpected error occurred on the server";

  logger.error(`Error handling request [${req.method} ${req.originalUrl}]: ${message}`, {
    stack: err.stack,
    statusCode,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
}
