import { useState, useEffect, useMemo } from "react";

import ContactList from '../components/contactList'
import ChatList from "../components/chatList";
import ChatWindow from "../components/chatWindow";

import type { Message } from "../types/entity";
import type { ActiveTabType } from "../types/ui";

import { DEFAULT_AVATAR, CHATICON, CONTACTICON, CONFIGICON } from "../constants/string";

import '../styles/index.css'

// 模拟数据
import { MOCK_FRIENDS, MOCK_GROUPS } from '../mockData/contactListMock'

export default function Index(){
    const [currentUserId, setCurrentUserId] = useState<number>(0)
    const [userName, setUserName] = useState<string>('');
    const [myAvatar, setMyAvatar] = useState<string>(DEFAULT_AVATAR);
    const [activeTab, setActiveTab] = useState<ActiveTabType>('chat');
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [activeChatId, setActiveChatId] = useState<number>(0);
    const [messages, setMessages] = useState<Message[]>([]);

    const chatListData = useMemo(() => {
        const friendsChat = MOCK_FRIENDS.map(f => ({
            id: f.id,
            name: f.username,
            avatar: f.avatar,
            lastMessage: "[最近暂无消息]", // 实际开发应从后端获取
            lastTime: "12:00",
            unreadCount: 0,
            type: 'user' as const,
            status: f.status
        }));

        const groupsChat = MOCK_GROUPS.map(g => ({
            id: g.id,
            name: g.groupname,
            avatar: g.avatar,
            lastMessage: "群聊暂无新动态",
            lastTime: "昨天",
            unreadCount: 0,
            type: 'group' as const
        }));

        return [...friendsChat, ...groupsChat];
    }, []);

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
            localStorage.removeItem("token")
            window.location.href = '/login';
        }
    };

    const activeChat = useMemo(() => {
        return chatListData.find(chat => chat.id === activeChatId);
    }, [activeChatId, chatListData]);

    const handleSendMessage = (content: string) => {
        const payload = {
            type: "send_message",
            data: {
                conversation_id: activeChatId,
                content: content
            }
        };
        // socket.send(JSON.stringify(payload));
        console.log("发送消息:", payload);
    };

    const handleReadMessage = (convId: number, lastMsgId: number) => {
        const payload = {
            type: "read_message",
            data: {
                conversation_id: convId,
                last_message_id: lastMsgId
            }
        };
        // socket.send(JSON.stringify(payload));
        console.log("标记已读:", payload);
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
                            console.log('选中聊天:', chat.name);
                        }}
                    />
                    
                )}
                {activeTab === 'contacts' && (
                    <ContactList
                        friends={MOCK_FRIENDS}
                        groups={MOCK_GROUPS}
                        onItemClick={(item, type) => console.log(item, type)}
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
