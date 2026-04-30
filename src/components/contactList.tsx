import { useEffect, useRef, useState, type ReactNode } from 'react'

import { type User, type Group } from '../types/entity'
import {
    acceptFriendRequest,
    getReceivedFriendRequests,
    rejectFriendRequest,
    searchUsersByEmail,
    searchUsers,
    sendFriendRequest,
    type ReceivedFriendRequestData,
    type UserSearchData,
} from '../services/friend'
import { DEFAULT_AVATAR } from '../constants/string'

import '../styles/contactList.css'

interface CreateGroupFormValues {
    groupName: string;
    memberIds: number[];
}

interface ContactsProps{
    readonly friends: User[];
    readonly groups: Group[];
    readonly currentUserId: number;
    readonly onItemClick: (item: User | Group, type: 'user' | 'group') => void;
    readonly onCreateGroup: (values: CreateGroupFormValues) => Promise<void> | void;
    readonly onContactsChanged?: () => Promise<void> | void;
}

export default function ContactList(props: Readonly<ContactsProps>) {
    const { friends, groups, currentUserId, onItemClick, onCreateGroup, onContactsChanged } = props;
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isActionMenuOpen, setIsActionMenuOpen] = useState<boolean>(false);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState<boolean>(false);
    const [isAddFriendOpen, setIsAddFriendOpen] = useState<boolean>(false);
    const [isFriendRequestsOpen, setIsFriendRequestsOpen] = useState<boolean>(false);
    const [friendKeyword, setFriendKeyword] = useState<string>('');
    const [searchResults, setSearchResults] = useState<UserSearchData[]>([]);
    const [searching, setSearching] = useState<boolean>(false);
    const [sendingFriendId, setSendingFriendId] = useState<number | null>(null);
    const [addFriendHint, setAddFriendHint] = useState<string>('');
    const [requestHint, setRequestHint] = useState<string>('');
    const [sentRequestKeys, setSentRequestKeys] = useState<string[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<ReceivedFriendRequestData[]>([]);
    const [requestLoading, setRequestLoading] = useState<boolean>(false);
    const [requestActionId, setRequestActionId] = useState<number | null>(null);
    const [groupName, setGroupName] = useState<string>('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
    const actionMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            if (!actionMenuRef.current) {
                return;
            }

            if (!actionMenuRef.current.contains(event.target as Node)) {
                setIsActionMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentClick);

        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
        };
    }, []);

    useEffect(() => {
        if (!isFriendRequestsOpen) {
            return;
        }

        let cancelled = false;

        const loadRequests = async () => {
            setRequestLoading(true);

            try {
                const requests = await getReceivedFriendRequests();
                if (!cancelled) {
                    setReceivedRequests(requests);
                }
            } catch (error) {
                if (!cancelled) {
                    setRequestHint(error instanceof Error ? error.message : '获取好友请求失败');
                }
            } finally {
                if (!cancelled) {
                    setRequestLoading(false);
                }
            }
        };

        void loadRequests();

        return () => {
            cancelled = true;
        };
    }, [isFriendRequestsOpen]);

    const filteredFriends = friends.filter(f =>
        f.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredGroups = groups.filter(g =>
        g.groupname.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleMember = (memberId: number) => {
        setSelectedMemberIds((currentIds) => (
            currentIds.includes(memberId)
                ? currentIds.filter((id) => id !== memberId)
                : [...currentIds, memberId]
        ));
    };

    const getUserIdentityKey = (user: UserSearchData) => {
        const normalizedEmail = user.email?.trim().toLowerCase();
        return normalizedEmail || `uid:${user.user_id}`;
    };

    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const handleSearchFriend = async () => {
        const keyword = friendKeyword.trim();
        const shouldSearchByEmail = keyword.includes('@');

        if (!keyword) {
            setAddFriendHint('请输入用户名或邮箱');
            setSearchResults([]);
            return;
        }

        if (shouldSearchByEmail && !isValidEmail(keyword)) {
            setAddFriendHint('邮箱格式不正确，请输入有效邮箱地址');
            setSearchResults([]);
            return;
        }

        setSearching(true);
        setAddFriendHint('');

        try {
            const users = shouldSearchByEmail
                ? await searchUsersByEmail(keyword)
                : await searchUsers(keyword);
            setSearchResults(users);

            if (users.length === 0) {
                setAddFriendHint('没有找到匹配的用户');
            }
        } catch (error) {
            setSearchResults([]);
            setAddFriendHint(error instanceof Error ? error.message : '搜索用户失败');
        } finally {
            setSearching(false);
        }
    };

    const handleSendFriendRequest = async (targetUserId: number, targetUserKey: string) => {
        setSendingFriendId(targetUserId);
        setAddFriendHint('');

        try {
            await sendFriendRequest(targetUserId);
            setSentRequestKeys((current) => (current.includes(targetUserKey) ? current : [...current, targetUserKey]));
            setAddFriendHint('好友请求已发送');
            await onContactsChanged?.();
        } catch (error) {
            setAddFriendHint(error instanceof Error ? error.message : '发送好友请求失败');
        } finally {
            setSendingFriendId(null);
        }
    };

    const handleAcceptRequest = async (requestId: number) => {
        setRequestActionId(requestId);
        setRequestHint('');

        try {
            await acceptFriendRequest(requestId);
            setReceivedRequests((current) => current.filter((request) => request.request_id !== requestId));
            setRequestHint('已接受好友请求');
            await onContactsChanged?.();
        } catch (error) {
            setRequestHint(error instanceof Error ? error.message : '接受好友请求失败');
        } finally {
            setRequestActionId(null);
        }
    };

    const handleRejectRequest = async (requestId: number) => {
        setRequestActionId(requestId);
        setRequestHint('');

        try {
            await rejectFriendRequest(requestId);
            setReceivedRequests((current) => current.filter((request) => request.request_id !== requestId));
            setRequestHint('已拒绝好友请求');
            await onContactsChanged?.();
        } catch (error) {
            setRequestHint(error instanceof Error ? error.message : '拒绝好友请求失败');
        } finally {
            setRequestActionId(null);
        }
    };

    const friendIdSet = new Set(friends.map((friend) => friend.id));

    const getAddFriendButtonText = (user: UserSearchData) => {
        const userId = user.user_id;
        const userKey = getUserIdentityKey(user);

        if (userId === currentUserId) {
            return '自己';
        }

        if (friendIdSet.has(userId)) {
            return '已是好友';
        }

        if (sentRequestKeys.includes(userKey)) {
            return '已发送';
        }

        return sendingFriendId === userId ? '发送中' : '加好友';
    };

    const isAddFriendDisabled = (user: UserSearchData) => {
        const userId = user.user_id;
        const userKey = getUserIdentityKey(user);
        return sendingFriendId === userId || userId === currentUserId || friendIdSet.has(userId) || sentRequestKeys.includes(userKey);
    };

    let friendRequestContent: ReactNode;

    if (requestLoading) {
        friendRequestContent = <div className='friend-request-empty'>加载中...</div>;
    } else if (receivedRequests.length === 0) {
        friendRequestContent = <div className='friend-request-empty'>暂无待处理请求</div>;
    } else {
        friendRequestContent = (
            <>
                {receivedRequests.map((request) => (
                    <div key={request.request_id} className='friend-request-item'>
                        <div className='friend-request-meta'>
                            <span className='friend-request-name'>{request.from_user.username}</span>
                            <span className='friend-request-time'>{new Date(request.created_at).toLocaleString()}</span>
                        </div>
                        <div className='friend-request-actions'>
                            <button
                                type='button'
                                className='friend-request-accept-button'
                                onClick={() => void handleAcceptRequest(request.request_id)}
                                disabled={requestActionId === request.request_id}
                            >
                                {requestActionId === request.request_id ? '处理中' : '接受'}
                            </button>
                            <button
                                type='button'
                                className='friend-request-reject-button'
                                onClick={() => void handleRejectRequest(request.request_id)}
                                disabled={requestActionId === request.request_id}
                            >
                                拒绝
                            </button>
                        </div>
                    </div>
                ))}
            </>
        );
    }

    const handleCreateGroup = async () => {
        const trimmedGroupName = groupName.trim();

        if (!trimmedGroupName) {
            globalThis.alert('请输入群聊名称');
            return;
        }

        if (selectedMemberIds.length === 0) {
            globalThis.alert('请至少选择一位好友');
            return;
        }

        await onCreateGroup({
            groupName: trimmedGroupName,
            memberIds: selectedMemberIds,
        });

        setGroupName('');
        setSelectedMemberIds([]);
        setIsCreateGroupOpen(false);
    };

    const handleFriendSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void handleSearchFriend();
    };

    return (
        <div className='contact-list'>
            <div className='contacts-header'>
                <div className='search-action-row' ref={actionMenuRef}>
                    <div className='search-container'>
                        <input
                            type='text'
                            placeholder='搜索联系人或群聊'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        type='button'
                        className='action-toggle-button'
                        aria-label='打开更多操作'
                        onClick={() => setIsActionMenuOpen((current) => !current)}
                    >
                        +
                    </button>

                    {isActionMenuOpen && (
                        <div className='action-menu'>
                            <button
                                type='button'
                                className='action-menu-item'
                                onClick={() => {
                                    setIsActionMenuOpen(false);
                                    setIsAddFriendOpen(true);
                                    setIsFriendRequestsOpen(false);
                                    setRequestHint('');
                                }}
                            >
                                    添加好友
                            </button>
                            <button
                                type='button'
                                className='action-menu-item'
                                onClick={() => {
                                    setIsActionMenuOpen(false);
                                    setIsFriendRequestsOpen(true);
                                    setIsAddFriendOpen(false);
                                    setAddFriendHint('');
                                }}
                            >
                                好友请求
                            </button>
                            <button
                                type='button'
                                className='action-menu-item'
                                onClick={() => {
                                    setIsActionMenuOpen(false);
                                    setIsCreateGroupOpen(true);
                                }}
                            >
                                新建群聊
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isCreateGroupOpen && (
                <div className='create-group-panel'>
                    <div className='create-group-field'>
                        <label htmlFor='group-name-input'>群聊名称</label>
                        <input
                            id='group-name-input'
                            type='text'
                            placeholder='输入群聊名称'
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                    </div>
                    <div className='create-group-field'>
                        <div className='create-group-label-row'>
                            <span className='create-group-member-list-label'>选择好友</span>
                            <span>{selectedMemberIds.length} 人已选</span>
                        </div>
                        <div className='create-group-member-list'>
                            {filteredFriends.map((friend) => (
                                <label key={friend.id} className='create-group-member-item'>
                                    <input
                                        type='checkbox'
                                        checked={selectedMemberIds.includes(friend.id)}
                                        onChange={() => toggleMember(friend.id)}
                                    />
                                    <span>{friend.username}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className='create-group-actions'>
                        <button type='button' className='create-group-secondary-button' onClick={() => setIsCreateGroupOpen(false)}>
                            取消
                        </button>
                        <button type='button' className='create-group-primary-button' onClick={() => void handleCreateGroup()}>
                            创建群聊
                        </button>
                    </div>
                </div>
            )}

            {isAddFriendOpen && (
                <div className='add-friend-panel'>
                    <div className='add-friend-field'>
                        <label htmlFor='friend-search-input'>搜索用户</label>
                        <form className='add-friend-search-row' onSubmit={handleFriendSearchSubmit}>
                            <input
                                id='friend-search-input'
                                type='text'
                                placeholder='输入用户名或邮箱'
                                value={friendKeyword}
                                onChange={(e) => setFriendKeyword(e.target.value)}
                            />
                            <button type='submit' className='add-friend-search-button' disabled={searching}>
                                {searching ? '搜索中' : '搜索'}
                            </button>
                        </form>
                    </div>

                    {addFriendHint && <div className='add-friend-hint'>{addFriendHint}</div>}

                    <div className='add-friend-result-list'>
                        {searchResults.map((user) => (
                            <div key={user.user_id} className='add-friend-result-item'>
                                <div className='add-friend-user-info'>
                                    <img className='add-friend-user-avatar' src={user.avatar || DEFAULT_AVATAR} alt='avatar' />
                                    <div className='add-friend-user-text'>
                                    <span className='add-friend-user-name'>{user.username}</span>
                                        <span className='add-friend-user-email'>{user.email || '邮箱未公开'}</span>
                                    </div>
                                </div>
                                <button
                                    type='button'
                                    className={`add-friend-action-button ${isAddFriendDisabled(user) ? 'is-disabled' : ''}`}
                                    onClick={() => void handleSendFriendRequest(user.user_id, getUserIdentityKey(user))}
                                    disabled={isAddFriendDisabled(user)}
                                >
                                    {getAddFriendButtonText(user)}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className='create-group-actions'>
                        <button type='button' className='create-group-secondary-button' onClick={() => {
                            setIsAddFriendOpen(false);
                            setAddFriendHint('');
                        }}>
                            关闭
                        </button>
                    </div>
                </div>
            )}

            {isFriendRequestsOpen && (
                <div className='friend-request-panel'>
                    <div className='friend-request-header'>
                        <div>
                            <div className='friend-request-title'>好友请求</div>
                            <div className='friend-request-subtitle'>处理其他人发来的好友申请</div>
                        </div>
                        <button type='button' className='friend-request-close-button' onClick={() => setIsFriendRequestsOpen(false)}>
                            关闭
                        </button>
                    </div>

                    {requestHint && <div className='friend-request-hint'>{requestHint}</div>}

                    <div className='friend-request-list'>
                        {friendRequestContent}
                    </div>
                </div>
            )}

            {/* 好友部分 */}
            <div className='section-container'>
                <div className='section-title'>联系人 ({filteredFriends.length})</div>
                <div className='list-render-area'>
                    {filteredFriends.map(user => (
                        <button key={user.id} type='button' className='contact-item contact-button' onClick={() => onItemClick(user, 'user')}>
                            <div className='item-avatar'>
                                <img src={user.avatar} alt="avatar" />
                                <span className={`status-badge ${user.status}`} />
                            </div>
                            <div className='item-info'>
                                <span className="item-name">{user.username}</span>
                                <span className={`item-meta status-${user.status}`}>
                                    {user.status === 'online' ? '在线' : '离线'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className='section-container'>
                <div className='section-title'>群聊 ({filteredGroups.length})</div>
                <div className='list-render-area'>
                    {filteredGroups.map(group => (
                        <button key={group.id} type='button' className='contact-item contact-button' onClick={() => onItemClick(group, 'group')}>
                            <div className='item-avatar'>
                                <img src={group.avatar} alt="avatar" />
                            </div>
                            <div className='item-info'>
                                <span className="item-name">{group.groupname}</span>
                                <span className="item-meta">{group.memberCount} 人</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}