import { DEFAULT_AVATAR } from '../../constants/string';
import type { User } from '../../types/entity';
import { resolvedUserAvatar } from '../../utils/avatar';

export interface TaggedFriendsSection {
    tag: string;
    users: User[];
}

export interface ContactFriendsSectionProps {
    taggedFriends: TaggedFriendsSection[];
    friendCount: number;
    expanded: boolean;
    onToggleExpanded: () => void;
    onUserClick: (user: User) => void;
}

export default function ContactFriendsSection({
    taggedFriends,
    friendCount,
    expanded,
    onToggleExpanded,
    onUserClick,
}: ContactFriendsSectionProps) {
    return (
        <div className={`section-container section-friends${expanded ? ' is-expanded' : ' is-collapsed'}`}>
            <button
                type="button"
                className="section-header-toggle"
                aria-expanded={expanded}
                aria-controls="contact-list-friends"
                id="contact-section-friends-heading"
                onClick={onToggleExpanded}
            >
                <span className="section-header-label">联系人 ({friendCount})</span>
                <span className="section-header-chevron" aria-hidden>
                    {expanded ? '▼' : '▶'}
                </span>
            </button>
            {expanded && (
                <div
                    id="contact-list-friends"
                    className="list-render-area"
                    role="region"
                    aria-labelledby="contact-section-friends-heading"
                >
                    {taggedFriends.map((section) => (
                        <div key={section.tag} className="friend-tag-group">
                            <div className="friend-tag-group-header">
                                {section.tag} ({section.users.length})
                            </div>
                            {section.users.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className="contact-item contact-button"
                                    onClick={() => onUserClick(user)}
                                >
                                    <div className="item-avatar">
                                        <img
                                            src={resolvedUserAvatar(user.avatar)}
                                            alt=""
                                            onError={(e) => {
                                                const img = e.currentTarget;
                                                img.onerror = null;
                                                img.src = DEFAULT_AVATAR;
                                            }}
                                        />
                                        <span className={`status-badge ${user.status}`} />
                                    </div>
                                    <div className="item-info">
                                        <span className="item-name">{user.username}</span>
                                        <span className={`item-meta status-${user.status}`}>
                                            {user.status === 'online' ? '在线' : '离线'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
