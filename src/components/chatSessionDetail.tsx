import { useEffect, useState } from 'react';
import { getGroupDetail } from '../services/group';
import type { GroupDetailData } from '../services/group';

import '../styles/chatSessionDetail.css';

export interface ChatSessionDetailProps {
    roomId: number;
    displayName: string;
    isGroup: boolean;
    /** 私聊时对端用户 id；群聊为 null */
    otherUserId: number | null;
    onBack: () => void;
}

export default function ChatSessionDetail({ roomId, displayName, isGroup, otherUserId, onBack }: ChatSessionDetailProps) {
    const [groupDetail, setGroupDetail] = useState<GroupDetailData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 私聊信息需要等后端接口完善
        if (!isGroup) return;

        getGroupDetail(roomId)
            .then(setGroupDetail)
            .catch(err => setError(err.message || '获取群信息失败'))
    }, [roomId, isGroup]);
    
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

                {!isGroup && (
                    <>
                        <p className="chat-session-detail-name">{displayName}</p>
                        <dl className="chat-session-detail-meta">
                            <div>
                                <dt>会话类型</dt>
                                <dd>私聊</dd>
                            </div>
                            {otherUserId != null && (
                                <div>
                                    <dt>对方用户 ID</dt>
                                    <dd>{otherUserId}</dd>
                                </div>
                            )}
                        </dl>
                        <p className="chat-session-detail-placeholder">正在施工中。</p>
                    </>
                )}
            </div>
        </div>
    );
}
