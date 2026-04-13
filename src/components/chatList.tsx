import { useState } from 'react'
import { type User, type Group } from '../types/entity'
import '../styles/chatList.css'

interface ChatItem {
    id: string | number;
    name: string;
    avatar: string;
    lastMessage: string;
    lastTime: string;
    unreadCount: number;
    type: 'user' | 'group';
    status?: 'online' | 'offline'; // 仅用户类型有效
}

interface ChatListProps {
    chats: ChatItem[];
    activeId?: string | number; // 当前选中的聊天ID
    onChatClick: (chat: ChatItem) => void;
}

export default function ChatList({ chats, activeId, onChatClick }: ChatListProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');

    // 过滤逻辑：按名称搜索
    const filteredChats = chats.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className='chat-list'>
            <div className='chat-header'>
                <div className='search-container'>
                    <input
                        type='text'
                        placeholder='搜索消息'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className='chat-render-area'>
                {filteredChats.length > 0 ? (
                    filteredChats.map(chat => (
                        <div 
                            key={`${chat.type}-${chat.id}`} 
                            className={`chat-item ${activeId === chat.id ? 'active' : ''}`} 
                            onClick={() => onChatClick(chat)}
                        >
                            <div className='item-avatar'>
                                <img src={chat.avatar} alt="avatar" />
                                {chat.type === 'user' && (
                                    <span className={`status-badge ${chat.status}`} />
                                )}
                                {/* 未读消息气泡 */}
                                {chat.unreadCount > 0 && (
                                    <span className="unread-badge">
                                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                    </span>
                                )}
                            </div>

                            <div className='item-content'>
                                <div className='content-top'>
                                    <span className="item-name">{chat.name}</span>
                                    <span className="item-time">{chat.lastTime}</span>
                                </div>
                                <div className='content-bottom'>
                                    <span className="last-message">{chat.lastMessage}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className='empty-hint'>暂无聊天消息</div>
                )}
            </div>
        </div>
    )
}