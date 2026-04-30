import request from '../utils/request';

// 注册
export interface RegisterParams {
    username: string;
    email: string;
    password: string;
}

export interface RegisterResponse {
    code: number;
    info: string;
}

export const registerApi = (data: RegisterParams) => {
    return request.post<any, RegisterResponse>('/api/auth/register', data);
};

// 登录
export interface LoginParams {
    email: string;
    password: string;
}

export interface LoginResponse {
    code: number;
    info: string;
    data?: {
        token: string;
        user_id: number;
        username: string;
    };
}

export const loginApi = (data: LoginParams) => {
    return request.post<any, LoginResponse>('/api/auth/login', data);
};

