import { io } from "socket.io-client";

export const socketURL = "http://localhost:5000";

export const socket = io(socketURL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});

socket.on("connect", () => {
  console.log("socket connected", socket.id);
});

socket.on("connect_error", (error) => {
  console.log("socket connect_error", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("socket disconnected", reason);
});

export const connectAdminSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectAdminSocket = () => {
  socket.disconnect();
};
