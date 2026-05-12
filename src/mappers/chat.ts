import type { ChatMessageData, ChatRoomSummaryData } from '../services/chat';
import type { FriendSummaryData } from '../services/friend';
import type { GroupSummaryData } from '../services/group';
import type { ChatListItem } from '../types/chat';
import type { Group, Message, User } from '../types/entity';
import { resolvedUserAvatar } from '../utils/avatar';

export const mapFriendSummary = (friend: FriendSummaryData): User => ({
    id: friend.user_id,
    username: friend.username,
    avatar: resolvedUserAvatar(friend.avatar),
    status: friend.status ?? 'online',
    registerTime: Date.now(),
    lastLoginTime: Date.now(),
    tag: friend.tag,
});

export const mapHistoryMessage = (roomId: number, message: ChatMessageData): Message => {
    const timestamp = new Date(message.created_at).getTime();

    return {
        id: message.id,
        convId: message.room_id ?? roomId,
        senderId: message.sender_id,
        senderUsername: message.sender_username,
        senderAvatar: message.sender_avatar,
        type: 'text',
        status: 'sent',
        content: message.content,
        timestamp,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: message.is_read,
    };
};

export const mapChatRoom = (room: ChatRoomSummaryData): ChatListItem => ({
    id: room.room_id,
    name: room.name,
    avatar: resolvedUserAvatar(room.avatar),
    lastMessage: room.last_message || '[最近暂无消息]',
    lastTime: room.last_time ? new Date(room.last_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '刚刚',
    unreadCount: room.unread_count,
    otherUserId: room.other_user_id ?? null,
    status: undefined,
    isGroup: room.is_group,
    isMuted: room.is_muted === true,
    isPinned: room.is_pinned === true,
});

export const mapGroupSummary = (group: GroupSummaryData): Group => ({
    id: group.room_id,
    groupname: group.group_name,
    avatar: resolvedUserAvatar(group.avatar),
    ownerId: group.owner_id ?? 0,
    adminIds: [],
    memberCount: group.member_count,
    createdTime: new Date(group.created_at).getTime(),
});

export const groupSummariesFromRoomList = (roomList: ChatRoomSummaryData[]): Group[] =>
    roomList
        .filter((r) => r.is_group)
        .map((r) =>
            mapGroupSummary({
                room_id: r.room_id,
                group_name: r.name,
                avatar: r.avatar || '',
                owner_id: null,
                member_count: 0,
                created_at: r.last_time && r.last_time.length > 0 ? r.last_time : new Date().toISOString(),
            }),
        );
