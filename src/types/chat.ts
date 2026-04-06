export interface ChatItemProps{
    convId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    lastMsg: string;
    time: string;
    isActive: boolean;
    onClick(): () => void
}