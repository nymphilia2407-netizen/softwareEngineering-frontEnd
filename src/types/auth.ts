// 注册
export interface RegisterParams {
    username: string;
    email: string;
    password: string;
    /** 可选：图片 data URL（与 PUT /api/users/me/ 一致） */
    avatar?: string;
}

export interface RegisterResponse {
    code: number;
    info: string;
    data?: {
        token: string;
        user_id: number;
        username: string;
        avatar?: string;
    };
}

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
        avatar?: string;
    };
}