import { DEFAULT_AVATAR } from '../constants/string';
import type { ChatListItem } from '../types/chat';
import type { Message } from '../types/entity';
import { sameUserId } from './messageStore';

/** 置顶在前，其余按最后消息时间降序（与左侧会话列表展示一致） */
export const sortChatRoomsForDisplay = (rooms: ChatListItem[]): ChatListItem[] =>
    [...rooms].sort((a, b) => {
        const ap = a.isPinned === true ? 1 : 0;
        const bp = b.isPinned === true ? 1 : 0;
        if (ap !== bp) {
            return bp - ap;
        }
        return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
    });

export const updateRoomOnIncomingMessage = (
    rooms: ChatListItem[],
    incomingMessage: Message,
    currentUserId: number,
    activeChatId: number
) => {
    const formattedTime = new Date(incomingMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fromSelf = sameUserId(incomingMessage.senderId, currentUserId);
    const isActive = activeChatId === incomingMessage.convId;
    const index = rooms.findIndex((room) => room.id === incomingMessage.convId);

    if (index !== -1) {
        const room = { ...rooms[index] };
        room.lastMessage = incomingMessage.content;
        room.lastTime = formattedTime;

        const muted = room.isMuted === true;
        if (!fromSelf && !isActive && !muted) {
            room.unreadCount = (room.unreadCount || 0) + 1;
        }

        const remainingRooms = [...rooms.slice(0, index), ...rooms.slice(index + 1)];
        return sortChatRoomsForDisplay([room, ...remainingRooms]);
    }

    return sortChatRoomsForDisplay([
        {
            id: incomingMessage.convId,
            name: '[新会话]',
            avatar: DEFAULT_AVATAR,
            lastMessage: incomingMessage.content,
            lastTime: formattedTime,
            unreadCount: fromSelf || isActive ? 0 : 1,
            otherUserId: null,
            isGroup: false,
            isMuted: false,
            isPinned: false,
        },
        ...rooms,
    ]);
};

export const clearUnreadRoom = (rooms: ChatListItem[], conversationId: number) =>
    rooms.map((room) => (room.id === conversationId ? { ...room, unreadCount: 0 } : room));

/**
 * 用服务端会话列表覆盖本地时，保留前端已乐观清零的未读与 @ 状态，
 * 避免 read_message 尚未落库时 getChatRooms 把角标刷回非 0。新消息仍由 WS 递增未读。
 */
export const mergeChatRoomsFromServer = (prev: ChatListItem[], mappedRooms: ChatListItem[]): ChatListItem[] => {
    const prevMap = new Map(prev.map((r) => [r.id, r]));
    return sortChatRoomsForDisplay(
        mappedRooms.map((mapped) => {
            const existing = prevMap.get(mapped.id);
            if (existing?.hasUnreadMention) {
                mapped.hasUnreadMention = true;
            }
            if (existing && (existing.unreadCount ?? 0) === 0) {
                mapped.unreadCount = 0;
            }
            return mapped;
        }),
    );
};
