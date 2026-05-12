import type { FormEvent } from 'react';

import { resolvedUserAvatar } from '../../utils/avatar';
import type { UserSearchData } from '../../services/friend';

export interface AddFriendPanelProps {
    friendKeyword: string;
    onFriendKeywordChange: (value: string) => void;
    searching: boolean;
    addFriendHint: string;
    searchResults: UserSearchData[];
    getAddFriendButtonText: (user: UserSearchData) => string;
    isAddFriendDisabled: (user: UserSearchData) => boolean;
    onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onSendRequest: (targetUserId: number) => void;
    onClose: () => void;
}

export default function AddFriendPanel({
    friendKeyword,
    onFriendKeywordChange,
    searching,
    addFriendHint,
    searchResults,
    getAddFriendButtonText,
    isAddFriendDisabled,
    onSearchSubmit,
    onSendRequest,
    onClose,
}: AddFriendPanelProps) {
    return (
        <div className="add-friend-panel">
            <div className="add-friend-field">
                <label htmlFor="friend-search-input">搜索用户</label>
                <form className="add-friend-search-row" onSubmit={onSearchSubmit}>
                    <input
                        id="friend-search-input"
                        type="text"
                        placeholder="输入用户名或邮箱"
                        value={friendKeyword}
                        onChange={(e) => onFriendKeywordChange(e.target.value)}
                    />
                    <button type="submit" className="add-friend-search-button" disabled={searching}>
                        {searching ? '搜索中' : '搜索'}
                    </button>
                </form>
            </div>

            {addFriendHint && <div className="add-friend-hint">{addFriendHint}</div>}

            <div className="add-friend-result-list">
                {searchResults.map((user) => (
                    <div key={user.user_id} className="add-friend-result-item">
                        <div className="add-friend-user-info">
                            <img className="add-friend-user-avatar" src={resolvedUserAvatar(user.avatar)} alt="avatar" />
                            <div className="add-friend-user-text">
                                <span className="add-friend-user-name">{user.username}</span>
                                <span className="add-friend-user-email">{user.email || '邮箱未公开'}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className={`add-friend-action-button ${isAddFriendDisabled(user) ? 'is-disabled' : ''}`}
                            onClick={() => void onSendRequest(user.user_id)}
                            disabled={isAddFriendDisabled(user)}
                        >
                            {getAddFriendButtonText(user)}
                        </button>
                    </div>
                ))}
            </div>

            <div className="create-group-actions">
                <button
                    type="button"
                    className="create-group-secondary-button"
                    onClick={() => {
                        onClose();
                    }}
                >
                    关闭
                </button>
            </div>
        </div>
    );
}
