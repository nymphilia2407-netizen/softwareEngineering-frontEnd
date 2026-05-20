import { DEFAULT_AVATAR } from '../constants/string';

/** 后端常返回空字符串；data URL / http(s) 有内容时才用作 img src */
export function resolvedUserAvatar(avatar?: string | null): string {
    const trimmed = (avatar ?? '').trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_AVATAR;
}

/** 注册/资料接口：本地选图原文件大小上限 */
export const MAX_AVATAR_FILE_BYTES = 4 * 1024 * 1024;

export async function readAvatarFileAsDataUrl(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件');
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
        throw new Error(`图片需不超过 ${Math.round(MAX_AVATAR_FILE_BYTES / (1024 * 1024))}MB`);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('读取文件失败'));
                return;
            }
            resolve(result);
        };
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(file);
    });
}

// 简单的内存级头像缓存，按 user_id 存储原始 avatar 字符串
const avatarCache: Record<string, string> = {};

export function setCachedAvatar(userId: number, avatar: string | null | undefined) {
    const v = (avatar ?? '').trim();
    if (v.length > 0) {
        avatarCache[String(userId)] = v;
    }
}

export function getCachedAvatar(userId: number): string | undefined {
    return avatarCache[String(userId)];
}

export function mergeUserAvatars(map: Record<string, string> | undefined) {
    if (!map) return;
    Object.keys(map).forEach((k) => {
        const v = (map[k] ?? '').trim();
        if (v.length > 0) avatarCache[k] = v;
    });
}
