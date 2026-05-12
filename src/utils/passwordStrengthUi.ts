import { checkPasswordStrength } from './auth';

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
