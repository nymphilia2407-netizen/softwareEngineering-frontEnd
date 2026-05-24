export interface User {
    id: number;
    username: string;
    avatar: string;
    status: 'online' | 'offline' | 'busy';
    registerTime: number;
    lastLoginTime: number;
    tag?: string;
}

export interface Group {
    id: number;
    groupname: string;
    avatar: string;
    ownerId: number;
    adminIds: number[];
    memberCount: number;
    createdTime: number;
}

export type MsgType = 'text' | 'image' | 'file';
export type MsgStatus = 'sending' | 'sent' | 'failed';

export type Message = {
    id: number;
    convId: number;
    senderId: number;
    /** 群聊展示用；私聊可不填 */
    senderUsername?: string;
    senderAvatar?: string;
    type: MsgType;
    status: MsgStatus;
    content: string;
    timestamp: number;
    time?: string;
    isRead?: boolean;
    clientId?: string;
    mentionedUserIds?: number[];
    replyTo?: ReplyToData;
    replyCount?: number;
};

export interface ReplyToData {
    messageId: number;
    senderUsername: string;
    content: string;
    replyCount?: number;
}

export type WsAction =
    | { type: 'send_message'; data: { conversation_id: number; content: string; client_id?: string; mentioned_user_ids?: number[]; reply_to_id?: number } }
    /** 与 Django ChatConsumer.handle_read_message 一致：last_read_message_id */
    | { type: 'read_message'; data: { conversation_id: number; last_read_message_id: number } }
    /** 建群/入群后加入 room_<id>，无需整页刷新即可收 new_message */
    | { type: 'subscribe_room'; data: { conversation_id: number } }
    /** 离开非活跃会话 room group，配合后端懒订阅 */
    | { type: 'unsubscribe_room'; data: { conversation_id: number } };
