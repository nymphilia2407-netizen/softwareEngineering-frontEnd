import type { ChatIncomingMessage, ChatReadReceiptData } from '../services/websocket';
import type { Message } from '../types/entity';
import { getCachedAvatar, setCachedAvatar, resolvedUserAvatar } from './avatar';

/** 与 ChatWindow.isOtherMemberMessage 一致：避免 senderId / currentUserId 类型不一致或短暂为 0 时误判己方消息 */
export const sameUserId = (a: number, b: number) => Number(a) === Number(b);

const sortMessagesByTime = (messages: Message[]) => [...messages].sort((left, right) => left.timestamp - right.timestamp);

/** 新消息时间单调递增时 O(1) 追加，否则才全量排序 */
const appendMessageSorted = (messages: Message[], incoming: Message): Message[] => {
    if (messages.length === 0) {
        return [incoming];
    }
    const last = messages[messages.length - 1];
    if (incoming.timestamp >= last.timestamp) {
        return [...messages, incoming];
    }
    return sortMessagesByTime([...messages, incoming]);
};

export const formatIncomingMessage = (message: ChatIncomingMessage): Message => {
    const timestamp = new Date(message.created_at).getTime();
    if (message.sender_avatar) {
        setCachedAvatar(message.sender_id, message.sender_avatar);
    }
    const senderAvatar = resolvedUserAvatar(
        getCachedAvatar(message.sender_id) ?? message.sender_avatar,
    );

    return {
        id: message.id,
        convId: message.conversation_id,
        senderId: message.sender_id,
        senderUsername: message.sender_username,
        senderAvatar,
        type: 'text',
        status: 'sent',
        content: message.content,
        timestamp,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        clientId: message.client_id,
        mentionedUserIds: message.mentioned_users,
        replyTo: message.reply_to ?? undefined,
        replyCount: message.reply_to?.replyCount ?? 0,
    };
};

export const replaceOrAppendIncomingMessage = (
    store: Record<number, Message[]>,
    incomingMessage: Message,
    currentUserId: number
) => {
    const conversationId = incomingMessage.convId;
    const roomMessages = store[conversationId] ? [...store[conversationId]] : [];

    if (incomingMessage.clientId) {
        const matchedIndex = roomMessages.findIndex((message) => message.clientId === incomingMessage.clientId);

        if (matchedIndex !== -1) {
            const updated = [...roomMessages];
            updated[matchedIndex] = { ...incomingMessage, status: 'sent' };
            return {
                nextStore: {
                    ...store,
                    [conversationId]: updated,
                },
                consumedClientId: incomingMessage.clientId,
            };
        }
    }

    if (roomMessages.some((message) => message.id === incomingMessage.id)) {
        return { nextStore: store };
    }

    return {
        nextStore: {
            ...store,
            [conversationId]: appendMessageSorted(roomMessages, incomingMessage),
        },
        fromSelf: sameUserId(incomingMessage.senderId, currentUserId),
    };
};

export const applyReadReceiptToMessages = (
    store: Record<number, Message[]>,
    receipt: ChatReadReceiptData,
    currentUserId: number
) => {
    const roomMessages = store[receipt.conversation_id];
    if (!roomMessages || roomMessages.length === 0) {
        return store;
    }

    let changed = false;
    const updatedMessages = roomMessages.map((message) => {
        if (message.id > receipt.last_message_id) {
            return message;
        }

        if (sameUserId(receipt.reader_id, currentUserId)) {
            if (sameUserId(message.senderId, currentUserId) || message.isRead) {
                return message;
            }
            changed = true;
            return { ...message, isRead: true };
        }

        if (sameUserId(message.senderId, currentUserId) && !message.isRead) {
            changed = true;
            return { ...message, isRead: true };
        }

        return message;
    });

    if (!changed) {
        return store;
    }

    return {
        ...store,
        [receipt.conversation_id]: updatedMessages,
    };
};

export const markMessageFailedInStore = (
    store: Record<number, Message[]>,
    conversationId: number,
    clientId: string
) => ({
    ...store,
    [conversationId]: (store[conversationId] ?? []).map((message) =>
        message.clientId === clientId && message.status === 'sending' ? { ...message, status: 'failed' as const } : message
    ),
});

export const appendOptimisticMessage = (
    store: Record<number, Message[]>,
    conversationId: number,
    message: Message
) => ({
    ...store,
    [conversationId]: appendMessageSorted(store[conversationId] ?? [], message),
});

/** 时间处理：当天仅显示时间，非当天显示月日，非当年加上年份 */
export const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    if (isSameDay) {
        return time;
    }
    const datePart = `${date.getMonth() + 1}月${date.getDate()}日`;
    if (date.getFullYear() === now.getFullYear()) {
        return `${datePart} ${time}`;
    }
    return `${date.getFullYear()}年${datePart} ${time}`;
};
