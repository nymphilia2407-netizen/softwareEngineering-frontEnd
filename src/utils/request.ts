import axios from 'axios';

import { BACKENDURL } from '../constants/string';
import { tokenUtils } from './auth';

// 创建 axios 实例（与 constants/string 中 BACKENDURL 同源，避免两处改漏）
const request = axios.create({
    baseURL: BACKENDURL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

const getAuthScheme = () => localStorage.getItem('auth_scheme') || 'Bearer';

const buildAuthorizationHeader = (token: string, scheme?: string) => {
    const normalizedScheme = (scheme || '').trim();
    if (!normalizedScheme) {
        return token;
    }

    return `${normalizedScheme} ${token}`;
};

// 请求拦截器
request.interceptors.request.use(
    (config) => {
        const token = tokenUtils.getToken();
        // 如果存在 token，添加到请求头
        if (token) {
            config.headers.Authorization = buildAuthorizationHeader(token, getAuthScheme());
        }
        return config;
    },
    (error) => {
        // 请求配置出错
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// 响应拦截器
request.interceptors.response.use(
    (response) => {
        return response.data;
    },
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
        const token = tokenUtils.getToken();

        // 兼容后端可能要求 Token 而不是 Bearer
        if ((status === 401 || status === 403) && token && originalRequest && !originalRequest._authRetried) {
            const currentScheme = getAuthScheme();
            const fallbackScheme = currentScheme === 'Bearer' ? 'Token' : 'Bearer';

            originalRequest._authRetried = true;
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = buildAuthorizationHeader(token, fallbackScheme);
            localStorage.setItem('auth_scheme', fallbackScheme);

            return request(originalRequest);
        }

        const backendMessage =
            error.response?.data?.info ||
            error.response?.data?.detail ||
            error.response?.data?.message ||
            error.message;

        // 如果token无效且不在登录，返回到login界面
        if (status === 401 && !window.location.pathname.includes('/login')) {
            tokenUtils.removeToken();
            window.location.href = '/login';
            return Promise.resolve(null);
        }
        // 直接返回错误，让组件自己处理
        return Promise.reject(new Error(backendMessage || '请求失败'));
    }
);

export default request;

