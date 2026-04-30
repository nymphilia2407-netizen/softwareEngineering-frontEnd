import { useState, useEffect, useMemo, useRef } from "react";

import ContactList from '../components/contactList'
import ChatList from "../components/chatList";
import ChatWindow from "../components/chatWindow";

import { getCurrentUser } from "../api/user";
import { getFriendList } from "../api/friend";
import { createChatWebSocketClient, type ChatWebSocketClient } from "../services/websocket";
import type { Message, User, Group } from "../types/entity";
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
        const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
        const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
        return JSON.parse(atob(paddedPayload)) as { user_id?: number; username?: string };
    } catch {
        return null;
    }
};

const formatIncomingMessage = (message: { id: number; conversation_id: number; sender_id: number; content: string; created_at: string; }): Message => {
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
    const [messageStore, setMessageStore] = useState<Record<number, Message[]>>({});

    const socketRef = useRef<ChatWebSocketClient | null>(null);
    const activeChatIdRef = useRef<number>(activeChatId);

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

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

                setFriends(friendList.map(mapFriendSummary));
            } catch (error) {
                console.error('获取好友列表失败:', error);
                setFriends(MOCK_FRIENDS);
            }
        };

        void syncUserProfile();
        void syncFriendList();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!activeChatId && chatListData.length > 0) {
            setActiveChatId(chatListData[0].id);
        }
    }, [activeChatId]);

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
                const roomMessages = prev[incomingMsg.convId] ?? [];

                if (roomMessages.some((item) => item.id === incomingMsg.id)) {
                    return prev;
                }

                return {
                    ...prev,
                    [incomingMsg.convId]: [...roomMessages, incomingMsg].sort((a, b) => a.timestamp - b.timestamp),
                };
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

    const chatListData = useMemo<ChatListItem[]>(() => {
        const friendsChat = friends.map(friend => ({
            id: friend.id,
            name: friend.username,
            avatar: friend.avatar,
            lastMessage: '[最近暂无消息]',
            lastTime: '12:00',
            unreadCount: 0,
            type: 'user' as const,
            status: friend.status,
        }));

        const groupsChat = MOCK_GROUPS.map(group => ({
            id: group.id,
            name: group.groupname,
            avatar: group.avatar,
            lastMessage: '群聊暂无新动态',
            lastTime: '昨天',
            unreadCount: 0,
            type: 'group' as const,
        }));

        return [...friendsChat, ...groupsChat];
    }, [friends]);

    useEffect(() => {
        if (!activeChatId && chatListData.length > 0) {
            setActiveChatId(chatListData[0].id);
        }
    }, [activeChatId, chatListData]);

    const messages = messageStore[activeChatId] ?? [];

    /**
     * @todo 增加跳转到显示按钮相应组件的功能(完成相应组件)
     */
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
        const isConfirmed = window.confirm('确认要退出登录吗？')
        if(isConfirmed){
            socketRef.current?.disconnect();
            localStorage.removeItem('token')
            window.location.href = '/login';
        }
    };

    const activeChat = useMemo(() => {
        return chatListData.find(chat => chat.id === activeChatId);
    }, [activeChatId, chatListData]);

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
                        <img src={myAvatar} alt="myAvatar" />
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
                <div className="overlay" onClick={() => setIsSettingsOpen(false)}>
                    <div className="config-panel" onClick={(e) => e.stopPropagation()}>
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
                                setActiveChatId(item.id);
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
