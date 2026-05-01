import { useEffect, useRef, useState } from 'react';

import ChatList from '../components/chatList';
import ChatWindow from '../components/chatWindow';
import ContactList from '../components/contactList';

import { BACKENDURL, CHATICON, CONFIGICON, CONTACTICON, DEFAULT_AVATAR } from '../constants/string';
import { MOCK_FRIENDS, MOCK_GROUPS } from '../mockData/contactListMock';
import { getChatMessages, getChatRooms, type ChatMessageData, type ChatRoomSummaryData } from '../services/chat';
import { createGroup, getGroupList, type GroupSummaryData } from '../services/group';
import { getFriendList, type FriendSummaryData } from '../services/friend';
import { getCurrentUser } from '../services/user';
import { createChatWebSocketClient, type ChatIncomingMessage, type ChatReadReceiptData, type ChatSocketEvent, type ChatWebSocketClient } from '../services/websocket';
import { tokenUtils } from '../utils/auth';
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
}

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
        fromSelf: incomingMessage.senderId === currentUserId,
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

        if (receipt.reader_id === currentUserId) {
            return message.senderId === currentUserId ? message : { ...message, isRead: true };
        }

        return message.senderId === currentUserId ? { ...message, isRead: true } : message;
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
        (store[conversationId] ?? []).map((message) => (message.clientId === clientId ? { ...message, status: 'failed' } : message))
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
    const fromSelf = incomingMessage.senderId === currentUserId;
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
        },
        ...rooms,
    ];
};

const clearUnreadRoom = (rooms: ChatListItem[], conversationId: number) =>
    rooms.map((room) => (room.id === conversationId ? { ...room, unreadCount: 0 } : room));

const mapFriendSummary = (friend: FriendSummaryData): User => ({
    id: friend.user_id,
    username: friend.username,
    avatar: friend.avatar ?? DEFAULT_AVATAR,
    status: friend.status ?? 'online',
    registerTime: Date.now(),
    lastLoginTime: Date.now(),
});

const mapHistoryMessage = (roomId: number, message: ChatMessageData): Message => {
    const timestamp = new Date(message.created_at).getTime();

    return {
        id: message.id,
        convId: message.room_id ?? roomId,
        senderId: message.sender_id,
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
    avatar: room.avatar || DEFAULT_AVATAR,
    lastMessage: room.last_message || '[最近暂无消息]',
    lastTime: room.last_time ? new Date(room.last_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '刚刚',
    unreadCount: room.unread_count,
    otherUserId: room.other_user_id ?? null,
    status: undefined,
});

const mapGroupSummary = (group: GroupSummaryData): Group => ({
    id: group.room_id,
    groupname: group.group_name,
    avatar: group.avatar || DEFAULT_AVATAR,
    ownerId: group.owner_id ?? 0,
    adminIds: [],
    memberCount: group.member_count,
    createdTime: new Date(group.created_at).getTime(),
});

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
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [activeChatId, setActiveChatId] = useState<number>(0);
    const [selectedContact, setSelectedContact] = useState<User | null>(null);
    const [friends, setFriends] = useState<User[]>(MOCK_FRIENDS);
    const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);
    const [chatRooms, setChatRooms] = useState<ChatListItem[]>([]);
    const [messageStore, setMessageStore] = useState<Record<number, Message[]>>({});

    const socketRef = useRef<ChatWebSocketClient | null>(null);
    const currentUserIdRef = useRef<number>(currentUserId);
    const activeChatIdRef = useRef<number>(activeChatId);
    const pendingSendTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
    /** 乐观消息的临时负数 id，保证同毫秒内多次发送也不与 React key 冲突 */
    const optimisticIdSeqRef = useRef(0);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

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
                setMyAvatar(currentUser.avatar || DEFAULT_AVATAR);
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
                setFriends(MOCK_FRIENDS);
            }
        };

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

        const syncGroupList = async () => {
            try {
                const groupList = await getGroupList();

                if (cancelled) {
                    return;
                }

                setGroups(groupList.map(mapGroupSummary));
            } catch (error) {
                console.error('获取群聊列表失败:', error);
                setGroups(MOCK_GROUPS);
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
    }, []);

    const chatListData: ChatListItem[] = chatRooms;
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

    const handleLogout = () => {
        const isConfirmed = globalThis.confirm('确认要退出登录吗？');
        if (!isConfirmed) {
            return;
        }

        socketRef.current?.disconnect();
        tokenUtils.removeToken();
        globalThis.location.reload();
    };

    const refreshFriendsAndRooms = async () => {
        try {
            const [friendList, roomList] = await Promise.all([getFriendList(), getChatRooms()]);
            setFriends(friendList.map(mapFriendSummary));
            setChatRooms(roomList.map(mapChatRoom));
        } catch (error) {
            console.error('刷新好友或会话失败:', error);
        }
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

        const clearSendTimer = () => {
            const t = pendingSendTimers.current[clientId];
            if (t) clearTimeout(t);
            delete pendingSendTimers.current[clientId];
        };

        const timer = setTimeout(() => {
            setMessageStore((prev) => markMessageFailedInStore(prev, activeChatId, clientId));
            clearSendTimer();
        }, 8000);

        pendingSendTimers.current[clientId] = timer;

        const socket = socketRef.current;
        if (!socket) {
            clearSendTimer();
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
            type: 'text',
            status: 'sending',
            content,
            timestamp,
            time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isRead: false,
            clientId,
        };

        setMessageStore((prev) => appendOptimisticMessage(prev, convId, optimisticMsg));

        const clearSendTimer = () => {
            const t = pendingSendTimers.current[clientId];
            if (t) clearTimeout(t);
            delete pendingSendTimers.current[clientId];
        };

        const timer = setTimeout(() => {
            setMessageStore((prev) => markMessageFailedInStore(prev, convId, clientId));
            clearSendTimer();
        }, 8000);

        pendingSendTimers.current[clientId] = timer;

        const socket = socketRef.current;
        if (!socket) {
            clearSendTimer();
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
        socketRef.current?.send({
            type: 'read_message',
            data: { conversation_id: convId, last_message_id: lastMsgId },
        });

        // 乐观设置该会话为已读（前端显示）
        setChatRooms((prev) => prev.map((r) => (r.id === convId ? { ...r, unreadCount: 0 } : r)));
    };

    const handleCreateGroup = async ({ groupName, memberIds }: { groupName: string; memberIds: number[] }) => {
        try {
            const createdGroup = await createGroup({
                group_name: groupName,
                member_ids: memberIds,
            });

            setActiveTab('chat');
            setSelectedContact(null);
            setActiveChatId(createdGroup.room_id);

            const mappedGroup = mapGroupSummary(createdGroup);
            setGroups((currentGroups) => [mappedGroup, ...currentGroups.filter((group) => group.id !== mappedGroup.id)]);
            setChatRooms((currentRooms) => [
                {
                    id: createdGroup.room_id,
                    name: createdGroup.group_name,
                    avatar: createdGroup.avatar || DEFAULT_AVATAR,
                    lastMessage: '[最近暂无消息]',
                    lastTime: new Date(createdGroup.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    unreadCount: 0,
                    otherUserId: null,
                },
                ...currentRooms.filter((room) => room.id !== createdGroup.room_id),
            ]);
        } catch (error) {
            console.error('创建群聊失败:', error);
            alert(error instanceof Error ? error.message : '创建群聊失败');
        }
    };

    return (
        <div className="main">
            <aside className="side-bar">
                <div className="nav-top">
                    <div className="user-avatar">
                        <img src={myAvatar} alt="myAvatar" title={userName || '当前用户'} />
                    </div>
                    <nav className="nav-menu">
                        <button
                            className={`nav-button ${activeTab === 'chat' ? 'active-button' : ''}`}
                            onClick={() => {
                                setActiveTab('chat');
                                setSelectedContact(null);
                            }}
                        >
                            <img src={CHATICON} alt="chat-icon" />
                        </button>
                        <button
                            className={`nav-button ${activeTab === 'contacts' ? 'active-button' : ''}`}
                            onClick={() => setActiveTab('contacts')}
                        >
                            <img src={CONTACTICON} alt="contact-icon" />
                        </button>
                    </nav>
                </div>
                <div className="nav-bottom">
                    <button
                        className={`nav-button ${activeTab === 'settings' ? 'active-button' : ''}`}
                        onClick={() => {
                            setActiveTab('settings');
                            setIsSettingsOpen(true);
                        }}
                    >
                        <img src={CONFIGICON} alt="config-icon" />
                    </button>
                </div>
            </aside>

            {isSettingsOpen && (
                <div className="overlay">
                    <div className="config-panel">
                        <button className="config-button" onClick={() => setIsSettingsOpen(false)}>
                            关闭
                        </button>
                        <button className="config-button">个人资料</button>
                        <button className="config-button">修改设置</button>
                        <button className="config-button">切换账号</button>
                        <button className="config-button log-out-item" onClick={handleLogout}>
                            退出登录
                        </button>
                    </div>
                </div>
            )}

            <div className="list-area">
                {activeTab === 'chat' && (
                    <ChatList
                        chats={chatListData}
                        activeId={activeChatId}
                        onChatClick={(chat) => {
                            setActiveChatId(chat.id);
                            setSelectedContact(null);
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
                                const matchedRoom = chatRooms.find((room) => room.otherUserId === userItem.id);
                                setActiveChatId(matchedRoom?.id ?? 0);
                                return;
                            }

                            const groupItem = item as { id: number };
                            setSelectedContact(null);
                            setActiveChatId(groupItem.id);
                        }}
                        onCreateGroup={handleCreateGroup}
                        onContactsChanged={refreshFriendsAndRooms}
                    />
                )}
            </div>

            <main className="chat-area">
                {activeChatName ? (
                    <ChatWindow
                        activeChatId={activeChatId}
                        activeChatName={activeChatName}
                        messages={messages}
                        currentUserId={currentUserId}
                        onSendMessage={handleSendMessage}
                        onReadMessage={handleReadMessage}
                        onRetryMessage={handleRetryMessage}
                    />
                ) : (
                    <div className="empty-chat-placeholder">
                        <p>选择一个联系人开始聊天</p>
                    </div>
                )}
            </main>
        </div>
    );
}
