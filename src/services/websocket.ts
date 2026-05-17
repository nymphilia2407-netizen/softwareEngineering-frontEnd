import type { MentionSocketData } from '../types/chat';
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
    sender_username?: string;
    sender_avatar?: string;
    content: string;
    created_at: string;
    client_id?: string;
    mentioned_users?: number[];
}

export interface ChatReadReceiptData {
    conversation_id: number;
    reader_id: number;
    last_message_id: number;
}

/** Django ChatConsumer.group_sync 推送的 data */
export interface GroupSyncEventData {
    action: 'created' | 'avatar_updated';
    conversation_id: number;
    group_name?: string;
    avatar?: string;
    /** 建群时由后端附带，用于提示文案 */
    creator_username?: string;
}

/** Django ChatConsumer.chat_message 推送的 data 形状 */
interface BackendNewMessagePayload {
    message_id: number;
    conversation_id: number;
    sender?: { user_id: number; username: string; avatar?: string };
    content: string;
    timestamp: string;
    client_id?: string | null;
    mentioned_users?: number[];
}

function normalizeSocketEvent(message: ChatSocketEvent): ChatSocketEvent {
    if (message.type !== 'new_message') {
        return message;
    }

    const raw = message.data as unknown;
    if (raw && typeof raw === 'object' && 'message_id' in raw) {
        const b = raw as BackendNewMessagePayload;
        return {
            type: 'new_message',
            data: {
                id: b.message_id,
                conversation_id: b.conversation_id,
                sender_id: b.sender?.user_id ?? 0,
                sender_username: b.sender?.username,
                sender_avatar: b.sender?.avatar,
                content: b.content,
                created_at: b.timestamp,
                client_id: b.client_id ?? undefined,
                mentioned_users: b.mentioned_users,
            },
        };
    }

    return message;
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
      }
    | {
          type: 'group_sync';
          data: GroupSyncEventData;
      }
    | {
          type: 'room_subscribed';
          data: { conversation_id: number };
      }
    | {
        type: 'friend_request';
        data: {
            request_id: number;
            from_user_id: number;
            from_username: string;
        };
    }
    | {
        type: 'mention';
        data: MentionSocketData;
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
                this.emitMessage(normalizeSocketEvent(message));
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
