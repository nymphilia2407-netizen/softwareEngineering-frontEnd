import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getFriendDetail, deleteFriend, updateFriendTag } from '../services/friend';
import type { FriendDetail } from '../services/friend';
import { dissolveGroup, getGroupDetail, leaveGroup, updateGroupAvatar, updateGroupName } from '../services/group';
import type { GroupDetailData } from '../services/group';
import { DEFAULT_AVATAR } from '../constants/string';
import { readAvatarFileAsDataUrl, resolvedUserAvatar } from '../utils/avatar';

import '../styles/chatSessionDetail.css';

const displayMeta = (value: string | undefined) => {
    const t = (value ?? '').trim();
    return t.length > 0 ? t : '未填写';
};

export type ContactSessionDetailProps =
    | {
          mode: 'friend';
          userId: number;
          onBack: () => void;
          onEnterChat: (userId: number) => void;
          onDeleted?: () => void;
      }
    | {
          mode: 'group';
          roomId: number;
          currentUserId: number;
          /** WebSocket 群公告变更时递增，用于刷新群详情 */
          groupDetailRefreshKey?: number;
          onBack: () => void;
          onEnterChat: (roomId: number) => void;
          onLeftOrDissolved?: (roomId: number) => void;
          /** 群名称或头像更新后同步会话列表 / 联系人中的群展示 */
          onGroupProfileUpdated?: (roomId: number) => void;
      };

export default function ContactSessionDetail(props: ContactSessionDetailProps) {
    if (props.mode === 'group') {
        return <ContactGroupBranch {...props} />;
    }
    return <ContactFriendBranch {...props} />;
}

function ContactFriendBranch({
    userId,
    onBack,
    onEnterChat,
    onDeleted,
}: Extract<ContactSessionDetailProps, { mode: 'friend' }>) {
    const [friendDetail, setFriendDetail] = useState<FriendDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
        setFriendDetail(null);
        getFriendDetail(userId)
            .then(setFriendDetail)
            .catch((err) => setError(err.message || '获取好友信息失败'));
    }, [userId]);

    const [savedTag, setSavedTag] = useState('');
    const [friendTag, setFriendTag] = useState('');
    const [tagSubmitting, setTagSubmitting] = useState(false);

    useEffect(() => {
        const tag = friendDetail?.tag ?? '';
        setFriendTag(tag);
        setSavedTag(tag);
    }, [friendDetail?.tag]);

    const handleDelete = async () => {
        if (!globalThis.confirm('确认删除该好友？')) return;
        try {
            await deleteFriend(userId);
            alert('已删除');
            onBack();
            onDeleted?.();
        } catch (err) {
            alert(err instanceof Error ? err.message : '删除失败');
        }
    };

    return (
        <div className="chat-session-detail">
            <header className="chat-session-detail-header">
                <button type="button" className="chat-session-detail-back" onClick={onBack}>
                    返回
                </button>
                <h1 className="chat-session-detail-title">好友信息</h1>
                <span className="chat-session-detail-header-spacer" aria-hidden />
            </header>
            <div className="chat-session-detail-body">
                {error && <p className="error">{error}</p>}

                {friendDetail && (
                    <>
                        <div className="contact-detail-profile-head">
                            <div className="contact-detail-avatar-wrap">
                                <img
                                    className="contact-detail-avatar"
                                    src={resolvedUserAvatar(friendDetail.avatar)}
                                    alt=""
                                    onError={(e) => {
                                        const img = e.currentTarget;
                                        img.onerror = null;
                                        img.src = DEFAULT_AVATAR;
                                    }}
                                />
                            </div>
                            <p className="chat-session-detail-name contact-detail-username">{friendDetail.username}</p>
                        </div>
                        <dl className="chat-session-detail-meta">
                            <div>
                                <dt>邮箱</dt>
                                <dd>{(friendDetail.email ?? '').trim() || '未公开'}</dd>
                            </div>
                            <div>
                                <dt>生日</dt>
                                <dd>{displayMeta(friendDetail.birthday)}</dd>
                            </div>
                            <div>
                                <dt>地址</dt>
                                <dd className="chat-session-detail-meta-multiline">{displayMeta(friendDetail.address)}</dd>
                            </div>
                            <div>
                                <dt>个性签名</dt>
                                <dd className="chat-session-detail-meta-multiline">{displayMeta(friendDetail.signature)}</dd>
                            </div>
                        </dl>

                        <div className="friend-tag-section">
                            <div className="friend-tag-label">好友分组</div>
                            <div className="friend-tag-current">{savedTag ? `当前分组: ${savedTag}` : '暂未分组'}</div>
                            <div className="friend-tag-input-row">
                                <input
                                    type="text"
                                    className="friend-tag-input"
                                    placeholder="设置好友分组"
                                    value={friendTag}
                                    onChange={(e) => setFriendTag(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="friend-tag-submit"
                                    disabled={tagSubmitting || !friendTag.trim()}
                                    onClick={async () => {
                                        if (!friendTag.trim()) return;
                                        setTagSubmitting(true);
                                        try {
                                            await updateFriendTag(userId, friendTag.trim());
                                            setSavedTag(friendTag.trim());
                                            alert('分组已更新');
                                        } catch (err) {
                                            alert(err instanceof Error ? err.message : '更改失败');
                                        } finally {
                                            setTagSubmitting(false);
                                        }
                                    }}
                                >
                                    {tagSubmitting ? '提交中' : '提交'}
                                </button>
                            </div>
                        </div>

                        <div className="chat-session-detail-footer">
                            <button type="button" className="no-danger-button" onClick={() => onEnterChat(userId)}>
                                进入聊天
                            </button>
                            <button type="button" className="danger-button" onClick={handleDelete}>
                                删除好友
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ContactGroupBranch({
    roomId,
    currentUserId,
    groupDetailRefreshKey = 0,
    onBack,
    onEnterChat,
    onLeftOrDissolved,
    onGroupProfileUpdated,
}: Extract<ContactSessionDetailProps, { mode: 'group' }>) {
    const [detail, setDetail] = useState<GroupDetailData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [nameSaving, setNameSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const avatarFileRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setError(null);
        setDetail(null);
        getGroupDetail(roomId)
            .then(setDetail)
            .catch((err) => setError(err.message || '获取群信息失败'));
    }, [roomId]);

    useEffect(() => {
        if (!groupDetailRefreshKey) {
            return;
        }

        getGroupDetail(roomId)
            .then(setDetail)
            .catch((err) => setError(err.message || '获取群信息失败'));
    }, [roomId, groupDetailRefreshKey]);

    useEffect(() => {
        if (detail != null) {
            setNameDraft(detail.group_name);
        }
    }, [roomId, detail?.group_name]);

    const currentMember = detail?.members.find((m) => m.user_id === currentUserId);
    const currentUserRole = currentMember?.role;
    const isOwner = currentUserRole === 'owner';
    const isStaff = currentUserRole === 'owner' || currentUserRole === 'admin';

    const handleLeaveOrDissolve = async () => {
        if (isOwner) {
            if (!globalThis.confirm('确认解散该群聊？所有成员将被移除。')) {
                return;
            }
        } else if (!globalThis.confirm('确认退出该群聊？')) {
            return;
        }

        setActionLoading(true);
        try {
            if (isOwner) {
                await dissolveGroup(roomId);
                alert('群聊已解散');
            } else {
                await leaveGroup(roomId);
                alert('已退出群聊');
            }
            onBack();
            onLeftOrDissolved?.(roomId);
        } catch (err) {
            alert(err instanceof Error ? err.message : '操作失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveGroupName = async () => {
        if (!detail || !isStaff) {
            return;
        }
        const next = nameDraft.trim();
        if (!next) {
            alert('群名称不能为空');
            return;
        }
        if (next === detail.group_name) {
            return;
        }
        setNameSaving(true);
        try {
            await updateGroupName(roomId, next);
            const d = await getGroupDetail(roomId);
            setDetail(d);
            onGroupProfileUpdated?.(roomId);
            alert('群名称已更新');
        } catch (err) {
            alert(err instanceof Error ? err.message : '修改失败');
        } finally {
            setNameSaving(false);
        }
    };

    const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !isStaff) {
            return;
        }
        setAvatarUploading(true);
        try {
            const dataUrl = await readAvatarFileAsDataUrl(file);
            await updateGroupAvatar(roomId, dataUrl);
            const d = await getGroupDetail(roomId);
            setDetail(d);
            onGroupProfileUpdated?.(roomId);
            alert('群头像已更新');
        } catch (err) {
            alert(err instanceof Error ? err.message : '上传失败');
        } finally {
            setAvatarUploading(false);
        }
    };

    return (
        <div className="chat-session-detail">
            <header className="chat-session-detail-header">
                <button type="button" className="chat-session-detail-back" onClick={onBack}>
                    返回
                </button>
                <h1 className="chat-session-detail-title">群聊信息</h1>
                <span className="chat-session-detail-header-spacer" aria-hidden />
            </header>
            <div className="chat-session-detail-body">
                {error && <p className="error">{error}</p>}

                {detail && (
                    <>
                        <div className="contact-detail-profile-head">
                            <div className="contact-group-avatar-block">
                                <div className="contact-detail-avatar-wrap">
                                    <img
                                        className="contact-detail-avatar"
                                        src={resolvedUserAvatar(detail.avatar)}
                                        alt=""
                                        onError={(e) => {
                                            const img = e.currentTarget;
                                            img.onerror = null;
                                            img.src = DEFAULT_AVATAR;
                                        }}
                                    />
                                </div>
                                {isStaff ? (
                                    <>
                                        <input
                                            ref={avatarFileRef}
                                            type="file"
                                            accept="image/*"
                                            className="contact-group-avatar-file-input"
                                            aria-hidden
                                            tabIndex={-1}
                                            onChange={(ev) => void handleAvatarFileChange(ev)}
                                        />
                                        <div className="contact-group-avatar-tabs" role="tablist" aria-label="群头像">
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected="true"
                                                className="contact-group-avatar-tab contact-group-avatar-tab--active"
                                                disabled={avatarUploading}
                                                onClick={() => avatarFileRef.current?.click()}
                                            >
                                                {avatarUploading ? '上传中…' : '修改头像'}
                                            </button>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>
                        <dl className="chat-session-detail-meta">
                            <div className="contact-group-meta-name-row">
                                <dt>群名称</dt>
                                <dd>
                                    {isStaff ? (
                                        <form
                                            className="contact-group-name-meta-form"
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                void handleSaveGroupName();
                                            }}
                                        >
                                            <div className="contact-group-name-editor">
                                                <input
                                                    id={`contact-group-name-${roomId}`}
                                                    name="group_name"
                                                    type="text"
                                                    className="contact-group-name-input"
                                                    placeholder="填写群聊名称"
                                                    value={nameDraft}
                                                    onChange={(e) => setNameDraft(e.target.value)}
                                                    maxLength={64}
                                                    autoComplete="off"
                                                />
                                                <button
                                                    type="submit"
                                                    className="contact-group-name-save-btn"
                                                    disabled={
                                                        nameSaving || nameDraft.trim() === detail.group_name.trim()
                                                    }
                                                >
                                                    {nameSaving ? '保存中…' : '保存'}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <span className="contact-group-name-readonly">{detail.group_name}</span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>成员</dt>
                                <dd>
                                    <ul className="contact-group-member-list">
                                        {detail.members.map((m) => (
                                            <li key={m.user_id}>
                                                <span className="contact-group-member-name">{m.username}</span>
                                                <span className="contact-group-member-role">
                                                    {m.role === 'owner'
                                                        ? '群主'
                                                        : m.role === 'admin'
                                                          ? '管理员'
                                                          : '成员'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </dd>
                            </div>
                            {detail.announcements.length > 0 && (
                                <div>
                                    <dt>公告</dt>
                                    <dd className="chat-session-detail-meta-multiline">{detail.announcements[0].content}</dd>
                                </div>
                            )}
                        </dl>

                        <div className="chat-session-detail-footer">
                            <button type="button" className="no-danger-button" onClick={() => onEnterChat(roomId)}>
                                进入聊天
                            </button>
                            <button
                                type="button"
                                className="danger-button"
                                disabled={actionLoading}
                                onClick={() => void handleLeaveOrDissolve()}
                            >
                                {actionLoading ? '处理中…' : isOwner ? '解散群聊' : '退出群聊'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
