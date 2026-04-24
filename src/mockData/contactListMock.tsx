import { DEFAULT_AVATAR } from "../constants/string";
import { type User, type Group } from "../types/entity";

export const MOCK_FRIENDS: User[] = [
    {
        id: 11,
        username: 'Alice',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1712470000000,
        lastLoginTime: 1712556400000,
    },
    {
        id: 12,
        username: 'Bob',
        avatar: DEFAULT_AVATAR,
        status: 'busy',
        registerTime: 1712471000000,
        lastLoginTime: 1712556500000,
    },
    {
        id: 13,
        username: 'Cindy',
        avatar: DEFAULT_AVATAR,
        status: 'offline',
        registerTime: 1712472000000,
        lastLoginTime: 1712550000000,
    },
    {
        id: 14,
        username: 'Dave',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1712473000000,
        lastLoginTime: 1712556000000,
    },
    {
        id: 15,
        username: 'Eric',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1600000000000,
        lastLoginTime: 1712556000000,
    },
    {
        id: 16,
        username: 'Frank',
        avatar: DEFAULT_AVATAR,
        status: 'offline',
        registerTime: 1600000000000,
        lastLoginTime: 1712516000000,
    },
    {
        id: 17,
        username: 'Grace',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1000000000000,
        lastLoginTime: 1712516000000,
    },
    {
        id: 18,
        username: 'Hans',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1630000000000,
        lastLoginTime: 18712516000000,
    }
];

// 模拟群聊数据
export const MOCK_GROUPS: Group[] = [
    {
        id: 21,
        groupname: 'Group 1',
        avatar: DEFAULT_AVATAR,
        ownerId: 11,
        adminIds: [12, 13],
        memberCount: 1258,
        createdTime: 1700000000000,
    },
    {
        id: 22,
        groupname: 'Group 2',
        avatar: DEFAULT_AVATAR,
        ownerId: 12,
        adminIds: [],
        memberCount: 8,
        createdTime: 1710000000000,
    },
    {
        id: 23,
        groupname: 'Group 3',
        avatar: DEFAULT_AVATAR,
        ownerId: 14,
        adminIds: [11],
        memberCount: 45,
        createdTime: 1711000000000,
    },
    {
        id: 24,
        groupname: 'Group 4',
        avatar: DEFAULT_AVATAR,
        ownerId: 14,
        adminIds: [11,16],
        memberCount: 1000,
        createdTime: 1711000000000,
    },
    {
        id: 25,
        groupname: 'Group 5',
        avatar: DEFAULT_AVATAR,
        ownerId: 16,
        adminIds: [11,17],
        memberCount: 999,
        createdTime: 1711000000000,
    }
];