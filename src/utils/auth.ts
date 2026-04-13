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

export const checkPasswordStrength = (password: string) => {
    let score = 0;
    const len = password.length;

    /**非法密码
     * 长度小于6的
     * 只含数字或只含字符的
     */
    const hasAlpha = /[a-zA-Z]/.test(password);
    const hasNum = /\d/.test(password);
    const hasSpecial = /[~!@#$%^&*()\\/<>?{}]/.test(password)

    if((hasAlpha && !hasNum && !hasSpecial) ||
        (hasNum && !hasAlpha && !hasSpecial) ||
        (hasSpecial && !hasAlpha && !hasNum))
        return -1;

    score = 1;

    /**加分项
     * 长度足够长
     * 含有特殊字符
     * 大小写混合
     */
    if(password.length >= 10) ++score;
    if(hasSpecial) score += 2;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;

    /**减分项
     * 某字符连续出现3次以上
     * 出现连续字符（长度 > 3）
     * 密码字符集太小
     */

    if (/(.)\1{2,}/.test(password)) {
        score -= 1;
    }

    let continuousCount = 0;
    for (let i = 0; i < len - 1; i++) {
        const curr = password.charCodeAt(i);
        const next = password.charCodeAt(i + 1);
        if (next === curr + 1 || next === curr - 1) {
            continuousCount++;
            if (continuousCount >= 3) {
                score -= 1;
                break;
            }
        } else {
            continuousCount = 0;
        }
    }

    const uniqueChar = new Set(password).size;
    if(uniqueChar <= 3) score -= 1;

    return Math.max(0, score);
}