import type { ActiveTabType } from '../../types/chat';

interface MainSidebarProps {
    myAvatar: string;
    userName: string;
    activeTab: ActiveTabType;
    totalUnreadCount: number;
    hasMutedUnread?: boolean;
    pendingFriendRequestCount: number;
    mentionCount?: number;
    chatIcon: string;
    contactIcon: string;
    configIcon: string;
    onOpenProfileSettings: () => void;
    onSelectChat: () => void;
    onSelectContacts: () => void;
    onOpenSettingsMenu: () => void;
}

export default function MainSidebar({
    myAvatar,
    userName,
    activeTab,
    totalUnreadCount,
    hasMutedUnread,
    pendingFriendRequestCount,
    mentionCount,
    chatIcon,
    contactIcon,
    configIcon,
    onOpenProfileSettings,
    onSelectChat,
    onSelectContacts,
    onOpenSettingsMenu,
}: MainSidebarProps) {
    return (
        <aside className="side-bar">
            <div className="nav-top">
                <button
                    className="user-avatar"
                    title="点击更换头像"
                    onClick={onOpenProfileSettings}
                    type="button"
                >
                    <img src={myAvatar} alt="myAvatar" title={userName || '当前用户'} />
                </button>
                <nav className="nav-menu">
                    <button
                        className={`nav-button ${activeTab === 'chat' ? 'active-button' : ''}`}
                        onClick={onSelectChat}
                        type="button"
                    >
                        <img src={chatIcon} alt="chat-icon" />
                        {(totalUnreadCount > 0 || (mentionCount ?? 0) > 0) && (
                            <span className="nav-unread-badge" aria-label={`${totalUnreadCount} 条未读消息`}>
                                {totalUnreadCount > 99
                                    ? '99+'
                                    : (mentionCount ?? 0) > 0 && totalUnreadCount > 0
                                        ? `@${mentionCount} ${totalUnreadCount}`
                                        : (mentionCount ?? 0) > 0
                                            ? `@${mentionCount}`
                                            : totalUnreadCount}
                            </span>
                        )}
                        {totalUnreadCount === 0 && hasMutedUnread && (
                            <span className="nav-unread-dot" aria-label="免打扰会话有新消息" />
                        )}
                    </button>
                    <button
                        className={`nav-button ${activeTab === 'contacts' ? 'active-button' : ''}`}
                        onClick={onSelectContacts}
                        type="button"
                    >
                        <img src={contactIcon} alt="contact-icon" />
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
                    onClick={onOpenSettingsMenu}
                    type="button"
                >
                    <img src={configIcon} alt="config-icon" />
                </button>
            </div>
        </aside>
    );
}
