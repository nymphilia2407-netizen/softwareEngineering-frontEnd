import axios from 'axios'

// 创建 axios 实例
const request = axios.create({
    // 后端地址
    baseURL: 'http://localhost:8000',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器
request.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
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
        // 直接返回错误，让组件自己处理
        return Promise.reject(error);
    }
);

export default request;

