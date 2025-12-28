import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://indulgeconcierge.com';

let socket: Socket | null = null;

export const initializeSocket = (token: string) => {
  if (socket?.connected) {
    return socket;
  }

  console.log('🔌 Initializing socket with token:', token ? 'Token exists' : 'No token');
  console.log('🔌 Socket URL:', SOCKET_URL);
  console.log('🔌 Creating socket.io connection...');

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    forceNew: false,
    autoConnect: true,
    upgrade: true,
    rememberUpgrade: true
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected successfully!');
    console.log('✅ Socket ID:', socket?.id);
    console.log('✅ Socket connected:', socket?.connected);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
    console.error('Full error:', error);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error event:', error);
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
