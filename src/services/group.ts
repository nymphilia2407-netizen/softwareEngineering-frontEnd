import request from '../utils/request';
import { getChatRooms } from './chat';

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
    role: 'owner' | 'admin' | 'member';
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
    /** 与单次打开「新建群聊」弹窗绑定，用于防抖重复创建 */
    client_request_id?: string;
}

/** 后端 POST /api/groups/ 返回的 data */
interface CreateGroupResponseData {
    conversation_id: number;
    group_name: string;
    avatar?: string;
}

/** 后端 GET /api/groups/:id/ 的 data */
interface BackendGroupDetailData {
    group_name: string;
    avatar?: string;
    members: Array<{ user_id: number; username: string; role: string }>;
    announcements: Array<{
        author_username: string;
        content: string;
        created_at: string;
    }>;
}

/** 从会话列表推导群列表（后端未提供 GET /api/groups/） */
export const getGroupList = async () => {
    const rooms = await getChatRooms();
    return rooms
        .filter((r) => r.is_group)
        .map(
            (r): GroupSummaryData => ({
                room_id: r.room_id,
                group_name: r.name,
                avatar: r.avatar || '',
                owner_id: null,
                member_count: 0,
                created_at: r.last_time && r.last_time.length > 0 ? r.last_time : new Date().toISOString(),
            }),
        );
};

export const createGroup = async (payload: CreateGroupPayload) => {
    const body: Record<string, unknown> = {
        group_name: payload.group_name,
        member_ids: payload.member_ids,
    };
    if (payload.client_request_id) {
        body.client_request_id = payload.client_request_id;
    }

    const response = await request.post<any, ApiResponse<CreateGroupResponseData>>('/api/groups/', body);

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '创建群聊失败');
    }

    const d = response.data;
    return {
        room_id: d.conversation_id,
        group_name: d.group_name,
        avatar: d.avatar ?? '',
        owner_id: null as number | null,
        member_count: 1 + (payload.member_ids?.length ?? 0),
        created_at: new Date().toISOString(),
    } satisfies GroupSummaryData;
};

/** 群主单独上传群头像（与 POST /api/groups/ 分离以降低建群延时） */
export const updateGroupAvatar = async (roomId: number, avatar: string) => {
    const response = await request.put<any, ApiResponse<{ conversation_id: number; avatar: string }>>(
        `/api/groups/${roomId}/avatar/`,
        { avatar },
    );

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '上传群头像失败');
    }

    return response.data;
};

export const getGroupDetail = async (roomId: number) => {
    const response = await request.get<any, ApiResponse<BackendGroupDetailData>>(`/api/groups/${roomId}/`);

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取群聊详情失败');
    }

    const raw = response.data;
    const ownerMember = raw.members.find((m) => m.role === 'owner');

    const mapped: GroupDetailData = {
        room_id: roomId,
        group_name: raw.group_name,
        avatar: raw.avatar ?? '',
        owner_id: ownerMember?.user_id ?? null,
        member_count: raw.members.length,
        created_at: raw.announcements[0]?.created_at ?? new Date().toISOString(),
        members: raw.members.map((m) => ({
            user_id: m.user_id,
            username: m.username,
            avatar: '',
            role: m.role as 'owner' | 'admin' | 'member',
        })),
        announcements: raw.announcements.map((a, index) => ({
            id: index + 1,
            content: a.content,
            created_at: a.created_at,
            author_id: 0,
            author_name: a.author_username,
        })),
    };

    return mapped;
};

/** 退出群聊（非群主） */
export const leaveGroup = async (groupId: number): Promise<void> => {
    const response = await request.delete<any, ApiResponse<null>>(`/api/groups/${groupId}/members/me/`);
    if (response.code !== 0) {
        throw new Error(response.info || '退群失败');
    }
};

/** 解散群聊（仅群主） */
export const dissolveGroup = async (groupId: number): Promise<void> => {
    const response = await request.delete<any, ApiResponse<null>>(`/api/groups/${groupId}/`);
    if (response.code !== 0) {
        throw new Error(response.info || '解散群聊失败');
    }
};

/** 发布群公告 */
export const publishAnnouncement = async (groupId: number, content: string): Promise<void> => {
    const response = await request.post<any, ApiResponse<null>>(
        `/api/groups/${groupId}/announcements/`,
        { content }
    );
    if (response.code !== 0) {
        throw new Error(response.info || '发布公告失败');
    }
};
