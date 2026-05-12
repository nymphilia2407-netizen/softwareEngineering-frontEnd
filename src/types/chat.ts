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

/** 主界面会话列表行（含私聊/群与免打扰等） */
export interface ChatListItem {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  status?: 'online' | 'offline' | 'busy';
  otherUserId?: number | null;
  isGroup: boolean;
  /** 消息免打扰：开启后新消息仍更新预览，但不增加未读数 */
  isMuted?: boolean;
}

export type ActiveTabType = 'chat' | 'contacts' | 'settings';

