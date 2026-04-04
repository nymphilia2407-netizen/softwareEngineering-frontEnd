interface User{
    id: string;
    username: string;
    avatar: string;
    lastLoginTime: number;
}

interface group{
    id: string;
    groupname: string;
    ownerId: string;
    adminIds: string[];
    memberCount: number;
    createdTime: number;
}