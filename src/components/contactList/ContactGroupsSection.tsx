import { DEFAULT_AVATAR } from '../../constants/string';
import type { Group } from '../../types/entity';
import { resolvedUserAvatar } from '../../utils/avatar';

export interface ContactGroupsSectionProps {
    groups: Group[];
    groupCount: number;
    expanded: boolean;
    onToggleExpanded: () => void;
    onGroupClick: (group: Group) => void;
}

export default function ContactGroupsSection({
    groups,
    groupCount,
    expanded,
    onToggleExpanded,
    onGroupClick,
}: ContactGroupsSectionProps) {
    return (
        <div className={`section-container section-groups${expanded ? ' is-expanded' : ' is-collapsed'}`}>
            <button
                type="button"
                className="section-header-toggle"
                aria-expanded={expanded}
                aria-controls="contact-list-groups"
                id="contact-section-groups-heading"
                onClick={onToggleExpanded}
            >
                <span className="section-header-label">群聊 ({groupCount})</span>
                <span className="section-header-chevron" aria-hidden>
                    {expanded ? '▼' : '▶'}
                </span>
            </button>
            {expanded && (
                <div
                    id="contact-list-groups"
                    className="list-render-area"
                    role="region"
                    aria-labelledby="contact-section-groups-heading"
                >
                    {groups.map((group) => (
                        <button
                            key={group.id}
                            type="button"
                            className="contact-item contact-button"
                            onClick={() => onGroupClick(group)}
                        >
                            <div className="item-avatar">
                                <img
                                    src={resolvedUserAvatar(group.avatar)}
                                    alt=""
                                    onError={(e) => {
                                        const img = e.currentTarget;
                                        img.onerror = null;
                                        img.src = DEFAULT_AVATAR;
                                    }}
                                />
                            </div>
                            <div className="item-info">
                                <span className="item-name">{group.groupname}</span>
                                <span className="item-meta">{group.memberCount} 人</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
