// 伪token生成函数， 用于登录/注册鉴权模拟
export const tokenUtilis = {
    generate: (username: string) => {
        const payload = {
            username: username,
            loginAt: new Date().toISOString(),
            expire: Date.now() + 1000 * 60 * 60 * 24 // 24h 后过期
        };
        const base64PlatLoad = btoa(JSON.stringify(payload));
        return base64PlatLoad;
    },

    decode: (token: string) => {
        try{
            const payload = JSON.parse(atob(token));
            return payload;
        }catch(e){
            return null;
        }
    }
}