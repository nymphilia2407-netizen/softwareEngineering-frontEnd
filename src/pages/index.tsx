import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChatList from '../components/chatList';
import ConfigNav from '../components/configNav';
import ChatSessionDetail from '../components/chatSessionDetail';
import ChatWindow from '../components/chatWindow';
import ContactList from '../components/contactList';
import ContactSessionDetail from '../components/contactSessionDetail';

import { BACKENDURL, CHATICON, CONFIGICON, CONTACTICON, DEFAULT_AVATAR } from '../constants/string';
import { getChatMessages, getChatRooms, type ChatMessageData, type ChatRoomSummaryData } from '../services/chat';
import { createGroup, getGroupList, updateGroupAvatar, type GroupSummaryData } from '../services/group';
import { getFriendList, getReceivedFriendRequests, type FriendSummaryData } from '../services/friend';
import { getCurrentUser, deleteUser } from '../services/user';
import { createChatWebSocketClient, type ChatIncomingMessage, type ChatReadReceiptData, type ChatSocketEvent, type ChatWebSocketClient } from '../services/websocket';
import { persistUserProfile, tokenUtils } from '../utils/auth';
import { resolvedUserAvatar } from '../utils/avatarDisplay';
import type { Group, Message, User } from '../types/entity';
import type { ActiveTabType } from '../types/ui';

import '../styles/index.css';

interface ChatListItem {
    id: number;
    name: string;
    avatar: string;
    lastMessage: string;
    lastTime: string;
    unreadCount: number;
    status?: 'online' | 'offline' | 'busy';
    otherUserId?: number | null;
    isGroup: boolean;
}

/** 与 ChatWindow.isOtherMemberMessage 一致：避免 senderId / currentUserId 类型不一致或短暂为 0 时误判己方消息 */
const sameUserId = (a: number, b: number) => Number(a) === Number(b);

const decodeTokenPayload = () => {
    const token = tokenUtils.getToken();
    if (!token) {
        return null;
    }

    const payload = token.split('.')[1];
    if (!payload) {
        return null;
    }

    try {
        const normalizedPayload = payload.replaceAll('-', '+').replaceAll('_', '/');
        const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
        const parsed = JSON.parse(atob(paddedPayload)) as {
            data?: { user_id?: number; username?: string };
            user_id?: number;
            username?: string;
        };
        // 后端 generate_jwt_token 把业务字段放在 payload.data 里
        const inner = parsed.data ?? parsed;
        return { user_id: inner.user_id, username: inner.username };
    } catch {
        return null;
    }
};

const formatIncomingMessage = (message: ChatIncomingMessage): Message => {
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
    };
};

const sortMessagesByTime = (messages: Message[]) => [...messages].sort((left, right) => left.timestamp - right.timestamp);

const replaceOrAppendIncomingMessage = (
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

const applyReadReceiptToMessages = (
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

const markMessageFailedInStore = (
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

const appendOptimisticMessage = (
    store: Record<number, Message[]>,
    conversationId: number,
    message: Message
) => ({
    ...store,
    [conversationId]: sortMessagesByTime([...(store[conversationId] ?? []), message]),
});

const updateRoomOnIncomingMessage = (
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

        if (!fromSelf && !isActive) {
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
        },
        ...rooms,
    ];
};

const clearUnreadRoom = (rooms: ChatListItem[], conversationId: number) =>
    rooms.map((room) => (room.id === conversationId ? { ...room, unreadCount: 0 } : room));

const mapFriendSummary = (friend: FriendSummaryData): User => ({
    id: friend.user_id,
    username: friend.username,
    avatar: resolvedUserAvatar(friend.avatar),
    status: friend.status ?? 'online',
    registerTime: Date.now(),
    lastLoginTime: Date.now(),
    tag: friend.tag,
});

const mapHistoryMessage = (roomId: number, message: ChatMessageData): Message => {
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

const mapChatRoom = (room: ChatRoomSummaryData): ChatListItem => ({
    id: room.room_id,
    name: room.name,
    avatar: resolvedUserAvatar(room.avatar),
    lastMessage: room.last_message || '[最近暂无消息]',
    lastTime: room.last_time ? new Date(room.last_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '刚刚',
    unreadCount: room.unread_count,
    otherUserId: room.other_user_id ?? null,
    status: undefined,
    isGroup: room.is_group,
});

const mapGroupSummary = (group: GroupSummaryData): Group => ({
    id: group.room_id,
    groupname: group.group_name,
    avatar: resolvedUserAvatar(group.avatar),
    ownerId: group.owner_id ?? 0,
    adminIds: [],
    memberCount: group.member_count,
    createdTime: new Date(group.created_at).getTime(),
});

const groupSummariesFromRoomList = (roomList: ChatRoomSummaryData[]): Group[] =>
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

/** 收不到 WS 回执时的等待上限；过长易被当成卡死，过短易误判弱网失败 */
const SEND_ACK_TIMEOUT_MS = 8000;
const SEND_ACK_GRACE_MS = 2000;

export default function Index() {
    const tokenPayload = decodeTokenPayload();
    const [currentUserId, setCurrentUserId] = useState<number>(tokenPayload?.user_id ?? 0);
    const [userName, setUserName] = useState<string>(tokenPayload?.username ?? '');
    const [myAvatar, setMyAvatar] = useState<string>(() => {
        const storedProfile = localStorage.getItem('user_profile');
        if (!storedProfile) {
            return DEFAULT_AVATAR;
        }

        try {
            const parsed = JSON.parse(storedProfile) as { avatar?: string };
            return parsed.avatar ?? DEFAULT_AVATAR;
        } catch {
            return DEFAULT_AVATAR;
        }
    });
    const [activeTab, setActiveTab] = useState<ActiveTabType>('chat');
    const [settingsPanel, setSettingsPanel] = useState<'menu' | 'profile'>('menu');
    const [activeChatId, setActiveChatId] = useState<number>(0);
    const [selectedContact, setSelectedContact] = useState<User | null>(null);
    const [friends, setFriends] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [chatRooms, setChatRooms] = useState<ChatListItem[]>([]);
    const [messageStore, setMessageStore] = useState<Record<number, Message[]>>({});
    const [chatSessionInfoOpen, setChatSessionInfoOpen] = useState<boolean>(false);
    const [profileBirthday, setProfileBirthday] = useState<string>('');
    const [profileAddress, setProfileAddress] = useState<string>('');
    const [profileSignature, setProfileSignature] = useState<string>('');
    const [entryUnreadHintCount, setEntryUnreadHintCount] = useState<number>(0);
    const [groupSyncToast, setGroupSyncToast] = useState<string | null>(null);
    const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0);

    const socketRef = useRef<ChatWebSocketClient | null>(null);
    const currentUserIdRef = useRef<number>(currentUserId);
    const activeChatIdRef = useRef<number>(activeChatId);
    const userNameRef = useRef<string>(userName);
    const myAvatarRef = useRef<string>(myAvatar);
    const pendingSendTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
    const messageStoreRef = useRef<Record<number, Message[]>>(messageStore);
    /** 乐观消息的临时负数 id，保证同毫秒内多次发送也不与 React key 冲突 */
    const optimisticIdSeqRef = useRef(0);
    /** 已在 WS 上 subscribe_room 的会话；新建私聊在连接之后才出现，必须补订阅才能收到发消息回执 */
    const subscribedWsRoomsRef = useRef<Set<number>>(new Set());
    // 用于展示联系人具体信息
    const [contactDetailUserId, setContactDetailUserId] = useState<number | null>(null);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    useEffect(() => {
        if (!activeChatId) {
            setChatSessionInfoOpen(false);
        }
    }, [activeChatId]);

    useEffect(() => {
        userNameRef.current = userName;
    }, [userName]);

    useEffect(() => {
        myAvatarRef.current = myAvatar;
    }, [myAvatar]);

    useEffect(() => {
        messageStoreRef.current = messageStore;
    }, [messageStore]);

    const activeChatIsGroup = useMemo(
        () => chatRooms.find((room) => room.id === activeChatId)?.isGroup ?? false,
        [chatRooms, activeChatId]
    );

    const refreshFriendsAndRooms = useCallback(async () => {
        try {
            const [friendList, roomList] = await Promise.all([getFriendList(), getChatRooms()]);
            setFriends(friendList.map(mapFriendSummary));
            setChatRooms(roomList.map(mapChatRoom));
        } catch (error) {
            console.error('刷新好友或会话失败:', error);
        }
    }, []);

    const syncChatRoomsAndGroups = useCallback(async () => {
        try {
            const roomList = await getChatRooms();
            setChatRooms(roomList.map(mapChatRoom));
            setGroups(groupSummariesFromRoomList(roomList));
        } catch (error) {
            console.error('同步群会话列表失败:', error);
        }
    }, []);

    const subscribeWsRoom = useCallback((conversationId: number) => {
        if (!conversationId) {
            return;
        }

        socketRef.current?.send({
            type: 'subscribe_room',
            data: { conversation_id: conversationId },
        });
    }, []);

    useEffect(() => {
        for (const room of chatRooms) {
            if (!room.id || subscribedWsRoomsRef.current.has(room.id)) {
                continue;
            }
            subscribedWsRoomsRef.current.add(room.id);
            subscribeWsRoom(room.id);
        }
    }, [chatRooms, subscribeWsRoom]);

    useEffect(() => {
        if (!groupSyncToast) {
            return;
        }

        const timer = globalThis.setTimeout(() => setGroupSyncToast(null), 4800);
        return () => globalThis.clearTimeout(timer);
    }, [groupSyncToast]);

    /** 对方同意好友请求后发起方无推送：切到联系人或回到前台时同步列表 */
    useEffect(() => {
        if (activeTab !== 'contacts') {
            return;
        }

        void refreshFriendsAndRooms();
    }, [activeTab, refreshFriendsAndRooms]);

    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            debounceTimer = setTimeout(() => {
                void refreshFriendsAndRooms();
                debounceTimer = null;
            }, 400);
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [refreshFriendsAndRooms]);

    const syncGroupList = async () => {
        try {
            const groupList = await getGroupList();
            setGroups(groupList.map(mapGroupSummary));
        } catch (error) {
            console.error('获取群聊列表失败:', error);
            setGroups([]);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const syncCurrentUser = async () => {
            try {
                const currentUser = await getCurrentUser();

                if (cancelled) {
                    return;
                }

                setCurrentUserId(currentUser.user_id);
                setUserName(currentUser.username);
                const resolvedAvatar = currentUser.avatar && currentUser.avatar.length > 0 ? currentUser.avatar : DEFAULT_AVATAR;
                setMyAvatar(resolvedAvatar);
                setProfileBirthday(currentUser.birthday);
                setProfileAddress(currentUser.address);
                setProfileSignature(currentUser.signature);
                persistUserProfile(currentUser.username, resolvedAvatar);
            } catch (error) {
                console.error('获取当前用户失败:', error);
            }
        };

        const syncFriendList = async () => {
            try {
                const friendList = await getFriendList();

                if (cancelled) {
                    return;
                }

                setFriends(friendList.map(mapFriendSummary));
            } catch (error) {
                console.error('获取好友列表失败:', error);
                setFriends([]);
            }
        };

        getReceivedFriendRequests().then(requests => {
            if (!cancelled) setPendingFriendRequestCount(requests.length);
        }).catch(() => {});

        const syncChatRooms = async () => {
            try {
                const roomList = await getChatRooms();

                if (cancelled) {
                    return;
                }

                const mappedRooms = roomList.map(mapChatRoom);
                setChatRooms(mappedRooms);
                setActiveChatId((currentActiveChatId) => currentActiveChatId || mappedRooms[0]?.id || 0);
            } catch (error) {
                console.error('获取会话列表失败:', error);
                setChatRooms([]);
            }
        };

        const token = tokenUtils.getToken();

        // 先同步当前用户/列表数据
        void syncCurrentUser();
        void syncFriendList();
        void syncChatRooms();
        void syncGroupList();

        if (token) {
            const client = createChatWebSocketClient({
                backendUrl: BACKENDURL,
                token,
                autoReconnect: true,
                reconnectDelayMs: 3000,
            });

            socketRef.current = client;

            const unsubscribeMessage = client.onMessage((event: ChatSocketEvent) => {
                if (event.type === 'new_message') {
                    const incomingMsg = formatIncomingMessage(event.data);

                    setMessageStore((prev) => {
                        const result = replaceOrAppendIncomingMessage(prev, incomingMsg, currentUserIdRef.current);

                        if (result.consumedClientId) {
                            const timer = pendingSendTimers.current[result.consumedClientId];
                            if (timer) {
                                clearTimeout(timer);
                            }

                            delete pendingSendTimers.current[result.consumedClientId];
                        }

                        return result.nextStore;
                    });

                    setChatRooms((prevRooms) => updateRoomOnIncomingMessage(prevRooms, incomingMsg, currentUserIdRef.current, activeChatIdRef.current));
                }

                if (event.type === 'read_receipt') {
                    setMessageStore((prev) => applyReadReceiptToMessages(prev, event.data, currentUserIdRef.current));
                    setChatRooms((prev) => clearUnreadRoom(prev, event.data.conversation_id));
                }

                if (event.type === 'error') {
                    console.error('Chat WebSocket:', event.message);
                    if (event.message?.toLowerCase().includes('muted') || event.message?.includes('禁言')) {
                        setGroupSyncToast('你已被禁言，暂时无法发送消息');
                    }
                }

                if (event.type === 'group_sync') {
                    const d = event.data;
                    subscribeWsRoom(d.conversation_id);

                    if (d.action === 'created') {
                        const displayName = d.group_name?.trim() || '群聊';
                        const creator = d.creator_username?.trim();
                        const selfName = userNameRef.current?.trim();
                        if (creator && creator === selfName) {
                            setGroupSyncToast(`群聊「${displayName}」已创建，成员将同步收到`);
                        } else {
                            const suffix = creator ? `（${creator} 创建）` : '';
                            setGroupSyncToast(`新群聊「${displayName}」已加入会话与联系人${suffix}`);
                        }

                        setChatRooms((prev) => {
                            if (prev.some((r) => r.id === d.conversation_id)) {
                                return prev;
                            }

                            const row: ChatListItem = {
                                id: d.conversation_id,
                                name: displayName,
                                avatar: resolvedUserAvatar(d.avatar || ''),
                                lastMessage: '[最近暂无消息]',
                                lastTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                unreadCount: 0,
                                otherUserId: null,
                                isGroup: true,
                            };

                            return [row, ...prev];
                        });

                        setGroups((prev) => {
                            if (prev.some((g) => g.id === d.conversation_id)) {
                                return prev;
                            }

                            const next: Group = {
                                id: d.conversation_id,
                                groupname: displayName,
                                avatar: resolvedUserAvatar(d.avatar || ''),
                                ownerId: 0,
                                adminIds: [],
                                memberCount: 0,
                                createdTime: Date.now(),
                            };

                            return [next, ...prev];
                        });
                    } else if (d.action === 'avatar_updated') {
                        const displayName = d.group_name?.trim() || '群聊';
                        setGroupSyncToast(`「${displayName}」群头像已更新`);
                    }

                    void syncChatRoomsAndGroups();
                }

                if (event.type === 'friend_request') {
                    setPendingFriendRequestCount(prev => prev + 1);
                }
            });

            const unsubscribeStatus = client.onStatusChange((status: 'connecting' | 'open' | 'closed' | 'error') => {
                console.log('WebSocket status:', status);
            });

            client.connect();

            return () => {
                cancelled = true;
                unsubscribeMessage();
                unsubscribeStatus();
                client.disconnect();
                socketRef.current = null;

                // 组件卸载时清理所有发送超时
                Object.values(pendingSendTimers.current).forEach((t) => {
                    if (t) clearTimeout(t);
                });
                pendingSendTimers.current = {};
            };
        }

        return () => {
            cancelled = true;

            // 组件卸载时清理所有发送超时
            Object.values(pendingSendTimers.current).forEach((t) => {
                if (t) clearTimeout(t);
            });
            pendingSendTimers.current = {};
        };
    }, [syncChatRoomsAndGroups, subscribeWsRoom]);

    const chatListData: ChatListItem[] = chatRooms;
    const totalUnreadCount = useMemo(
        () => chatListData.reduce((sum, room) => sum + Math.max(0, room.unreadCount || 0), 0),
        [chatListData]
    );
    const messages = messageStore[activeChatId] ?? [];
    const activeChat = activeChatId ? chatListData.find((chat) => chat.id === activeChatId) ?? null : null;
    const activeChatName = activeChat?.name ?? selectedContact?.username ?? '';

    useEffect(() => {
        if (!activeChatId) {
            return;
        }

        let cancelled = false;

        const loadMessages = async () => {
            try {
                const history = await getChatMessages(activeChatId, 100, 0);

                if (cancelled) {
                    return;
                }

                // 后端按时间倒序分页，界面按时间正序展示
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
    }, [activeChatId]);

    const clearPendingSendTimer = (clientId: string) => {
        const timer = pendingSendTimers.current[clientId];
        if (timer) {
            clearTimeout(timer);
        }
        delete pendingSendTimers.current[clientId];
    };

    const scheduleSendFailureCheck = (conversationId: number, clientId: string) => {
        const timer = setTimeout(() => {
            const roomMessages = messageStoreRef.current[conversationId] ?? [];
            const stillSending = roomMessages.some((message) => message.clientId === clientId && message.status === 'sending');

            if (!stillSending) {
                clearPendingSendTimer(clientId);
                return;
            }

            const graceTimer = setTimeout(() => {
                setMessageStore((prev) => markMessageFailedInStore(prev, conversationId, clientId));
                clearPendingSendTimer(clientId);
            }, SEND_ACK_GRACE_MS);

            pendingSendTimers.current[clientId] = graceTimer;
        }, SEND_ACK_TIMEOUT_MS);

        pendingSendTimers.current[clientId] = timer;
    };

    const handleSendMessage = (content: string) => {
        if (!activeChatId || !content.trim()) {
            return;
        }

        const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        optimisticIdSeqRef.current += 1;
        const tempId = -optimisticIdSeqRef.current;
        const timestamp = Date.now();

        const optimisticMsg: Message = {
            id: tempId,
            convId: activeChatId,
            senderId: currentUserIdRef.current,
            senderUsername: userNameRef.current,
            senderAvatar: myAvatarRef.current,
            type: 'text',
            status: 'sending',
            content,
            timestamp,
            time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isRead: false,
            clientId,
        };

        setMessageStore((prev) => appendOptimisticMessage(prev, activeChatId, optimisticMsg));
        setChatRooms((prev) => updateRoomOnIncomingMessage(prev, optimisticMsg, currentUserIdRef.current, activeChatId));
        scheduleSendFailureCheck(activeChatId, clientId);

        const socket = socketRef.current;
        if (!socket) {
            clearPendingSendTimer(clientId);
            setMessageStore((prev) => markMessageFailedInStore(prev, activeChatId, clientId));
            return;
        }

        // 未 OPEN 时由客户端入队，连接建立后自动发出，避免与 HTTP 双写
        socket.send({
            type: 'send_message',
            data: {
                conversation_id: activeChatId,
                content,
                client_id: clientId,
            },
        });
    };

    // 直接向指定会话发送（用于重试）
    const sendMessageDirect = (convId: number, content: string) => {
        if (!convId || !content.trim()) return;

        const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        optimisticIdSeqRef.current += 1;
        const tempId = -optimisticIdSeqRef.current;
        const timestamp = Date.now();

        const optimisticMsg: Message = {
            id: tempId,
            convId,
            senderId: currentUserIdRef.current,
            senderUsername: userNameRef.current,
            senderAvatar: myAvatarRef.current,
            type: 'text',
            status: 'sending',
            content,
            timestamp,
            time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isRead: false,
            clientId,
        };

        setMessageStore((prev) => appendOptimisticMessage(prev, convId, optimisticMsg));
        scheduleSendFailureCheck(convId, clientId);

        const socket = socketRef.current;
        if (!socket) {
            clearPendingSendTimer(clientId);
            setMessageStore((prev) => markMessageFailedInStore(prev, convId, clientId));
            return;
        }

        socket.send({ type: 'send_message', data: { conversation_id: convId, content, client_id: clientId } });
    };

    const handleRetryMessage = (clientId: string) => {
        // 找到原消息
        const store = messageStore;
        for (const convKey of Object.keys(store)) {
            const convId = Number(convKey);
            const msgs = store[convId] || [];
            const orig = msgs.find((m) => m.clientId === clientId);
            if (orig) {
                // 移除旧的失败消息
                setMessageStore((prev) => ({ ...prev, [convId]: prev[convId].filter((m) => m.clientId !== clientId) }));
                // 用新 clientId 重新发送
                sendMessageDirect(convId, orig.content);
                return;
            }
        }
    };

    const handleReadMessage = (convId: number, lastMsgId: number) => {
        if (lastMsgId > 0) {
            socketRef.current?.send({
                type: 'read_message',
                data: { conversation_id: convId, last_read_message_id: lastMsgId },
            });
        }

        // 乐观设置该会话为已读（前端显示）
        setChatRooms((prev) => prev.map((r) => (r.id === convId ? { ...r, unreadCount: 0 } : r)));
        /** 不在此处立刻 getChatRooms：服务端 last_read 可能尚未落库，拉列表会把角标又刷回非 0 */
    };

    const handleCreateGroup = async ({
        groupName,
        memberIds,
        avatar,
        clientRequestId,
    }: {
        groupName: string;
        memberIds: number[];
        avatar?: string;
        clientRequestId: string;
    }) => {
        try {
            const createdGroup = await createGroup({
                group_name: groupName,
                member_ids: memberIds,
                client_request_id: clientRequestId,
            });

            const optimisticAvatar = resolvedUserAvatar(avatar ?? createdGroup.avatar);

            if (avatar) {
                void updateGroupAvatar(createdGroup.room_id, avatar).catch((err) => {
                    console.error('群头像上传失败:', err);
                });
            }

            subscribeWsRoom(createdGroup.room_id);

            setActiveTab('chat');
            setSelectedContact(null);
            setEntryUnreadHintCount(0);
            setActiveChatId(createdGroup.room_id);

            const mappedGroup = mapGroupSummary({
                ...createdGroup,
                avatar: optimisticAvatar,
            });
            setGroups((currentGroups) => [mappedGroup, ...currentGroups.filter((group) => group.id !== mappedGroup.id)]);
            setChatRooms((currentRooms) => [
                {
                    id: createdGroup.room_id,
                    name: createdGroup.group_name,
                    avatar: optimisticAvatar,
                    lastMessage: '[最近暂无消息]',
                    lastTime: new Date(createdGroup.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    unreadCount: 0,
                    otherUserId: null,
                    isGroup: true,
                },
                ...currentRooms.filter((room) => room.id !== createdGroup.room_id),
            ]);
        } catch (error) {
            console.error('创建群聊失败:', error);
            alert(error instanceof Error ? error.message : '创建群聊失败');
        }
    };

    const handleChatDeleted = useCallback(() => {
        const convId = activeChatIdRef.current;
        setChatSessionInfoOpen(false);
        setActiveChatId(0);
        setSelectedContact(null);
        
        // 清除该会话，并删除本地存储的消息（目前只能实现一侧的，另一侧需要手动刷新）
        setChatRooms(prev => prev.filter(room => room.id !== convId));
        setMessageStore(prev => {
            const next = { ...prev };
            delete next[convId];
            return next;
        });

        // 刷新列表
        void refreshFriendsAndRooms();
        void syncGroupList();
    }, [refreshFriendsAndRooms, syncGroupList]);

    const handleLogout = () => {
        const isConfirmed = globalThis.confirm('确认要退出登录吗？');
        if (!isConfirmed) {
            return;
        }

        socketRef.current?.disconnect();
        tokenUtils.removeToken();
        globalThis.location.reload();
    };

    const handleDeleteAccount = async () => {
        const success = await deleteUser();

        if (success) {
            alert('账号已注销');
            localStorage.clear();
            socketRef.current?.disconnect();
            tokenUtils.removeToken();
            globalThis.location.reload();
        } else {
            alert('注销失败，请稍后重试');
        }
    };

    // 在好友详情界面里删除好友的接口
    const handleFriendDetailDeleted = useCallback(() => {
        const userId = contactDetailUserId;
        if (!userId) return;
        
        setContactDetailUserId(null);
        setActiveChatId(0);
        setSelectedContact(null);
        
        // 清理对应会话
        const convId = chatRooms.find(r => r.otherUserId === userId)?.id;
        if (convId) {
            setChatRooms(prev => prev.filter(r => r.id !== convId));
            setMessageStore(prev => {
                const next = { ...prev };
                delete next[convId];
                return next;
            });
        }
        
        void refreshFriendsAndRooms();
    }, [contactDetailUserId, chatRooms, refreshFriendsAndRooms]);

    // 在好友详情界面进入聊天
    const handleEnterChat = useCallback((userId: number) => {
        const matchedRoom =
            chatRooms.find(room => room.otherUserId === userId) ??
            chatRooms.find(room => !room.isGroup && room.name === selectedContact?.username);
        const roomId = matchedRoom?.id ?? 0;
        
        setContactDetailUserId(null);
        setChatSessionInfoOpen(false);
        setActiveChatId(roomId);
        setEntryUnreadHintCount(matchedRoom ? Math.max(0, matchedRoom.unreadCount || 0) : 0);
    }, [chatRooms, selectedContact]);

    return (
        <div className="main">
            {groupSyncToast ? (
                <div className="group-sync-toast" role="status" aria-live="polite">
                    {groupSyncToast}
                </div>
            ) : null}
            <aside className="side-bar">
                <div className="nav-top">
                    <button
                        className="user-avatar"
                        title="点击更换头像"
                        onClick={() => {
                            setActiveTab('settings');
                            setSettingsPanel('profile');
                        }}
                        type="button"
                    >
                        <img src={myAvatar} alt="myAvatar" title={userName || '当前用户'} />
                    </button>
                    <nav className="nav-menu">
                        <button
                            className={`nav-button ${activeTab === 'chat' ? 'active-button' : ''}`}
                            onClick={() => {
                                setActiveTab('chat');
                                setSelectedContact(null);
                            }}
                        >
                            <img src={CHATICON} alt="chat-icon" />
                            {totalUnreadCount > 0 && (
                                <span className="nav-unread-badge" aria-label={`${totalUnreadCount} 条未读消息`}>
                                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                                </span>
                            )}
                        </button>
                        <button
                            className={`nav-button ${activeTab === 'contacts' ? 'active-button' : ''}`}
                            onClick={() => setActiveTab('contacts')}
                        >
                            <img src={CONTACTICON} alt="contact-icon" />
                            {pendingFriendRequestCount > 0 && (
                                <span className="nav-unread-badge">
                                    {pendingFriendRequestCount > 99 ? '99+' : pendingFriendRequestCount}
                                </span>
                            )}
                        </button>
                    </nav>
                </div>
                <div className="nav-bottom">
                    <button
                        className={`nav-button ${activeTab === 'settings' ? 'active-button' : ''}`}
                        onClick={() => {
                            setActiveTab('settings');
                            setSettingsPanel('menu');
                        }}
                    >
                        <img src={CONFIGICON} alt="config-icon" />
                    </button>
                </div>
            </aside>

                <div className="list-area">
                {activeTab === 'settings' && (
                <div className="list-actions">
                    <button
                        className={`list-action-button ${activeTab === 'settings' && settingsPanel === 'profile' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('settings');
                            setSettingsPanel('profile');
                        }}
                        title="个人资料"
                    >
                        个人资料
                    </button>

                    <button
                        className="list-action-button"
                        onClick={() => handleLogout()}
                        title="退出登录"
                    >
                        退出登录
                    </button>

                    <button
                        className="list-action-button list-action-button--danger"
                        onClick={async () => {
                            const confirmed = globalThis.confirm('确认要注销账号吗？此操作无法撤销！');
                            if (!confirmed) return;
                            await handleDeleteAccount();
                        }}
                        title="注销账号"
                    >
                        注销账号
                    </button>
                </div>
                )}
                {activeTab === 'chat' && (
                    <ChatList
                        chats={chatListData}
                        activeId={activeChatId}
                        onChatClick={(chat) => {
                            const hint = Math.max(0, chat.unreadCount || 0);
                            setEntryUnreadHintCount(hint);
                            /** 与消息窗口内未读提示同源：点进会话即清列表角标，窗口内仍用 hint 跟踪直到读完 */
                            setChatRooms((prev) => clearUnreadRoom(prev, chat.id));
                            setActiveChatId(chat.id);
                            setSelectedContact(null);
                            setChatSessionInfoOpen(false);
                            setActiveTab('chat');
                        }}
                    />
                )}
                {activeTab === 'contacts' && (
                    <ContactList
                        friends={friends}
                        groups={groups}
                        currentUserId={currentUserId}
                        onItemClick={(item, type) => {
                            if (type === 'user') {
                                const userItem = item as User;
                                setSelectedContact(userItem);
                                setContactDetailUserId(userItem.id);
                                return;
                            }

                            const groupItem = item as { id: number };
                            setSelectedContact(null);
                            const groupRoom = chatRooms.find((room) => room.id === groupItem.id);
                            const hint = groupRoom ? Math.max(0, groupRoom.unreadCount || 0) : 0;
                            setEntryUnreadHintCount(hint);
                            setChatRooms((prev) => clearUnreadRoom(prev, groupItem.id));
                            setActiveChatId(groupItem.id);
                            setChatSessionInfoOpen(false);
                        }}
                        onCreateGroup={handleCreateGroup}
                        onContactsChanged={refreshFriendsAndRooms}
                        pendingFriendRequestCount={pendingFriendRequestCount}
                        onClearFriendRequests={() => setPendingFriendRequestCount(0)}
                    />
                )}
                {/* settings 页面现在在主区域呈现（与聊天窗口平级），因此移除此处的渲染 */}
            </div>

            <main className="chat-area">
                {activeTab === 'settings' ? (
                    <ConfigNav
                        isOpen
                        initialView={settingsPanel}
                        showMenuInMain={false}
                        onClose={() => setActiveTab('chat')}
                        currentUser={{
                            userId: currentUserId,
                            username: userName,
                            avatar: myAvatar,
                            birthday: profileBirthday,
                            address: profileAddress,
                            signature: profileSignature,
                        }}
                        onAvatarUpdated={setMyAvatar}
                        onLogout={handleLogout}
                        onDeleteAccount={handleDeleteAccount}
                    />
                ) : contactDetailUserId != null ? (
                    <ContactSessionDetail
                        userId={contactDetailUserId}
                        onBack={() => setContactDetailUserId(null)}
                        onEnterChat={handleEnterChat}
                        onDeleted={handleFriendDetailDeleted}
                    />
                ) : activeChatName ? (
                    chatSessionInfoOpen ? (
                        <ChatSessionDetail
                            roomId={activeChatId}
                            isGroup={activeChatIsGroup}
                            currentUserId={currentUserId}
                            otherUserId={activeChat?.otherUserId ?? null}
                            onBack={() => setChatSessionInfoOpen(false)}
                            onDeleted={handleChatDeleted}
                        />
                    ) : (
                        <ChatWindow
                            activeChatId={activeChatId}
                            activeChatName={activeChatName}
                            isGroupChat={activeChatIsGroup}
                            messages={messages}
                            initialUnreadCount={entryUnreadHintCount}
                            currentUserId={currentUserId}
                            onSendMessage={handleSendMessage}
                            onReadMessage={handleReadMessage}
                            onRetryMessage={handleRetryMessage}
                            onOpenSessionInfo={() => setChatSessionInfoOpen(true)}
                        />
                    )
                ) : (
                    <div className="empty-chat-placeholder">
                        <p>选择一个联系人开始聊天</p>
                    </div>
                )}
            </main>
        </div>
    );
}
