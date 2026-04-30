import request from '../utils/request';
import type { RegisterResponse, RegisterParams, LoginParams, LoginResponse } from '../types/auth';

// 注册
export const registerApi = (data: RegisterParams) => {
    return request.post<any, RegisterResponse>('/api/auth/register', data);
};

// 登录
export const loginApi = (data: LoginParams) => {
    return request.post<any, LoginResponse>('/api/auth/login', data);
};
