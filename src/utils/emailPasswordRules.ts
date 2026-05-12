/** 与登录/注册页邮箱校验一致 */
export const isValidEmailFormat = (email: string) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
