import { Bonjour } from "bonjour-service";
import { logger } from "../logger.js";
import { getLocalIP } from "./network.js";

let bonjourInstance: Bonjour | null = null;
let service: { stop: () => void } | null = null;

/**
 * Initialize and start mDNS/Bonjour service advertisement.
 */
export function startMdnsService(port: number): void {
  const enabled = process.env.MDNS_ENABLED !== "false";
  if (!enabled) {
    logger.info("mDNS service disabled via MDNS_ENABLED=false");
    return;
  }

  try {
    bonjourInstance = new Bonjour();
    const ip = getLocalIP();

    service = bonjourInstance.publish({
      name: "Hitster Server",
      type: "hitster",
      protocol: "tcp",
      port,
      host: ip,
      txt: {
        version: "1.0.0",
      },
    });

    logger.info(
      {
        name: service.name,
        type: service.type,
        port,
        host: ip,
      },
      "mDNS service started"
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to start mDNS service"
    );
  }
}

/**
 * Stop mDNS/Bonjour service.
 */
export function stopMdnsService(): void {
  if (service && bonjourInstance) {
    try {
      service.stop();
      bonjourInstance.destroy();
      logger.info("mDNS service stopped");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Error stopping mDNS service"
      );
    }
    service = null;
    bonjourInstance = null;
  }
}

