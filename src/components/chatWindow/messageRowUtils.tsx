import type { Message } from '../../types/entity';
import { sameUserId } from '../../utils/messageStore';

export function messageRowKey(msg: Message) {
    return msg.clientId ? `client:${msg.clientId}` : `id:${msg.id}`;
}

export const isOtherMemberMessage = (msg: Message, currentUserId: number) =>
    !sameUserId(msg.senderId, currentUserId);

export function renderMentionText(
    text: string,
    groupMembers?: { id: number; username: string }[],
) {
    return text.split(/(@\S+?)(?=\s|$)/g).map((part, i) =>
        part.startsWith('@') && groupMembers?.some((m) => `@${m.username}` === part) ? (
            <span key={i} className="mention-highlight">
                {part}
            </span>
        ) : (
            part
        ),
    );
}
