// token存储、提取用
export const tokenUtils = {
    setToken: (token: string) => {
        localStorage.setItem('token', token);
    },
    
    getToken: (): string | null => {
        return localStorage.getItem('token');
    },
    
    removeToken: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user_profile');
    },

    // 检测是否已经有token
    isAuthenticated: (): boolean => {
        return !!localStorage.getItem('token');
    },
};

const USER_PROFILE_KEY = 'user_profile';

/** 与 token 同机缓存的用户展示信息；换账号登录时会按 username 判断是否沿用旧字段 */
export interface UserProfileCache {
    username: string;
    avatar: string;
    birthday: string;
    address: string;
    signature: string;
    phone: string;
}

export function readUserProfileCache(): UserProfileCache | null {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const p = JSON.parse(raw) as Record<string, unknown>;
        if (typeof p.username !== 'string' || p.username.length === 0) {
            return null;
        }

        return {
            username: p.username,
            avatar: typeof p.avatar === 'string' ? p.avatar : '',
            birthday: typeof p.birthday === 'string' ? p.birthday : '',
            address: typeof p.address === 'string' ? p.address : '',
            signature: typeof p.signature === 'string' ? p.signature : '',
            phone: typeof p.phone === 'string' ? p.phone : '',
        };
    } catch {
        return null;
    }
}

/** 写入 localStorage；未传的字段在与当前 username 一致时保留旧值，换用户则清空未传字段 */
export function persistUserProfile(updates: {
    username: string;
    avatar?: string;
    birthday?: string;
    address?: string;
    signature?: string;
    phone?: string;
}): void {
    const prev = readUserProfileCache();
    const sameUser = prev !== null && prev.username === updates.username;

    const next: UserProfileCache = {
        username: updates.username,
        avatar:
            updates.avatar !== undefined ? updates.avatar : sameUser ? prev.avatar : '',
        birthday:
            updates.birthday !== undefined ? updates.birthday : sameUser ? prev.birthday : '',
        address:
            updates.address !== undefined ? updates.address : sameUser ? prev.address : '',
        signature:
            updates.signature !== undefined ? updates.signature : sameUser ? prev.signature : '',
        phone:
            updates.phone !== undefined ? updates.phone : sameUser ? prev.phone : '',
    };

    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(next));
}

/** 与登录/注册页邮箱校验一致 */
export const isValidEmailFormat = (email: string) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());

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

    score = 0;

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
};

/** 与登录页注册密码强度展示一致（checkPasswordStrength 评分档位） */
const STRENGTH_LEVELS = [
    { label: '极弱', meterClass: 'security-strength-meter-fill--level-1', textClass: 'security-strength-text--level-1' },
    { label: '弱', meterClass: 'security-strength-meter-fill--level-2', textClass: 'security-strength-text--level-2' },
    { label: '中', meterClass: 'security-strength-meter-fill--level-3', textClass: 'security-strength-text--level-3' },
    { label: '强', meterClass: 'security-strength-meter-fill--level-4', textClass: 'security-strength-text--level-4' },
    { label: '极强', meterClass: 'security-strength-meter-fill--level-5', textClass: 'security-strength-text--level-5' },
] as const;

export type PasswordStrengthUi = {
    label: string;
    meterClass: string;
    textClass: string;
};

/** 与注册页一致：score === -1 表示不合法（单一字符集等） */
export function getPasswordStrengthDisplay(password: string): PasswordStrengthUi | null {
    if (!password) {
        return null;
    }

    const score = checkPasswordStrength(password);
    if (score === -1) {
        return {
            label: '不合法',
            meterClass: 'security-strength-meter-fill--invalid',
            textClass: 'security-strength-text--invalid',
        };
    }

    const index = Math.min(Math.max(0, score), STRENGTH_LEVELS.length - 1);
    return STRENGTH_LEVELS[index];
}

export function isPasswordAllowedForRegister(password: string): boolean {
    return checkPasswordStrength(password) !== -1;
}