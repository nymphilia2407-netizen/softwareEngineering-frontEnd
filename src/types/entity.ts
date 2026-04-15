export interface User{
    id: number; // 和后端一致
    username: string;
    avatar: string;
    status: 'online' | 'offline' | 'busy'; // 需要在websocket里获取
    registerTime: number;
    lastLoginTime: number;
}

// 从后端接受
export interface BackendFriend {
    user_id: number;
    username: string;
    avatar: string;
}

// 接受后端类型向前端类型的转换
export function toUser(friend: BackendFriend): User {
    return {
        id: friend.user_id,
        username: friend.username,
        avatar: friend.avatar,
        status: 'offline', // 这几项还没有处理
        registerTime: 0,
        lastLoginTime: 0
    };
}

export interface Group{
    id: number;
    groupname: string;
    avatar: string;
    ownerId: string;
    adminIds: string[];
    memberCount: number;
    createdTime: number;
}

