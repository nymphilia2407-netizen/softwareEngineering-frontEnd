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
    const response = await request.get<any, ApiResponse<UserSearchData[]>>('/api/users/search', {
        params: { q: keyword },
    });

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '搜索用户失败');
    }

    return response.data;
};

export const sendFriendRequest = async (targetUserId: number) => {
    const response = await request.post<any, ApiResponse<null>>('/api/friends/requests/send', {
        target_user_id: targetUserId,
    });

    if (response.code !== 0) {
        throw new Error(response.info || '发送好友请求失败');
    }

    return true;
};