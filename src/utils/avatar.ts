import { DEFAULT_AVATAR } from '../constants/string';

/** 后端常返回空字符串；data URL / http(s) 有内容时才用作 img src */
export function resolvedUserAvatar(avatar?: string | null): string {
    const trimmed = (avatar ?? '').trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_AVATAR;
}

/** 注册/资料接口：本地选图原文件大小上限 */
export const MAX_AVATAR_FILE_BYTES = 4 * 1024 * 1024;

/** 头像 data URL / 内联字符串最大长度（<4MB） */
export const MAX_AVATAR_DATA_URL_LEN = MAX_AVATAR_FILE_BYTES;

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

/** 可缓存/展示的头像 data URL 最大长度（原图 <4MB） */
export const AVATAR_CACHE_MAX_LEN = MAX_AVATAR_DATA_URL_LEN;

// 简单的内存级头像缓存，按 user_id 存储原始 avatar 字符串
const avatarCache: Record<string, string> = {};

export function isCacheableAvatar(avatar: string | null | undefined): boolean {
    const v = (avatar ?? '').trim();
    if (v.length === 0 || v.length > AVATAR_CACHE_MAX_LEN) {
        return false;
    }
    return true;
}

export function setCachedAvatar(userId: number, avatar: string | null | undefined) {
    const v = (avatar ?? '').trim();
    if (isCacheableAvatar(v)) {
        avatarCache[String(userId)] = v;
    }
}

export function getCachedAvatar(userId: number): string | undefined {
    return avatarCache[String(userId)];
}

export function mergeUserAvatars(map: Record<string, string> | undefined) {
    if (!map) return;
    Object.keys(map).forEach((k) => {
        setCachedAvatar(Number(k), map[k]);
    });
}

/** 好友列表加载后预热发送者头像，历史消息接口可不带头像 */
export function cacheAvatarsFromFriends(friends: { user_id: number; avatar?: string }[]) {
    friends.forEach((f) => setCachedAvatar(f.user_id, f.avatar));
}

/** 私聊会话列表中的对方头像写入用户缓存 */
export function cacheAvatarsFromChatRooms(
    rooms: { is_group: boolean; other_user_id?: number | null; avatar: string }[],
) {
    rooms.forEach((room) => {
        if (room.is_group) return;
        const otherId = room.other_user_id;
        if (typeof otherId === 'number' && Number.isFinite(otherId)) {
            setCachedAvatar(otherId, room.avatar);
        }
    });
}
