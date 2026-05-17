import type { ChatIncomingMessage, ChatReadReceiptData } from '../services/websocket';
import type { Message } from '../types/entity';

/** 与 ChatWindow.isOtherMemberMessage 一致：避免 senderId / currentUserId 类型不一致或短暂为 0 时误判己方消息 */
export const sameUserId = (a: number, b: number) => Number(a) === Number(b);

const sortMessagesByTime = (messages: Message[]) => [...messages].sort((left, right) => left.timestamp - right.timestamp);

export const formatIncomingMessage = (message: ChatIncomingMessage): Message => {
    const timestamp = new Date(message.created_at).getTime();

    return {
        id: message.id,
        convId: message.conversation_id,
        senderId: message.sender_id,
        senderUsername: message.sender_username,
        senderAvatar: message.sender_avatar,
        type: 'text',
        status: 'sent',
        content: message.content,
        timestamp,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        clientId: message.client_id,
        mentionedUserIds: message.mentioned_users,
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
            roomMessages[matchedIndex] = { ...incomingMessage, status: 'sent' };
            return {
                nextStore: {
                    ...store,
                    [conversationId]: sortMessagesByTime(roomMessages),
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
            [conversationId]: sortMessagesByTime([...roomMessages, incomingMessage]),
        },
        fromSelf: sameUserId(incomingMessage.senderId, currentUserId),
    };
};

export const applyReadReceiptToMessages = (
    store: Record<number, Message[]>,
    receipt: ChatReadReceiptData,
    currentUserId: number
) => {
    const roomMessages = store[receipt.conversation_id] ? [...store[receipt.conversation_id]] : [];

    if (roomMessages.length === 0) {
        return store;
    }

    const updatedMessages = roomMessages.map((message) => {
        if (message.id > receipt.last_message_id) {
            return message;
        }

        if (sameUserId(receipt.reader_id, currentUserId)) {
            return sameUserId(message.senderId, currentUserId) ? message : { ...message, isRead: true };
        }

        return sameUserId(message.senderId, currentUserId) ? { ...message, isRead: true } : message;
    });

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
    [conversationId]: sortMessagesByTime(
        (store[conversationId] ?? []).map((message) =>
            message.clientId === clientId && message.status === 'sending' ? { ...message, status: 'failed' } : message
        )
    ),
});

export const appendOptimisticMessage = (
    store: Record<number, Message[]>,
    conversationId: number,
    message: Message
) => ({
    ...store,
    [conversationId]: sortMessagesByTime([...(store[conversationId] ?? []), message]),
});
