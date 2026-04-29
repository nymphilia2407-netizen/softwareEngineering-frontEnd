import axios from 'axios'
import { tokenUtils } from './auth';

// 部署时导入环境变量
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

console.log('BASE_URL:', import.meta.env.VITE_API_BASE_URL)

// 创建 axios 实例
const request = axios.create({
    // 后端地址
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器
request.interceptors.request.use(
    (config) => {
        const token = tokenUtils.getToken();
        // 如果存在 token，添加到请求头
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
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
    (error) => {
        // 如果token无效且不在登录，返回到login界面
        if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            tokenUtils.removeToken();
            window.location.href = '/login';
            return Promise.resolve(null);
        }
        // 直接返回错误，让组件自己处理
        return Promise.reject(error);
    }
);

export default request;

