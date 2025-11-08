import pino from "pino";

const logLevel = process.env.LOG_LEVEL || "info";

/**
 * Configured Pino logger instance.
 * Uses pretty printing in development, structured JSON in production.
 */
export const logger = pino({
  level: logLevel,
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
});

