import request from '../utils/request';

export interface ChatRoomSummaryData {
    room_id: number;
    is_group: boolean;
    name: string;
    avatar: string;
    other_user_id?: number | null;
    last_message: string;
    last_time: string;
    unread_count: number;
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

interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
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
}

/** 后端 GET /api/conversations/:id/messages 单条 */
interface BackendMessageRow {
    message_id: number;
    sender: { user_id: number; username: string } | null;
    content: string;
    timestamp: string;
    reply_to?: unknown;
    reply_count?: number;
}

function mapConversationRow(row: BackendConversationRow): ChatRoomSummaryData {
    const last = row.last_message;
    return {
        room_id: row.conversation_id,
        is_group: row.type === 'group',
        name: row.name,
        avatar: row.avatar || '',
        other_user_id: null,
        last_message: last?.content ?? '',
        last_time: last?.timestamp ?? '',
        unread_count: row.unread_count,
    };
}

function mapMessageRow(convId: number, row: BackendMessageRow): ChatMessageData {
    const sender = row.sender;
    return {
        id: row.message_id,
        room_id: convId,
        sender_id: sender?.user_id ?? 0,
        sender_username: sender?.username,
        sender_avatar: undefined,
        content: row.content,
        created_at: row.timestamp,
        is_read: false,
    };
}

export const getChatRooms = async () => {
    const response = await request.get<any, ApiResponse<BackendConversationRow[]>>('/api/conversations/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取会话列表失败');
    }

    return response.data.map(mapConversationRow);
};

export const getChatMessages = async (roomId: number, limit = 50, offset = 0) => {
    const page = Math.floor(offset / limit) + 1;
    const pageSize = limit;
    const response = await request.get<any, ApiResponse<{ messages: BackendMessageRow[]; total_pages: number; current_page: number }>>(
        `/api/conversations/${roomId}/messages`,
        { params: { page, page_size: pageSize } },
    );

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取聊天记录失败');
    }

    const { messages } = response.data;
    return {
        room_id: roomId,
        count: messages.length,
        messages: messages.map((m) => mapMessageRow(roomId, m)),
    };
};
