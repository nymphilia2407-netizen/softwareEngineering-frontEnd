import ReconnectingWebSocket from 'reconnecting-websocket';

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