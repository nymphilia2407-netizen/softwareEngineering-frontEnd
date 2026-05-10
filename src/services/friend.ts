import request from '../utils/request';

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

// GET /api/friends/<friend_id>/info 获取好友信息
export const getFriendDetail = async (friendId: number): Promise<FriendDetail> => {
    const response = await request.get<any, ApiResponse<FriendDetail>>(`/api/friends/${friendId}/info/`);

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取好友信息失败');
    }

    return response.data;
};

// 删除好友
export const deleteFriend = async (friendId: number): Promise<boolean> => {
    await request.delete<any, void>(`/api/friends/${friendId}/`);
    return true;
};

/** 更改好友分组 */
export const updateFriendTag = async (friendId: number, tag: string): Promise<void> => {
    const response = await request.put<any, ApiResponse<null>>(
        `/api/friends/${friendId}/group/`,
        { tag: tag }
    );
    if (response.code !== 0) {
        throw new Error(response.info || '更改分组失败');
    }
};