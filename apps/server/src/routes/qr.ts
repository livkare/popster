import type { FastifyReply, FastifyRequest } from "fastify";
import QRCode from "qrcode";
import { generateRoomURL } from "../discovery/network.js";
import { logger } from "../logger.js";

const PORT = Number.parseInt(process.env.PORT || "5173", 10);

/**
 * Register QR code generation endpoint.
 * GET /api/qr?roomKey=XXXXXX - Returns QR code as PNG image
 * GET /api/qr/:roomKey - Returns QR code as PNG image
 * GET /api/qr/:roomKey/html - Returns QR code as HTML page
 */
export async function registerQrRoute(fastify: any): Promise<void> {
  // Helper function to generate QR code
  async function generateQRCodeImage(roomKey: string): Promise<Buffer> {
    const url = generateRoomURL(roomKey, PORT);
    return await QRCode.toBuffer(url, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  }

  // Main endpoint - returns QR code as PNG image (for <img> tags)
  fastify.get("/api/qr", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { roomKey?: string };
    const roomKey = query.roomKey;

    if (!roomKey) {
      return reply.code(400).send({
        error: "Room key is required. Use ?roomKey=XXXXXX",
      });
    }

    // Validate room key format (6 alphanumeric characters)
    if (!/^[A-Z0-9]{6}$/.test(roomKey.toUpperCase())) {
      return reply.code(400).send({
        error: "Invalid room key format. Must be 6 alphanumeric characters.",
      });
    }

    const normalizedRoomKey = roomKey.toUpperCase();

    try {
      const qrCodeBuffer = await generateQRCodeImage(normalizedRoomKey);
      reply.type("image/png").send(qrCodeBuffer);
    } catch (error) {
      logger.error(
        {
          roomKey: normalizedRoomKey,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to generate QR code"
      );

      return reply.code(500).send({
        error: "Failed to generate QR code",
      });
    }
  });

  // Path parameter endpoint - returns QR code as PNG image
  fastify.get("/api/qr/:roomKey", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { roomKey: string };
    const roomKey = params.roomKey;

    // Validate room key format (6 alphanumeric characters)
    if (!/^[A-Z0-9]{6}$/.test(roomKey.toUpperCase())) {
      return reply.code(400).send({
        error: "Invalid room key format. Must be 6 alphanumeric characters.",
      });
    }

    const normalizedRoomKey = roomKey.toUpperCase();

    try {
      const qrCodeBuffer = await generateQRCodeImage(normalizedRoomKey);
      reply.type("image/png").send(qrCodeBuffer);
    } catch (error) {
      logger.error(
        {
          roomKey: normalizedRoomKey,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to generate QR code"
      );

      return reply.code(500).send({
        error: "Failed to generate QR code",
      });
    }
  });

  // HTML page endpoint (optional, for standalone QR code pages)
  fastify.get("/api/qr/:roomKey/html", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { roomKey: string };
    const roomKey = params.roomKey;

    // Validate room key format (6 alphanumeric characters)
    if (!/^[A-Z0-9]{6}$/.test(roomKey.toUpperCase())) {
      return reply.code(400).send({
        error: "Invalid room key format. Must be 6 alphanumeric characters.",
      });
    }

    const normalizedRoomKey = roomKey.toUpperCase();

    try {
      const url = generateRoomURL(normalizedRoomKey, PORT);
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // Return as HTML page with embedded QR code
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Hitster Room ${normalizedRoomKey}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 {
      margin: 0 0 1rem 0;
      color: #333;
    }
    .room-key {
      font-size: 1.5rem;
      font-weight: bold;
      color: #0066cc;
      margin: 1rem 0;
    }
    .url {
      color: #666;
      font-size: 0.9rem;
      word-break: break-all;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Join Room</h1>
    <div class="room-key">${normalizedRoomKey}</div>
    <img src="${qrCodeDataUrl}" alt="QR Code for Room ${normalizedRoomKey}" />
    <div class="url">${url}</div>
  </div>
</body>
</html>
      `;

      reply.type("text/html").send(html);
    } catch (error) {
      logger.error(
        {
          roomKey: normalizedRoomKey,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to generate QR code"
      );

      return reply.code(500).send({
        error: "Failed to generate QR code",
      });
    }
  });
}

