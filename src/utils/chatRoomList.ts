import { DEFAULT_AVATAR } from '../constants/string';
import type { ChatListItem } from '../types/chat';
import type { Message } from '../types/entity';
import { sameUserId } from './messageStore';

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
        return [room, ...remainingRooms];
    }

    return [
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
        },
        ...rooms,
    ];
};

export const clearUnreadRoom = (rooms: ChatListItem[], conversationId: number) =>
    rooms.map((room) => (room.id === conversationId ? { ...room, unreadCount: 0 } : room));
