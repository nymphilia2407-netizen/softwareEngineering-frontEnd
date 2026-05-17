import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';

import { BACKENDURL, DEFAULT_AVATAR } from '../constants/string';
import { mapChatRoom, mapFriendSummary } from '../mappers/chat';
import { getChatRooms, getUnreadMentions } from '../services/chat';
import { getFriendList, getReceivedFriendRequests } from '../services/friend';
import { getCurrentUser } from '../services/user';
import { createChatWebSocketClient, type ChatSocketEvent, type ChatWebSocketClient } from '../services/websocket';
import type { ChatListItem } from '../types/chat';
import type { Group, Message, User } from '../types/entity';
import { persistUserProfile, tokenUtils } from '../utils/auth';
import { resolvedUserAvatar } from '../utils/avatar';
import { clearUnreadRoom, sortChatRoomsForDisplay, updateRoomOnIncomingMessage } from '../utils/chatRoomList';
import {
    applyReadReceiptToMessages,
    formatIncomingMessage,
    replaceOrAppendIncomingMessage,
} from '../utils/messageStore';

export type IndexBootstrapSocketParams = {
    socketRef: RefObject<ChatWebSocketClient | null>;
    pendingSendTimers: MutableRefObject<Record<string, ReturnType<typeof setTimeout> | null>>;
    currentUserIdRef: MutableRefObject<number>;
    activeChatIdRef: MutableRefObject<number>;
    userNameRef: MutableRefObject<string>;
    subscribeWsRoom: (conversationId: number) => void;
    syncChatRoomsAndGroups: () => Promise<void>;
    syncGroupList: () => Promise<void>;
    setCurrentUserId: Dispatch<SetStateAction<number>>;
    setUserName: Dispatch<SetStateAction<string>>;
    setMyAvatar: Dispatch<SetStateAction<string>>;
    setProfileBirthday: Dispatch<SetStateAction<string>>;
    setProfileAddress: Dispatch<SetStateAction<string>>;
    setProfileSignature: Dispatch<SetStateAction<string>>;
    setUserEmail: Dispatch<SetStateAction<string>>;
    setFriends: Dispatch<SetStateAction<User[]>>;
    setChatRooms: Dispatch<SetStateAction<ChatListItem[]>>;
    setActiveChatId: Dispatch<SetStateAction<number>>;
    setMessageStore: Dispatch<SetStateAction<Record<number, Message[]>>>;
    setGroupSyncToast: Dispatch<SetStateAction<string | null>>;
    setGroups: Dispatch<SetStateAction<Group[]>>;
    setPendingFriendRequestCount: Dispatch<SetStateAction<number>>;
    setMentionToast: Dispatch<SetStateAction<string | null>>;
    setMentionCount: Dispatch<SetStateAction<number>>;
};

export function useIndexBootstrapAndSocket(params: IndexBootstrapSocketParams) {
    const {
        socketRef,
        pendingSendTimers,
        currentUserIdRef,
        activeChatIdRef,
        userNameRef,
        subscribeWsRoom,
        syncChatRoomsAndGroups,
        syncGroupList,
        setCurrentUserId,
        setUserName,
        setMyAvatar,
        setProfileBirthday,
        setProfileAddress,
        setProfileSignature,
        setUserEmail,
        setFriends,
        setChatRooms,
        setActiveChatId,
        setMessageStore,
        setGroupSyncToast,
        setGroups,
        setPendingFriendRequestCount,
        setMentionToast,
        setMentionCount,
    } = params;

    useEffect(() => {
        let cancelled = false;

        const syncCurrentUser = async () => {
            try {
                const currentUser = await getCurrentUser();

                if (cancelled) {
                    return;
                }

                setCurrentUserId(currentUser.user_id);
                setUserName(currentUser.username);
                const resolvedAvatar =
                    currentUser.avatar && currentUser.avatar.length > 0 ? currentUser.avatar : DEFAULT_AVATAR;
                setMyAvatar(resolvedAvatar);
                setProfileBirthday(currentUser.birthday);
                setProfileAddress(currentUser.address);
                setProfileSignature(currentUser.signature);
                setUserEmail(currentUser.email ?? '');
                persistUserProfile({
                    username: currentUser.username,
                    avatar: resolvedAvatar,
                    birthday: currentUser.birthday ?? '',
                    address: currentUser.address ?? '',
                    signature: currentUser.signature ?? '',
                });
            } catch (error) {
                console.error('获取当前用户失败:', error);
            }
        };

        const syncFriendList = async () => {
            try {
                const friendList = await getFriendList();

                if (cancelled) {
                    return;
                }

                setFriends(friendList.map(mapFriendSummary));
            } catch (error) {
                console.error('获取好友列表失败:', error);
                setFriends([]);
            }
        };

        getReceivedFriendRequests()
            .then((requests) => {
                if (!cancelled) {
                    setPendingFriendRequestCount(requests.length);
                }
            })
            .catch(() => {});

        const syncChatRooms = async () => {
            try {
                const roomList = await getChatRooms();

                if (cancelled) {
                    return;
                }

                const mappedRooms = roomList.map(mapChatRoom);
                setChatRooms(sortChatRoomsForDisplay(mappedRooms));
                setActiveChatId((currentActiveChatId) => currentActiveChatId || mappedRooms[0]?.id || 0);
            } catch (error) {
                console.error('获取会话列表失败:', error);
                setChatRooms([]);
            }
        };

        const token = tokenUtils.getToken();

        void syncCurrentUser();
        void syncFriendList();
        void syncChatRooms();
        void syncGroupList();

        getUnreadMentions()
            .then((mentions) => {
                if (cancelled) return;
                const convIds = new Set(mentions.map((m) => m.conversation_id));
                if (convIds.size > 0) {
                    setChatRooms((prev) =>
                        prev.map((r) =>
                            convIds.has(r.id) ? { ...r, hasUnreadMention: true } : r,
                        ),
                    );
                }
                setMentionCount(mentions.length);
            })
            .catch(() => {});

        if (token) {
            const client = createChatWebSocketClient({
                backendUrl: BACKENDURL,
                token,
                autoReconnect: true,
                reconnectDelayMs: 3000,
            });

            socketRef.current = client;

            const unsubscribeMessage = client.onMessage((event: ChatSocketEvent) => {
                if (event.type === 'new_message') {
                    const incomingMsg = formatIncomingMessage(event.data);

                    setMessageStore((prev) => {
                        const result = replaceOrAppendIncomingMessage(prev, incomingMsg, currentUserIdRef.current);

                        if (result.consumedClientId) {
                            const timer = pendingSendTimers.current[result.consumedClientId];
                            if (timer) {
                                clearTimeout(timer);
                            }

                            delete pendingSendTimers.current[result.consumedClientId];
                        }

                        return result.nextStore;
                    });

                    setChatRooms((prevRooms) =>
                        updateRoomOnIncomingMessage(
                            prevRooms,
                            incomingMsg,
                            currentUserIdRef.current,
                            activeChatIdRef.current,
                        ),
                    );
                }

                if (event.type === 'read_receipt') {
                    setMessageStore((prev) => applyReadReceiptToMessages(prev, event.data, currentUserIdRef.current));
                    setChatRooms((prev) => clearUnreadRoom(prev, event.data.conversation_id));
                }

                if (event.type === 'error') {
                    console.error('Chat WebSocket:', event.message);
                    if (event.message?.toLowerCase().includes('muted') || event.message?.includes('禁言')) {
                        setGroupSyncToast('你已被禁言，暂时无法发送消息');
                    }
                }

                if (event.type === 'group_sync') {
                    const d = event.data;
                    subscribeWsRoom(d.conversation_id);

                    if (d.action === 'created') {
                        const displayName = d.group_name?.trim() || '群聊';
                        const creator = d.creator_username?.trim();
                        const selfName = userNameRef.current?.trim();
                        if (creator && creator === selfName) {
                            setGroupSyncToast(`群聊「${displayName}」已创建，成员将同步收到`);
                        } else {
                            const suffix = creator ? `（${creator} 创建）` : '';
                            setGroupSyncToast(`新群聊「${displayName}」已加入会话与联系人${suffix}`);
                        }

                        setChatRooms((prev) => {
                            if (prev.some((room) => room.id === d.conversation_id)) {
                                return prev;
                            }

                            const row: ChatListItem = {
                                id: d.conversation_id,
                                name: displayName,
                                avatar: resolvedUserAvatar(d.avatar || ''),
                                lastMessage: '[最近暂无消息]',
                                lastTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                unreadCount: 0,
                                otherUserId: null,
                                isGroup: true,
                                isMuted: false,
                                isPinned: false,
                            };

                            return sortChatRoomsForDisplay([row, ...prev]);
                        });

                        setGroups((prev) => {
                            if (prev.some((g) => g.id === d.conversation_id)) {
                                return prev;
                            }

                            const next: Group = {
                                id: d.conversation_id,
                                groupname: displayName,
                                avatar: resolvedUserAvatar(d.avatar || ''),
                                ownerId: 0,
                                adminIds: [],
                                memberCount: 0,
                                createdTime: Date.now(),
                            };

                            return [next, ...prev];
                        });
                    } else if (d.action === 'avatar_updated') {
                        const displayName = d.group_name?.trim() || '群聊';
                        setGroupSyncToast(`「${displayName}」群头像已更新`);
                    }

                    void syncChatRoomsAndGroups();
                }

                if (event.type === 'friend_request') {
                    setPendingFriendRequestCount((prev) => prev + 1);
                }

                if (event.type === 'mention') {
                    const d = event.data;
                    setChatRooms((prev) =>
                        prev.map((r) =>
                            r.id === d.conversation_id ? { ...r, hasUnreadMention: true } : r,
                        ),
                    );
                    setMentionCount((prev) => prev + 1);
                    setMentionToast(
                        `${d.from_username} 在群聊中@了你`,
                    );
                }
            });

            const unsubscribeStatus = client.onStatusChange((status: 'connecting' | 'open' | 'closed' | 'error') => {
                console.log('WebSocket status:', status);
            });

            client.connect();

            return () => {
                cancelled = true;
                unsubscribeMessage();
                unsubscribeStatus();
                client.disconnect();
                socketRef.current = null;

                Object.values(pendingSendTimers.current).forEach((t) => {
                    if (t) {
                        clearTimeout(t);
                    }
                });
                pendingSendTimers.current = {};
            };
        }

        return () => {
            cancelled = true;

            Object.values(pendingSendTimers.current).forEach((t) => {
                if (t) {
                    clearTimeout(t);
                }
            });
            pendingSendTimers.current = {};
        };
    }, [
        activeChatIdRef,
        currentUserIdRef,
        pendingSendTimers,
        setActiveChatId,
        setChatRooms,
        setCurrentUserId,
        setFriends,
        setGroupSyncToast,
        setGroups,
        setMentionCount,
        setMentionToast,
        setMessageStore,
        setMyAvatar,
        setPendingFriendRequestCount,
        setProfileAddress,
        setProfileBirthday,
        setProfileSignature,
        setUserEmail,
        setUserName,
        socketRef,
        subscribeWsRoom,
        syncChatRoomsAndGroups,
        syncGroupList,
        userNameRef,
    ]);
}
