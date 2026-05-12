import request from '../utils/request';

import { assertApiSuccess, unwrapApiData, type ApiResponse } from './apiResponse';

export interface CurrentUserData {
    user_id: number;
    username: string;
    email: string;
    avatar: string;
    birthday: string;
    address: string;
    signature: string;
}

export const getCurrentUser = async () => {
    const response = await request.get<unknown, ApiResponse<CurrentUserData>>('/api/users/me/');
    return unwrapApiData(response, '获取当前用户失败');
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
    const response = await request.put<unknown, ApiResponse<null>>('/api/users/me/', payload);
    assertApiSuccess(response, '更新资料失败');
    return true;
};

export const deleteUser = async (): Promise<boolean> => {
    try {
        await request.delete('/api/users/me/');
        return true;
    } catch {
        return false;
    }
};
