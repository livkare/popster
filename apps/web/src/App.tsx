import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage.js";
import { RoomPage } from "./pages/RoomPage.js";
import { HostPage } from "./pages/HostPage.js";
import { CallbackPage } from "./pages/CallbackPage.js";
import { useWebSocket } from "./hooks/useWebSocket.js";

function App() {
  // Initialize WebSocket connection
  useWebSocket();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:roomKey" element={<RoomPage />} />
      <Route path="/host/:roomKey" element={<HostPage />} />
      <Route path="/callback" element={<CallbackPage />} />
    </Routes>
  );
}

export default App;

