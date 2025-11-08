import { API_URL } from "../config.js";

interface QRCodeProps {
  roomKey: string;
}

export function QRCode({ roomKey }: QRCodeProps) {
  const qrUrl = `${API_URL}/api/qr?roomKey=${roomKey}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <img
          src={qrUrl}
          alt={`QR code for room ${roomKey}`}
          className="w-48 h-48"
          loading="lazy"
        />
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-1">Room Key</p>
        <p className="text-2xl font-mono font-bold text-gray-900">{roomKey}</p>
      </div>
    </div>
  );
}

