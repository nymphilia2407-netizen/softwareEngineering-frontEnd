import request from '../utils/request';

interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
}

export interface GroupSummaryData {
    room_id: number;
    group_name: string;
    avatar: string;
    owner_id: number | null;
    member_count: number;
    created_at: string;
}

export interface GroupMemberData {
    user_id: number;
    username: string;
    avatar: string;
    is_owner: boolean;
}

export interface GroupDetailData {
    room_id: number;
    group_name: string;
    avatar: string;
    owner_id: number | null;
    member_count: number;
    created_at: string;
    members: GroupMemberData[];
    announcements: Array<{
        id: number;
        content: string;
        created_at: string;
        author_id: number;
        author_name: string;
    }>;
}

export interface CreateGroupPayload {
    group_name: string;
    member_ids: number[];
}

export const getGroupList = async () => {
    const response = await request.get<any, ApiResponse<GroupSummaryData[]>>('/api/groups/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取群组列表失败');
    }

    return response.data;
};

export const createGroup = async (payload: CreateGroupPayload) => {
    const response = await request.post<any, ApiResponse<GroupSummaryData>>('/api/groups/', payload);

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '创建群聊失败');
    }

    return response.data;
};

export const getGroupDetail = async (roomId: number) => {
    const response = await request.get<any, ApiResponse<GroupDetailData>>(`/api/groups/${roomId}`);

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取群聊详情失败');
    }

    return response.data;
};