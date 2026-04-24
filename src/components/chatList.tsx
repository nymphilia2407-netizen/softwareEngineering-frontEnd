import { useState, useMemo } from 'react'
import { type User, type Group } from '../types/entity'

import '../styles/chatList.css'

interface ChatItem {
    id: number;
    name: string;
    avatar: string;
    lastMessage: string;
    lastTime: string;
    unreadCount: number;
    status?: 'online' | 'offline' | 'busy';
}

interface ChatListProps {
    chats: ChatItem[];
    activeId?: number; 
    onChatClick: (chat: ChatItem) => void;
}

export default function ChatList({ chats, activeId, onChatClick }: ChatListProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filteredChats = useMemo(() => {
        return chats.filter(chat =>
            chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
    }, [chats, searchQuery]);

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
            <div className='list-container'>
                {filteredChats.length > 0 ? (
                    filteredChats.map(chat => (
                        <div 
                            key={chat.id} 
                            className={`chat-item ${activeId === chat.id ? 'active' : ''}`}
                            onClick={() => onChatClick(chat)}
                        >
                            <div className='item-avatar'>
                                <img src={chat.avatar || '/default-avatar.png'} alt="avatar" />
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
                    <div className='empty-hint'>没有找到相关聊天</div>
                )}
            </div>
        </div>
    )
}