/**
 * Request Validation Middleware using Zod.
 * Validates request bodies, query parameters, or route parameters, returning clean 400 responses.
 */

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { logger } from "../lib/logger.js";

export const validateRequest = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query) as any;
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("Request validation failed:", error.issues);
        
        res.status(400).json({
          success: false,
          error: "Request validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
        return;
      }

      logger.error("Unexpected error in request validation:", error);
      res.status(500).json({
        success: false,
        error: "Internal validation exception occurred",
      });
    }
  };
};
