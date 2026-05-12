import request from '../utils/request';

import { assertApiSuccess, unwrapApiData, type ApiResponse } from './apiResponse';

export interface FriendSummaryData {
    user_id: number;
    username: string;
    avatar?: string;
    status?: 'online' | 'offline' | 'busy';
    tag?: string;
}

export interface UserSearchData {
    user_id: number;
    username: string;
    avatar?: string;
    email?: string;
}

/** 好友请求里嵌套的用户信息；后端可只返回 id + username，其余为可选 */
export interface FriendRequestUserSnippet {
    user_id: number;
    username: string;
    avatar?: string;
    email?: string;
    birthday?: string;
    address?: string;
    signature?: string;
}

export interface ReceivedFriendRequestData {
    request_id: number;
    from_user: FriendRequestUserSnippet;
    created_at: string;
}

/** GET /api/friends/requests/sent/ — 当前用户发出且仍为 pending 的申请 */
export interface SentFriendRequestData {
    request_id: number;
    to_user: FriendRequestUserSnippet;
    created_at: string;
}

// GET /api/friends/<friend_id>/info
export interface FriendDetail {
    user_id: number;
    username: string;
    email: string;
    avatar: string;
    birthday: string;
    address: string;
    signature: string;
    tag?: string;
}

/** 获取好友列表 */
export const getFriendList = async () => {
    const response = await request.get<unknown, ApiResponse<FriendSummaryData[]>>('/api/friends/');
    return unwrapApiData(response, '获取好友列表失败');
};

export const searchUsers = async (keyword: string) => {
    const response = await request.get<unknown, ApiResponse<UserSearchData[]>>('/api/users/search/', {
        params: { q: keyword },
    });
    return unwrapApiData(response, '搜索用户失败');
};

export const searchUsersByEmail = async (email: string) => {
    const response = await request.get<unknown, ApiResponse<UserSearchData[]>>('/api/users/search/', {
        params: { email },
    });
    return unwrapApiData(response, '按邮箱搜索用户失败');
};

export const sendFriendRequest = async (targetUserId: number) => {
    const response = await request.post<unknown, ApiResponse<null>>('/api/friends/requests/', {
        target_user_id: targetUserId,
    });
    assertApiSuccess(response, '发送好友请求失败');
    return true;
};

export const getReceivedFriendRequests = async () => {
    const response = await request.get<unknown, ApiResponse<ReceivedFriendRequestData[]>>('/api/friends/requests/');
    return unwrapApiData(response, '获取好友请求失败');
};

export const getSentFriendRequests = async () => {
    const response = await request.get<unknown, ApiResponse<SentFriendRequestData[]>>('/api/friends/requests/sent/');
    return unwrapApiData(response, '获取已发送好友请求失败');
};

export const acceptFriendRequest = async (requestId: number) => {
    const response = await request.post<unknown, ApiResponse<null>>(`/api/friends/requests/${requestId}/accept/`);
    assertApiSuccess(response, '接受好友请求失败');
    return true;
};

export const rejectFriendRequest = async (requestId: number) => {
    const response = await request.post<unknown, ApiResponse<null>>(`/api/friends/requests/${requestId}/reject/`);
    assertApiSuccess(response, '拒绝好友请求失败');
    return true;
};

// GET /api/friends/<friend_id>/info 获取好友信息
export const getFriendDetail = async (friendId: number): Promise<FriendDetail> => {
    const response = await request.get<unknown, ApiResponse<FriendDetail>>(`/api/friends/${friendId}/info/`);
    return unwrapApiData(response, '获取好友信息失败');
};

// 删除好友
export const deleteFriend = async (friendId: number): Promise<boolean> => {
    await request.delete<unknown, void>(`/api/friends/${friendId}/`);
    return true;
};

/** 更改好友分组 */
export const updateFriendTag = async (friendId: number, tag: string): Promise<void> => {
    const response = await request.put<unknown, ApiResponse<null>>(`/api/friends/${friendId}/group/`, { tag });
    assertApiSuccess(response, '更改分组失败');
};
