import { DEFAULT_AVATAR } from '../../constants/string';
import type { ReceivedFriendRequestData } from '../../services/friend';
import { resolvedUserAvatar } from '../../utils/avatar';

export interface FriendRequestsPanelProps {
    requestHint: string;
    requestLoading: boolean;
    receivedRequests: ReceivedFriendRequestData[];
    requestActionId: number | null;
    onAccept: (requestId: number) => void;
    onReject: (requestId: number) => void;
    onClose: () => void;
}

export default function FriendRequestsPanel({
    requestHint,
    requestLoading,
    receivedRequests,
    requestActionId,
    onAccept,
    onReject,
    onClose,
}: FriendRequestsPanelProps) {
    return (
        <div className="friend-request-panel">
            <div className="friend-request-header">
                <div>
                    <div className="friend-request-title">好友请求</div>
                    <div className="friend-request-subtitle">处理其他人发来的好友申请</div>
                </div>
                <button type="button" className="friend-request-close-button" onClick={onClose}>
                    关闭
                </button>
            </div>

            {requestHint && <div className="friend-request-hint">{requestHint}</div>}

            <div className="friend-request-list">
                {requestLoading ? (
                    <div className="friend-request-empty">加载中...</div>
                ) : receivedRequests.length === 0 ? (
                    <div className="friend-request-empty">暂无待处理请求</div>
                ) : (
                    receivedRequests.map((request) => {
                        const from = request.from_user;
                        const sig = (from.signature ?? '').trim();
                        const sigShort = sig.length > 72 ? `${sig.slice(0, 72)}…` : sig;

                        return (
                            <div key={request.request_id} className="friend-request-item">
                                <img
                                    className="friend-request-avatar"
                                    src={resolvedUserAvatar(from.avatar)}
                                    alt=""
                                    onError={(e) => {
                                        const img = e.currentTarget;
                                        img.onerror = null;
                                        img.src = DEFAULT_AVATAR;
                                    }}
                                />
                                <div className="friend-request-body">
                                    <div className="friend-request-meta">
                                        <span className="friend-request-name">{from.username}</span>
                                        <span className="friend-request-email">
                                            邮箱 · {(from.email ?? '').trim() || '未公开'}
                                        </span>
                                        <span className="friend-request-signature">
                                            {sig ? `个性签名 · 「${sigShort}」` : '个性签名 · 未填写'}
                                        </span>
                                        {(from.birthday ?? '').trim() ? (
                                            <span className="friend-request-extra">生日 · {from.birthday}</span>
                                        ) : null}
                                        {(from.address ?? '').trim() ? (
                                            <span
                                                className="friend-request-extra friend-request-extra--address"
                                                title={from.address}
                                            >
                                                地址 · {from.address}
                                            </span>
                                        ) : null}
                                        <span className="friend-request-time">
                                            申请时间 · {new Date(request.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="friend-request-actions">
                                        <button
                                            type="button"
                                            className="friend-request-accept-button"
                                            onClick={() => void onAccept(request.request_id)}
                                            disabled={requestActionId === request.request_id}
                                        >
                                            {requestActionId === request.request_id ? '处理中' : '接受'}
                                        </button>
                                        <button
                                            type="button"
                                            className="friend-request-reject-button"
                                            onClick={() => void onReject(request.request_id)}
                                            disabled={requestActionId === request.request_id}
                                        >
                                            拒绝
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
