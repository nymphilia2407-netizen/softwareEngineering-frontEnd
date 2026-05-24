import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';

import { BACKENDURL, DEFAULT_AVATAR } from '../constants/string';
import { mapChatRoom, mapFriendSummary } from '../mappers/chat';
import { getChatRooms, getUnreadMentions } from '../services/chat';
import { getFriendList, getReceivedFriendRequests } from '../services/friend';
import { getMyInvitations } from '../services/group';
import { getCurrentUser } from '../services/user';
import { createChatWebSocketClient, type ChatSocketEvent, type ChatWebSocketClient } from '../services/websocket';
import type { ChatListItem } from '../types/chat';
import type { Group, Message, User } from '../types/entity';
import { persistUserProfile, tokenUtils } from '../utils/auth';
import {
    cacheAvatarsFromChatRooms,
    cacheAvatarsFromFriends,
    resolvedUserAvatar,
    setCachedAvatar,
} from '../utils/avatar';
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
    setProfilePhone: Dispatch<SetStateAction<string>>;
    setUserEmail: Dispatch<SetStateAction<string>>;
    setFriends: Dispatch<SetStateAction<User[]>>;
    setChatRooms: Dispatch<SetStateAction<ChatListItem[]>>;
    setActiveChatId: Dispatch<SetStateAction<number>>;
    setMessageStore: Dispatch<SetStateAction<Record<number, Message[]>>>;
    setGroupSyncToast: Dispatch<SetStateAction<string | null>>;
    setGroups: Dispatch<SetStateAction<Group[]>>;
    setPendingFriendRequestCount: Dispatch<SetStateAction<number>>;
    setMyInvitationCount: Dispatch<SetStateAction<number>>;
    setMentionTargetMap: Dispatch<SetStateAction<Record<number, number>>>;
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
        setProfilePhone,
        setUserEmail,
        setFriends,
        setChatRooms,
        setActiveChatId,
        setMessageStore,
        setGroupSyncToast,
        setGroups,
        setPendingFriendRequestCount,
        setMyInvitationCount,
        setMentionTargetMap,
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
                setProfilePhone(currentUser.phone ?? '');
                setUserEmail(currentUser.email ?? '');
                setCachedAvatar(currentUser.user_id, resolvedAvatar);
                persistUserProfile({
                    username: currentUser.username,
                    avatar: resolvedAvatar,
                    birthday: currentUser.birthday ?? '',
                    address: currentUser.address ?? '',
                    signature: currentUser.signature ?? '',
                    phone: currentUser.phone ?? '',
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

                cacheAvatarsFromFriends(friendList);
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

                cacheAvatarsFromChatRooms(roomList);
                const mappedRooms = roomList.map(mapChatRoom);
                setChatRooms((prev) => {
                    const prevMap = new Map(prev.map((r) => [r.id, r]));
                    return sortChatRoomsForDisplay(
                        mappedRooms.map((mapped) => {
                            const existing = prevMap.get(mapped.id);
                            if (existing?.hasUnreadMention) {
                                mapped.hasUnreadMention = true;
                            }
                            return mapped;
                        }),
                    );
                });
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
                const activeConv = activeChatIdRef.current;
                const convIds = new Set(mentions.map((m) => m.conversation_id));
                if (convIds.size > 0) {
                    setChatRooms((prev) =>
                        prev.map((r) =>
                            convIds.has(r.id) && r.id !== activeConv
                                ? { ...r, hasUnreadMention: true }
                                : r,
                        ),
                    );
                }
            })
            .catch(() => {});

        getMyInvitations()
            .then((invitations) => {
                if (!cancelled) {
                    setMyInvitationCount(invitations.length);
                }
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

                        // 群列表与人数由紧随其后的 syncChatRoomsAndGroups 从会话接口同步，避免先写入 memberCount: 0
                    } else if (d.action === 'avatar_updated') {
                        const displayName = d.group_name?.trim() || '群聊';
                        setGroupSyncToast(`「${displayName}」群头像已更新`);
                    } else if (d.action === 'member_joined') {
                        const displayName = d.group_name?.trim() || '群聊';
                        const joinedNames = d.joined_usernames?.join(', ') || '';
                        const operator = d.operator_username?.trim();
                        const selfName = userNameRef.current?.trim();
                        const joinedSelf = d.joined_user_ids?.includes(currentUserIdRef.current);
                        if (joinedSelf) {
                            setGroupSyncToast(`你已被 ${operator} 邀请加入群聊「${displayName}」`);
                            setMessageStore((prev) => {
                                const next = { ...prev };
                                delete next[d.conversation_id];
                                return next;
                            });
                            void syncChatRoomsAndGroups();
                        } else if (operator && operator === selfName) {
                            setGroupSyncToast(`你已将 ${joinedNames} 加入群聊「${displayName}」`);
                        } else {
                            setGroupSyncToast(`${joinedNames} 加入了群聊「${displayName}」`);
                        }
                    } else if (d.action === 'invitation_pending') {
                        const displayName = d.group_name?.trim() || '群聊';
                        const inviter = d.inviter_username?.trim() || '';
                        const isInvitee = d.invitee_user_ids?.includes(currentUserIdRef.current);
                        if (isInvitee) {
                            setGroupSyncToast(`${inviter} 邀请你加入群聊「${displayName}」`);
                            getMyInvitations()
                                .then((list) => setMyInvitationCount(list.length))
                                .catch(() => {});
                        } else {
                            setGroupSyncToast(`${inviter} 在「${displayName}」中发起了成员邀请，请前往会话信息审核`);
                        }
                    } else if (d.action === 'mute_updated') {
                        const displayName = d.group_name?.trim() || '群聊';
                        const isSelf = d.user_id === currentUserIdRef.current;
                        if (d.muted_until) {
                            const until = new Date(d.muted_until);
                            const minutes = Math.round((until.getTime() - Date.now()) / 60000);
                            const duration = minutes >= 60
                                ? `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`
                                : `${minutes}分钟`;
                            if (isSelf) {
                                setGroupSyncToast(`你已被禁言${duration}（群聊[${displayName}]）`);
                            }
                        } else {
                            if (isSelf) {
                                setGroupSyncToast(`你已被解除禁言（群聊[${displayName}]）`);
                            }
                        }
                    }

                    if (d.action !== 'avatar_updated') {
                        getMyInvitations()
                            .then((list) => setMyInvitationCount(list.length))
                            .catch(() => {});
                    }

                    void syncChatRoomsAndGroups();
                }

                if (event.type === 'friend_request') {
                    setPendingFriendRequestCount((prev) => prev + 1);
                }

                if (event.type === 'mention') {
                    const d = event.data;
                    setMentionTargetMap((prev) => ({ ...prev, [d.conversation_id]: d.message_id }));
                    if (d.conversation_id !== activeChatIdRef.current) {
                        setChatRooms((prev) =>
                            prev.map((r) =>
                                r.id === d.conversation_id ? { ...r, hasUnreadMention: true } : r,
                            ),
                        );
                    }
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
        setMentionTargetMap,
        setMessageStore,
        setMyAvatar,
        setMyInvitationCount,
        setPendingFriendRequestCount,
        setProfileAddress,
        setProfileBirthday,
        setProfileSignature,
        setProfilePhone,
        setUserEmail,
        setUserName,
        socketRef,
        subscribeWsRoom,
        syncChatRoomsAndGroups,
        syncGroupList,
        userNameRef,
    ]);
}
