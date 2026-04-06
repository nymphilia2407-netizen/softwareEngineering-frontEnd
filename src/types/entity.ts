export interface User{
    id: string;
    username: string;
    avatar: string;
    status: 'online' | 'offline' | 'busy';
    registerTime: number;
    lastLoginTime: number;
}

export interface Group{
    id: string;
    groupname: string;
    avatar: string;
    ownerId: string;
    adminIds: string[];
    memberCount: number;
    createdTime: number;
}

