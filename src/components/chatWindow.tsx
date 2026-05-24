import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";

import { type Message } from "../types/entity";
import type { SearchResultData } from "../types/chat";
import { searchMessages, getChatMessages, CHAT_FILTER_PAGE_SIZE } from "../services/chat";
import type { PendingGroupAnnouncement } from '../services/group';
import { useConversationMessages } from '../contexts/MessageStoreContext';
import MessageRow from './chatWindow/MessageRow';
import { isOtherMemberMessage, messageRowKey } from './chatWindow/messageRowUtils';

import '../styles/chatWindow.css'

/** 消息行悬浮一段时间后弹出操作菜单；右键立即打开 */
const MESSAGE_ACTION_HOVER_MS = 600;
const MESSAGE_ACTION_LEAVE_CLOSE_MS = 220;

interface ChatWindowProps{
    activeChatId: number;
    activeChatName: string;
    /** 群聊时在每条消息旁展示发送者头像与用户名 */
    isGroupChat?: boolean;
    initialUnreadCount?: number;
    currentUserId: number;
    /** 群成员列表，用于@建议弹窗（私聊时可为对方用户名） */
    groupMembers?: { id: number; username: string }[];
    /** 待确认的群公告（群聊顶部展示） */
    pendingGroupAnnouncement?: PendingGroupAnnouncement | null;
    onAcknowledgeGroupAnnouncement?: (announcementId: number) => Promise<void>;
    /** @提醒已读回调 */
    onReadMentions?: (convId: number) => void;
    onSendMessage: (content: string, mentionedUserIds?: number[], replyToId?: number) => void
    onReadMessage: (convId: number, lastMsgId: number) => void;
    onRetryMessage?: (clientId: string) => void;
    /** 右上角「…」打开好友/群聊资料（由父级处理路由或占位页） */
    onOpenSessionInfo?: () => void;
    onDeleteMessage?: (convId: number, messageId: number) => void;
    scrollToMessageId?: number;
    mentionTargetMessageId?: number;
    onClearMentionTarget?: () => void;
    onNavigateToChat?: (convId: number, messageId?: number, timestamp?: string) => void;
    onScrollComplete?: () => void;
    onAddFriend?: (userId: number, username: string) => void;
}

export default function ChatWindow({
    activeChatId,
    activeChatName,
    isGroupChat = false,
    initialUnreadCount = 0,
    currentUserId,
    groupMembers,
    pendingGroupAnnouncement = null,
    onAcknowledgeGroupAnnouncement,
    onReadMentions,
    onSendMessage,
    onReadMessage,
    onRetryMessage,
    onDeleteMessage,
    onOpenSessionInfo,
    scrollToMessageId,
    mentionTargetMessageId,
    onClearMentionTarget,
    onNavigateToChat,
    onScrollComplete,
    onAddFriend,
}:ChatWindowProps){
    const messages = useConversationMessages(activeChatId);
    const [inputText, setInputText] = useState<string>('');
    const [announcementAckSubmitting, setAnnouncementAckSubmitting] = useState(false);
    /** 远离底部时展示：仅统计「下方」新来的对方消息（与顶栏历史未读分开） */
    const [unreadFloatingCount, setUnreadFloatingCount] = useState(0);
    /** 顶栏「上方未读」= 进会话时按 initialUnread 种下的对方消息，上滑读历史时递减 */
    const [headerUnreadCount, setHeaderUnreadCount] = useState(0);
    const [showHeaderUnreadButton, setShowHeaderUnreadButton] = useState(false);
    const [highlightMessageKey, setHighlightMessageKey] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const caretCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
    const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | null>(null);

    const [replyTarget, setReplyTarget] = useState<{
        messageId: number;
        senderUsername: string;
        content: string;
    } | null>(null);

    const [showSearchPanel, setShowSearchPanel] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResultData[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [draftSenderId, setDraftSenderId] = useState(0);
    const [localScrollTarget, setLocalScrollTarget] = useState<string | null>(null);
    const [draftStartDate, setDraftStartDate] = useState('');
    const [draftEndDate, setDraftEndDate] = useState('');
    const [filterResults, setFilterResults] = useState<SearchResultData[]>([]);
    const [filterLoading, setFilterLoading] = useState(false);
    const searchPanelRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 88,
        overscan: 12,
    });

    const scrollToMessageByKey = useCallback(
        (key: string, behavior: ScrollBehavior = 'smooth') => {
            const idx = messagesRef.current.findIndex((m) => messageRowKey(m) === key);
            if (idx >= 0) {
                virtualizer.scrollToIndex(idx, { align: 'center', behavior });
                setHighlightMessageKey(key);
                setTimeout(() => setHighlightMessageKey(null), 2000);
            }
        },
        [virtualizer],
    );

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

    useEffect(() => {
        if (!showSearchPanel) return;
        const handleClick = (e: MouseEvent) => {
            if (searchPanelRef.current && !searchPanelRef.current.contains(e.target as Node)) {
                setShowSearchPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showSearchPanel]);

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
        const count = messagesRef.current.length;
        if (count === 0) {
            return;
        }
        virtualizer.scrollToIndex(count - 1, { align: 'end', behavior });
    }, [virtualizer]);

    /** flex/输入框高度变化后 scrollHeight 可能晚一帧才稳定，双 rAF 再滚一次 */
    const scrollToBottomAfterLayout = useCallback(
        (behavior: ScrollBehavior = 'auto') => {
            scrollToBottom(behavior);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    scrollToBottom(behavior);
                });
            });
        },
        [scrollToBottom],
    );

    const getCaretCoordinates = useCallback((textarea: HTMLTextAreaElement, position: number) => {
        const style = getComputedStyle(textarea);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
        const fontSize = parseFloat(style.fontSize);

        const text = textarea.value.slice(0, position);
        const lines = text.split('\n');
        const lineIndex = lines.length - 1;
        const lastLine = lines[lineIndex];

        const canvas = caretCanvasRef.current ?? document.createElement('canvas');
        if (!caretCanvasRef.current) {
            caretCanvasRef.current = canvas;
        }
        const ctx = canvas.getContext('2d')!;
        ctx.font = `${fontSize}px ${style.fontFamily}`;
        const textWidth = ctx.measureText(lastLine).width;

        const rect = textarea.getBoundingClientRect();

        return {
            x: rect.left + paddingLeft + textWidth,
            y: rect.top + paddingTop + lineIndex * lineHeight,
        };
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
        const key = localScrollTarget || (scrollToMessageId ? `id:${scrollToMessageId}` : null);
        if (!key) return;

        scrollToMessageByKey(key, 'smooth');
        if (localScrollTarget) setLocalScrollTarget(null);
        if (scrollToMessageId) onScrollComplete?.();
    }, [localScrollTarget, scrollToMessageId, scrollToMessageByKey, onScrollComplete]);

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
            const isOwnMessage = latestMessage && !isOtherMemberMessage(latestMessage, currentUserId);
            if (shouldAutoScrollRef.current || isOwnMessage) {
                if (isOwnMessage) {
                    shouldAutoScrollRef.current = true;
                }
                scrollToBottomAfterLayout('auto');
            } else if (latestMessage && isOtherMemberMessage(latestMessage, currentUserId)) {
                if (nextLastMessageKey && !floatingUnreadKeysRef.current.includes(nextLastMessageKey)) {
                    floatingUnreadKeysRef.current.push(nextLastMessageKey);
                }
            }
        }
        lastMessageKeyRef.current = nextLastMessageKey;
        syncUnreadFloatingVisibility(listEl);
    }, [messages, scrollToBottomAfterLayout, currentUserId, syncUnreadFloatingVisibility]);

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
        const targetKey = unreadKeys[0];
        if (!targetKey) {
            scrollToBottom('smooth');
            return;
        }

        const idx = messagesRef.current.findIndex((m) => messageRowKey(m) === targetKey);
        if (idx < 0) {
            scrollToBottom('smooth');
            headerUnreadKeysRef.current = [];
            floatingUnreadKeysRef.current = [];
            setUnreadFloatingCount(0);
            setHeaderUnreadCount(0);
            return;
        }

        const lastIdx = messagesRef.current.length - 1;
        if (idx >= lastIdx - 2) {
            scrollToBottom('smooth');
        } else {
            virtualizer.scrollToIndex(idx, { align: 'start', behavior: 'smooth' });
        }

        const listEl = scrollRef.current;
        if (listEl) {
            syncUnreadFloatingVisibility(listEl);
        }
    };

    const handleHeaderJumpToUnread = () => {
        canConsumeUnreadRef.current = true;
        jumpToFirstUnreadFromKeys(orderKeysByMessageTop(headerUnreadKeysRef.current));
    };

    const handleApplyFilter = async () => {
        setFilterLoading(true);
        try {
            const startTime = draftStartDate ? draftStartDate + 'T00:00:00' : undefined;
            const endTime = draftEndDate ? draftEndDate + 'T23:59:59' : undefined;
            const data = await getChatMessages(
                activeChatId,
                CHAT_FILTER_PAGE_SIZE,
                0,
                startTime,
                draftSenderId || undefined,
                endTime,
            );
            const results: SearchResultData[] = data.messages.map((m) => ({
                message_id: m.id,
                conversation_id: activeChatId,
                conversation_name: activeChatName,
                sender: { user_id: m.sender_id, username: m.sender_username || '', avatar: m.sender_avatar || '' },
                content: m.content.length > 200 ? `${m.content.slice(0, 200)}…` : m.content,
                timestamp: m.created_at,
            }));
            results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setFilterResults(results);
        } catch (err) {
            alert(err instanceof Error ? err.message : '筛选失败');
        } finally {
            setFilterLoading(false);
        }
    };

    const handleClearFilter = () => {
        setDraftSenderId(0);
        setDraftStartDate('');
        setDraftEndDate('');
        setFilterResults([]);
    };

    const handleSearch = async () => {
        const q = searchKeyword.trim();
        if (!q) return;
        setSearchLoading(true);
        try {
            const data = await searchMessages(q, 1, undefined, { countTotal: false });
            setSearchResults(data.results);
        } catch (err) {
            alert(err instanceof Error ? err.message : '搜索失败');
        } finally {
            setSearchLoading(false);
        }
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
        shouldAutoScrollRef.current = true;
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

        const coords = getCaretCoordinates(e.target, atIndex + 1); // +1 在 @ 后面
        setMentionPosition({
            x: coords.x,
            y: coords.y - 4,
        });

        if (atIndex !== -1) {
            const filterText = textBeforeCursor.slice(atIndex + 1);
            const hasSpaceOrEnd = /^[^\s]*$/.test(filterText);
            if (hasSpaceOrEnd && groupMembers && groupMembers.length > 0) {
                const lowerFilter = filterText.toLowerCase();
                const filtered = groupMembers
                    .filter((m) => m.id !== currentUserId && m.username.toLowerCase().includes(lowerFilter))
                    .slice(0, 8);
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
                    {isGroupChat && targetMsg && isOtherMemberMessage(targetMsg, currentUserId) && onAddFriend && (
                        <button
                            type="button"
                            className="message-action-btn"
                            role="menuitem"
                            onClick={() => {
                                if (globalThis.confirm(`发送好友请求给 ${targetMsg.senderUsername || '用户'}？`)) {
                                    onAddFriend(targetMsg.senderId, targetMsg.senderUsername || '用户');
                                }
                                closeMessageActionMenu();
                            }}
                        >
                            添加好友
                        </button>
                    )}
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
                <div className="chat-header-search-wrap" ref={searchPanelRef}>
                    <button
                        type="button"
                        className="chat-header-search-btn"
                        aria-label="搜索与筛选"
                        onClick={() => {
                            setShowSearchPanel((prev) => {
                                if (prev) {
                                    setSearchKeyword('');
                                    setSearchResults([]);
                                }
                                return !prev;
                            });
                        }}
                    >
                        &#128269;
                    </button>
                    {showSearchPanel && (
                        <div className="chat-header-search-panel">
                            <div className="search-panel-section">
                                <div className="search-panel-label">搜索消息</div>
                                <div className="search-panel-keyword-row">
                                    <input
                                        type="text"
                                        className="search-panel-input"
                                        placeholder="输入关键词..."
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                                    />
                                    <button
                                        type="button"
                                        className="search-panel-search-btn"
                                        disabled={!searchKeyword.trim() || searchLoading}
                                        onClick={handleSearch}
                                    >
                                        {searchLoading ? '...' : '搜索'}
                                    </button>
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="search-panel-results">
                                        {searchResults.map((r) => (
                                            <div
                                                key={r.message_id}
                                                className="search-panel-result-item"
                                                onClick={() => {
                                                    setShowSearchPanel(false);
                                                    setSearchKeyword('');
                                                    setSearchResults([]);
                                                    onNavigateToChat?.(r.conversation_id, r.message_id, r.timestamp);
                                                }}
                                            >
                                                <span className="search-panel-result-conv">{r.conversation_name}</span>
                                                <span className="search-panel-result-sender">{r.sender.username}</span>
                                                <span className="search-panel-result-text">{r.content.slice(0, 60)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="search-panel-section">
                                <div className="search-panel-label">筛选当前会话</div>
                                <div className="search-panel-filter-row">
                                    <label className="search-panel-filter-label">发送人:</label>
                                    <select
                                        className="search-panel-select"
                                        value={draftSenderId}
                                        onChange={(e) => setDraftSenderId(Number(e.target.value))}
                                    >
                                        <option value={0}>全部</option>
                                        {groupMembers?.map((m) => (
                                            <option key={m.id} value={m.id}>{m.username}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="search-panel-filter-row">
                                    <label className="search-panel-filter-label">起始:</label>
                                    <input
                                        type="date"
                                        className="search-panel-date"
                                        value={draftStartDate}
                                        onChange={(e) => setDraftStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="search-panel-filter-row">
                                    <label className="search-panel-filter-label">截止:</label>
                                    <input
                                        type="date"
                                        className="search-panel-date"
                                        value={draftEndDate}
                                        onChange={(e) => setDraftEndDate(e.target.value)}
                                    />
                                </div>
                                <div className="search-panel-filter-actions">
                                    <button type="button" className="search-panel-filter-apply" disabled={filterLoading} onClick={handleApplyFilter}>
                                        {filterLoading ? '筛选...' : '应用筛选'}
                                    </button>
                                    <button type="button" className="search-panel-filter-clear" onClick={handleClearFilter}>
                                        清除
                                    </button>
                                </div>
                                {filterResults.length > 0 && (
                                    <div className="search-panel-results" style={{ marginTop: 12 }}>
                                        <div className="search-panel-label">筛选结果 ({filterResults.length} 条)</div>
                                        {filterResults.map((r) => (
                                            <div
                                                key={r.message_id}
                                                className="search-panel-result-item"
                                                onClick={() => {
                                                    setShowSearchPanel(false);
                                                    setFilterResults([]);
                                                    setDraftSenderId(0);
                                                    setDraftStartDate('');
                                                    setDraftEndDate('');
                                                    onNavigateToChat?.(r.conversation_id, r.message_id, r.timestamp);
                                                }}
                                            >
                                                <span className="search-panel-result-sender">
                                                    {new Date(r.timestamp).toLocaleDateString()} {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {r.sender.username}
                                                </span>
                                                <span className="search-panel-result-text">{r.content.slice(0, 80)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
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

            {isGroupChat && pendingGroupAnnouncement && pendingGroupAnnouncement.author_id !== currentUserId ? (
                <div className="group-announcement-banner" role="note" aria-live="polite">
                    <p className="group-announcement-banner-label">群公告</p>
                    <p className="group-announcement-banner-content">{pendingGroupAnnouncement.content}</p>
                    {pendingGroupAnnouncement.author_name ? (
                        <p className="group-announcement-banner-meta">发布者：{pendingGroupAnnouncement.author_name}</p>
                    ) : null}
                    <button
                        type="button"
                        className="group-announcement-banner-confirm"
                        disabled={announcementAckSubmitting}
                        onClick={async () => {
                            if (!onAcknowledgeGroupAnnouncement || announcementAckSubmitting) {
                                return;
                            }
                            setAnnouncementAckSubmitting(true);
                            try {
                                await onAcknowledgeGroupAnnouncement(pendingGroupAnnouncement.id);
                            } catch (err) {
                                alert(err instanceof Error ? err.message : '确认失败');
                            } finally {
                                setAnnouncementAckSubmitting(false);
                            }
                        }}
                    >
                        {announcementAckSubmitting ? '确认中...' : '确认'}
                    </button>
                </div>
            ) : null}

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
                <div
                    className="message-list-virtual-inner"
                    style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const msg = messages[virtualRow.index];
                        if (!msg) {
                            return null;
                        }
                        return (
                            <div
                                key={virtualRow.key}
                                data-index={virtualRow.index}
                                ref={virtualizer.measureElement}
                                className="message-list-virtual-item"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <MessageRow
                                    msg={msg}
                                    currentUserId={currentUserId}
                                    isGroupChat={isGroupChat}
                                    groupMembers={groupMembers}
                                    highlightMessageKey={highlightMessageKey}
                                    onScrollToMessage={scrollToMessageByKey}
                                    onRetryMessage={onRetryMessage}
                                    onPointerEnter={handleMessageRowPointerEnter}
                                    onPointerLeave={handleMessageRowPointerLeave}
                                    onContextMenu={handleMessageRowContextMenu}
                                />
                            </div>
                        );
                    })}
                </div>
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

            {mentionTargetMessageId && (
                <button
                    type="button"
                    className="mention-jump-button"
                    aria-label="有人@你，点击定位"
                    onClick={() => {
                        scrollToMessageByKey(`id:${mentionTargetMessageId}`, 'smooth');
                        onClearMentionTarget?.();
                    }}
                >
                    有人@你
                </button>
            )}

            {messageActionMenuPortal}

            {mentionSuggest?.visible && mentionPosition && 
                createPortal(
                    <div 
                        ref={mentionSuggestRef}
                        className="mention-suggestions"
                        role="listbox"
                        style={{
                            position: 'fixed',
                            left: mentionPosition.x,
                            top: mentionPosition.y,
                            transform: 'translateY(-100%)',
                        }}
                    >
                        {mentionSuggest.members.map((member, index) => (
                            <div
                                key={member.id}
                                role="option"
                                style={{
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                }}
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
        setLocalScrollTarget(null);
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
