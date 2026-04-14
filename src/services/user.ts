import request from '../utils/request';
import type { BackendFriend, User } from '../types/entity';
import { toUser } from '../types/entity';

/** 获取当前用户信息 */
export const getCurrentUser = async (): Promise<User> => {
    const data = await request.get('/api/users/me') as BackendFriend;
    return toUser(data);
};