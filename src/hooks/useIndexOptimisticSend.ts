import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';

import { SEND_ACK_GRACE_MS, SEND_ACK_TIMEOUT_MS } from '../constants/string';
import type { ChatListItem } from '../types/chat';
import type { ChatWebSocketClient } from '../services/websocket';
import type { Message } from '../types/entity';
import { updateRoomOnIncomingMessage } from '../utils/chatRoomList';
import { appendOptimisticMessage, markMessageFailedInStore } from '../utils/messageStore';

export type IndexOptimisticRefs = {
    socketRef: RefObject<ChatWebSocketClient | null>;
    pendingSendTimers: MutableRefObject<Record<string, ReturnType<typeof setTimeout> | null>>;
    messageStoreRef: MutableRefObject<Record<number, Message[]>>;
    currentUserIdRef: MutableRefObject<number>;
    userNameRef: MutableRefObject<string>;
    myAvatarRef: MutableRefObject<string>;
    optimisticIdSeqRef: MutableRefObject<number>;
};

export function useIndexOptimisticSend(
    activeChatId: number,
    r: IndexOptimisticRefs,
    activeChatIdRef: MutableRefObject<number>,
    setMessageStore: Dispatch<SetStateAction<Record<number, Message[]>>>,
    setChatRooms: Dispatch<SetStateAction<ChatListItem[]>>,
) {
    const clearPendingSendTimer = useCallback(
        (clientId: string) => {
            const timer = r.pendingSendTimers.current[clientId];
            if (timer) {
                clearTimeout(timer);
            }
            delete r.pendingSendTimers.current[clientId];
        },
        [r.pendingSendTimers],
    );

    const scheduleSendFailureCheck = useCallback(
        (conversationId: number, clientId: string) => {
            const timer = setTimeout(() => {
                const roomMessages = r.messageStoreRef.current[conversationId] ?? [];
                const stillSending = roomMessages.some(
                    (message) => message.clientId === clientId && message.status === 'sending',
                );

                if (!stillSending) {
                    clearPendingSendTimer(clientId);
                    return;
                }

                const graceTimer = setTimeout(() => {
                    setMessageStore((prev) => markMessageFailedInStore(prev, conversationId, clientId));
                    clearPendingSendTimer(clientId);
                }, SEND_ACK_GRACE_MS);

                r.pendingSendTimers.current[clientId] = graceTimer;
            }, SEND_ACK_TIMEOUT_MS);

            r.pendingSendTimers.current[clientId] = timer;
        },
        [clearPendingSendTimer, r.messageStoreRef, r.pendingSendTimers, setMessageStore],
    );

    const sendMessageDirect = useCallback(
        (convId: number, content: string, mentionedUserIds?: number[], replyToId?: number) => {
            if (!convId || !content.trim()) {
                return;
            }

            const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            r.optimisticIdSeqRef.current += 1;
            const tempId = -r.optimisticIdSeqRef.current;
            const timestamp = Date.now();

            const optimisticMsg: Message = {
                id: tempId,
                convId,
                senderId: r.currentUserIdRef.current,
                senderUsername: r.userNameRef.current,
                senderAvatar: r.myAvatarRef.current,
                type: 'text',
                status: 'sending',
                content,
                timestamp,
                time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isRead: false,
                clientId,
                mentionedUserIds,
                replyTo: replyToId
                    ? (() => {
                          const msgs = r.messageStoreRef.current[convId] ?? [];
                          const target = msgs.find((m) => m.id === replyToId);
                          return target
                              ? {
                                    messageId: target.id,
                                    senderUsername: target.senderUsername || '',
                                    content: target.content,
                                }
                              : undefined;
                      })()
                    : undefined,
            };

            setMessageStore((prev) => appendOptimisticMessage(prev, convId, optimisticMsg));
            scheduleSendFailureCheck(convId, clientId);

            const socket = r.socketRef.current;
            if (!socket) {
                clearPendingSendTimer(clientId);
                setMessageStore((prev) => markMessageFailedInStore(prev, convId, clientId));
                return;
            }

            socket.send({
                type: 'send_message',
                data: {
                    conversation_id: convId,
                    content,
                    client_id: clientId,
                    mentioned_user_ids: mentionedUserIds,
                    reply_to_id: replyToId,
                },
            });
        },
        [
            clearPendingSendTimer,
            r.currentUserIdRef,
            r.myAvatarRef,
            r.optimisticIdSeqRef,
            r.socketRef,
            r.userNameRef,
            scheduleSendFailureCheck,
            setMessageStore,
        ],
    );

    const handleSendMessage = useCallback(
        (content: string, mentionedUserIds?: number[], replyToId?: number) => {
            if (!activeChatId || !content.trim()) {
                return;
            }

            const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            r.optimisticIdSeqRef.current += 1;
            const tempId = -r.optimisticIdSeqRef.current;
            const timestamp = Date.now();

            const optimisticMsg: Message = {
                id: tempId,
                convId: activeChatId,
                senderId: r.currentUserIdRef.current,
                senderUsername: r.userNameRef.current,
                senderAvatar: r.myAvatarRef.current,
                type: 'text',
                status: 'sending',
                content,
                timestamp,
                time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isRead: false,
                clientId,
                mentionedUserIds,
                replyTo: replyToId
                    ? (() => {
                          const msgs = r.messageStoreRef.current[activeChatId] ?? [];
                          const target = msgs.find((m) => m.id === replyToId);
                          return target
                              ? {
                                    messageId: target.id,
                                    senderUsername: target.senderUsername || '',
                                    content: target.content,
                                }
                              : undefined;
                      })()
                    : undefined,
            };

            setMessageStore((prev) => appendOptimisticMessage(prev, activeChatId, optimisticMsg));
            setChatRooms((prev) =>
                updateRoomOnIncomingMessage(prev, optimisticMsg, r.currentUserIdRef.current, activeChatIdRef.current),
            );
            scheduleSendFailureCheck(activeChatId, clientId);

            const socket = r.socketRef.current;
            if (!socket) {
                clearPendingSendTimer(clientId);
                setMessageStore((prev) => markMessageFailedInStore(prev, activeChatId, clientId));
                return;
            }

            socket.send({
                type: 'send_message',
                data: {
                    conversation_id: activeChatId,
                    content,
                    client_id: clientId,
                    mentioned_user_ids: mentionedUserIds,
                    reply_to_id: replyToId,
                },
            });
        },
        [
            activeChatId,
            activeChatIdRef,
            clearPendingSendTimer,
            r.currentUserIdRef,
            r.myAvatarRef,
            r.optimisticIdSeqRef,
            r.socketRef,
            r.userNameRef,
            scheduleSendFailureCheck,
            setChatRooms,
            setMessageStore,
        ],
    );

    const handleRetryMessage = useCallback(
        (clientId: string) => {
            const store = r.messageStoreRef.current;
            for (const convKey of Object.keys(store)) {
                const convId = Number(convKey);
                const msgs = store[convId] || [];
                const orig = msgs.find((m) => m.clientId === clientId);
                if (orig) {
                    setMessageStore((prev) => ({
                        ...prev,
                        [convId]: prev[convId].filter((m) => m.clientId !== clientId),
                    }));
                    sendMessageDirect(convId, orig.content, orig.mentionedUserIds, orig.replyTo?.messageId);
                    return;
                }
            }
        },
        [r.messageStoreRef, sendMessageDirect, setMessageStore],
    );

    return { handleSendMessage, handleRetryMessage };
}
