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
    /** 可选：群头像 data URL 或外链（后端当前创建接口未持久化头像，仅用于前端展示兜底） */
    avatar?: string;
}

/** 后端 POST /api/groups/ 返回的 data */
interface CreateGroupResponseData {
    conversation_id: number;
    group_name: string;
}

/** 后端 GET /api/groups/:id 的 data */
interface BackendGroupDetailData {
    group_name: string;
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
    const response = await request.post<any, ApiResponse<CreateGroupResponseData>>('/api/groups/', payload);

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '创建群聊失败');
    }

    const d = response.data;
    return {
        room_id: d.conversation_id,
        group_name: d.group_name,
        avatar: payload.avatar || '',
        owner_id: null as number | null,
        member_count: 1 + (payload.member_ids?.length ?? 0),
        created_at: new Date().toISOString(),
    } satisfies GroupSummaryData;
};

export const getGroupDetail = async (roomId: number) => {
    const response = await request.get<any, ApiResponse<BackendGroupDetailData>>(`/api/groups/${roomId}`);

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取群聊详情失败');
    }

    const raw = response.data;
    const ownerMember = raw.members.find((m) => m.role === 'owner');

    const mapped: GroupDetailData = {
        room_id: roomId,
        group_name: raw.group_name,
        avatar: '',
        owner_id: ownerMember?.user_id ?? null,
        member_count: raw.members.length,
        created_at: raw.announcements[0]?.created_at ?? new Date().toISOString(),
        members: raw.members.map((m) => ({
            user_id: m.user_id,
            username: m.username,
            avatar: '',
            is_owner: m.role === 'owner',
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
