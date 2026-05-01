import request from '../utils/request';

export interface CurrentUserData {
    user_id: number;
    username: string;
    email: string;
    avatar: string;
    birthday: string;
    address: string;
    signature: string;
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

export interface UpdateProfilePayload {
    username?: string;
    avatar?: string;
    email?: string;
    password?: string;
    old_password?: string;
    birthday?: string;
    address?: string;
    signature?: string;
}

export const updateUserProfile = async (payload: UpdateProfilePayload) => {
    const response = await request.put<any, ApiResponse<null>>('/api/users/me', payload);

    if (response.code !== 0) {
        throw new Error(response.info || '更新资料失败');
    }

    return true;
};