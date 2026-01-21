import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SERVER_URL = 'https://flam-sde-assignment.onrender.com';

export const useWebSocket = (roomId) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [latency, setLatency] = useState(0);
  const latencyInterval = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    // Connecting to server
    socketRef.current = io(SERVER_URL, {
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');

      // Starting monitoring
      latencyInterval.current = setInterval(() => {
        const start = Date.now();
        socket.emit('ping', () => {
          const duration = Date.now() - start;
          setLatency(duration);
        });
      }, 2000);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
      if (latencyInterval.current) {
        clearInterval(latencyInterval.current);
      }
    });

    socket.on('users-update', (userList) => {
      setUsers(userList);
    });

    socket.on('cursor-move', ({ userId, x, y, username, color }) => {
      setCursors((prev) => ({
        ...prev,
        [userId]: { x, y, username, color }
      }));
    });

    socket.on('user-left', ({ userId }) => {
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    });

    return () => {
      if (latencyInterval.current) {
        clearInterval(latencyInterval.current);
      }
      socket.disconnect();
    };
  }, [roomId]);

  const joinRoom = (username) => {
    if (socketRef.current) {
      const userColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
      socketRef.current.emit('join-room', { roomId, username, color: userColor });
    }
  };

  const sendDrawEvent = (data) => {
    if (socketRef.current) {
      socketRef.current.emit('draw', data);
    }
  };

  const sendCursorMove = (x, y) => {
    if (socketRef.current) {
      socketRef.current.emit('cursor-move', { x, y });
    }
  };

  const saveCanvasState = (dataURL) => {
    if (socketRef.current) {
      socketRef.current.emit('save-canvas', dataURL);
    }
  };

  const loadCanvasState = () => {
    if (socketRef.current) {
      socketRef.current.emit('request-canvas-state');
    }
  };

  return {
    socket: socketRef.current,
    connected,
    users,
    cursors,
    latency,
    joinRoom,
    sendDrawEvent,
    sendCursorMove,
    saveCanvasState,
    loadCanvasState
  };

};
