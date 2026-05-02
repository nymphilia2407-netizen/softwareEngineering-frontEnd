import { useEffect, useRef, useState, type ReactNode } from 'react'

import { type User, type Group } from '../types/entity'
import {
    acceptFriendRequest,
    getReceivedFriendRequests,
    getSentFriendRequests,
    rejectFriendRequest,
    searchUsersByEmail,
    searchUsers,
    sendFriendRequest,
    type ReceivedFriendRequestData,
    type UserSearchData,
} from '../services/friend'
import { DEFAULT_AVATAR } from '../constants/string'
import { readAvatarFileAsDataUrl } from '../utils/avatarFile'
import { resolvedUserAvatar } from '../utils/avatarDisplay'

import '../styles/contactList.css'

interface CreateGroupFormValues {
    groupName: string;
    memberIds: number[];
    /** 可选：自定义群头像 data URL */
    avatar?: string;
    /** 单次打开新建群聊弹窗内固定，用于后端幂等与前端防重复提交 */
    clientRequestId: string;
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
    const [isSearchGroupOpen, setIsSearchGroupOpen] = useState<boolean>(false);
    const [isFriendRequestsOpen, setIsFriendRequestsOpen] = useState<boolean>(false);
    const [friendKeyword, setFriendKeyword] = useState<string>('');
    const [searchResults, setSearchResults] = useState<UserSearchData[]>([]);
    const [searching, setSearching] = useState<boolean>(false);
    const [sendingFriendId, setSendingFriendId] = useState<number | null>(null);
    const [addFriendHint, setAddFriendHint] = useState<string>('');
    const [groupKeyword, setGroupKeyword] = useState<string>('');
    const [groupSearchResults, setGroupSearchResults] = useState<Group[]>([]);
    const [groupHint, setGroupHint] = useState<string>('');
    const [requestHint, setRequestHint] = useState<string>('');
    /** 已向这些 user_id 发出过 pending 申请（与后端 /api/friends/requests/sent/ 同步） */
    const [sentPendingToIds, setSentPendingToIds] = useState<number[]>([]);
    /** 对方向我发起的 pending 申请中的 from_user_id（避免重复再点「加好友」） */
    const [incomingRequestFromIds, setIncomingRequestFromIds] = useState<number[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<ReceivedFriendRequestData[]>([]);
    const [requestLoading, setRequestLoading] = useState<boolean>(false);
    const [requestActionId, setRequestActionId] = useState<number | null>(null);
    const [groupName, setGroupName] = useState<string>('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
    const [groupAvatarPreview, setGroupAvatarPreview] = useState<string>(DEFAULT_AVATAR);
    const [groupAvatarDataUrl, setGroupAvatarDataUrl] = useState<string | null>(null);
    const [isCreateGroupSubmitting, setIsCreateGroupSubmitting] = useState<boolean>(false);
    /** 刚进入页面时列表折叠，点击标题栏展开 */
    const [friendsExpanded, setFriendsExpanded] = useState<boolean>(false);
    const [groupsExpanded, setGroupsExpanded] = useState<boolean>(false);
    const actionMenuRef = useRef<HTMLDivElement | null>(null);
    /** 每次打开「新建群聊」弹窗生成一次，关闭弹窗后下次打开会换新 */
    const createGroupClientRequestIdRef = useRef<string>('');
    const createGroupInFlightRef = useRef<boolean>(false);

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
        if (!isCreateGroupOpen) {
            return;
        }

        createGroupClientRequestIdRef.current =
            typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
                ? globalThis.crypto.randomUUID()
                : `cg_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }, [isCreateGroupOpen]);

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

    useEffect(() => {
        if (!isAddFriendOpen) {
            return;
        }

        let cancelled = false;

        const loadSentPending = async () => {
            try {
                const [sent, received] = await Promise.all([getSentFriendRequests(), getReceivedFriendRequests()]);
                if (!cancelled) {
                    setSentPendingToIds(sent.map((row) => row.to_user.user_id));
                    setIncomingRequestFromIds(received.map((row) => row.from_user.user_id));
                }
            } catch {
                if (!cancelled) {
                    setSentPendingToIds([]);
                    setIncomingRequestFromIds([]);
                }
            }
        };

        void loadSentPending();

        return () => {
            cancelled = true;
        };
    }, [isAddFriendOpen]);

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
            const existingFriendIds = new Set(friends.map((f) => f.id));
            const visible = users.filter(
                (u) => u.user_id !== currentUserId && !existingFriendIds.has(u.user_id),
            );
            setSearchResults(visible);

            if (visible.length === 0) {
                setAddFriendHint(
                    users.length === 0 ? '没有找到匹配的用户' : '没有可添加的用户（已隐藏本人与已是好友的用户）',
                );
            }
        } catch (error) {
            setSearchResults([]);
            setAddFriendHint(error instanceof Error ? error.message : '搜索用户失败');
        } finally {
            setSearching(false);
        }
    };

    const handleSendFriendRequest = async (targetUserId: number) => {
        setSendingFriendId(targetUserId);
        setAddFriendHint('');

        try {
            await sendFriendRequest(targetUserId);
            setSentPendingToIds((current) => [...new Set([...current, targetUserId])]);
            setAddFriendHint('好友请求已发送');
            await onContactsChanged?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : '发送好友请求失败';
            setAddFriendHint(message);
            if (message.includes('请求已存在')) {
                try {
                    const sent = await getSentFriendRequests();
                    setSentPendingToIds(sent.map((row) => row.to_user.user_id));
                } catch {
                    setSentPendingToIds((current) => [...new Set([...current, targetUserId])]);
                }
            }
        } finally {
            setSendingFriendId(null);
        }
    };

    const handleSearchGroup = () => {
        const keyword = groupKeyword.trim().toLowerCase();

        if (!keyword) {
            setGroupHint('请输入群聊名称或群聊ID');
            setGroupSearchResults([]);
            return;
        }

        const matchedGroups = groups.filter((group) => (
            group.groupname.toLowerCase().includes(keyword) ||
            String(group.id).includes(keyword)
        ));

        setGroupSearchResults(matchedGroups);
        setGroupHint(matchedGroups.length === 0 ? '没有找到匹配的群聊' : '');
    };

    const refreshSentAndIncomingIds = async () => {
        try {
            const [sent, received] = await Promise.all([getSentFriendRequests(), getReceivedFriendRequests()]);
            setSentPendingToIds(sent.map((row) => row.to_user.user_id));
            setIncomingRequestFromIds(received.map((row) => row.from_user.user_id));
        } catch {
            /* 列表页仍可用，忽略同步失败 */
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
            await refreshSentAndIncomingIds();
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
            await refreshSentAndIncomingIds();
        } catch (error) {
            setRequestHint(error instanceof Error ? error.message : '拒绝好友请求失败');
        } finally {
            setRequestActionId(null);
        }
    };

    const friendIdSet = new Set(friends.map((friend) => friend.id));
    const sentPendingSet = new Set(sentPendingToIds);
    const incomingFromSet = new Set(incomingRequestFromIds);

    const getAddFriendButtonText = (user: UserSearchData) => {
        const userId = user.user_id;

        if (userId === currentUserId) {
            return '自己';
        }

        if (friendIdSet.has(userId)) {
            return '已是好友';
        }

        if (incomingFromSet.has(userId)) {
            return '对方已申请';
        }

        if (sentPendingSet.has(userId)) {
            return '已发送';
        }

        return sendingFriendId === userId ? '发送中' : '加好友';
    };

    const isAddFriendDisabled = (user: UserSearchData) => {
        const userId = user.user_id;
        return (
            sendingFriendId === userId ||
            userId === currentUserId ||
            friendIdSet.has(userId) ||
            sentPendingSet.has(userId) ||
            incomingFromSet.has(userId)
        );
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
        if (createGroupInFlightRef.current) {
            return;
        }

        const trimmedGroupName = groupName.trim();

        if (!trimmedGroupName) {
            globalThis.alert('请输入群聊名称');
            return;
        }

        if (selectedMemberIds.length === 0) {
            globalThis.alert('请至少选择一位好友');
            return;
        }

        const clientRequestId = createGroupClientRequestIdRef.current;
        if (!clientRequestId) {
            globalThis.alert('请关闭弹窗后重试');
            return;
        }

        createGroupInFlightRef.current = true;
        setIsCreateGroupSubmitting(true);

        try {
            await onCreateGroup({
                groupName: trimmedGroupName,
                memberIds: selectedMemberIds,
                clientRequestId,
                ...(groupAvatarDataUrl ? { avatar: groupAvatarDataUrl } : {}),
            });

            setGroupName('');
            setSelectedMemberIds([]);
            setGroupAvatarPreview(DEFAULT_AVATAR);
            setGroupAvatarDataUrl(null);
            setIsCreateGroupOpen(false);
        } finally {
            createGroupInFlightRef.current = false;
            setIsCreateGroupSubmitting(false);
        }
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
                                    setIsSearchGroupOpen(false);
                                    setIsFriendRequestsOpen(false);
                                    setRequestHint('');
                                    setAddFriendHint('');
                                    setSearchResults([]);
                                }}
                            >
                                    添加好友
                            </button>
                            <button
                                type='button'
                                className='action-menu-item'
                                onClick={() => {
                                    setIsActionMenuOpen(false);
                                    setIsSearchGroupOpen(true);
                                    setIsAddFriendOpen(false);
                                    setIsFriendRequestsOpen(false);
                                    setAddFriendHint('');
                                    setRequestHint('');
                                }}
                            >
                                    添加群聊
                            </button>
                            <button
                                type='button'
                                className='action-menu-item'
                                onClick={() => {
                                    setIsActionMenuOpen(false);
                                    setIsFriendRequestsOpen(true);
                                    setIsAddFriendOpen(false);
                                    setIsSearchGroupOpen(false);
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
                                    setGroupAvatarPreview(DEFAULT_AVATAR);
                                    setGroupAvatarDataUrl(null);
                                    setIsCreateGroupOpen(true);
                                    setIsSearchGroupOpen(false);
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
                        <span className='create-group-member-list-label'>群头像（可选）</span>
                        <div className='create-group-avatar-row'>
                            <img className='create-group-avatar-preview' src={groupAvatarPreview} alt="" />
                            <div className='create-group-avatar-actions'>
                                <label className='create-group-avatar-upload'>
                                    选择图片
                                    <input
                                        type='file'
                                        accept='image/*'
                                        className='create-group-avatar-file'
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) {
                                                return;
                                            }
                                            void (async () => {
                                                try {
                                                    const dataUrl = await readAvatarFileAsDataUrl(file);
                                                    setGroupAvatarPreview(dataUrl);
                                                    setGroupAvatarDataUrl(dataUrl);
                                                } catch (err) {
                                                    alert(err instanceof Error ? err.message : '选择图片失败');
                                                } finally {
                                                    e.target.value = '';
                                                }
                                            })();
                                        }}
                                    />
                                </label>
                                {groupAvatarDataUrl && (
                                    <button
                                        type='button'
                                        className='create-group-avatar-clear'
                                        onClick={() => {
                                            setGroupAvatarPreview(DEFAULT_AVATAR);
                                            setGroupAvatarDataUrl(null);
                                        }}
                                    >
                                        使用默认
                                    </button>
                                )}
                            </div>
                        </div>
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
                        <button
                            type='button'
                            className='create-group-secondary-button'
                            onClick={() => {
                                setGroupAvatarPreview(DEFAULT_AVATAR);
                                setGroupAvatarDataUrl(null);
                                setIsCreateGroupOpen(false);
                            }}
                        >
                            取消
                        </button>
                        <button
                            type='button'
                            className='create-group-primary-button'
                            onClick={() => void handleCreateGroup()}
                            disabled={isCreateGroupSubmitting}
                        >
                            {isCreateGroupSubmitting ? '创建中…' : '创建群聊'}
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
                                    <img className='add-friend-user-avatar' src={resolvedUserAvatar(user.avatar)} alt='avatar' />
                                    <div className='add-friend-user-text'>
                                    <span className='add-friend-user-name'>{user.username}</span>
                                        <span className='add-friend-user-email'>{user.email || '邮箱未公开'}</span>
                                    </div>
                                </div>
                                <button
                                    type='button'
                                    className={`add-friend-action-button ${isAddFriendDisabled(user) ? 'is-disabled' : ''}`}
                                    onClick={() => void handleSendFriendRequest(user.user_id)}
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

            {isSearchGroupOpen && (
                <div className='add-friend-panel'>
                    <div className='add-friend-field'>
                        <label htmlFor='group-search-input'>搜索群聊</label>
                        <form
                            className='add-friend-search-row'
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleSearchGroup();
                            }}
                        >
                            <input
                                id='group-search-input'
                                type='text'
                                placeholder='输入群聊名称或群聊ID'
                                value={groupKeyword}
                                onChange={(e) => setGroupKeyword(e.target.value)}
                            />
                            <button type='submit' className='add-friend-search-button'>
                                搜索
                            </button>
                        </form>
                    </div>

                    {groupHint && <div className='add-friend-hint'>{groupHint}</div>}

                    <div className='add-friend-result-list'>
                        {groupSearchResults.map((group) => (
                            <div key={group.id} className='add-friend-result-item'>
                                <div className='add-friend-user-info'>
                                    <img className='add-friend-user-avatar' src={resolvedUserAvatar(group.avatar)} alt='group-avatar' />
                                    <div className='add-friend-user-text'>
                                        <span className='add-friend-user-name'>{group.groupname}</span>
                                        <span className='add-friend-user-email'>群聊ID: {group.id}</span>
                                    </div>
                                </div>
                                <button
                                    type='button'
                                    className='add-friend-action-button'
                                    onClick={() => {
                                        onItemClick(group, 'group');
                                        setIsSearchGroupOpen(false);
                                    }}
                                >
                                    进入
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className='create-group-actions'>
                        <button type='button' className='create-group-secondary-button' onClick={() => {
                            setIsSearchGroupOpen(false);
                            setGroupHint('');
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

            {/* 联系人 + 群聊：同一滚动区顺序排列，群聊紧跟在联系人列表下方 */}
            <div className='contact-sections-scroll'>
                <div className={`section-container section-friends${friendsExpanded ? ' is-expanded' : ' is-collapsed'}`}>
                    <button
                        type='button'
                        className='section-header-toggle'
                        aria-expanded={friendsExpanded}
                        aria-controls='contact-list-friends'
                        id='contact-section-friends-heading'
                        onClick={() => setFriendsExpanded((v) => !v)}
                    >
                        <span className='section-header-label'>联系人 ({filteredFriends.length})</span>
                        <span className='section-header-chevron' aria-hidden>
                            {friendsExpanded ? '▼' : '▶'}
                        </span>
                    </button>
                    {friendsExpanded && (
                        <div id='contact-list-friends' className='list-render-area' role='region' aria-labelledby='contact-section-friends-heading'>
                            {filteredFriends.map((user) => (
                                <button key={user.id} type='button' className='contact-item contact-button' onClick={() => onItemClick(user, 'user')}>
                                    <div className='item-avatar'>
                                        <img
                                            src={resolvedUserAvatar(user.avatar)}
                                            alt=''
                                            onError={(e) => {
                                                const img = e.currentTarget;
                                                img.onerror = null;
                                                img.src = DEFAULT_AVATAR;
                                            }}
                                        />
                                        <span className={`status-badge ${user.status}`} />
                                    </div>
                                    <div className='item-info'>
                                        <span className='item-name'>{user.username}</span>
                                        <span className={`item-meta status-${user.status}`}>
                                            {user.status === 'online' ? '在线' : '离线'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`section-container section-groups${groupsExpanded ? ' is-expanded' : ' is-collapsed'}`}>
                    <button
                        type='button'
                        className='section-header-toggle'
                        aria-expanded={groupsExpanded}
                        aria-controls='contact-list-groups'
                        id='contact-section-groups-heading'
                        onClick={() => setGroupsExpanded((v) => !v)}
                    >
                        <span className='section-header-label'>群聊 ({filteredGroups.length})</span>
                        <span className='section-header-chevron' aria-hidden>
                            {groupsExpanded ? '▼' : '▶'}
                        </span>
                    </button>
                    {groupsExpanded && (
                        <div id='contact-list-groups' className='list-render-area' role='region' aria-labelledby='contact-section-groups-heading'>
                            {filteredGroups.map((group) => (
                                <button key={group.id} type='button' className='contact-item contact-button' onClick={() => onItemClick(group, 'group')}>
                                    <div className='item-avatar'>
                                        <img
                                            src={resolvedUserAvatar(group.avatar)}
                                            alt=''
                                            onError={(e) => {
                                                const img = e.currentTarget;
                                                img.onerror = null;
                                                img.src = DEFAULT_AVATAR;
                                            }}
                                        />
                                    </div>
                                    <div className='item-info'>
                                        <span className='item-name'>{group.groupname}</span>
                                        <span className='item-meta'>{group.memberCount} 人</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}