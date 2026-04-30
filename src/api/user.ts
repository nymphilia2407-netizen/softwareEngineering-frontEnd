import request from '../utils/request';

export interface CurrentUserData {
    user_id: number;
    username: string;
    email: string;
    avatar: string;
}

interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
}

export const getCurrentUser = async () => {
    const response = await request.get<any, ApiResponse<CurrentUserData>>('/api/users/me');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取当前用户失败');
    }

    return response.data;
};