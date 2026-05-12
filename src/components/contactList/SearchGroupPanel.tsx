import type { FormEvent } from 'react';

import type { Group } from '../../types/entity';
import { resolvedUserAvatar } from '../../utils/avatar';

export interface SearchGroupPanelProps {
    groupKeyword: string;
    onGroupKeywordChange: (value: string) => void;
    groupHint: string;
    groupSearchResults: Group[];
    onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onEnterGroup: (group: Group) => void;
    onClose: () => void;
}

export default function SearchGroupPanel({
    groupKeyword,
    onGroupKeywordChange,
    groupHint,
    groupSearchResults,
    onSearchSubmit,
    onEnterGroup,
    onClose,
}: SearchGroupPanelProps) {
    return (
        <div className="add-friend-panel">
            <div className="add-friend-field">
                <label htmlFor="group-search-input">搜索群聊</label>
                <form className="add-friend-search-row" onSubmit={onSearchSubmit}>
                    <input
                        id="group-search-input"
                        type="text"
                        placeholder="输入群聊名称或群聊ID"
                        value={groupKeyword}
                        onChange={(e) => onGroupKeywordChange(e.target.value)}
                    />
                    <button type="submit" className="add-friend-search-button">
                        搜索
                    </button>
                </form>
            </div>

            {groupHint && <div className="add-friend-hint">{groupHint}</div>}

            <div className="add-friend-result-list">
                {groupSearchResults.map((group) => (
                    <div key={group.id} className="add-friend-result-item">
                        <div className="add-friend-user-info">
                            <img
                                className="add-friend-user-avatar"
                                src={resolvedUserAvatar(group.avatar)}
                                alt="group-avatar"
                            />
                            <div className="add-friend-user-text">
                                <span className="add-friend-user-name">{group.groupname}</span>
                                <span className="add-friend-user-email">群聊ID: {group.id}</span>
                            </div>
                        </div>
                        <button type="button" className="add-friend-action-button" onClick={() => onEnterGroup(group)}>
                            进入
                        </button>
                    </div>
                ))}
            </div>

            <div className="create-group-actions">
                <button type="button" className="create-group-secondary-button" onClick={onClose}>
                    关闭
                </button>
            </div>
        </div>
    );
}
