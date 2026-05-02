import { useEffect, useState } from 'react';
import { getGroupDetail } from '../services/group';
import { getFriendDetail, deleteFriend } from '../services/friend';
import type { FriendDetail } from '../services/friend';
import type { GroupDetailData } from '../services/group';

import '../styles/chatSessionDetail.css';

export interface ChatSessionDetailProps {
    roomId: number;
    isGroup: boolean;
    /** 私聊时对端用户 id；群聊为 null */
    otherUserId: number | null;
    onBack: () => void;
    onDeleted?: () => void;
}

export default function ChatSessionDetail({ roomId, isGroup, otherUserId, onBack, onDeleted }: ChatSessionDetailProps) {
    const [groupDetail, setGroupDetail] = useState<GroupDetailData | null>(null);
    const [friendDetail, setFriendDetail] = useState<FriendDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

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
    
    return (
        <div className="chat-session-detail">
            <header className="chat-session-detail-header">
                <button type="button" className="chat-session-detail-back" onClick={onBack}>
                    返回
                </button>
                <h1 className="chat-session-detail-title">会话信息</h1>
                <span className="chat-session-detail-header-spacer" aria-hidden />
            </header>
            <div className="chat-session-detail-body">
                {error && <p className="error">{error}</p>}
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
                                    {groupDetail.members.map(m => (
                                        <div key={m.user_id} className="member-row">
                                            <span className="member-name">
                                                {m.username}{m.is_owner ? ' (群主)' : ''}
                                            </span>
                                            <span className="member-actions">
                                                {/* 按钮预留位 */}
                                            </span>
                                        </div>
                                    ))}
                                </dd>
                            </div>
                            {groupDetail.announcements.length > 0 && (
                                <div>
                                    <dt>公告</dt>
                                    <dd>{groupDetail.announcements[0].content}</dd>
                                </div>
                            )}
                        </dl>
                    </>
                )}

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
                            <button type="button"
                                className="delete-friend-button"
                                onClick={async () => {
                                    if (!otherUserId) return;
                                    const confirmed = globalThis.confirm('确认删除该好友？');
                                    if (!confirmed) return;

                                    try {
                                        await deleteFriend(otherUserId);
                                        alert('已删除');
                                        onBack();
                                        onDeleted?.();
                                    } catch (err) {
                                        alert(err instanceof Error ? err.message : '删除失败');
                                    }
                                }}
                            >
                                删除好友
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
