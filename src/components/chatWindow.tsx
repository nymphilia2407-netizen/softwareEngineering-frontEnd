import React, { useState, useRef, useEffect } from "react";

import { type Message } from "../types/entity";

import '../styles/chatWindow.css'

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

    useEffect(() => {
        if(scrollRef.current){
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth"
            });
        }

        if(messages.length > 0){
            const lastMsg = messages[messages.length - 1];
            if(lastMsg.senderId !== currentUserId){
                onReadMessage(activeChatId, lastMsg.id);
            }
        }
    }, [messages]);

    const handleSend = () => {
        if(!inputText.trim()) return;
        onSendMessage(inputText);
        setInputText('');
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
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`message-item ${msg.senderId === currentUserId ? "self" : "other"}`}
                    >
                        <div className="message-bubble">
                            <p>{msg.content}</p>
                            <span className="msg-time">{msg.time}</span>
                            {msg.senderId === currentUserId && (
                                <>
                                    <span className="msg-read">{msg.isRead ? '已读' : (msg.status === 'sending' ? '发送中' : '')}</span>
                                    {msg.status === 'failed' && msg.clientId && (
                                        <button className="msg-retry" onClick={() => onRetryMessage?.(msg.clientId!)}>重试</button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="window-footer">
                <textarea
                    value={inputText}
                    placeholder="输入消息...(Shift + Enter 以换行)"
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                />
                <button onClick={handleSend} disabled={!inputText.trim()}>发送</button>
            </div>
        </div>
    );
}