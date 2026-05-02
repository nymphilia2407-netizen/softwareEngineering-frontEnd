export interface ChatItemProps{
    convId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    lastMsg: string;
    time: string;
    isActive: boolean;
    onClick(): () => void
}

// 新消息的数据结构（下行）
export interface NewMessageData {
  id: number;
  conversation_id: number;
  content: string;
  sender_id: number;
  timestamp: string;
}

// 发送消息的数据结构（上行）
export interface SendMessagePayload {
  conversation_id: number;
  content: string;
}

// 标记已读的数据结构（上行，与 WebSocket read_message 一致）
export interface ReadMessagePayload {
  conversation_id: number;
  last_read_message_id: number;
}

