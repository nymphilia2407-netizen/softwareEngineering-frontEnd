import { DEFAULT_AVATAR } from '../constants/string';

/** 后端常返回空字符串；data URL / http(s) 有内容时才用作 img src */
export function resolvedUserAvatar(avatar?: string | null): string {
    const trimmed = (avatar ?? '').trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_AVATAR;
}
