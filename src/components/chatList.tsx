import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';

import { DEFAULT_AVATAR } from '../constants/string';
import type { ChatListItem } from '../types/chat';

import '../styles/chatList.css';

interface ChatListProps {
    chats: ChatListItem[];
    activeId?: number;
    onChatClick: (chat: ChatListItem) => void;
    onClearChat?: (convId: number) => void;
    onPinChat?: (convId: number, pinned: boolean) => void;
    onMuteChat?: (convId: number, muted: boolean) => void;
}

function ChatList({ chats, activeId, onChatClick, onClearChat, onPinChat, onMuteChat }: ChatListProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [contextMenu, setContextMenu] = useState<{
        chat: ChatListItem;
        x: number;
        y: number;
    } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const filteredChats = useMemo(() => {
        const q = searchQuery.toLowerCase();
        if (!q) {
            return chats;
        }
        return chats.filter(
            (chat) => chat.name.toLowerCase().includes(q) || chat.lastMessage.toLowerCase().includes(q),
        );
    }, [chats, searchQuery]);

    // 点击其他地方关闭菜单
    useEffect(() => {
        if (!contextMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [contextMenu]);

    const handleContextMenu = useCallback((e: React.MouseEvent, chat: ChatListItem) => {
        e.preventDefault();
        setContextMenu({
            chat,
            x: e.clientX,
            y: e.clientY,
        });
    }, []);

    const handleClear = useCallback(() => {
        if (contextMenu && onClearChat) {
            onClearChat(contextMenu.chat.id);
        }
        setContextMenu(null);
    }, [contextMenu, onClearChat]);

    const handleCloseMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    return (
        <div className="chat-list">
            <div className="chat-header">
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="搜索会话"
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
                            onContextMenu={(e) => handleContextMenu(e, chat)}
                        >
                            <div className="item-avatar">
                                <img src={chat.avatar || DEFAULT_AVATAR} alt="avatar" />
                                {chat.unreadCount > 0 && (
                                    chat.isMuted ? (
                                        <span className="unread-dot" />
                                    ) : (
                                        <span className="unread-badge">
                                            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                        </span>
                                    )
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
                                    {chat.hasUnreadMention && (
                                        <span className="mention-badge">[有人@你]</span>
                                    )}
                                    <span className="last-message">{chat.lastMessage}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-hint">没有找到相关聊天</div>
                )}
            </div>

            {/* 右键菜单 Portal */}
            {contextMenu &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="message-action-popover message-action-popover--context"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        role="menu"
                        aria-label="会话操作"
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <button
                            type="button"
                            className="message-action-btn"
                            role="menuitem"
                            onClick={() => {
                                if (contextMenu && onPinChat) {
                                    onPinChat(contextMenu.chat.id, !contextMenu.chat.isPinned);
                                }
                                setContextMenu(null);
                            }}
                        >
                            {contextMenu?.chat.isPinned ? '取消置顶' : '置顶'}
                        </button>
                        <button
                            type="button"
                            className="message-action-btn"
                            role="menuitem"
                            onClick={() => {
                                if (contextMenu && onMuteChat) {
                                    onMuteChat(contextMenu.chat.id, !contextMenu.chat.isMuted);
                                }
                                setContextMenu(null);
                            }}
                        >
                            {contextMenu?.chat.isMuted ? '取消免打扰' : '消息免打扰'}
                        </button>
                        <button
                            type="button"
                            className="message-action-btn message-action-btn--danger"
                            role="menuitem"
                            onClick={handleClear}
                        >
                            清空聊天记录
                        </button>
                        <button
                            type="button"
                            className="message-action-btn"
                            role="menuitem"
                            onClick={handleCloseMenu}
                        >
                            取消
                        </button>
                    </div>,
                    document.body
                )}
        </div>
    );
}

export default memo(ChatList);