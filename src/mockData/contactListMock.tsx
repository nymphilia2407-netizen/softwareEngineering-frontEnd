import { DEFAULT_AVATAR } from "../constants/string";
import { type User, type Group } from "../types/entity";

export const MOCK_FRIENDS: User[] = [
    {
        id: '1',
        username: 'Alice',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1712470000000,
        lastLoginTime: 1712556400000,
    },
    {
        id: '2',
        username: 'Bob',
        avatar: DEFAULT_AVATAR,
        status: 'busy',
        registerTime: 1712471000000,
        lastLoginTime: 1712556500000,
    },
    {
        id: '3',
        username: 'Cindy',
        avatar: DEFAULT_AVATAR,
        status: 'offline',
        registerTime: 1712472000000,
        lastLoginTime: 1712550000000,
    },
    {
        id: '4',
        username: 'Dave',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1712473000000,
        lastLoginTime: 1712556000000,
    },
    {
        id: '5',
        username: 'Eric',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1600000000000,
        lastLoginTime: 1712556000000,
    },
    {
        id: '6',
        username: 'Frank',
        avatar: DEFAULT_AVATAR,
        status: 'offline',
        registerTime: 1600000000000,
        lastLoginTime: 1712516000000,
    },
    {
        id: '7',
        username: 'Grace',
        avatar: DEFAULT_AVATAR,
        status: 'online',
        registerTime: 1000000000000,
        lastLoginTime: 1712516000000,
    },
    {
        id: '8',
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
        id: 'g1',
        groupname: 'Group 1',
        avatar: DEFAULT_AVATAR,
        ownerId: '1',
        adminIds: ['2', '3'],
        memberCount: 1258,
        createdTime: 1700000000000,
    },
    {
        id: 'g2',
        groupname: 'Group 2',
        avatar: DEFAULT_AVATAR,
        ownerId: '2',
        adminIds: [],
        memberCount: 8,
        createdTime: 1710000000000,
    },
    {
        id: 'g3',
        groupname: 'Group 3',
        avatar: DEFAULT_AVATAR,
        ownerId: '4',
        adminIds: ['1'],
        memberCount: 45,
        createdTime: 1711000000000,
    },
    {
        id: 'g4',
        groupname: 'Group 4',
        avatar: DEFAULT_AVATAR,
        ownerId: '4',
        adminIds: ['1','6'],
        memberCount: 1000,
        createdTime: 1711000000000,
    },
    {
        id: 'g5',
        groupname: 'Group 5',
        avatar: DEFAULT_AVATAR,
        ownerId: '6',
        adminIds: ['1','7'],
        memberCount: 999,
        createdTime: 1711000000000,
    }
];