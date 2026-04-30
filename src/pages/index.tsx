import { useState, useEffect, useRef } from "react";

import ContactList from '../components/contactList'
import ChatList from "../components/chatList";
import ChatWindow from "../components/chatWindow";

import { getCurrentUser } from "../api/user";
import { getFriendList } from "../api/friend";
import { getChatRooms, getChatMessages } from "../api/chat";
import { createChatWebSocketClient, type ChatWebSocketClient, type ChatIncomingMessage } from "../services/websocket";
import type { Message, User } from "../types/entity";
import type { ActiveTabType } from "../types/ui";

import { DEFAULT_AVATAR, CHATICON, CONTACTICON, CONFIGICON, BACKENDURL } from "../constants/string";

import '../styles/index.css'

// 模拟数据
import { MOCK_FRIENDS, MOCK_GROUPS } from '../mockData/contactListMock'

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
    const token = localStorage.getItem('token');
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
        return JSON.parse(atob(paddedPayload)) as { user_id?: number; username?: string };
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
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
};

const mapFriendSummary = (friend: { user_id: number; username: string; avatar?: string; status?: 'online' | 'offline' | 'busy'; }): User => ({
    id: friend.user_id,
    username: friend.username,
    avatar: friend.avatar ?? DEFAULT_AVATAR,
    status: friend.status ?? 'online',
    registerTime: Date.now(),
    lastLoginTime: Date.now(),
});

const mapHistoryMessage = (message: { id: number; room_id: number; sender_id: number; content: string; created_at: string; }): Message => {
    const timestamp = new Date(message.created_at).getTime();

    return {
        id: message.id,
        convId: message.room_id,
        senderId: message.sender_id,
        type: 'text',
        status: 'sent',
        content: message.content,
        timestamp,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
};

export default function Index(){
    const tokenPayload = decodeTokenPayload();
    const [currentUserId, setCurrentUserId] = useState<number>(tokenPayload?.user_id ?? 0)
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
    const [friends, setFriends] = useState<User[]>(MOCK_FRIENDS);
    const [chatRooms, setChatRooms] = useState<ChatListItem[]>([]);
    const [messageStore, setMessageStore] = useState<Record<number, Message[]>>({});

    const socketRef = useRef<ChatWebSocketClient | null>(null);

    const mergeMessageStore = (store: Record<number, Message[]>, incomingMessage: Message) => {
        const roomMessages = store[incomingMessage.convId] ?? [];

        for (const roomMessage of roomMessages) {
            if (roomMessage.id === incomingMessage.id) {
                return store;
            }
        }

        return {
            ...store,
            [incomingMessage.convId]: [...roomMessages, incomingMessage].sort((left, right) => left.timestamp - right.timestamp),
        };
    };

    useEffect(() => {
        let cancelled = false;

        const syncUserProfile = async () => {
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

                const mappedFriends = friendList.map(mapFriendSummary);
                setFriends(mappedFriends);
                setActiveChatId(mappedFriends[0]?.id ?? 0);
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

                const mappedRooms = roomList.map((room) => ({
                    id: room.room_id,
                    name: room.name,
                    avatar: room.avatar || DEFAULT_AVATAR,
                    lastMessage: room.last_message || '[最近暂无消息]',
                    lastTime: room.last_time ? new Date(room.last_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '刚刚',
                    unreadCount: room.unread_count,
                    otherUserId: room.other_user_id ?? null,
                    status: undefined,
                }));

                setChatRooms(mappedRooms);
                setActiveChatId((currentActiveChatId) => currentActiveChatId || mappedRooms[0]?.id || 0);
            } catch (error) {
                console.error('获取会话列表失败:', error);
                setChatRooms([]);
            }
        };

        void syncUserProfile();
        void syncFriendList();
        void syncChatRooms();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');

        if (!token) {
            return;
        }

        const client = createChatWebSocketClient({
            backendUrl: BACKENDURL,
            token,
            autoReconnect: true,
            reconnectDelayMs: 3000,
        });

        socketRef.current = client;

        const unsubscribeMessage = client.onMessage((event) => {
            if (event.type !== 'new_message') {
                return;
            }

            const incomingMsg = formatIncomingMessage({
                id: event.data.id,
                conversation_id: event.data.conversation_id,
                sender_id: event.data.sender_id,
                content: event.data.content,
                created_at: event.data.created_at,
            });

            setMessageStore((prev) => {
                return mergeMessageStore(prev, incomingMsg);
            });
        });

        const unsubscribeStatus = client.onStatusChange((status) => {
            console.log('WebSocket status:', status);
        });

        client.connect();

        return () => {
            unsubscribeMessage();
            unsubscribeStatus();
            client.disconnect();
            socketRef.current = null;
        };
    }, []);

    const chatListData: ChatListItem[] = chatRooms;

    const messages = messageStore[activeChatId] ?? [];

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

                setMessageStore((prev) => ({
                    ...prev,
                    [activeChatId]: history.messages.map(mapHistoryMessage),
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

    function chatClicked(){
        setActiveTab('chat');
    }
    function contactsClicked(){
        setActiveTab('contacts')
    }
    function configClicked(){
        setActiveTab('settings')
        setIsSettingsOpen(true);
    }

    const handleLogout = () => {
        const isConfirmed = globalThis.confirm('确认要退出登录吗？')
        if(isConfirmed){
            socketRef.current?.disconnect();
            localStorage.removeItem('token')
            globalThis.location.href = '/login';
        }
    };

    const activeChat = chatListData.find((chat) => chat.id === activeChatId);

    const handleSendMessage = (content: string) => {
        if(!socketRef.current){
            console.error('WebSocket Not Connected');
            return;
        }

        socketRef.current.send({
            type: 'send_message',
            data: {
                conversation_id: activeChatId,
                content: content,
            },
        });
    };

    const handleReadMessage = (convId: number, lastMsgId: number) => {
        socketRef.current?.send({
            type: 'read_message',
            data: { conversation_id: convId, last_message_id: lastMsgId },
        });
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
                            onClick={chatClicked}
                        >
                            <img src={CHATICON} alt='chat-icon' />
                        </button>
                        <button
                            className={`nav-button ${activeTab === 'contacts' ? 'active-button' : ''}`}
                            onClick={contactsClicked}
                        >
                            <img src={CONTACTICON} alt="contact-icon" />
                        </button>
                    </nav>
                </div>
                <div className="nav-bottom">
                    <button 
                        className={`nav-button ${activeTab === 'settings' ? 'active-button' : ''}`}
                        onClick={configClicked}
                    >
                        <img src={CONFIGICON} alt="config-icon" />
                    </button>
                </div>
            </aside>

            {isSettingsOpen && (
                <div className="overlay">
                    <div className="config-panel">
                        <button className="config-button" onClick={() => setIsSettingsOpen(false)}>关闭</button>
                        <button className="config-button">个人资料</button>
                        <button className="config-button">修改设置</button>
                        <button className="config-button">切换账号</button>
                        <button className="config-button log-out-item" onClick={handleLogout}>退出登录</button>
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
                            setActiveTab('chat');
                            console.log('选中聊天:', chat.name);
                        }}
                    />
                    
                )}
                {activeTab === 'contacts' && (
                    <ContactList
                        friends={friends}
                        groups={MOCK_GROUPS}
                        onItemClick={(item, type) => {
                            console.log(item, type);
                            if (type === 'user') {
                                const matchedRoom = chatRooms.find((room) => room.otherUserId === item.id);
                                if (matchedRoom) {
                                    setActiveChatId(matchedRoom.id);
                                }
                                setActiveTab('chat');
                            }
                        }}
                    />
                )}
            </div>

            <main className="chat-area">
                {activeChat ? (
                    <ChatWindow
                        activeChatId={Number(activeChat.id)}
                        activeChatName={activeChat.name}
                        messages={messages}
                        currentUserId={currentUserId}
                        onSendMessage={handleSendMessage}
                        onReadMessage={handleReadMessage}
                    />
                ) : (
                    <div className="empty-chat-placeholder">
                        <p>选择一个联系人开始聊天</p>
                    </div>
                )}
            </main>
            
        </div>
    )
}
