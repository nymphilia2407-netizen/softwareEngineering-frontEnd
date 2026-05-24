import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useSyncExternalStore,
    type Dispatch,
    type MutableRefObject,
    type ReactNode,
    type SetStateAction,
} from 'react';

import type { Message } from '../types/entity';

const EMPTY_MESSAGES: Message[] = [];

type MessageStoreContextValue = {
    setMessageStore: Dispatch<SetStateAction<Record<number, Message[]>>>;
    messageStoreRef: MutableRefObject<Record<number, Message[]>>;
    subscribe: (listener: () => void) => () => void;
};

const MessageStoreContext = createContext<MessageStoreContextValue | null>(null);

export function MessageStoreProvider({ children }: { children: ReactNode }) {
    const storeRef = useRef<Record<number, Message[]>>({});
    const listenersRef = useRef(new Set<() => void>());

    const subscribe = useCallback((listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    }, []);

    const setMessageStore = useCallback((updater: SetStateAction<Record<number, Message[]>>) => {
        storeRef.current = typeof updater === 'function' ? updater(storeRef.current) : updater;
        listenersRef.current.forEach((listener) => listener());
    }, []);

    const value = useMemo(
        () => ({
            setMessageStore,
            messageStoreRef: storeRef,
            subscribe,
        }),
        [setMessageStore, subscribe],
    );

    return <MessageStoreContext.Provider value={value}>{children}</MessageStoreContext.Provider>;
}

export function useMessageStoreActions() {
    const ctx = useContext(MessageStoreContext);
    if (!ctx) {
        throw new Error('useMessageStoreActions must be used within MessageStoreProvider');
    }
    return ctx;
}

/** 仅订阅指定会话的消息，其他会话更新不会触发重渲染 */
export function useConversationMessages(conversationId: number): Message[] {
    const { subscribe, messageStoreRef } = useMessageStoreActions();

    return useSyncExternalStore(
        subscribe,
        () => messageStoreRef.current[conversationId] ?? EMPTY_MESSAGES,
        () => messageStoreRef.current[conversationId] ?? EMPTY_MESSAGES,
    );
}
