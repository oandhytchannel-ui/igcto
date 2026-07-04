/**
 * HTTP Request Logger Middleware.
 * Captures request details and log execution durations.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  // Wait for the response to finish to log the status code and duration
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    const message = `${method} ${originalUrl} [${statusCode}] - ${duration}ms (IP: ${ip})`;
    
    if (statusCode >= 500) {
      logger.error(message);
    } else if (statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
}
