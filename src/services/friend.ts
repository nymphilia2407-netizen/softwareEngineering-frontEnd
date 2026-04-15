// src/services/friend.ts
import request from '../utils/request';
import { toUser } from '../types/entity';
import type { User } from '../types/entity';

/** 获取好友列表 */
export const getFriendList = async (): Promise<User[]> => {
    const response: any = await request.get('/api/friends');
    return response.data.map(toUser);
};

/**
 * 添加好友（预留）
 */


/**
 * 删除好友（预留）
 */
