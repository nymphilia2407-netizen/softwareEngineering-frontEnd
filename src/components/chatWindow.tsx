import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

import { DEFAULT_AVATAR } from "../constants/string";
import { type Message } from "../types/entity";
import { sameUserId } from '../utils/messageStore';
import { resolvedUserAvatar } from '../utils/avatar';

import '../styles/chatWindow.css'

/** 消息行悬浮一段时间后弹出操作菜单；右键立即打开 */
const MESSAGE_ACTION_HOVER_MS = 600;
const MESSAGE_ACTION_LEAVE_CLOSE_MS = 220;

function messageRowKey(msg: Message) {
    return msg.clientId ? `client:${msg.clientId}` : `id:${msg.id}`;
}

const isOtherMemberMessage = (msg: Message, currentUserId: number) => !sameUserId(msg.senderId, currentUserId);

interface ChatWindowProps{
    activeChatId: number;
    activeChatName: string;
    /** 群聊时在每条消息旁展示发送者头像与用户名 */
    isGroupChat?: boolean;
    messages: Message[];
    initialUnreadCount?: number;
    currentUserId: number;
    /** 群成员列表，用于@建议弹窗（私聊时可为对方用户名） */
    groupMembers?: { id: number; username: string }[];
    /** @提醒已读回调 */
    onReadMentions?: (convId: number) => void;
    onSendMessage: (content: string, mentionedUserIds?: number[], replyToId?: number) => void
    onReadMessage: (convId: number, lastMsgId: number) => void;
    onRetryMessage?: (clientId: string) => void;
    /** 右上角「…」打开好友/群聊资料（由父级处理路由或占位页） */
    onOpenSessionInfo?: () => void;
    onDeleteMessage?: (convId: number, messageId: number) => void;
    scrollToMessageId?: number;
}

export default function ChatWindow({
    activeChatId,
    activeChatName,
    isGroupChat = false,
    messages,
    initialUnreadCount = 0,
    currentUserId,
    groupMembers,
    onReadMentions,
    onSendMessage,
    onReadMessage,
    onRetryMessage,
    onDeleteMessage,
    onOpenSessionInfo,
    scrollToMessageId,
}:ChatWindowProps){
    const [inputText, setInputText] = useState<string>('');
    /** 远离底部时展示：仅统计「下方」新来的对方消息（与顶栏历史未读分开） */
    const [unreadFloatingCount, setUnreadFloatingCount] = useState(0);
    /** 顶栏「上方未读」= 进会话时按 initialUnread 种下的对方消息，上滑读历史时递减 */
    const [headerUnreadCount, setHeaderUnreadCount] = useState(0);
    const [showHeaderUnreadButton, setShowHeaderUnreadButton] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const onReadMessageRef = useRef(onReadMessage);
    const shouldAutoScrollRef = useRef(true);
    const lastMessageKeyRef = useRef<string | null>(null);
    const headerUnreadKeysRef = useRef<string[]>([]);
    const floatingUnreadKeysRef = useRef<string[]>([]);
    const hasSeededRoomUnreadRef = useRef(false);
    const roomEntryUnreadCountRef = useRef(0);
    const canConsumeUnreadRef = useRef(false);
    const hasConfirmedReadRef = useRef(false);
    const messagesRef = useRef<Message[]>(messages);
    /** 用户是否已与消息列表发生过滚动/手势交互（避免首帧布局尚未稳定就 finalize） */
    const listInteractionRef = useRef(false);
    /** 滚动后延后一帧再算可见性，避免 flex/图片未撑开导致上滑时计数不减 */
    const scrollSyncRafRef = useRef<number | null>(null);
    onReadMessageRef.current = onReadMessage;
    const AUTO_SCROLL_THRESHOLD_PX = 80;
    const SHOW_UNREAD_DISTANCE_BASE_PX = 220;
    const SHOW_UNREAD_DISTANCE_RATIO = 0.6;
    const MIN_VISIBLE_OVERLAP_PX = 1;

    /** 消息行悬浮一段时间后，或右键，弹出「回复 / 删除」占位菜单 */
    const [messageActionMenu, setMessageActionMenu] = useState<{
        messageKey: string;
        mode: "hover" | "context";
        x: number;
        y: number;
    } | null>(null);
    const messageActionPopoverRef = useRef<HTMLDivElement>(null);
    const messageHoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messageHoverLeaveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messageHoverRowRef = useRef<{ key: string; el: HTMLElement } | null>(null);

    /** @建议弹窗状态 */
    const [mentionSuggest, setMentionSuggest] = useState<{
        visible: boolean;
        filter: string;
        members: { id: number; username: string }[];
        selectedIndex: number;
    } | null>(null);
    const mentionSuggestRef = useRef<HTMLDivElement>(null);
    const mentionFilterRef = useRef<string>('');
    const mentionStartPosRef = useRef<number>(-1);

    const [replyTarget, setReplyTarget] = useState<{
        messageId: number;
        senderUsername: string;
        content: string;
    } | null>(null);

    useEffect(() => {
        if (onReadMentions && activeChatId) {
            onReadMentions(activeChatId);
        }
    }, [activeChatId, onReadMentions]);

    const clearMessageHoverOpenTimer = useCallback(() => {
        if (messageHoverOpenTimerRef.current !== null) {
            clearTimeout(messageHoverOpenTimerRef.current);
            messageHoverOpenTimerRef.current = null;
        }
    }, []);

    const clearMessageHoverLeaveCloseTimer = useCallback(() => {
        if (messageHoverLeaveCloseTimerRef.current !== null) {
            clearTimeout(messageHoverLeaveCloseTimerRef.current);
            messageHoverLeaveCloseTimerRef.current = null;
        }
    }, []);

    const closeMessageActionMenu = useCallback(() => {
        clearMessageHoverOpenTimer();
        clearMessageHoverLeaveCloseTimer();
        messageHoverRowRef.current = null;
        setMessageActionMenu(null);
    }, [clearMessageHoverLeaveCloseTimer, clearMessageHoverOpenTimer]);

    const handleMessageRowPointerEnter = useCallback(
        (msgKey: string, e: React.PointerEvent<HTMLDivElement>) => {
            if (e.pointerType === "touch") {
                return;
            }
            clearMessageHoverOpenTimer();
            clearMessageHoverLeaveCloseTimer();
            messageHoverRowRef.current = { key: msgKey, el: e.currentTarget };
            messageHoverOpenTimerRef.current = setTimeout(() => {
                messageHoverOpenTimerRef.current = null;
                if (messageHoverRowRef.current?.key !== msgKey) {
                    return;
                }
                const bubble = messageHoverRowRef.current.el.querySelector<HTMLElement>(".message-bubble");
                if (!bubble) {
                    return;
                }
                const rect = bubble.getBoundingClientRect();
                setMessageActionMenu({
                    messageKey: msgKey,
                    mode: "hover",
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 6,
                });
            }, MESSAGE_ACTION_HOVER_MS);
        },
        [clearMessageHoverLeaveCloseTimer, clearMessageHoverOpenTimer],
    );

    const handleMessageRowPointerLeave = useCallback(
        (msgKey: string) => {
            clearMessageHoverOpenTimer();
            if (messageHoverRowRef.current?.key === msgKey) {
                messageHoverRowRef.current = null;
            }
            clearMessageHoverLeaveCloseTimer();
            messageHoverLeaveCloseTimerRef.current = setTimeout(() => {
                messageHoverLeaveCloseTimerRef.current = null;
                setMessageActionMenu((prev) =>
                    prev?.messageKey === msgKey && prev.mode === "hover" ? null : prev,
                );
            }, MESSAGE_ACTION_LEAVE_CLOSE_MS);
        },
        [clearMessageHoverLeaveCloseTimer, clearMessageHoverOpenTimer],
    );

    const handleMessageRowContextMenu = useCallback(
        (msgKey: string, e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            clearMessageHoverOpenTimer();
            clearMessageHoverLeaveCloseTimer();
            messageHoverRowRef.current = null;
            setMessageActionMenu({
                messageKey: msgKey,
                mode: "context",
                x: e.clientX,
                y: e.clientY,
            });
        },
        [clearMessageHoverLeaveCloseTimer, clearMessageHoverOpenTimer],
    );

    useEffect(() => {
        if (!messageActionMenu) {
            return;
        }
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
                closeMessageActionMenu();
            }
        };
        const onPointerDown = (ev: PointerEvent) => {
            const pop = messageActionPopoverRef.current;
            if (pop && ev.target instanceof Node && pop.contains(ev.target)) {
                return;
            }
            closeMessageActionMenu();
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown, true);
        };
    }, [messageActionMenu, closeMessageActionMenu]);

    useEffect(() => () => closeMessageActionMenu(), [closeMessageActionMenu]);

    const resolveReadCursorId = useCallback((msgs: Message[]) => {
        for (let i = msgs.length - 1; i >= 0; i -= 1) {
            if (msgs[i].id > 0) {
                return msgs[i].id;
            }
        }
        return 0;
    }, []);

    const tryFinalizeSessionRead = useCallback(() => {
        if (!activeChatId || hasConfirmedReadRef.current || !hasSeededRoomUnreadRef.current) {
            return;
        }
        const msgs = messagesRef.current;
        hasConfirmedReadRef.current = true;
        headerUnreadKeysRef.current = [];
        floatingUnreadKeysRef.current = [];
        setHeaderUnreadCount(0);
        setUnreadFloatingCount(0);
        onReadMessageRef.current(activeChatId, resolveReadCursorId(msgs));
    }, [activeChatId, resolveReadCursorId]);

    const syncUnreadFloatingVisibility = useCallback(
        (el: HTMLDivElement) => {
            const distanceToBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
            const nearBottom = distanceToBottom <= AUTO_SCROLL_THRESHOLD_PX;
            shouldAutoScrollRef.current = nearBottom;

            const listRect = el.getBoundingClientRect();
            const BELOW_VIEWPORT_EPS = 2;

            /**
             * 顶栏「上方未读」：与列表有重叠则视为已看到；整行在列表可视区域之下（上滑后最新几条滑出底边）
             * 也视为已读过，否则会一直把「在视口下方」误判成「仍隐藏」导致上滑计数不减。
             */
            const keepHeaderUnreadKey = (key: string) => {
                const node = el.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(key)}"]`);
                if (!node) {
                    return true;
                }
                const r = node.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) {
                    return true;
                }
                const overlap = Math.min(r.bottom, listRect.bottom) - Math.max(r.top, listRect.top);
                if (overlap > MIN_VISIBLE_OVERLAP_PX) {
                    return false;
                }
                if (r.top >= listRect.bottom - BELOW_VIEWPORT_EPS) {
                    return false;
                }
                return true;
            };

            /** 底部「新消息」：仅在进入列表可视区时消掉；在视口下方表示还没滚到底，必须保留 */
            const keepFloatingUnreadKey = (key: string) => {
                const node = el.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(key)}"]`);
                if (!node) {
                    return true;
                }
                const r = node.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) {
                    return true;
                }
                const overlap = Math.min(r.bottom, listRect.bottom) - Math.max(r.top, listRect.top);
                return overlap <= MIN_VISIBLE_OVERLAP_PX;
            };

            headerUnreadKeysRef.current = headerUnreadKeysRef.current.filter(keepHeaderUnreadKey);
            floatingUnreadKeysRef.current = floatingUnreadKeysRef.current.filter(keepFloatingUnreadKey);

            setHeaderUnreadCount(headerUnreadKeysRef.current.length);

            const showThreshold = Math.max(el.clientHeight * SHOW_UNREAD_DISTANCE_RATIO, SHOW_UNREAD_DISTANCE_BASE_PX);
            /** 仅「下方」新消息未读；上滑远离底部时不要混入上方历史未读，避免诡异重复计数 */
            setUnreadFloatingCount(
                distanceToBottom >= showThreshold ? floatingUnreadKeysRef.current.length : 0,
            );

            const noTracked =
                headerUnreadKeysRef.current.length === 0 && floatingUnreadKeysRef.current.length === 0;
            if (
                noTracked &&
                hasSeededRoomUnreadRef.current &&
                !hasConfirmedReadRef.current &&
                (nearBottom || listInteractionRef.current)
            ) {
                tryFinalizeSessionRead();
            }
        },
        [tryFinalizeSessionRead],
    );

    const scheduleSyncUnreadAfterScroll = useCallback(
        (el: HTMLDivElement) => {
            if (scrollSyncRafRef.current !== null) {
                cancelAnimationFrame(scrollSyncRafRef.current);
            }
            scrollSyncRafRef.current = requestAnimationFrame(() => {
                scrollSyncRafRef.current = null;
                syncUnreadFloatingVisibility(el);
                requestAnimationFrame(() => {
                    syncUnreadFloatingVisibility(el);
                });
            });
        },
        [syncUnreadFloatingVisibility],
    );

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const el = scrollRef.current;
        if (!el) return;
        if (behavior === 'auto') {
            const previousBehavior = el.style.scrollBehavior;
            el.style.scrollBehavior = 'auto';
            el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
            el.style.scrollBehavior = previousBehavior;
            return;
        }
        el.scrollTo({ top: el.scrollHeight, behavior });
    }, []);

    useLayoutEffect(() => {
        closeMessageActionMenu();
        shouldAutoScrollRef.current = true;
        lastMessageKeyRef.current = null;
        headerUnreadKeysRef.current = [];
        floatingUnreadKeysRef.current = [];
        hasSeededRoomUnreadRef.current = false;
        roomEntryUnreadCountRef.current = Math.max(0, initialUnreadCount);
        canConsumeUnreadRef.current = false;
        hasConfirmedReadRef.current = false;
        listInteractionRef.current = false;
        setUnreadFloatingCount(0);
        setHeaderUnreadCount(0);
        setShowHeaderUnreadButton(true);
        if (scrollSyncRafRef.current !== null) {
            cancelAnimationFrame(scrollSyncRafRef.current);
            scrollSyncRafRef.current = null;
        }
        scrollToBottom('auto');
    }, [activeChatId, initialUnreadCount, scrollToBottom, closeMessageActionMenu]);

    useLayoutEffect(() => {
        setReplyTarget(null);
    }, [activeChatId]);

    useEffect(() => {
        if (!scrollToMessageId || !scrollRef.current) return;
        const key = `id:${scrollToMessageId}`;
        const el = scrollRef.current.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(key)}"]`);
        if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [scrollToMessageId, messages]);

    useLayoutEffect(() => {
        messagesRef.current = messages;
        const listEl = scrollRef.current;
        if (!listEl) return;

        const nextLastMessageKey = messages.length ? messageRowKey(messages[messages.length - 1]) : null;
        if (lastMessageKeyRef.current === null) {
            if (!hasSeededRoomUnreadRef.current) {
                if (messages.length > 0) {
                    const incomingMessageKeys = messages
                        .filter((msg) => isOtherMemberMessage(msg, currentUserId))
                        .map((msg) => messageRowKey(msg));
                    const takeCount = Math.min(roomEntryUnreadCountRef.current, incomingMessageKeys.length);
                    headerUnreadKeysRef.current = takeCount > 0 ? incomingMessageKeys.slice(-takeCount) : [];
                    setHeaderUnreadCount(headerUnreadKeysRef.current.length);
                }
                hasSeededRoomUnreadRef.current = true;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const inner = scrollRef.current;
                        if (inner) {
                            syncUnreadFloatingVisibility(inner);
                        }
                    });
                });
            }
            if (messages.length > 0 && !scrollToMessageId) {
                scrollToBottom('auto');
            }
            lastMessageKeyRef.current = nextLastMessageKey;
            syncUnreadFloatingVisibility(listEl);
            return;
        }

        const hasNewMessage = nextLastMessageKey !== lastMessageKeyRef.current;
        if (hasNewMessage) {
            hasConfirmedReadRef.current = false;
            const latestMessage = messages[messages.length - 1];
            if (shouldAutoScrollRef.current) {
                scrollToBottom('auto');
            } else if (latestMessage && isOtherMemberMessage(latestMessage, currentUserId)) {
                if (nextLastMessageKey && !floatingUnreadKeysRef.current.includes(nextLastMessageKey)) {
                    floatingUnreadKeysRef.current.push(nextLastMessageKey);
                }
            }
        }
        lastMessageKeyRef.current = nextLastMessageKey;
        syncUnreadFloatingVisibility(listEl);
    }, [messages, scrollToBottom, currentUserId, syncUnreadFloatingVisibility]);

    /** 群聊 flex + 头像异步撑高时，仅靠 scroll 同步 getBoundingClientRect 易漏判；用 IO 判定「已进入列表可视区」 */
    useEffect(() => {
        const root = scrollRef.current;
        if (!root || !hasSeededRoomUnreadRef.current) {
            return;
        }

        const keySet = new Set([...headerUnreadKeysRef.current, ...floatingUnreadKeysRef.current]);
        if (keySet.size === 0) {
            return;
        }

        const io = new IntersectionObserver(
            (entries) => {
                let changed = false;
                for (const entry of entries) {
                    if (!entry.isIntersecting) {
                        continue;
                    }
                    const elmt = entry.target as HTMLElement;
                    const key = elmt.getAttribute('data-message-key');
                    if (!key || !keySet.has(key)) {
                        continue;
                    }
                    const beforeH = headerUnreadKeysRef.current.length;
                    const beforeF = floatingUnreadKeysRef.current.length;
                    headerUnreadKeysRef.current = headerUnreadKeysRef.current.filter((k) => k !== key);
                    floatingUnreadKeysRef.current = floatingUnreadKeysRef.current.filter((k) => k !== key);
                    if (headerUnreadKeysRef.current.length !== beforeH || floatingUnreadKeysRef.current.length !== beforeF) {
                        changed = true;
                        keySet.delete(key);
                    }
                }
                if (changed && scrollRef.current) {
                    scheduleSyncUnreadAfterScroll(scrollRef.current);
                }
            },
            { root, rootMargin: '24px 0px 24px 0px', threshold: [0, 0.001, 0.05, 0.2, 0.5, 1] },
        );

        for (const key of keySet) {
            const node = root.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(key)}"]`);
            if (node) {
                try {
                    io.observe(node);
                } catch {
                    /* root 非祖先等极端情况 */
                }
            }
        }

        return () => io.disconnect();
    }, [messages, activeChatId, currentUserId, initialUnreadCount, scheduleSyncUnreadAfterScroll]);

    const orderKeysByMessageTop = (keys: readonly string[]) => {
        const msgs = messagesRef.current;
        const keyIndex = (key: string) => msgs.findIndex((m) => messageRowKey(m) === key);
        return [...new Set(keys)].sort((a, b) => {
            const ia = keyIndex(a);
            const ib = keyIndex(b);
            return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
        });
    };

    const jumpToFirstUnreadFromKeys = (unreadKeys: string[]) => {
        const listEl = scrollRef.current;
        if (!listEl) return;

        const targetKey = unreadKeys[0];
        if (!targetKey) {
            scrollToBottom('smooth');
            return;
        }

        const targetElement = listEl.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(targetKey)}"]`);
        if (!targetElement) {
            scrollToBottom('smooth');
            headerUnreadKeysRef.current = [];
            floatingUnreadKeysRef.current = [];
            setUnreadFloatingCount(0);
            setHeaderUnreadCount(0);
            return;
        }

        const distanceToBottomFromUnread = listEl.scrollHeight - targetElement.offsetTop;
        if (distanceToBottomFromUnread <= listEl.clientHeight) {
            scrollToBottom('smooth');
        } else {
            listEl.scrollTo({ top: Math.max(targetElement.offsetTop - 12, 0), behavior: 'smooth' });
        }

        syncUnreadFloatingVisibility(listEl);
    };

    const handleHeaderJumpToUnread = () => {
        canConsumeUnreadRef.current = true;
        jumpToFirstUnreadFromKeys(orderKeysByMessageTop(headerUnreadKeysRef.current));
    };

    const handleFloatingJumpToUnread = () => {
        canConsumeUnreadRef.current = true;
        const ordered = orderKeysByMessageTop(floatingUnreadKeysRef.current);
        if (ordered.length === 0) {
            scrollToBottom('smooth');
            return;
        }
        jumpToFirstUnreadFromKeys(ordered);
    };

    const extractMentionedUserIds = (text: string): number[] | undefined => {
        if (!groupMembers || groupMembers.length === 0) return undefined;
        const mentionedPattern = /@(\S+?)(?=\s|$)/g;
        let match: RegExpExecArray | null;
        const names = new Set<string>();
        while ((match = mentionedPattern.exec(text)) !== null) {
            names.add(match[1]);
        }
        const ids = groupMembers
            .filter((m) => names.has(m.username))
            .map((m) => m.id);
        return ids.length > 0 ? ids : undefined;
    };

    const handleSend = () => {
        if(!inputText.trim()) return;
        const mentionedUserIds = extractMentionedUserIds(inputText);
        onSendMessage(inputText, mentionedUserIds, replyTarget?.messageId);
        setInputText('');
        setMentionSuggest(null);
        setReplyTarget(null);
        mentionStartPosRef.current = -1;
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const selectMentionedMember = (index: number) => {
        if (!mentionSuggest || !textareaRef.current) return;
        const member = mentionSuggest.members[index];
        if (!member) return;
        const textarea = textareaRef.current;
        const beforeMention = inputText.slice(0, mentionStartPosRef.current);
        const afterFilter = inputText.slice(
            mentionStartPosRef.current + 1 + mentionFilterRef.current.length,
        );
        const newText = `${beforeMention}@${member.username} ${afterFilter}`;
        setInputText(newText);
        setMentionSuggest(null);
        mentionStartPosRef.current = -1;
        setTimeout(() => {
            textarea.focus();
            const cursorPos = beforeMention.length + member.username.length + 2;
            textarea.setSelectionRange(cursorPos, cursorPos);
        }, 0);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputText(value);

        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;

        const cursorPos = ta.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');

        if (
            atIndex !== -1 &&
            (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ' || textBeforeCursor[atIndex - 1] === '\n')
        ) {
            const filterText = textBeforeCursor.slice(atIndex + 1);
            const hasSpaceOrEnd = /^[^\s]*$/.test(filterText);
            if (hasSpaceOrEnd && groupMembers && groupMembers.length > 0) {
                const lowerFilter = filterText.toLowerCase();
                const filtered = groupMembers
                    .filter((m) => m.id !== currentUserId && m.username.toLowerCase().includes(lowerFilter))
                    .slice(0, 8);
                const prevFilter = mentionFilterRef.current;
                mentionFilterRef.current = filterText;
                mentionStartPosRef.current = atIndex;
                if (filtered.length > 0) {
                    setMentionSuggest((prev) => ({
                        visible: true,
                        filter: filterText,
                        members: filtered,
                        selectedIndex:
                            prev?.visible && prev.filter === filterText
                                ? Math.min(prev.selectedIndex, filtered.length - 1)
                                : 0,
                    }));
                } else {
                    setMentionSuggest(null);
                }
                return;
            }
        }
        setMentionSuggest(null);
        mentionStartPosRef.current = -1;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mentionSuggest?.visible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionSuggest((prev) =>
                    prev ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, prev.members.length - 1) } : null,
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionSuggest((prev) =>
                    prev ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) } : null,
                );
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                selectMentionedMember(mentionSuggest.selectedIndex);
                return;
            }
            if (e.key === 'Escape') {
                setMentionSuggest(null);
                return;
            }
        }
        if(e.key === 'Enter' && !e.shiftKey){
            e.preventDefault();
            handleSend();
        }
    }

    const messageActionMenuPortal =
        messageActionMenu &&
        (() => {
            const { messageKey: actionMenuMessageKey, mode: actionMenuMode, x: ax, y: ay } = messageActionMenu;
            // 找到对应的消息
            const targetMsg = messages.find((msg) => messageRowKey(msg) === actionMenuMessageKey);
            const canDelete = targetMsg && targetMsg.id > 0 && onDeleteMessage;
            
            return createPortal(
                <div
                    ref={messageActionPopoverRef}
                    className={`message-action-popover${actionMenuMode === "hover" ? " message-action-popover--hover" : " message-action-popover--context"}`}
                    style={{ left: ax, top: ay }}
                    role="menu"
                    aria-label="消息操作"
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerEnter={clearMessageHoverLeaveCloseTimer}
                    onPointerLeave={() => {
                        if (actionMenuMode === "context") {
                            closeMessageActionMenu();
                            return;
                        }
                        clearMessageHoverLeaveCloseTimer();
                        messageHoverLeaveCloseTimerRef.current = setTimeout(() => {
                            setMessageActionMenu((prev) =>
                                prev?.messageKey === actionMenuMessageKey && prev.mode === "hover" ? null : prev
                            );
                        }, MESSAGE_ACTION_LEAVE_CLOSE_MS);
                    }}
                >
                    <button
                        type="button"
                        className="message-action-btn"
                        role="menuitem"
                        onClick={() => {
                            if (targetMsg) {
                                setReplyTarget({
                                    messageId: targetMsg.id,
                                    senderUsername: targetMsg.senderUsername || '用户',
                                    content: targetMsg.content,
                                });
                                const prefix = `@${targetMsg.senderUsername || '用户'} `;
                                setInputText((prev) => prefix + prev);
                                setTimeout(() => {
                                    const ta = textareaRef.current;
                                    if (ta) {
                                        ta.focus();
                                        ta.setSelectionRange(prefix.length, prefix.length);
                                    }
                                }, 0);
                            }
                            closeMessageActionMenu();
                        }}
                    >
                        回复
                    </button>
                    {canDelete && (
                        <button
                            type="button"
                            className="message-action-btn message-action-btn--danger"
                            role="menuitem"
                            onClick={() => {
                                onDeleteMessage(activeChatId, targetMsg.id);
                                closeMessageActionMenu();
                            }}
                        >
                            删除
                        </button>
                    )}
                </div>,
                document.body
            );
        })();

return (
        <div className="chat-window">
            <div className="window-header">
                <span className="chat-title">{activeChatName}</span>
                {showHeaderUnreadButton && headerUnreadCount > 0 ? (
                    <button
                        type="button"
                        className="chat-header-unread"
                        onClick={handleHeaderJumpToUnread}
                        aria-label={`跳转到最早一条上方未读，当前 ${headerUnreadCount} 条`}
                    >
                        上方未读 {headerUnreadCount > 99 ? '99+' : headerUnreadCount}
                    </button>
                ) : null}
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
                onWheel={() => {
                    canConsumeUnreadRef.current = true;
                    listInteractionRef.current = true;
                }}
                onTouchMove={() => {
                    canConsumeUnreadRef.current = true;
                    listInteractionRef.current = true;
                }}
                onPointerDown={() => {
                    canConsumeUnreadRef.current = true;
                    listInteractionRef.current = true;
                }}
                onScroll={(e) => {
                    canConsumeUnreadRef.current = true;
                    listInteractionRef.current = true;
                    closeMessageActionMenu();
                    scheduleSyncUnreadAfterScroll(e.currentTarget);
                }}
            >
                {messages.map((msg) => {
                    const msgKey = messageRowKey(msg);
                    const isSelf = !isOtherMemberMessage(msg, currentUserId);
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
                        onPointerEnter={(e) => handleMessageRowPointerEnter(msgKey, e)}
                        onPointerLeave={() => handleMessageRowPointerLeave(msgKey)}
                        onContextMenu={(e) => handleMessageRowContextMenu(msgKey, e)}
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
                                {msg.replyTo && (
                                    <div className="reply-quote">
                                        <span className="reply-quote-sender">
                                            {msg.replyTo.senderUsername}
                                        </span>
                                        <span className="reply-quote-text">
                                            {(msg.replyTo.content.length > 80
                                                ? msg.replyTo.content.slice(0, 80) + '...'
                                                : msg.replyTo.content
                                            ).split(/(@\S+?)(?=\s|$)/g).map((part, i) =>
                                                part.startsWith('@') &&
                                                groupMembers?.some((m) => `@${m.username}` === part) ? (
                                                    <span key={i} className="mention-highlight">
                                                        {part}
                                                    </span>
                                                ) : (
                                                    part
                                                ),
                                            )}
                                        </span>
                                    </div>
                                )}
                                <p className="message-text">
                                    {msg.content.split(/(@\S+?)(?=\s|$)/g).map((part, i) =>
                                        part.startsWith('@') &&
                                        groupMembers?.some(
                                            (m) => `@${m.username}` === part,
                                        ) ? (
                                            <span key={i} className="mention-highlight">
                                                {part}
                                            </span>
                                        ) : (
                                            part
                                        ),
                                    )}
                                </p>
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
                    onClick={handleFloatingJumpToUnread}
                    aria-label={`跳转到底部新消息，当前 ${unreadFloatingCount} 条`}
                >
                    下方新消息 {unreadFloatingCount > 99 ? '99+' : unreadFloatingCount}
                </button>
            )}

            {messageActionMenuPortal}

            {mentionSuggest?.visible &&
                createPortal(
                    <div ref={mentionSuggestRef} className="mention-suggestions" role="listbox" aria-label="选择要@的成员">
                        {mentionSuggest.members.map((member, index) => (
                            <div
                                key={member.id}
                                role="option"
                                aria-selected={index === mentionSuggest.selectedIndex}
                                className={`mention-suggestion-item${index === mentionSuggest.selectedIndex ? ' mention-suggestion-item--active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectMentionedMember(index);
                                }}
                                onMouseEnter={() =>
                                    setMentionSuggest((prev) => (prev ? { ...prev, selectedIndex: index } : null))
                                }
                            >
                                <span className="mention-suggestion-name">@{member.username}</span>
                            </div>
                        ))}
                    </div>,
                    document.body,
                )}

            <div className="window-footer">
                {replyTarget && (
                    <div className="reply-preview-bar">
                        <div className="reply-preview-content">
                            <span className="reply-preview-sender">{replyTarget.senderUsername}</span>
                            <span className="reply-preview-text">
                                {replyTarget.content.length > 50
                                    ? replyTarget.content.slice(0, 50) + '...'
                                    : replyTarget.content}
                            </span>
                        </div>
                        <button
                            className="reply-preview-close"
                            aria-label="取消回复"
                            onClick={() => {
                                const prefix = `@${replyTarget.senderUsername} `;
                                setReplyTarget(null);
                                setInputText((prev) =>
                                    prev.startsWith(prefix) ? prev.slice(prefix.length) : prev,
                                );
                                mentionStartPosRef.current = -1;
                                setTimeout(() => textareaRef.current?.focus(), 0);
                            }}
                        >
                            &#10005;
                        </button>
                    </div>
                )}
                <div className="footer-input-row">
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        placeholder="输入消息...(Shift + Enter 以换行)"
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button onClick={handleSend} disabled={!inputText.trim()}>发送</button>
                </div>
            </div>
        </div>
    );
}
