import { useState, useMemo } from 'react';

import { DEFAULT_AVATAR } from '../constants/string';
import type { ChatListItem } from '../types/chat';
import { sortChatRoomsForDisplay } from '../utils/chatRoomList';

import '../styles/chatList.css';

interface ChatListProps {
    chats: ChatListItem[];
    activeId?: number;
    onChatClick: (chat: ChatListItem) => void;
}

export default function ChatList({ chats, activeId, onChatClick }: ChatListProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filteredChats = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return sortChatRoomsForDisplay(
            chats.filter(
                (chat) =>
                    chat.name.toLowerCase().includes(q) || chat.lastMessage.toLowerCase().includes(q),
            ),
        );
    }, [chats, searchQuery]);

    return (
        <div className="chat-list">
            <div className="chat-header">
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="搜索消息"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="list-container">
                {filteredChats.length > 0 ? (
                    filteredChats.map((chat) => (
                        <div
                            key={chat.id}
                            className={`chat-item ${activeId === chat.id ? 'active' : ''}${chat.isPinned ? ' pinned' : ''}`}
                            onClick={() => onChatClick(chat)}
                        >
                            <div className="item-avatar">
                                <img src={chat.avatar || DEFAULT_AVATAR} alt="avatar" />
                                {chat.unreadCount > 0 && (
                                    <span className="unread-badge">
                                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                    </span>
                                )}
                            </div>
                            <div className="item-content">
                                <div className="content-top">
                                    <span className="item-name">
                                        {chat.isPinned ? <span className="item-pin-badge" title="置顶">顶</span> : null}
                                        {chat.name}
                                    </span>
                                    <span className="item-time">{chat.lastTime}</span>
                                </div>
                                <div className="content-bottom">
                                    <span className="last-message">{chat.lastMessage}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-hint">没有找到相关聊天</div>
                )}
            </div>
        </div>
    );
}
