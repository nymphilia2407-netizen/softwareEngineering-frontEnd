import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

import { DEFAULT_AVATAR } from "../constants/string";
import { type Message } from "../types/entity";
import { resolvedUserAvatar } from "../utils/avatarDisplay";

import '../styles/chatWindow.css'

function messageRowKey(msg: Message) {
    return msg.clientId ? `client:${msg.clientId}` : `id:${msg.id}`;
}

interface ChatWindowProps{
    activeChatId: number;
    activeChatName: string;
    /** 群聊时在每条消息旁展示发送者头像与用户名 */
    isGroupChat?: boolean;
    messages: Message[];
    currentUserId: number;
    onSendMessage: (content: string) => void
    onReadMessage: (convId: number, lastMsgId: number) => void;
    onRetryMessage?: (clientId: string) => void;
    /** 右上角「…」打开好友/群聊资料（由父级处理路由或占位页） */
    onOpenSessionInfo?: () => void;
}

export default function ChatWindow({
    activeChatId,
    activeChatName,
    isGroupChat = false,
    messages,
    currentUserId,
    onSendMessage,
    onReadMessage,
    onRetryMessage,
    onOpenSessionInfo,
}:ChatWindowProps){
    const [inputText, setInputText] = useState<string>('');
    const [unreadFloatingCount, setUnreadFloatingCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const onReadMessageRef = useRef(onReadMessage);
    const shouldAutoScrollRef = useRef(true);
    const lastMessageKeyRef = useRef<string | null>(null);
    const pendingUnreadKeysRef = useRef<string[]>([]);
    onReadMessageRef.current = onReadMessage;
    const AUTO_SCROLL_THRESHOLD_PX = 80;
    const SHOW_UNREAD_DISTANCE_BASE_PX = 220;
    const SHOW_UNREAD_DISTANCE_RATIO = 0.6;

    const syncUnreadFloatingVisibility = useCallback((el: HTMLDivElement) => {
        const distanceToBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
        const nearBottom = distanceToBottom <= AUTO_SCROLL_THRESHOLD_PX;
        shouldAutoScrollRef.current = nearBottom;

        if (nearBottom) {
            pendingUnreadKeysRef.current = [];
            setUnreadFloatingCount(0);
            return;
        }

        const viewportBottom = el.scrollTop + el.clientHeight;
        pendingUnreadKeysRef.current = pendingUnreadKeysRef.current.filter((key) => {
            const node = el.querySelector<HTMLElement>(`[data-message-key="${key}"]`);
            if (!node) {
                return false;
            }
            return node.offsetTop > viewportBottom;
        });

        const showThreshold = Math.max(el.clientHeight * SHOW_UNREAD_DISTANCE_RATIO, SHOW_UNREAD_DISTANCE_BASE_PX);
        setUnreadFloatingCount(distanceToBottom >= showThreshold ? pendingUnreadKeysRef.current.length : 0);
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior });
    }, []);

    useLayoutEffect(() => {
        scrollToBottom('auto');
        shouldAutoScrollRef.current = true;
        lastMessageKeyRef.current = messages.length ? messageRowKey(messages[messages.length - 1]) : null;
        pendingUnreadKeysRef.current = [];
        setUnreadFloatingCount(0);
    }, [activeChatId, scrollToBottom]);

    useLayoutEffect(() => {
        const listEl = scrollRef.current;
        if (!listEl) return;

        const nextLastMessageKey = messages.length ? messageRowKey(messages[messages.length - 1]) : null;
        const hasNewMessage = nextLastMessageKey !== lastMessageKeyRef.current;
        if (hasNewMessage) {
            const latestMessage = messages[messages.length - 1];
            if (shouldAutoScrollRef.current) {
                scrollToBottom('auto');
            } else if (latestMessage && latestMessage.senderId !== currentUserId) {
                if (nextLastMessageKey && !pendingUnreadKeysRef.current.includes(nextLastMessageKey)) {
                    pendingUnreadKeysRef.current.push(nextLastMessageKey);
                }
            }
        }
        lastMessageKeyRef.current = nextLastMessageKey;
        syncUnreadFloatingVisibility(listEl);
    }, [messages, scrollToBottom, currentUserId, syncUnreadFloatingVisibility]);

    const handleJumpToFirstUnread = () => {
        const listEl = scrollRef.current;
        if (!listEl) return;

        const targetKey = pendingUnreadKeysRef.current[0];
        if (!targetKey) {
            scrollToBottom('smooth');
            return;
        }

        const targetElement = listEl.querySelector<HTMLElement>(`[data-message-key="${targetKey}"]`);
        if (!targetElement) {
            scrollToBottom('smooth');
            pendingUnreadKeysRef.current = [];
            setUnreadFloatingCount(0);
            return;
        }

        const distanceToBottomFromUnread = listEl.scrollHeight - targetElement.offsetTop;
        if (distanceToBottomFromUnread <= listEl.clientHeight) {
            scrollToBottom('smooth');
        } else {
            listEl.scrollTo({ top: Math.max(targetElement.offsetTop - 12, 0), behavior: 'smooth' });
        }

        // 点击后不直接清零，保留未读并在后续滚动/到底时根据可视区动态扣减。
        syncUnreadFloatingVisibility(listEl);
    };

    useEffect(() => {
        if (messages.length === 0 || !activeChatId) {
            return;
        }
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.senderId !== currentUserId) {
            onReadMessageRef.current(activeChatId, lastMsg.id);
        }
    }, [messages, activeChatId, currentUserId]);

    const handleSend = () => {
        if(!inputText.trim()) return;
        onSendMessage(inputText);
        setInputText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if(e.key === 'Enter' && !e.shiftKey){
            e.preventDefault();
            handleSend();
        }
    }

return (
        <div className="chat-window">
            <div className="window-header">
                <span className="chat-title">{activeChatName}</span>
                {onOpenSessionInfo && (
                    <button
                        type="button"
                        className="chat-header-more"
                        aria-label="查看会话详情"
                        onClick={onOpenSessionInfo}
                    >
                        ...
                    </button>
                )}
            </div>

            <div
                className="message-list"
                ref={scrollRef}
                onScroll={(e) => {
                    syncUnreadFloatingVisibility(e.currentTarget);
                }}
            >
                {messages.map((msg) => {
                    const msgKey = messageRowKey(msg);
                    const isSelf = msg.senderId === currentUserId;
                    const senderLabel = (msg.senderUsername ?? '').trim() || `用户${msg.senderId}`;
                    const avatarSrc = resolvedUserAvatar(msg.senderAvatar);
                    const readLabel = msg.isRead ? "已读" : msg.status === "sending" ? "发送中" : msg.status === "failed" ? "失败" : "";
                    /** 群聊不展示已读/未读；仍保留发送中、失败与重试 */
                    const showSelfMeta =
                        isSelf &&
                        (isGroupChat
                            ? msg.status === "sending" || msg.status === "failed"
                            : readLabel.length > 0 || (msg.status === "failed" && msg.clientId));
                    return (
                    <div
                        key={msgKey}
                        data-message-key={msgKey}
                        className={`message-item ${isSelf ? "self" : "other"}${isGroupChat ? " group-row" : ""}`}
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
                            <div
                                className={`message-top-bar${isGroupChat ? " with-sender" : ""}${isSelf ? " self" : " other"}`}
                            >
                                {isGroupChat && (
                                    <span className={`message-sender-name${isSelf ? " self" : ""}`}>{senderLabel}</span>
                                )}
                                <span className="msg-time-row">{msg.time ?? ""}</span>
                            </div>
                            <div className="message-bubble">
                                <p className="message-text">{msg.content}</p>
                                {showSelfMeta && (
                                    <div className="message-meta">
                                        {isGroupChat ? (
                                            (msg.status === "sending" || msg.status === "failed") && (
                                                <span className="msg-read">{msg.status === "sending" ? "发送中" : "失败"}</span>
                                            )
                                        ) : (
                                            readLabel ? <span className="msg-read">{readLabel}</span> : null
                                        )}
                                        {msg.status === "failed" && msg.clientId ? (
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
                })}
            </div>
            {unreadFloatingCount > 0 && (
                <button
                    type="button"
                    className="unread-jump-button"
                    onClick={handleJumpToFirstUnread}
                    aria-label={`跳转到第一条未读消息，当前 ${unreadFloatingCount} 条`}
                >
                    {unreadFloatingCount > 99 ? '99+' : unreadFloatingCount} 条未读
                </button>
            )}

            <div className="window-footer">
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    placeholder="输入消息...(Shift + Enter 以换行)"
                    onChange={(e) => {
                        setInputText(e.target.value);
                        const ta = e.target;
                        ta.style.height = 'auto';
                        ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    rows={1}
                />
                <button onClick={handleSend} disabled={!inputText.trim()}>发送</button>
            </div>
        </div>
    );
}