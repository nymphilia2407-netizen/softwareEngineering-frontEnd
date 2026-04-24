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
