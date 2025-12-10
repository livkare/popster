import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "./Layout.js";

interface InvalidRoomKeyProps {
  title?: string;
  message?: string;
}

export function InvalidRoomKey({
  title = "Invalid Room Key",
  message = "The room key is missing or invalid.",
}: InvalidRoomKeyProps) {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <div className="card text-center">
          <div className="text-red-600 mb-4">
            <p className="text-lg font-semibold mb-2">{title}</p>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
          <button onClick={() => navigate("/")} className="btn-primary">
            Go Home
          </button>
        </div>
      </div>
    </Layout>
  );
}

