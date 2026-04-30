import request from '../utils/request';

import { BaseWebSocket } from './websocket';
import { tokenUtils } from '../utils/auth';
import { useEffect, useRef, useState } from 'react';
import type { NewMessageData, SendMessagePayload, ReadMessagePayload } from '../types/chat';

export interface ChatRoomSummaryData {
    room_id: number;
    is_group: boolean;
    name: string;
    avatar: string;
    other_user_id?: number | null;
    last_message: string;
    last_time: string;
    unread_count: number;
}

export interface ChatMessageData {
    id: number;
    room_id: number;
    sender_id: number;
    content: string;
    created_at: string;
    is_read: boolean;
}

interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
}

export const getChatRooms = async () => {
    const response = await request.get<any, ApiResponse<ChatRoomSummaryData[]>>('/api/chat/rooms/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取会话列表失败');
    }

    return response.data;
};

export const getChatMessages = async (roomId: number, limit = 50, offset = 0) => {
    const response = await request.get<any, ApiResponse<{ room_id: number; count: number; messages: ChatMessageData[] }>>(
        `/api/chat/messages/${roomId}/`,
        { params: { limit, offset } }
    );

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取聊天记录失败');
    }

    return response.data;
};

// 将上行、下行的所有可能消息类型进行包装，方便写函数 
export type IncomingChatMessage =
  | { type: 'new_message'; data: NewMessageData }
  | { type: 'error'; message: string };

export type OutgoingChatMessage =
  | { type: 'send_message'; data: SendMessagePayload }
  | { type: 'read_message'; data: ReadMessagePayload };

// 后端WebSocket地址
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:80';

// 适配chat功能的WebSocket服务类
export class ChatWebSocketService {
  private ws: BaseWebSocket;

  constructor(token: string) {
    const url = `${WS_BASE_URL}/ws/chat/?token=${token}`;
    
    this.ws = new BaseWebSocket({
      url,
      onOpen: () => console.log('[Chat] 连接成功'),
      onClose: () => console.log('[Chat] 连接断开'),
      onError: (error) => console.error('[Chat] 错误:', error),
    });
  }

  // 建立连接
  connect(): void {
    this.ws.connect();
  }

  // 断开连接
  disconnect(): void {
    this.ws.disconnect();
  }

  // 监听新消息
  onNewMessage(handler: (data: NewMessageData) => void): void {
    this.ws.on<NewMessageData>('new_message', handler);
  }

  // 监听错误
  onError(handler: (message: string) => void): void {
    this.ws.on<{ message: string }>('error', (data) => handler(data.message));
  }

  // 发送消息
  sendMessage(payload: SendMessagePayload): void {
    this.ws.send('send_message', payload);
  }

  // 标记已读
  markAsRead(payload: ReadMessagePayload): void {
    this.ws.send('read_message', payload);
  }

  // 获取连接状态
  get readyState(): number {
    return this.ws.readyState;
  }
}

// 设置React Hook管理ChatWebSocket，页面中直接调用即可
export const useChatWebSocket = () => {
  const [messages, setMessages] = useState<NewMessageData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const serviceRef = useRef<ChatWebSocketService | null>(null);

  useEffect(() => {
    // 获取 token 进行鉴权
    const token = tokenUtils.getToken();
    if (!token) {
      setError('未登录');
      return;
    }

    // 创建服务实例
    const service = new ChatWebSocketService(token);
    serviceRef.current = service;

    // 注册消息监听
    service.onNewMessage((data) => {
      setMessages((prev) => {
        // 去重
        const exists = prev.some((m) => m.id === data.id);
        return exists ? prev : [...prev, data];
      });
    });

    service.onError((message) => {
      setError(message);
    });

    // 建立连接
    service.connect();

    // 定期检查连接状态
    const interval = setInterval(() => {
      setIsConnected(service.readyState === WebSocket.OPEN);
    }, 100);

    // 清理
    return () => {
      clearInterval(interval);
      service.disconnect();
      serviceRef.current = null;
    };
  }, []);

  // 发送消息 
  const sendMessage = (conversationId: number, content: string) => {
    serviceRef.current?.sendMessage({ conversation_id: conversationId, content });
  };

  // 标记已读 
  const markAsRead = (conversationId: number, lastMessageId: number) => {
    serviceRef.current?.markAsRead({ conversation_id: conversationId, last_message_id: lastMessageId });
  };

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    markAsRead,
  };
};