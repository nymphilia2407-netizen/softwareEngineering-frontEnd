export interface User{
    id: number;
    username: string;
    avatar: string;
    status: 'online' | 'offline' | 'busy';
    registerTime: number;
    lastLoginTime: number;
}

export interface Group{
    id: number;
    groupname: string;
    avatar: string;
    ownerId: number;
    adminIds: number[];
    memberCount: number;
    createdTime: number;
}

export type MsgType = 'text' | 'image' | 'file';
export type MsgStatus = 'sending' | 'sent' | 'failed'

export type Message = {
    id: number;
    convId: number;
    senderId: number;
    type: MsgType;
    status: MsgStatus;
    content: string;
    timestamp: number;
    time?: string;
}

// 上行消息格式 (Client -> Server)
export type WsAction = 
  | { type: 'send_message'; data: { conversation_id: number; content: string } }
  | { type: 'read_message'; data: { conversation_id: number; last_message_id: number } };

// 下行消息格式 (Server -> Client)
export type WsResponse = 
  | { type: 'new_message'; data: Message }
  | { type: 'error'; message: string };
