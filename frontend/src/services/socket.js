import { io } from "socket.io-client";
import { API_ORIGIN } from "./api";

export const socketURL = API_ORIGIN;

export const socket = io(socketURL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
});

export const connectUserSocket = () => {
  const token = window.localStorage.getItem("readora_token");

  if (token) {
    socket.auth = { token };
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const connectAdminSocket = () => {
  const token = window.localStorage.getItem("readora_token");

  if (token) {
    socket.auth = { token };
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectAdminSocket = () => {
  socket.disconnect();
};