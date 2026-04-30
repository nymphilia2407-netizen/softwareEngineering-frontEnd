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
}

export type ChatSocketEvent = {
    type: 'new_message';
    data: ChatIncomingMessage;
} | {
    type: 'error';
    message: string;
} | {
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

export const createChatWebSocketClient = (options: ChatWebSocketOptions) => new ChatWebSocketClient(options);import ReconnectingWebSocket from 'reconnecting-websocket';

type MessageHandler<T = any> = (data: T) => void;

export interface WebSocketConfig {
  url: string;
  maxReconnectAttempts?: number;      // 最大重连次数
  reconnectIntervalBase?: number;     // 基础重连间隔（毫秒）
  heartbeatInterval?: number;         // 心跳间隔（毫秒）
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;   // 和ReconnectingWebSocket库返回类型不完全一致
}

// 默认配置
const DEFAULT_CONFIG = {
  maxReconnectAttempts: 5,
  reconnectIntervalBase: 1000,
  heartbeatInterval: 30000,
  onOpen: () => {},
  onClose: () => {},
  onError: () => {},
} as const;

// WebSocket基础类
export class BaseWebSocket {
  private ws: ReconnectingWebSocket | null = null;
  private heartbeatTimer: number | null = null;
  private handlers: Map<string, MessageHandler> = new Map();
  private config: Required<WebSocketConfig>;

  constructor(config: WebSocketConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<WebSocketConfig>;
  }

  // 创建连接
  connect(): void {
    this.ws = new ReconnectingWebSocket(this.config.url, [], {
      maxReconnectionDelay: this.config.reconnectIntervalBase * this.config.maxReconnectAttempts,
      minReconnectionDelay: this.config.reconnectIntervalBase,
      maxRetries: this.config.maxReconnectAttempts,
    });

    this.ws.onopen = () => {
      this.startHeartbeat();
      this.config.onOpen();
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.config.onClose();
    };

    // 使用类型断言绕过类型检查
    this.ws.onerror = ((error: Event) => {
      this.config.onError(error);
    }) as any;

    // 处理消息
    this.ws.onmessage = (event: MessageEvent) => {
      try {
        // type单独拿出来，其它放入data，用type对应的handler处理data
        const { type, ...data } = JSON.parse(event.data);
        const handler = this.handlers.get(type);
        if (handler) handler(data);
      } catch (error) {
        console.error('[BaseWebSocket] 消息解析失败:', error);
      }
    };
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // 发送心跳包（看后端是否需要）
        // this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 设置handlers
  on<T = any>(type: string, handler: MessageHandler<T>): void {
    this.handlers.set(type, handler);
  }

  // 发送消息
  send(type: string, data?: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  // 断连
  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  // 查询当前状态
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}