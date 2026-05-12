// components/contactSessionDetail.tsx
import { useEffect, useState } from 'react';
import { getFriendDetail, deleteFriend, updateFriendTag } from '../services/friend';
import type { FriendDetail } from '../services/friend';
import { DEFAULT_AVATAR } from '../constants/string';
import { resolvedUserAvatar } from '../utils/avatarDisplay';

import '../styles/chatSessionDetail.css';

const displayMeta = (value: string | undefined) => {
    const t = (value ?? '').trim();
    return t.length > 0 ? t : '未填写';
};

export interface ContactSessionDetailProps {
    userId: number; // 所查看好友的信息
    onBack: () => void;
    onEnterChat: (userId: number) => void;
    onDeleted?: () => void;
}

export default function ContactSessionDetail({ userId, onBack, onEnterChat, onDeleted }: ContactSessionDetailProps) {
    const [friendDetail, setFriendDetail] = useState<FriendDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
        setFriendDetail(null);
        getFriendDetail(userId)
            .then(setFriendDetail)
            .catch(err => setError(err.message || '获取好友信息失败'));
    }, [userId]);

    // 分组相关
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
                <button type="button" className="chat-session-detail-back" onClick={onBack}>返回</button>
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
                                <dt>用户 ID</dt>
                                <dd>{friendDetail.user_id}</dd>
                            </div>
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
                            <div className="friend-tag-current">
                                {savedTag ? `当前分组: ${savedTag}` : '暂未分组'}
                            </div>
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
                                            setSavedTag(friendTag.trim());  // 成功后更新显示
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