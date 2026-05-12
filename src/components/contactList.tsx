import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';

import AddFriendPanel from './contactList/AddFriendPanel';
import CreateGroupPanel from './contactList/CreateGroupPanel';
import FriendRequestsPanel from './contactList/FriendRequestsPanel';
import SearchGroupPanel from './contactList/SearchGroupPanel';
import { DEFAULT_AVATAR } from '../constants/string';
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
} from '../services/friend';
import { type User, type Group } from '../types/entity';
import { resolvedUserAvatar } from '../utils/avatar';

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
    readonly pendingFriendRequestCount?: number;
    readonly onClearFriendRequests?: () => void;
}

export default function ContactList(props: Readonly<ContactsProps>) {
    const { friends, groups, currentUserId, onItemClick, onCreateGroup, onContactsChanged, pendingFriendRequestCount, onClearFriendRequests } = props;
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

    // 好友分组处理逻辑
    const taggedFriends = useMemo(() => {
        const map = new Map<string, User[]>();
        const untagged: User[] = [];

        for (const f of filteredFriends) {
            const tag = f.tag?.trim();
            if (tag) {
                const list = map.get(tag) || [];
                list.push(f);
                map.set(tag, list);
            } else {
                untagged.push(f);
            }
        }

        const result: { tag: string; users: User[] }[] = [];
        if (untagged.length > 0) result.push({ tag: '未分组', users: untagged });
        for (const [tag, users] of map) result.push({ tag, users });
        return result;
    }, [filteredFriends]);

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

    const handleFriendSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
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
                        {(pendingFriendRequestCount ?? 0) > 0 && (
                            <span className="unread-badge">
                                {(pendingFriendRequestCount ?? 0) > 99 ? '99+' : pendingFriendRequestCount}
                            </span>
                        )}
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
                                    onClearFriendRequests?.();
                                }}
                            >
                                好友请求
                                {(pendingFriendRequestCount ?? 0) > 0 && (
                                    <span className="unread-badge-inline">
                                        {(pendingFriendRequestCount ?? 0) > 99 ? '99+' : pendingFriendRequestCount}
                                    </span>
                                )}
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
                <CreateGroupPanel
                    filteredFriends={filteredFriends}
                    groupName={groupName}
                    onGroupNameChange={setGroupName}
                    selectedMemberIds={selectedMemberIds}
                    onToggleMember={toggleMember}
                    groupAvatarPreview={groupAvatarPreview}
                    groupAvatarDataUrl={groupAvatarDataUrl}
                    onAvatarPicked={(dataUrl) => {
                        setGroupAvatarPreview(dataUrl);
                        setGroupAvatarDataUrl(dataUrl);
                    }}
                    onAvatarClear={() => {
                        setGroupAvatarPreview(DEFAULT_AVATAR);
                        setGroupAvatarDataUrl(null);
                    }}
                    isSubmitting={isCreateGroupSubmitting}
                    onSubmit={handleCreateGroup}
                    onCancel={() => {
                        setGroupAvatarPreview(DEFAULT_AVATAR);
                        setGroupAvatarDataUrl(null);
                        setIsCreateGroupOpen(false);
                    }}
                />
            )}

            {isAddFriendOpen && (
                <AddFriendPanel
                    friendKeyword={friendKeyword}
                    onFriendKeywordChange={setFriendKeyword}
                    searching={searching}
                    addFriendHint={addFriendHint}
                    searchResults={searchResults}
                    getAddFriendButtonText={getAddFriendButtonText}
                    isAddFriendDisabled={isAddFriendDisabled}
                    onSearchSubmit={handleFriendSearchSubmit}
                    onSendRequest={handleSendFriendRequest}
                    onClose={() => {
                        setIsAddFriendOpen(false);
                        setAddFriendHint('');
                    }}
                />
            )}

            {isSearchGroupOpen && (
                <SearchGroupPanel
                    groupKeyword={groupKeyword}
                    onGroupKeywordChange={setGroupKeyword}
                    groupHint={groupHint}
                    groupSearchResults={groupSearchResults}
                    onSearchSubmit={(event) => {
                        event.preventDefault();
                        handleSearchGroup();
                    }}
                    onEnterGroup={(group) => {
                        onItemClick(group, 'group');
                        setIsSearchGroupOpen(false);
                    }}
                    onClose={() => {
                        setIsSearchGroupOpen(false);
                        setGroupHint('');
                    }}
                />
            )}

            {isFriendRequestsOpen && (
                <FriendRequestsPanel
                    requestHint={requestHint}
                    requestLoading={requestLoading}
                    receivedRequests={receivedRequests}
                    requestActionId={requestActionId}
                    onAccept={handleAcceptRequest}
                    onReject={handleRejectRequest}
                    onClose={() => setIsFriendRequestsOpen(false)}
                />
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
                            {taggedFriends.map(section => (
                                <div key={section.tag} className="friend-tag-group">
                                    <div className="friend-tag-group-header">{section.tag} ({section.users.length})</div>
                                    {section.users.map(user => (
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