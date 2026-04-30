import request from '../utils/request';

export interface FriendSummaryData {
    user_id: number;
    username: string;
    avatar?: string;
    status?: 'online' | 'offline' | 'busy';
}

interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
}

export const getFriendList = async () => {
    const response = await request.get<any, ApiResponse<FriendSummaryData[]>>('/api/friends/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取好友列表失败');
    }

    return response.data;
};