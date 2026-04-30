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

export interface ChatMessageData {
    id: number;
    room_id: number;
    sender_id: number;
    content: string;
    created_at: string;
    is_read: boolean;
}

interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
}

export const getChatRooms = async () => {
    const response = await request.get<any, ApiResponse<ChatRoomSummaryData[]>>('/api/chat/rooms/');

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取会话列表失败');
    }

    return response.data;
};

export const getChatMessages = async (roomId: number, limit = 50, offset = 0) => {
    const response = await request.get<any, ApiResponse<{ room_id: number; count: number; messages: ChatMessageData[] }>>(
        `/api/chat/messages/${roomId}/`,
        { params: { limit, offset } }
    );

    if (response.code !== 0 || !response.data) {
        throw new Error(response.info || '获取聊天记录失败');
    }

    return response.data;
};