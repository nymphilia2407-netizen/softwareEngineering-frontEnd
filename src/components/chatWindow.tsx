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
}

export default function ChatWindow({
    activeChatId,
    activeChatName,
    messages,
    currentUserId,
    onSendMessage,
    onReadMessage
}:ChatWindowProps){
    const [inputText, setInputText] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(scrollRef.current){
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        if(messages.length > 0){
            const lastMsg = messages[messages.length - 1];
            if(lastMsg.senderId !== currentUserId){
                onReadMessage(activeChatId, lastMsg.id);
            }
        }
    }, [messages, activeChatId]);

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