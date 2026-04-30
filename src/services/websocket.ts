import type { WsAction } from '../types/entity';

export interface ChatWebSocketOptions {
    backendUrl: string;
    token: string;
    autoReconnect?: boolean;
    reconnectDelayMs?: number;
}

export interface ChatIncomingMessage {
    id: number;
    conversation_id: number;
    sender_id: number;
    content: string;
    created_at: string;
    client_id?: string;
}

export interface ChatReadReceiptData {
    conversation_id: number;
    reader_id: number;
    last_message_id: number;
}

export type ChatSocketEvent =
    | {
          type: 'new_message';
          data: ChatIncomingMessage;
      }
    | {
          type: 'read_receipt';
            data: ChatReadReceiptData;
      }
    | {
          type: 'error';
          message: string;
      }
    | {
          type: 'init';
          data: {
              message: string;
          };
      };

type MessageListener = (message: ChatSocketEvent) => void;
type StatusListener = (status: 'connecting' | 'open' | 'closed' | 'error') => void;

function buildChatWebSocketUrl(backendUrl: string, token: string) {
    const normalizedBase = backendUrl.replace(/\/$/, '');
    const websocketBase = normalizedBase.replace(/^http/, 'ws');

    return `${websocketBase}/ws/chat/?token=${encodeURIComponent(token)}`;
}

export class ChatWebSocketClient {
    private socket: WebSocket | null = null;
    private readonly messageListeners = new Set<MessageListener>();
    private readonly statusListeners = new Set<StatusListener>();
    private readonly pendingPayloads: string[] = [];
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private manualClose = false;

    private readonly options: ChatWebSocketOptions;

    constructor(options: ChatWebSocketOptions) {
        this.options = options;
    }

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return this.socket;
        }

        this.manualClose = false;
        this.clearReconnectTimer();
        this.emitStatus('connecting');

        const wsUrl = buildChatWebSocketUrl(this.options.backendUrl, this.options.token);
        const socket = new WebSocket(wsUrl);
        this.socket = socket;

        socket.onopen = () => {
            this.emitStatus('open');
            this.flushPendingPayloads();
        };

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as ChatSocketEvent;
                this.emitMessage(message);
            } catch {
                this.emitStatus('error');
            }
        };

        socket.onerror = () => {
            this.emitStatus('error');
        };

        socket.onclose = () => {
            this.socket = null;
            this.emitStatus('closed');

            if (!this.manualClose && this.options.autoReconnect !== false) {
                this.scheduleReconnect();
            }
        };

        return socket;
    }

    disconnect() {
        this.manualClose = true;
        this.clearReconnectTimer();
        this.pendingPayloads.length = 0;

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    send(action: WsAction) {
        const payload = JSON.stringify(action);

        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(payload);
            return;
        }

        this.pendingPayloads.push(payload);
        if (!this.socket) {
            this.connect();
        }
    }

    onMessage(listener: MessageListener) {
        this.messageListeners.add(listener);
        return () => this.messageListeners.delete(listener);
    }

    onStatusChange(listener: StatusListener) {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    private flushPendingPayloads() {
        if (this.socket?.readyState !== WebSocket.OPEN) {
            return;
        }

        while (this.pendingPayloads.length > 0) {
            const payload = this.pendingPayloads.shift();
            if (payload) {
                this.socket.send(payload);
            }
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.options.reconnectDelayMs ?? 3000);
    }

    private clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private emitMessage(message: ChatSocketEvent) {
        this.messageListeners.forEach((listener) => listener(message));
    }

    private emitStatus(status: 'connecting' | 'open' | 'closed' | 'error') {
        this.statusListeners.forEach((listener) => listener(status));
    }
}

export const createChatWebSocketClient = (options: ChatWebSocketOptions) => new ChatWebSocketClient(options);
