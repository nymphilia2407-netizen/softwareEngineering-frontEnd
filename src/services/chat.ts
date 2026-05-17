import request from '../utils/request';

import { assertApiSuccess, unwrapApiData, type ApiResponse } from './apiResponse';

export interface ChatRoomSummaryData {
    room_id: number;
    is_group: boolean;
    name: string;
    avatar: string;
    other_user_id?: number | null;
    last_message: string;
    last_time: string;
    unread_count: number;
    is_muted?: boolean;
    is_pinned?: boolean;
}

/** 与 HTTP 历史消息映射后的单条结构一致 */
export interface ChatMessageData {
    id: number;
    room_id?: number;
    sender_id: number;
    sender_username?: string;
    sender_avatar?: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

/** 后端 GET /api/conversations/ 单条 */
interface BackendConversationRow {
    conversation_id: number;
    type: 'group' | 'private';
    is_pinned?: boolean;
    is_muted?: boolean;
    unread_count: number;
    last_message: { content: string; timestamp: string } | null;
    name: string;
    avatar: string;
    /** 私聊时对方用户 id，供联系人列表打开已有会话 */
    other_user_id?: number;
}

/** 后端 GET /api/conversations/:id/messages/ 单条 */
interface BackendMessageRow {
    message_id: number;
    sender: { user_id: number; username: string; avatar?: string } | null;
    content: string;
    timestamp: string;
    reply_to?: unknown;
    reply_count?: number;
}

function mapConversationRow(row: BackendConversationRow): ChatRoomSummaryData {
    const last = row.last_message;
    const otherId = row.other_user_id;
    return {
        room_id: row.conversation_id,
        is_group: row.type === 'group',
        name: row.name,
        avatar: row.avatar || '',
        other_user_id:
            row.type === 'private' && typeof otherId === 'number' && Number.isFinite(otherId) ? otherId : null,
        last_message: last?.content ?? '',
        last_time: last?.timestamp ?? '',
        unread_count: row.unread_count,
        is_muted: row.is_muted === true,
        is_pinned: row.is_pinned === true,
    };
}

function mapMessageRow(convId: number, row: BackendMessageRow): ChatMessageData {
    const sender = row.sender;
    const rawAvatar = sender?.avatar?.trim();
    return {
        id: row.message_id,
        room_id: convId,
        sender_id: sender?.user_id ?? 0,
        sender_username: sender?.username,
        sender_avatar: rawAvatar && rawAvatar.length > 0 ? rawAvatar : undefined,
        content: row.content,
        created_at: row.timestamp,
        is_read: false,
    };
}

export const getChatRooms = async () => {
    const response = await request.get<unknown, ApiResponse<BackendConversationRow[]>>('/api/conversations/');
    const rows = unwrapApiData(response, '获取会话列表失败');
    return rows.map(mapConversationRow);
};

export const getChatMessages = async (roomId: number, limit = 50, offset = 0) => {
    const page = Math.floor(offset / limit) + 1;
    const pageSize = limit;
    const response = await request.get<
        unknown,
        ApiResponse<{ messages: BackendMessageRow[]; total_pages: number; current_page: number }>
    >(`/api/conversations/${roomId}/messages/`, { params: { page, page_size: pageSize } });

    const payload = unwrapApiData(response, '获取聊天记录失败');
    const { messages } = payload;
    return {
        room_id: roomId,
        count: messages.length,
        messages: messages.map((m) => mapMessageRow(roomId, m)),
    };
};

export const setConversationMuted = async (conversationId: number, isMuted: boolean) => {
    const response = await request.put<unknown, ApiResponse<unknown>>(
        `/api/conversations/${conversationId}/settings/`,
        { is_muted: isMuted },
    );
    assertApiSuccess(response, '设置免打扰失败');
};

export const setConversationPinned = async (conversationId: number, isPinned: boolean) => {
    const response = await request.put<unknown, ApiResponse<unknown>>(
        `/api/conversations/${conversationId}/settings/`,
        { is_pinned: isPinned },
    );
    assertApiSuccess(response, '设置置顶失败');
};

/**
 * 删除单条消息（软删除，仅对当前用户隐藏）
 * @param conversationId 会话ID
 * @param messageId 消息ID（必须是已落盘的正数ID）
 * @returns Promise<void>
 */
export const deleteMessage = async (conversationId: number, messageId: number): Promise<void> => {
    // 后端返回 204 No Content，没有响应体，所以直接用 request.delete 并忽略返回值
    await request.delete(`/api/conversations/${conversationId}/messages/${messageId}/`);
    // 如果 request 拦截器统一处理了非 2xx 状态码并抛出异常，这里不需要额外处理
    // 如果 request 未处理 204，上面调用成功即表示删除成功
};

/**
 * 清空当前用户在某会话中的所有消息（软删除，仅对操作者生效）
 * @param conversationId 会话ID
 */
export const clearConversationMessages = async (conversationId: number): Promise<void> => {
    await request.delete(`/api/conversations/${conversationId}/messages/`);
    // 后端返回 204 No Content，无需处理返回值
};

export interface UnreadMentionData {
    mention_id: number;
    message_id: number;
    conversation_id: number;
    from_user_id: number;
    from_username: string;
    content_preview: string;
    created_at: string;
}

export const getUnreadMentions = async (): Promise<UnreadMentionData[]> => {
    const response = await request.get<unknown, ApiResponse<UnreadMentionData[]>>(
        '/api/conversations/mentions/unread/',
    );
    return unwrapApiData(response, '获取未读@提醒失败');
};

export const markMentionRead = async (mentionId: number): Promise<void> => {
    await request.post(`/api/conversations/mentions/${mentionId}/read/`);
};