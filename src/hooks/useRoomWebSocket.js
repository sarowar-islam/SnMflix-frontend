import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';

const useRoomWebSocket = (roomCode, userId, onPlaybackEvent) => {
  const stompClientRef = useRef(null);
  const isConnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  const connect = useCallback(() => {
    if (!roomCode || isConnectedRef.current) return;

    // Skip WebSocket if too many failed attempts
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.warn('[WebSocket] Max reconnect attempts reached, using HTTP fallback only');
      return;
    }

    try {
      // Construct WebSocket URL from API base URL or default to localhost
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
      const wsUrl = apiBaseUrl.replace(/^http/, 'ws').replace(/\/api$/, '') + '/ws';

      const client = new Client({
        brokerURL: wsUrl,
        connectHeaders: {
          login: userId || 'guest',
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: (str) => {
          // Reduce debug noise
          if (str.includes('CONNECT') || str.includes('CONNECTED') || str.includes('SUBSCRIBE')) {
            console.log('[STOMP]', str);
          }
        },
        onConnect: () => {
          console.log('[WebSocket] Connected to room:', roomCode);
          isConnectedRef.current = true;
          reconnectAttemptsRef.current = 0; // Reset on successful connection

          // Subscribe to room playback events
          client.subscribe(`/topic/room/${roomCode}/playback`, (message) => {
            try {
              const event = JSON.parse(message.body);
              console.log('[WebSocket] Received playback event:', event);
              if (onPlaybackEvent) {
                onPlaybackEvent(event);
              }
            } catch (error) {
              console.error('[WebSocket] Error parsing playback event:', error);
            }
          });
        },
        onStompError: (frame) => {
          console.warn('[WebSocket] STOMP error:', frame.headers['message']);
          isConnectedRef.current = false;
          reconnectAttemptsRef.current++;
        },
        onWebSocketError: (event) => {
          console.warn('[WebSocket] Connection error, falling back to HTTP polling');
          isConnectedRef.current = false;
          reconnectAttemptsRef.current++;
        },
        onWebSocketClose: () => {
          console.log('[WebSocket] Connection closed');
          isConnectedRef.current = false;
        },
        onDisconnect: () => {
          console.log('[WebSocket] Disconnected');
          isConnectedRef.current = false;
        }
      });

      client.activate();
      stompClientRef.current = client;
    } catch (error) {
      console.error('[WebSocket] Failed to initialize:', error);
      reconnectAttemptsRef.current++;
    }
  }, [roomCode, userId, onPlaybackEvent]);

  const sendPlaybackEvent = useCallback((eventType, eventData) => {
    if (!stompClientRef.current || !isConnectedRef.current) {
      console.log('[WebSocket] Not connected, relying on HTTP fallback');
      return;
    }

    const event = {
      eventType,
      roomCode,
      ...eventData,
      timestamp: new Date().toISOString()
    };

    try {
      stompClientRef.current.publish({
        destination: `/app/room/${roomCode}/playback`,
        body: JSON.stringify(event),
      });
      console.log('[WebSocket] Sent playback event:', event);
    } catch (error) {
      console.error('[WebSocket] Error sending event:', error);
    }
  }, [roomCode]);

  const disconnect = useCallback(() => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
      isConnectedRef.current = false;
      console.log('[WebSocket] Disconnected manually');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    sendPlaybackEvent,
    isConnected: isConnectedRef.current,
    disconnect
  };
};

export default useRoomWebSocket;
