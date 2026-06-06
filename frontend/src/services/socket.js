import { io } from "socket.io-client";

export const socketURL = "http://localhost:5000";

export const socket = io(socketURL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
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
