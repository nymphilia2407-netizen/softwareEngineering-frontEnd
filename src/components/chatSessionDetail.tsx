import { useEffect, useState, useRef } from 'react';
import { getGroupDetail, dissolveGroup, leaveGroup, publishAnnouncement, updateMemberRole, muteMember, removeMember, inviteMembers, getGroupInvitations, processInvitation, updateAnnouncement, deleteAnnouncement } from '../services/group';
import { searchMessages } from '../services/chat';
import { getFriendDetail, deleteFriend } from '../services/friend';
import type { FriendDetail } from '../services/friend';
import type { GroupDetailData } from '../services/group';
import type { InvitationData, SearchResultData } from '../types/chat';
import type { User } from '../types/entity';

import '../styles/chatSessionDetail.css';

export interface ChatSessionDetailProps {
    roomId: number;
    isGroup: boolean;
    currentUserId: number;
    otherUserId: number | null;
    /** 当前会话是否消息免打扰（来自会话列表） */
    conversationMuted: boolean;
    onConversationMutedChange: (muted: boolean) => Promise<void>;
    conversationPinned: boolean;
    onConversationPinnedChange: (pinned: boolean) => Promise<void>;
    onBack: () => void;
    onDeleted?: () => void;
    friends?: User[];
    onNavigateToChat?: (convId: number, messageId?: number, timestamp?: string) => void;
}

export default function ChatSessionDetail({
    roomId,
    isGroup,
    currentUserId,
    otherUserId,
    onBack,
    onDeleted,
    conversationMuted,
    onConversationMutedChange,
    conversationPinned,
    onConversationPinnedChange,
    friends = [],
    onNavigateToChat,
}: ChatSessionDetailProps) {
    const [groupDetail, setGroupDetail] = useState<GroupDetailData | null>(null);
    const [friendDetail, setFriendDetail] = useState<FriendDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
    const [announcementContent, setAnnouncementContent] = useState('');
    const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
    const [muteSaving, setMuteSaving] = useState(false);
    const [pinSaving, setPinSaving] = useState(false);

    const [roleMenuOpenFor, setRoleMenuOpenFor] = useState<number | null>(null);
    const roleMenuRef = useRef<HTMLDivElement | null>(null); // 点击其它位置的时候让菜单缩回
    const [muteMenuOpenFor, setMuteMenuOpenFor] = useState<number | null>(null);
    const muteMenuRef = useRef<HTMLDivElement | null>(null);

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteSearchText, setInviteSearchText] = useState('');
    const [selectedInviteUserIds, setSelectedInviteUserIds] = useState<Set<number>>(new Set());
    const [inviteSubmitting, setInviteSubmitting] = useState(false);
    const [pendingInvitations, setPendingInvitations] = useState<InvitationData[]>([]);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResultData[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchTotal, setSearchTotal] = useState(0);
    const [editingAnnouncementId, setEditingAnnouncementId] = useState<number | null>(null);
    const [editAnnouncementContent, setEditAnnouncementContent] = useState('');

    const currentMember = groupDetail?.members.find(m => m.user_id === currentUserId);
    const currentUserRole = currentMember?.role;

    useEffect(() => {
        setError(null);
        setGroupDetail(null);
        setFriendDetail(null);

        if (isGroup) {
            getGroupDetail(roomId)
                .then(setGroupDetail)
                .catch(err => setError(err.message || '获取群信息失败'));
        } else if (otherUserId != null) {
            getFriendDetail(otherUserId)
                .then(setFriendDetail)
                .catch(err => setError(err.message || '获取好友信息失败'));
        }
    }, [roomId, isGroup, otherUserId]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                (roleMenuRef.current && !roleMenuRef.current.contains(target)) ||
                (muteMenuRef.current && !muteMenuRef.current.contains(target))
            ) {
                setRoleMenuOpenFor(null);
                setMuteMenuOpenFor(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (!isGroup) return;
        const cpr = currentUserRole;
        if (cpr !== 'owner' && cpr !== 'admin') {
            setPendingInvitations([]);
            return;
        }
        getGroupInvitations(roomId)
            .then(setPendingInvitations)
            .catch(() => setPendingInvitations([]));
    }, [roomId, isGroup, currentUserRole]);

    const refreshGroupDetail = async () => {
        try {
            const detail = await getGroupDetail(roomId);
            setGroupDetail(detail);
        } catch {}
    };

    const handleRoleAction = async (userId: number, role: 'owner' | 'admin' | 'member', label: string) => {
        setRoleMenuOpenFor(null);
        try {
            await updateMemberRole(roomId, userId, role);
            await refreshGroupDetail();
        } catch (err) {
            alert(err instanceof Error ? err.message : `${label}失败`);
        }
    };

    const muteOptions = [
        { label: '禁言 5 分钟', value: 5 * 60 },
        { label: '禁言 30 分钟', value: 30 * 60 },
        { label: '禁言 1 小时', value: 60 * 60 },
        { label: '禁言 12 小时', value: 12 * 60 * 60 },
        { label: '禁言 1 天', value: 24 * 60 * 60 },
        { label: '解除禁言', value: null },
    ];

    const handleMute = async (userId: number, seconds: number | null) => {
        setMuteMenuOpenFor(null);
        try {
            const mutedUntil = seconds !== null
                ? new Date(Date.now() + seconds * 1000).toISOString()
                : null;
            await muteMember(roomId, userId, mutedUntil);
            await refreshGroupDetail();
        } catch (err) {
            alert(err instanceof Error ? err.message : '操作失败');
        }
    };

    const handleRemove = async (userId: number, username: string) => {
        if (!globalThis.confirm(`确认将 ${username} 移出群聊？`)) return;
        try {
            await removeMember(roomId, userId);
            await refreshGroupDetail();
        } catch (err) {
            alert(err instanceof Error ? err.message : '移除失败');
        }
    };

    const handleInviteMembers = async () => {
        if (selectedInviteUserIds.size === 0) return;
        setInviteSubmitting(true);
        try {
            await inviteMembers(roomId, [...selectedInviteUserIds]);
            alert('邀请已发送');
            setShowInviteModal(false);
            setSelectedInviteUserIds(new Set());
            setInviteSearchText('');
            await refreshGroupDetail();
        } catch (err) {
            alert(err instanceof Error ? err.message : '邀请失败');
        } finally {
            setInviteSubmitting(false);
        }
    };

    const handleProcessInvitation = async (invitationId: number, action: 'accept' | 'reject') => {
        try {
            await processInvitation(roomId, invitationId, action);
            await refreshGroupDetail();
            const updated = await getGroupInvitations(roomId);
            setPendingInvitations(updated);
        } catch (err) {
            alert(err instanceof Error ? err.message : '操作失败');
        }
    };

    const handleEditAnnouncement = async () => {
        if (!editAnnouncementContent.trim() || editingAnnouncementId == null) return;
        try {
            await updateAnnouncement(roomId, editingAnnouncementId, editAnnouncementContent.trim());
            alert('公告已修改');
            setEditingAnnouncementId(null);
            setEditAnnouncementContent('');
            await refreshGroupDetail();
        } catch (err) {
            alert(err instanceof Error ? err.message : '修改失败');
        }
    };

    const handleDeleteAnnouncement = async (announcementId: number) => {
        if (!globalThis.confirm('确认删除该公告？')) return;
        try {
            await deleteAnnouncement(roomId, announcementId);
            await refreshGroupDetail();
        } catch (err) {
            alert(err instanceof Error ? err.message : '删除失败');
        }
    };

    const handleSearch = async () => {
        const q = searchKeyword.trim();
        if (!q) return;
        setSearchLoading(true);
        try {
            const data = await searchMessages(q, 1, 50);
            setSearchResults(data.results);
            setSearchTotal(data.total);
        } catch (err) {
            alert(err instanceof Error ? err.message : '搜索失败');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleMuteToggle = async (next: boolean) => {
        setMuteSaving(true);
        try {
            await onConversationMutedChange(next);
        } catch (err) {
            alert(err instanceof Error ? err.message : '设置失败');
        } finally {
            setMuteSaving(false);
        }
    };

    const handlePinToggle = async (next: boolean) => {
        setPinSaving(true);
        try {
            await onConversationPinnedChange(next);
        } catch (err) {
            alert(err instanceof Error ? err.message : '设置失败');
        } finally {
            setPinSaving(false);
        }
    };

    const conversationPinRow = (
        <div className="chat-session-mute-card">
            <div className="chat-session-mute-text">
                <span className="chat-session-mute-title">置顶会话</span>
                <span className="chat-session-mute-hint">置顶后会话固定在列表顶部，按时间排序</span>
            </div>
            <label className="chat-session-mute-switch-label">
                <input
                    type="checkbox"
                    className="chat-session-mute-switch-input"
                    checked={conversationPinned}
                    disabled={pinSaving}
                    onChange={(e) => void handlePinToggle(e.target.checked)}
                    aria-label="置顶会话"
                />
                <span className="chat-session-mute-switch-track" aria-hidden />
            </label>
        </div>
    );

    const conversationMuteRow = (
        <div className="chat-session-mute-card">
            <div className="chat-session-mute-text">
                <span className="chat-session-mute-title">消息免打扰</span>
                <span className="chat-session-mute-hint">开启后仍接收消息，但不再增加未读数</span>
            </div>
            <label className="chat-session-mute-switch-label">
                <input
                    type="checkbox"
                    className="chat-session-mute-switch-input"
                    checked={conversationMuted}
                    disabled={muteSaving}
                    onChange={(e) => void handleMuteToggle(e.target.checked)}
                    aria-label="消息免打扰"
                />
                <span className="chat-session-mute-switch-track" aria-hidden />
            </label>
        </div>
    );
    
    return (
        <div className="chat-session-detail">
            <header className="chat-session-detail-header">
                <button type="button" className="chat-session-detail-back" onClick={onBack}>返回</button>
                <h1 className="chat-session-detail-title">会话信息</h1>
                <span className="chat-session-detail-header-spacer" aria-hidden />
            </header>
            <div className="chat-session-detail-body">
                {error && <p className="error">{error}</p>}

                {/* ===== 群聊 ===== */}
                {groupDetail && (
                    <>
                        <p className="chat-session-detail-name">{groupDetail.group_name}</p>
                        <dl className="chat-session-detail-meta">
                            <div>
                                <dt>会话类型</dt>
                                <dd>群聊</dd>
                            </div>
                            <div>
                                <dt>成员 ({groupDetail.member_count})</dt>
                                <dd>
                                    {groupDetail.members.map(m => {
                                        const isSelf = m.user_id === currentUserId;
                                        const showRoleMenu =
                                            (currentUserRole === 'owner' && !isSelf);

                                        return (
                                            <div key={m.user_id} className="member-row">
                                                <span className="member-name">
                                                    {m.username}
                                                    {m.role === 'owner' && ' (群主)'}
                                                    {m.role === 'admin' && ' (管理员)'}
                                                    {m.is_muted && m.muted_until && (
                                                        <span className="member-mute-badge">
                                                            已禁言（
                                                            {(() => {
                                                                const remaining = Math.max(0, Math.ceil((new Date(m.muted_until!).getTime() - Date.now()) / 60000));
                                                                return remaining >= 60
                                                                    ? `剩余${Math.floor(remaining / 60)}小时${remaining % 60}分钟`
                                                                    : `剩余${remaining}分钟`;
                                                            })()}
                                                            ）
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="member-actions">
                                                    {showRoleMenu && (
                                                        <div className="role-menu-wrapper"
                                                            ref={roleMenuOpenFor === m.user_id ? roleMenuRef : undefined}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="member-action-button"
                                                                onClick={() =>
                                                                    setRoleMenuOpenFor(roleMenuOpenFor === m.user_id ? null : m.user_id)
                                                                }
                                                            >
                                                                调整权限
                                                            </button>
                                                            {roleMenuOpenFor === m.user_id && (
                                                                <div className="role-menu-dropdown">
                                                                    {currentUserRole === 'owner' && (
                                                                        <button
                                                                            type="button"
                                                                            className="role-menu-item"
                                                                            onClick={() => handleRoleAction(m.user_id, 'owner', '转让')}
                                                                        >
                                                                            转让群主
                                                                        </button>
                                                                    )}
                                                                    {currentUserRole === 'owner' && m.role === 'member' && (
                                                                        <button
                                                                            type="button"
                                                                            className="role-menu-item"
                                                                            onClick={() => handleRoleAction(m.user_id, 'admin', '设置')}
                                                                        >
                                                                            设为管理员
                                                                        </button>
                                                                    )}
                                                                    {m.role === 'admin' && (
                                                                        <button
                                                                            type="button"
                                                                            className="role-menu-item"
                                                                            onClick={() => handleRoleAction(m.user_id, 'member', '取消')}
                                                                        >
                                                                            取消管理员
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {(currentUserRole === 'owner' || currentUserRole === 'admin') &&
                                                        m.role !== 'owner' &&
                                                        !(currentUserRole === 'admin' && m.role === 'admin') && (
                                                            <button
                                                                type="button"
                                                                className="member-action-button member-action-button--danger"
                                                                onClick={() => handleRemove(m.user_id, m.username)}
                                                            >
                                                                移出
                                                            </button>
                                                        )}

                                                    {(currentUserRole === 'owner' || currentUserRole === 'admin') &&
                                                        m.role !== 'owner' &&
                                                        !(currentUserRole === 'admin' && m.role === 'admin') && (
                                                            <div className="role-menu-wrapper">
                                                                <button
                                                                    type="button"
                                                                    className="member-action-button"
                                                                    onClick={() => setMuteMenuOpenFor(muteMenuOpenFor === m.user_id ? null : m.user_id)}
                                                                >
                                                                    禁言
                                                                </button>
                                                                {muteMenuOpenFor === m.user_id && (
                                                                    <div
                                                                        className="role-menu-dropdown"
                                                                        ref={muteMenuOpenFor === m.user_id ? muteMenuRef : undefined}
                                                                    >
                                                                        {muteOptions.map(opt => (
                                                                            <button
                                                                                key={opt.label}
                                                                                type="button"
                                                                                className="role-menu-item"
                                                                                onClick={() => handleMute(m.user_id, opt.value)}
                                                                            >
                                                                                {opt.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </dd>
                            </div>
                            {groupDetail.announcements.length > 0 && (
                                <div>
                                    <dt>公告 ({groupDetail.announcements.length})</dt>
                                    <dd>
                                        <div className="announcement-list">
                                            {groupDetail.announcements.map((a) => (
                                                <div key={a.id} className="announcement-item">
                                                    <div className="announcement-item-header">
                                                        <span className="announcement-item-author">{a.author_name}</span>
                                                        <span className="announcement-item-time">
                                                            {new Date(a.created_at).toLocaleString()}
                                                        </span>
                                                        {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                                                            <span className="announcement-item-actions">
                                                                <button
                                                                    type="button"
                                                                    className="announcement-edit-btn"
                                                                    onClick={() => {
                                                                        setEditingAnnouncementId(a.id);
                                                                        setEditAnnouncementContent(a.content);
                                                                    }}
                                                                >
                                                                    编辑
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="announcement-delete-btn"
                                                                    onClick={() => handleDeleteAnnouncement(a.id)}
                                                                >
                                                                    删除
                                                                </button>
                                                            </span>
                                                        )}
                                                    </div>
                                                    {editingAnnouncementId === a.id ? (
                                                        <div className="announcement-edit-row">
                                                            <textarea
                                                                className="announcement-edit-input"
                                                                value={editAnnouncementContent}
                                                                onChange={(e) => setEditAnnouncementContent(e.target.value)}
                                                                rows={3}
                                                            />
                                                            <div className="announcement-edit-actions">
                                                                <button
                                                                    type="button"
                                                                    className="announcement-edit-cancel"
                                                                    onClick={() => {
                                                                        setEditingAnnouncementId(null);
                                                                        setEditAnnouncementContent('');
                                                                    }}
                                                                >
                                                                    取消
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="announcement-edit-save"
                                                                    disabled={!editAnnouncementContent.trim()}
                                                                    onClick={handleEditAnnouncement}
                                                                >
                                                                    保存
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="announcement-item-content">{a.content}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </dd>
                                </div>
                            )}
                        </dl>

                        {currentUserRole && (
                            <div className="invite-section">
                                <button
                                    type="button"
                                    className="invite-members-button"
                                    onClick={() => {
                                        setInviteSearchText('');
                                        setSelectedInviteUserIds(new Set());
                                        setShowInviteModal(true);
                                    }}
                                >
                                    邀请成员
                                </button>
                            </div>
                        )}

                        {pendingInvitations.length > 0 && (
                            <div className="pending-invitations">
                                <div className="pending-invitations-title">
                                    待审核邀请 ({pendingInvitations.length})
                                </div>
                                {pendingInvitations.map((inv) => (
                                    <div key={inv.invitation_id} className="pending-invitation-row">
                                        <span className="pending-invitation-info">
                                            <span className="pending-invitation-inviter">{inv.inviter.username}</span>
                                            {' 邀请 '}
                                            <span className="pending-invitation-invitee">{inv.invitee.username}</span>
                                        </span>
                                        <span className="pending-invitation-actions">
                                            <button
                                                type="button"
                                                className="pending-invitation-accept"
                                                onClick={() => handleProcessInvitation(inv.invitation_id, 'accept')}
                                            >
                                                批准
                                            </button>
                                            <button
                                                type="button"
                                                className="pending-invitation-reject"
                                                onClick={() => handleProcessInvitation(inv.invitation_id, 'reject')}
                                            >
                                                拒绝
                                            </button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {conversationPinRow}
                        {conversationMuteRow}

                        {/* 发布公告 */}
                        {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                            <div className="announcement-section">
                                {!isAnnouncementOpen ? (
                                    <button
                                        type="button"
                                        className="announcement-toggle-button"
                                        onClick={() => setIsAnnouncementOpen(true)}
                                    >
                                        发布群公告
                                    </button>
                                ) : (
                                    <div className="announcement-editor">
                                        <textarea
                                            className="announcement-input"
                                            placeholder="输入公告内容"
                                            value={announcementContent}
                                            onChange={(e) => setAnnouncementContent(e.target.value)}
                                            rows={3}
                                        />
                                        <div className="announcement-editor-actions">
                                            <button
                                                type="button"
                                                className="announcement-cancel-button"
                                                onClick={() => {
                                                    setIsAnnouncementOpen(false);
                                                    setAnnouncementContent('');
                                                }}
                                            >
                                                取消
                                            </button>
                                            <button
                                                type="button"
                                                className="announcement-submit-button"
                                                disabled={!announcementContent.trim() || announcementSubmitting}
                                                onClick={async () => {
                                                    if (!announcementContent.trim()) return;
                                                    setAnnouncementSubmitting(true);
                                                    try {
                                                        await publishAnnouncement(roomId, announcementContent.trim());
                                                        alert('公告已发布');
                                                        setAnnouncementContent('');
                                                        setIsAnnouncementOpen(false);
                                                        await refreshGroupDetail();
                                                    } catch (err) {
                                                        alert(err instanceof Error ? err.message : '发布失败');
                                                    } finally {
                                                        setAnnouncementSubmitting(false);
                                                    }
                                                }}
                                            >
                                                {announcementSubmitting ? '发布中...' : '发布'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 退出/解散 */}
                        <div className="chat-session-detail-footer">
                            {currentUserRole === 'owner' ? (
                                <button type="button" className="danger-button" onClick={async () => {
                                    if (!globalThis.confirm('确认解散该群聊？所有成员将被移除。')) return;
                                    try {
                                        await dissolveGroup(roomId);
                                        alert('群聊已解散');
                                        onDeleted?.();
                                    } catch (err) {
                                        alert(err instanceof Error ? err.message : '解散失败');
                                    }
                                }}>
                                    解散群聊
                                </button>
                            ) : (
                                <button type="button" className="danger-button" onClick={async () => {
                                    if (!globalThis.confirm('确认退出该群聊？')) return;
                                    try {
                                        await leaveGroup(roomId);
                                        alert('已退出群聊');
                                        onDeleted?.();
                                    } catch (err) {
                                        alert(err instanceof Error ? err.message : '退群失败');
                                    }
                                }}>
                                    退出群聊
                                </button>
                            )}
                        </div>
                    </>
                )}

                {/* ===== 私聊 ===== */}
                {!isGroup && friendDetail && (
                    <>
                        <p className="chat-session-detail-name">{friendDetail.username}</p>
                        <dl className="chat-session-detail-meta">
                            <div>
                                <dt>会话类型</dt>
                                <dd>私聊</dd>
                            </div>
                            <div>
                                <dt>邮箱</dt>
                                <dd>{friendDetail.email}</dd>
                            </div>
                            {friendDetail.birthday && (
                                <div>
                                    <dt>生日</dt>
                                    <dd>{friendDetail.birthday}</dd>
                                </div>
                            )}
                            {friendDetail.address && (
                                <div>
                                    <dt>地址</dt>
                                    <dd>{friendDetail.address}</dd>
                                </div>
                            )}
                            {friendDetail.signature && (
                                <div>
                                    <dt>个性签名</dt>
                                    <dd>{friendDetail.signature}</dd>
                                </div>
                            )}
                        </dl>

                        {conversationPinRow}
                        {conversationMuteRow}

                        <div className="chat-session-detail-footer">
                            <button type="button" className="danger-button" onClick={async () => {
                                if (!otherUserId) return;
                                if (!globalThis.confirm('确认删除该好友？')) return;
                                try {
                                    await deleteFriend(otherUserId);
                                    alert('已删除');
                                    onBack();
                                    onDeleted?.();
                                } catch (err) {
                                    alert(err instanceof Error ? err.message : '删除失败');
                                }
                            }}>
                                删除好友
                            </button>
                        </div>
                    </>
                )}
            </div>

            {showInviteModal && (
                <div className="invite-modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="invite-modal-header">
                            <span>邀请成员加入群聊</span>
                            <button
                                type="button"
                                className="invite-modal-close"
                                onClick={() => setShowInviteModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <input
                            type="text"
                            className="invite-modal-search"
                            placeholder="搜索好友..."
                            value={inviteSearchText}
                            onChange={(e) => setInviteSearchText(e.target.value)}
                        />
                        <div className="invite-modal-list">
                            {friends
                                .filter((f) => {
                                    if (groupDetail?.members.some((m) => m.user_id === f.id)) return false;
                                    const q = inviteSearchText.trim().toLowerCase();
                                    return !q || f.username.toLowerCase().includes(q);
                                })
                                .map((f) => {
                                    const isSelected = selectedInviteUserIds.has(f.id);
                                    return (
                                        <label key={f.id} className="invite-modal-friend">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {
                                                    setSelectedInviteUserIds((prev) => {
                                                        const next = new Set(prev);
                                                        if (isSelected) {
                                                            next.delete(f.id);
                                                        } else {
                                                            next.add(f.id);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                            />
                                            <span>{f.username}</span>
                                        </label>
                                    );
                                })}
                            {friends.filter((f) => {
                                if (groupDetail?.members.some((m) => m.user_id === f.id)) return false;
                                const q = inviteSearchText.trim().toLowerCase();
                                return !q || f.username.toLowerCase().includes(q);
                            }).length === 0 && (
                                <p className="invite-modal-empty">暂无可邀请的好友</p>
                            )}
                        </div>
                        <div className="invite-modal-footer">
                            <button
                                type="button"
                                className="invite-modal-cancel"
                                onClick={() => setShowInviteModal(false)}
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                className="invite-modal-confirm"
                                disabled={selectedInviteUserIds.size === 0 || inviteSubmitting}
                                onClick={handleInviteMembers}
                            >
                                {inviteSubmitting ? '邀请中...' : `确认邀请 (${selectedInviteUserIds.size})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSearchModal && (
                <div className="invite-modal-overlay" onClick={() => setShowSearchModal(false)}>
                    <div className="search-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="invite-modal-header">
                            <span>搜索消息</span>
                            <button
                                type="button"
                                className="invite-modal-close"
                                onClick={() => setShowSearchModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="search-modal-input-row">
                            <input
                                type="text"
                                className="search-modal-input"
                                placeholder="输入关键词搜索..."
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                            />
                            <button
                                type="button"
                                className="search-modal-btn"
                                disabled={!searchKeyword.trim() || searchLoading}
                                onClick={handleSearch}
                            >
                                {searchLoading ? '搜索中...' : '搜索'}
                            </button>
                        </div>
                        <div className="invite-modal-list">
                            {searchResults.length === 0 && !searchLoading ? (
                                <p className="invite-modal-empty">
                                    {searchKeyword.trim() ? '未找到匹配的消息' : '请输入关键词进行搜索'}
                                </p>
                            ) : (
                                <>
                                    {searchTotal > 0 && (
                                        <p className="search-result-count">共 {searchTotal} 条结果</p>
                                    )}
                                    {searchResults.map((result) => (
                                        <div
                                            key={result.message_id}
                                            className="search-result-item"
                                            onClick={() => {
                                                setShowSearchModal(false);
                                                onNavigateToChat?.(result.conversation_id, result.message_id, result.timestamp);
                                            }}
                                        >
                                            <div className="search-result-header">
                                                <span className="search-result-conv">{result.conversation_name}</span>
                                                <span className="search-result-sender">{result.sender.username}</span>
                                            </div>
                                            <p className="search-result-content">{result.content}</p>
                                            <span className="search-result-time">
                                                {new Date(result.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}