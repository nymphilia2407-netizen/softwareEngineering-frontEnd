import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

import { type Message } from "../types/entity";

import '../styles/chatWindow.css'

function messageRowKey(msg: Message) {
    return msg.clientId ? `client:${msg.clientId}` : `id:${msg.id}`;
}

interface ChatWindowProps{
    activeChatId: number;
    activeChatName: string;
    messages: Message[];
    currentUserId: number;
    onSendMessage: (content: string) => void
    onReadMessage: (convId: number, lastMsgId: number) => void;
    onRetryMessage?: (clientId: string) => void;
}

export default function ChatWindow({
    activeChatId,
    activeChatName,
    messages,
    currentUserId,
    onSendMessage,
    onReadMessage,
    onRetryMessage
}:ChatWindowProps){
    const [inputText, setInputText] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const onReadMessageRef = useRef(onReadMessage);
    onReadMessageRef.current = onReadMessage;

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior });
    }, []);

    useLayoutEffect(() => {
        scrollToBottom('auto');
    }, [messages, activeChatId, scrollToBottom]);

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
            </div>

            <div className="message-list" ref={scrollRef}>
                {messages.map((msg) => {
                    const isSelf = msg.senderId === currentUserId;
                    return (
                    <div
                        key={messageRowKey(msg)}
                        className={`message-item ${isSelf ? "self" : "other"}`}
                    >
                        <div className="message-bubble">
                            <p className="message-text">{msg.content}</p>
                            <div className="message-meta">
                                <span className="msg-time">{msg.time ?? ''}</span>
                                {isSelf && (
                                    <>
                                        <span className="msg-read">
                                            {msg.isRead ? '已读' : msg.status === 'sending' ? '发送中' : msg.status === 'failed' ? '失败' : ''}
                                        </span>
                                        {msg.status === 'failed' && msg.clientId && (
                                            <button type="button" className="msg-retry" onClick={() => onRetryMessage?.(msg.clientId!)}>重试</button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    );
                })}
            </div>

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