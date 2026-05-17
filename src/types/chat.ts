/** 主界面会话列表行（含私聊/群与免打扰等） */
export interface ChatListItem {
    id: number;
    name: string;
    avatar: string;
    lastMessage: string;
    lastTime: string;
    unreadCount: number;
    status?: 'online' | 'offline' | 'busy';
    otherUserId?: number | null;
    isGroup: boolean;
    /** 消息免打扰：开启后新消息仍更新预览，但不增加未读数 */
    isMuted?: boolean;
    /** 会话置顶：显示在列表顶部 */
    isPinned?: boolean;
    /** 有人@我（用于 "[有人@你]" 显示） */
    hasUnreadMention?: boolean;
}

export type ActiveTabType = 'chat' | 'contacts' | 'settings';

export interface MentionSocketData {
    message_id: number;
    conversation_id: number;
    from_user_id: number;
    from_username: string;
    content_preview: string;
    mentioned_users: number[];
}
