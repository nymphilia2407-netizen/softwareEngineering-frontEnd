import { DEFAULT_AVATAR } from '../constants/string';
import { readUserProfileCache, tokenUtils } from './auth';

export const decodeTokenPayload = () => {
    const token = tokenUtils.getToken();
    if (!token) {
        return null;
    }

    const payload = token.split('.')[1];
    if (!payload) {
        return null;
    }

    try {
        const normalizedPayload = payload.replaceAll('-', '+').replaceAll('_', '/');
        const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
        const parsed = JSON.parse(atob(paddedPayload)) as {
            data?: { user_id?: number; username?: string };
            user_id?: number;
            username?: string;
        };
        // 后端 generate_jwt_token 把业务字段放在 payload.data 里
        const inner = parsed.data ?? parsed;
        return { user_id: inner.user_id, username: inner.username };
    } catch {
        return null;
    }
};

/** 在 /me/ 返回前，用 localStorage 还原与当前 token 用户名一致的资料，便于刷新后立刻看到上次保存的内容 */
export const readInitialUserFromLocalCache = () => {
    const cache = readUserProfileCache();
    const username = decodeTokenPayload()?.username ?? '';
    if (!cache || cache.username !== username) {
        return {
            avatar: DEFAULT_AVATAR,
            profileBirthday: '',
            profileAddress: '',
            profileSignature: '',
        };
    }

    return {
        avatar: cache.avatar.length > 0 ? cache.avatar : DEFAULT_AVATAR,
        profileBirthday: cache.birthday,
        profileAddress: cache.address,
        profileSignature: cache.signature,
    };
};
