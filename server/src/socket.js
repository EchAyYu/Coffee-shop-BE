import { Server } from "socket.io";

let io = null;
export function initSocket(httpServer, corsOrigins = ["http://localhost:5173"]) {
  io = new Server(httpServer, { cors: { origin: corsOrigins, credentials: true } });
  io.on("connection", (socket) => {
    // FE nên emit 'join' với id_tk sau khi đăng nhập
    socket.on("join", (id_tk) => { if (id_tk) socket.join(String(id_tk)); });
  });
  return io;
}
export function emitToUser(id_tk, event, payload) {
  if (!io) return;
  io.to(String(id_tk)).emit(event, payload);
}
