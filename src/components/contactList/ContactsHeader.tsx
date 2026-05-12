import type { RefObject } from 'react';

export interface ContactsHeaderProps {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    actionMenuRef: RefObject<HTMLDivElement | null>;
    isActionMenuOpen: boolean;
    onToggleActionMenu: () => void;
    pendingFriendRequestCount?: number;
    onMenuAddFriend: () => void;
    onMenuSearchGroup: () => void;
    onMenuFriendRequests: () => void;
    onMenuCreateGroup: () => void;
}

export default function ContactsHeader({
    searchQuery,
    onSearchQueryChange,
    actionMenuRef,
    isActionMenuOpen,
    onToggleActionMenu,
    pendingFriendRequestCount,
    onMenuAddFriend,
    onMenuSearchGroup,
    onMenuFriendRequests,
    onMenuCreateGroup,
}: ContactsHeaderProps) {
    const pending = pendingFriendRequestCount ?? 0;

    return (
        <div className="contacts-header">
            <div className="search-action-row" ref={actionMenuRef}>
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="搜索联系人或群聊"
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                    />
                </div>
                <button
                    type="button"
                    className="action-toggle-button"
                    aria-label="打开更多操作"
                    onClick={onToggleActionMenu}
                >
                    +
                    {pending > 0 && (
                        <span className="unread-badge">{pending > 99 ? '99+' : pending}</span>
                    )}
                </button>

                {isActionMenuOpen && (
                    <div className="action-menu">
                        <button type="button" className="action-menu-item" onClick={onMenuAddFriend}>
                            添加好友
                        </button>
                        <button type="button" className="action-menu-item" onClick={onMenuSearchGroup}>
                            添加群聊
                        </button>
                        <button type="button" className="action-menu-item" onClick={onMenuFriendRequests}>
                            好友请求
                            {pending > 0 && (
                                <span className="unread-badge-inline">{pending > 99 ? '99+' : pending}</span>
                            )}
                        </button>
                        <button type="button" className="action-menu-item" onClick={onMenuCreateGroup}>
                            新建群聊
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
