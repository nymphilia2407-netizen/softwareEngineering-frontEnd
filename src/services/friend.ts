import request from '../utils/request';

export interface FriendSummaryData {
    user_id: number;
    username: string;
    avatar?: string;
    status?: 'online' | 'offline' | 'busy';
}

export interface UserSearchData {
    user_id: number;
    username: string;
    avatar?: string;
    email?: string;
}

export interface ReceivedFriendRequestData {
    request_id: number;
    from_user: {
        user_id: number;
        username: string;
    };
    created_at: string;
}

/** GET /api/friends/requests/sent/ — 当前用户发出且仍为 pending 的申请 */
export interface SentFriendRequestData {
    request_id: number;
    to_user: {
        user_id: number;
        username: string;
    };
    created_at: string;
}

interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
}

/** 获取好友列表 */
export const getFriendList = async () => {
    const response = await request.get<any, ApiResponse<FriendSummaryData[]>>('/api/friends/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取好友列表失败');
    }

    return response.data;
};

export const searchUsers = async (keyword: string) => {
    const response = await request.get<any, ApiResponse<UserSearchData[]>>('/api/users/search/', {
        params: { q: keyword },
    });

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '搜索用户失败');
    }

    return response.data;
};

export const searchUsersByEmail = async (email: string) => {
    const response = await request.get<any, ApiResponse<UserSearchData[]>>('/api/users/search/', {
        params: { email },
    });

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '按邮箱搜索用户失败');
    }

    return response.data;
};

export const sendFriendRequest = async (targetUserId: number) => {
    const response = await request.post<any, ApiResponse<null>>('/api/friends/requests/', {
        target_user_id: targetUserId,
    });

    if (response.code !== 0) {
        throw new Error(response.info || '发送好友请求失败');
    }

    return true;
};

export const getReceivedFriendRequests = async () => {
    const response = await request.get<any, ApiResponse<ReceivedFriendRequestData[]>>('/api/friends/requests/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取好友请求失败');
    }

    return response.data;
};

export const getSentFriendRequests = async () => {
    const response = await request.get<any, ApiResponse<SentFriendRequestData[]>>('/api/friends/requests/sent/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取已发送好友请求失败');
    }

    return response.data;
};

export const acceptFriendRequest = async (requestId: number) => {
    const response = await request.post<any, ApiResponse<null>>(`/api/friends/requests/${requestId}/accept/`);

    if (response.code !== 0) {
        throw new Error(response.info || '接受好友请求失败');
    }

    return true;
};

export const rejectFriendRequest = async (requestId: number) => {
    const response = await request.post<any, ApiResponse<null>>(`/api/friends/requests/${requestId}/reject/`);

    if (response.code !== 0) {
        throw new Error(response.info || '拒绝好友请求失败');
    }

    return true;
};