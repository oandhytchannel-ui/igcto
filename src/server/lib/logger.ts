/**
 * Centralized logger utility for StudyIG CTO.
 * Standardizes server logs with timestamps, severity levels, and tags.
 */

export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  info(message: string, context?: any) {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: any) {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  error(message: string, context?: any) {
    console.error(this.formatMessage(LogLevel.ERROR, message, context));
  }

  debug(message: string, context?: any) {
    if (process.env.NODE_ENV !== "production") {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }
}

export const logger = new Logger();
