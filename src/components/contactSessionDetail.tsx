// components/contactSessionDetail.tsx
import { useEffect, useState } from 'react';
import { getFriendDetail, deleteFriend } from '../services/friend';
import type { FriendDetail } from '../services/friend';

import '../styles/chatSessionDetail.css';

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
                        <p className="chat-session-detail-name">{friendDetail.username}</p>
                        <dl className="chat-session-detail-meta">
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