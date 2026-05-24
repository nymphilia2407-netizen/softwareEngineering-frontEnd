import { memo, useCallback } from 'react';

import { DEFAULT_AVATAR } from '../../constants/string';
import type { Message } from '../../types/entity';
import { formatMessageTime } from '../../utils/messageStore';
import { resolvedUserAvatar } from '../../utils/avatar';

import { isOtherMemberMessage, messageRowKey, renderMentionText } from './messageRowUtils';

export type MessageRowProps = {
    msg: Message;
    currentUserId: number;
    isGroupChat: boolean;
    groupMembers?: { id: number; username: string }[];
    highlightMessageKey: string | null;
    onScrollToMessage: (key: string) => void;
    onRetryMessage?: (clientId: string) => void;
    onPointerEnter: (msgKey: string, e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerLeave: (msgKey: string) => void;
    onContextMenu: (msgKey: string, e: React.MouseEvent<HTMLDivElement>) => void;
};

function MessageRow({
    msg,
    currentUserId,
    isGroupChat,
    groupMembers,
    highlightMessageKey,
    onScrollToMessage,
    onRetryMessage,
    onPointerEnter,
    onPointerLeave,
    onContextMenu,
}: MessageRowProps) {
    const msgKey = messageRowKey(msg);
    const isSelf = !isOtherMemberMessage(msg, currentUserId);
    const senderLabel = (msg.senderUsername ?? '').trim() || `用户${msg.senderId}`;
    const avatarSrc = resolvedUserAvatar(msg.senderAvatar);
    const readLabel = msg.isRead ? '已读' : msg.status === 'sending' ? '发送中' : msg.status === 'failed' ? '失败' : '';
    const showSelfMeta =
        isSelf &&
        (isGroupChat
            ? msg.status === 'sending' || msg.status === 'failed'
            : readLabel.length > 0 || (msg.status === 'failed' && msg.clientId));

    const handleReplyClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (msg.replyTo) {
                onScrollToMessage(`id:${msg.replyTo.messageId}`);
            }
        },
        [msg.replyTo, onScrollToMessage],
    );

    return (
        <div
            data-message-key={msgKey}
            className={`message-item ${isSelf ? 'self' : 'other'}${isGroupChat ? ' group-row' : ''}${highlightMessageKey === msgKey ? ' message-highlight' : ''}`}
            onPointerEnter={(e) => onPointerEnter(msgKey, e)}
            onPointerLeave={() => onPointerLeave(msgKey)}
            onContextMenu={(e) => onContextMenu(msgKey, e)}
        >
            {isGroupChat && (
                <img
                    className="message-sender-avatar"
                    src={avatarSrc}
                    alt=""
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                />
            )}
            <div className="message-item-main">
                <div className={`message-top-bar${isGroupChat ? ' with-sender' : ''}${isSelf ? ' self' : ' other'}`}>
                    {isGroupChat && (
                        <span className={`message-sender-name${isSelf ? ' self' : ''}`}>{senderLabel}</span>
                    )}
                    <span className="msg-time-row">{formatMessageTime(msg.timestamp)}</span>
                </div>
                <div className="message-bubble">
                    {msg.replyTo && (
                        <div className="reply-quote" onClick={handleReplyClick}>
                            <span className="reply-quote-sender">{msg.replyTo.senderUsername}</span>
                            <span className="reply-quote-text">
                                {renderMentionText(
                                    msg.replyTo.content.length > 80
                                        ? `${msg.replyTo.content.slice(0, 80)}...`
                                        : msg.replyTo.content,
                                    groupMembers,
                                )}
                            </span>
                            {(msg.replyTo.replyCount ?? 0) > 0 && (
                                <span className="reply-quote-count">{msg.replyTo.replyCount} 条回复</span>
                            )}
                        </div>
                    )}
                    <p className="message-text">{renderMentionText(msg.content, groupMembers)}</p>
                    {showSelfMeta && (
                        <div className="message-meta">
                            {isGroupChat ? (
                                (msg.status === 'sending' || msg.status === 'failed') && (
                                    <span className="msg-read">{msg.status === 'sending' ? '发送中' : '失败'}</span>
                                )
                            ) : readLabel ? (
                                <span className="msg-read">{readLabel}</span>
                            ) : null}
                            {msg.status === 'failed' && msg.clientId ? (
                                <button type="button" className="msg-retry" onClick={() => onRetryMessage?.(msg.clientId!)}>
                                    重试
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default memo(MessageRow);
