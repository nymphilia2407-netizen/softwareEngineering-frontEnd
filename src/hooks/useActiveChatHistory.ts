import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { CHAT_HISTORY_PAGE_SIZE } from '../constants/string';
import { mapHistoryMessage } from '../mappers/chat';
import { getChatMessages } from '../services/chat';
import type { Message } from '../types/entity';

export function useActiveChatHistory(
    activeChatId: number,
    setMessageStore: Dispatch<SetStateAction<Record<number, Message[]>>>,
    targetTimestamp?: string,
    filterSenderId?: number,
    filterEndTime?: string,
) {
    useEffect(() => {
        if (!activeChatId) {
            return;
        }

        let cancelled = false;

        const loadMessages = async () => {
            try {
                const history = await getChatMessages(
                    activeChatId,
                    CHAT_HISTORY_PAGE_SIZE,
                    0,
                    targetTimestamp,
                    filterSenderId,
                    filterEndTime,
                    { includeAvatars: true },
                );

                if (cancelled) {
                    return;
                }

                const chronological = [...history.messages].sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                );

                setMessageStore((prev) => ({
                    ...prev,
                    [activeChatId]: chronological.map((m) => mapHistoryMessage(history.room_id, m)),
                }));
            } catch (error) {
                console.error('获取聊天记录失败:', error);
            }
        };

        void loadMessages();

        return () => {
            cancelled = true;
        };
    }, [activeChatId, setMessageStore, targetTimestamp, filterSenderId, filterEndTime]);
}
