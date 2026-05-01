import '../styles/chatSessionDetail.css';

export interface ChatSessionDetailProps {
    roomId: number;
    displayName: string;
    isGroup: boolean;
    /** 私聊时对端用户 id；群聊为 null */
    otherUserId: number | null;
    onBack: () => void;
}

/**
 * 当前会话的好友 / 群聊资料占位页。
 *
 * TODO: 后端若提供「会话详情 / 好友资料 / 群资料」等接口（例如 GET /api/chat/rooms/:roomId/info
 * 或 GET /api/friends/:userId、GET /api/groups/:roomId），在此发起请求并渲染真实字段。
 */
export default function ChatSessionDetail({ roomId, displayName, isGroup, otherUserId, onBack }: ChatSessionDetailProps) {
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
                <p className="chat-session-detail-name">{displayName}</p>
                <dl className="chat-session-detail-meta">
                    <div>
                        <dt>会话类型</dt>
                        <dd>{isGroup ? '群聊' : '私聊'}</dd>
                    </div>
                    <div>
                        <dt>房间 ID</dt>
                        <dd>{roomId}</dd>
                    </div>
                    {!isGroup && otherUserId != null && (
                        <div>
                            <dt>对方用户 ID</dt>
                            <dd>{otherUserId}</dd>
                        </div>
                    )}
                </dl>
                <p className="chat-session-detail-placeholder">正在施工中。</p>
            </div>
        </div>
    );
}
