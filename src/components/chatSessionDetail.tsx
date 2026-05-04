import { useEffect, useState, useRef } from 'react';
import { getGroupDetail, dissolveGroup, leaveGroup, publishAnnouncement, updateMemberRole } from '../services/group';
import { getFriendDetail, deleteFriend } from '../services/friend';
import type { FriendDetail } from '../services/friend';
import type { GroupDetailData } from '../services/group';

import '../styles/chatSessionDetail.css';

export interface ChatSessionDetailProps {
    roomId: number;
    isGroup: boolean;
    currentUserId: number;
    otherUserId: number | null;
    onBack: () => void;
    onDeleted?: () => void;
}

export default function ChatSessionDetail({ roomId, isGroup, currentUserId, otherUserId, onBack, onDeleted }: ChatSessionDetailProps) {
    const [groupDetail, setGroupDetail] = useState<GroupDetailData | null>(null);
    const [friendDetail, setFriendDetail] = useState<FriendDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
    const [announcementContent, setAnnouncementContent] = useState('');
    const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
    const [roleMenuOpenFor, setRoleMenuOpenFor] = useState<number | null>(null);
    const roleMenuRef = useRef<HTMLDivElement | null>(null); // 点击其它位置的时候让菜单缩回

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
            if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
                setRoleMenuOpenFor(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

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
                                            (currentUserRole === 'owner' && !isSelf) ||
                                            (currentUserRole === 'admin' && m.role === 'member');

                                        return (
                                            <div key={m.user_id} className="member-row">
                                                <span className="member-name">
                                                    {m.username}
                                                    {m.role === 'owner' && ' (群主)'}
                                                    {m.role === 'admin' && ' (管理员)'}
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
                                                </span>
                                            </div>
                                        );
                                    })}
                                </dd>
                            </div>
                            {groupDetail.announcements.length > 0 && (
                                <div>
                                    <dt>公告</dt>
                                    <dd>{groupDetail.announcements[0].content}</dd>
                                </div>
                            )}
                        </dl>

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
        </div>
    );
}