import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChatList from '../components/chatList';
import ContactList from '../components/contactList';
import ContactSessionDetail from '../components/contactSessionDetail';
import ChatSessionDetail from '../components/chatSessionDetail';
import ChatWindow from '../components/chatWindow';
import GroupSyncToast from '../components/main/GroupSyncToast';
import MainSidebar from '../components/main/MainSidebar';
import SettingsListActions from '../components/main/SettingsListActions';
import SettingsPanel from '../components/settingsPanel';

import { CHATICON, CONFIGICON, CONTACTICON } from '../constants/string';
import { useActiveChatHistory } from '../hooks/useActiveChatHistory';
import { useIndexBootstrapAndSocket } from '../hooks/useIndexBootstrapAndSocket';
import { useIndexOptimisticSend, type IndexOptimisticRefs } from '../hooks/useIndexOptimisticSend';
import { mapChatRoom, mapFriendSummary, mapGroupSummary, groupSummariesFromRoomList } from '../mappers/chat';
import { getChatRooms, setConversationMuted, setConversationPinned } from '../services/chat';
import { createGroup, getGroupList, updateGroupAvatar } from '../services/group';
import { getFriendList } from '../services/friend';
import { deleteUser } from '../services/user';
import type { ChatWebSocketClient } from '../services/websocket';
import type { ActiveTabType, ChatListItem } from '../types/chat';
import type { Group, Message, User } from '../types/entity';
import { persistUserProfile, tokenUtils } from '../utils/auth';
import { resolvedUserAvatar } from '../utils/avatar';
import { clearUnreadRoom, sortChatRoomsForDisplay } from '../utils/chatRoomList';
import { decodeTokenPayload, readInitialUserFromLocalCache } from '../utils/jwtProfile';

import '../styles/index.css';

export default function Index() {
    const tokenPayload = decodeTokenPayload();
    const profileBoot = useMemo(() => readInitialUserFromLocalCache(), []);
    const [currentUserId, setCurrentUserId] = useState<number>(tokenPayload?.user_id ?? 0);
    const [userName, setUserName] = useState<string>(tokenPayload?.username ?? '');
    const [myAvatar, setMyAvatar] = useState<string>(profileBoot.avatar);
    const [activeTab, setActiveTab] = useState<ActiveTabType>('chat');
    const [settingsPanel, setSettingsPanel] = useState<'menu' | 'profile' | 'security'>('menu');
    const [userEmail, setUserEmail] = useState<string>('');
    const [activeChatId, setActiveChatId] = useState<number>(0);
    const [selectedContact, setSelectedContact] = useState<User | null>(null);
    const [friends, setFriends] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [chatRooms, setChatRooms] = useState<ChatListItem[]>([]);
    const [messageStore, setMessageStore] = useState<Record<number, Message[]>>({});
    const [chatSessionInfoOpen, setChatSessionInfoOpen] = useState<boolean>(false);
    const [profileBirthday, setProfileBirthday] = useState<string>(profileBoot.profileBirthday);
    const [profileAddress, setProfileAddress] = useState<string>(profileBoot.profileAddress);
    const [profileSignature, setProfileSignature] = useState<string>(profileBoot.profileSignature);
    const [entryUnreadHintCount, setEntryUnreadHintCount] = useState<number>(0);
    const [groupSyncToast, setGroupSyncToast] = useState<string | null>(null);
    const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0);

    const socketRef = useRef<ChatWebSocketClient | null>(null);
    const currentUserIdRef = useRef<number>(currentUserId);
    const activeChatIdRef = useRef<number>(activeChatId);
    const userNameRef = useRef<string>(userName);
    const myAvatarRef = useRef<string>(myAvatar);
    const pendingSendTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
    const messageStoreRef = useRef<Record<number, Message[]>>(messageStore);
    /** 乐观消息的临时负数 id，保证同毫秒内多次发送也不与 React key 冲突 */
    const optimisticIdSeqRef = useRef(0);
    /** 已在 WS 上 subscribe_room 的会话；新建私聊在连接之后才出现，必须补订阅才能收到发消息回执 */
    const subscribedWsRoomsRef = useRef<Set<number>>(new Set());
    // 用于展示联系人具体信息（好友 / 群）
    const [contactDetailUserId, setContactDetailUserId] = useState<number | null>(null);
    const [contactDetailGroupId, setContactDetailGroupId] = useState<number | null>(null);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    useEffect(() => {
        if (!activeChatId) {
            setChatSessionInfoOpen(false);
        }
    }, [activeChatId]);

    useEffect(() => {
        userNameRef.current = userName;
    }, [userName]);

    useEffect(() => {
        myAvatarRef.current = myAvatar;
    }, [myAvatar]);

    useEffect(() => {
        messageStoreRef.current = messageStore;
    }, [messageStore]);

    const activeChatIsGroup = useMemo(
        () => chatRooms.find((room) => room.id === activeChatId)?.isGroup ?? false,
        [chatRooms, activeChatId]
    );

    const refreshFriendsAndRooms = useCallback(async () => {
        try {
            const [friendList, roomList] = await Promise.all([getFriendList(), getChatRooms()]);
            setFriends(friendList.map(mapFriendSummary));
            setChatRooms(sortChatRoomsForDisplay(roomList.map(mapChatRoom)));
        } catch (error) {
            console.error('刷新好友或会话失败:', error);
        }
    }, []);

    const syncChatRoomsAndGroups = useCallback(async () => {
        try {
            const roomList = await getChatRooms();
            setChatRooms(sortChatRoomsForDisplay(roomList.map(mapChatRoom)));
            setGroups(groupSummariesFromRoomList(roomList));
        } catch (error) {
            console.error('同步群会话列表失败:', error);
        }
    }, []);

    const subscribeWsRoom = useCallback((conversationId: number) => {
        if (!conversationId) {
            return;
        }

        socketRef.current?.send({
            type: 'subscribe_room',
            data: { conversation_id: conversationId },
        });
    }, []);

    useEffect(() => {
        for (const room of chatRooms) {
            if (!room.id || subscribedWsRoomsRef.current.has(room.id)) {
                continue;
            }
            subscribedWsRoomsRef.current.add(room.id);
            subscribeWsRoom(room.id);
        }
    }, [chatRooms, subscribeWsRoom]);

    useEffect(() => {
        if (!groupSyncToast) {
            return;
        }

        const timer = globalThis.setTimeout(() => setGroupSyncToast(null), 4800);
        return () => globalThis.clearTimeout(timer);
    }, [groupSyncToast]);

    /** 对方同意好友请求后发起方无推送：切到联系人或回到前台时同步列表 */
    useEffect(() => {
        if (activeTab !== 'contacts') {
            return;
        }

        void refreshFriendsAndRooms();
    }, [activeTab, refreshFriendsAndRooms]);

    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            debounceTimer = setTimeout(() => {
                void refreshFriendsAndRooms();
                debounceTimer = null;
            }, 400);
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [refreshFriendsAndRooms]);

    const syncGroupList = useCallback(async () => {
        try {
            const groupList = await getGroupList();
            setGroups(groupList.map(mapGroupSummary));
        } catch (error) {
            console.error('获取群聊列表失败:', error);
            setGroups([]);
        }
    }, []);

    useIndexBootstrapAndSocket({
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
    });

    const chatListData: ChatListItem[] = chatRooms;
    const totalUnreadCount = useMemo(
        () => chatListData.reduce((sum, room) => sum + Math.max(0, room.unreadCount || 0), 0),
        [chatListData]
    );
    const messages = messageStore[activeChatId] ?? [];
    const activeChat = activeChatId ? chatListData.find((chat) => chat.id === activeChatId) ?? null : null;
    const activeChatName = activeChat?.name ?? selectedContact?.username ?? '';

    useActiveChatHistory(activeChatId, setMessageStore);

    const optimisticRefs = useMemo<IndexOptimisticRefs>(
        () => ({
            socketRef,
            pendingSendTimers,
            messageStoreRef,
            currentUserIdRef,
            userNameRef,
            myAvatarRef,
            optimisticIdSeqRef,
        }),
        [],
    );

    const { handleSendMessage, handleRetryMessage } = useIndexOptimisticSend(
        activeChatId,
        messageStore,
        optimisticRefs,
        activeChatIdRef,
        setMessageStore,
        setChatRooms,
    );

    const handleReadMessage = (convId: number, lastMsgId: number) => {
        if (lastMsgId > 0) {
            socketRef.current?.send({
                type: 'read_message',
                data: { conversation_id: convId, last_read_message_id: lastMsgId },
            });
        }

        // 乐观设置该会话为已读（前端显示）
        setChatRooms((prev) => prev.map((r) => (r.id === convId ? { ...r, unreadCount: 0 } : r)));
        /** 不在此处立刻 getChatRooms：服务端 last_read 可能尚未落库，拉列表会把角标又刷回非 0 */
    };

    const handleCreateGroup = async ({
        groupName,
        memberIds,
        avatar,
        clientRequestId,
    }: {
        groupName: string;
        memberIds: number[];
        avatar?: string;
        clientRequestId: string;
    }) => {
        try {
            const createdGroup = await createGroup({
                group_name: groupName,
                member_ids: memberIds,
                client_request_id: clientRequestId,
            });

            const optimisticAvatar = resolvedUserAvatar(avatar ?? createdGroup.avatar);

            if (avatar) {
                void updateGroupAvatar(createdGroup.room_id, avatar).catch((err) => {
                    console.error('群头像上传失败:', err);
                });
            }

            subscribeWsRoom(createdGroup.room_id);

            setActiveTab('chat');
            setSelectedContact(null);
            setContactDetailUserId(null);
            setContactDetailGroupId(null);
            setEntryUnreadHintCount(0);
            setActiveChatId(createdGroup.room_id);

            const mappedGroup = mapGroupSummary({
                ...createdGroup,
                avatar: optimisticAvatar,
            });
            setGroups((currentGroups) => [mappedGroup, ...currentGroups.filter((group) => group.id !== mappedGroup.id)]);
            setChatRooms((currentRooms) =>
                sortChatRoomsForDisplay([
                    {
                        id: createdGroup.room_id,
                        name: createdGroup.group_name,
                        avatar: optimisticAvatar,
                        lastMessage: '[最近暂无消息]',
                        lastTime: new Date(createdGroup.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        unreadCount: 0,
                        otherUserId: null,
                        isGroup: true,
                        isMuted: false,
                        isPinned: false,
                    },
                    ...currentRooms.filter((room) => room.id !== createdGroup.room_id),
                ]),
            );
        } catch (error) {
            console.error('创建群聊失败:', error);
            alert(error instanceof Error ? error.message : '创建群聊失败');
        }
    };

    const handleConversationMutedChange = useCallback(async (muted: boolean) => {
        const convId = activeChatIdRef.current;
        if (!convId) {
            return;
        }

        await setConversationMuted(convId, muted);
        setChatRooms((prev) =>
            sortChatRoomsForDisplay(
                prev.map((room) =>
                    room.id === convId ? { ...room, isMuted: muted, unreadCount: muted ? 0 : room.unreadCount } : room,
                ),
            ),
        );
    }, []);

    const handleConversationPinnedChange = useCallback(async (pinned: boolean) => {
        const convId = activeChatIdRef.current;
        if (!convId) {
            return;
        }

        await setConversationPinned(convId, pinned);
        setChatRooms((prev) =>
            sortChatRoomsForDisplay(
                prev.map((room) => (room.id === convId ? { ...room, isPinned: pinned } : room)),
            ),
        );
    }, []);

    const handleChatDeleted = useCallback(() => {
        const convId = activeChatIdRef.current;
        setChatSessionInfoOpen(false);
        setActiveChatId(0);
        setSelectedContact(null);
        setContactDetailUserId(null);
        setContactDetailGroupId(null);
        
        // 清除该会话，并删除本地存储的消息（目前只能实现一侧的，另一侧需要手动刷新）
        setChatRooms(prev => prev.filter(room => room.id !== convId));
        setMessageStore(prev => {
            const next = { ...prev };
            delete next[convId];
            return next;
        });

        // 刷新列表
        void refreshFriendsAndRooms();
        void syncGroupList();
    }, [refreshFriendsAndRooms, syncGroupList]);

    const handleLogout = () => {
        const isConfirmed = globalThis.confirm('确认要退出登录吗？');
        if (!isConfirmed) {
            return;
        }

        socketRef.current?.disconnect();
        tokenUtils.removeToken();
        globalThis.location.reload();
    };

    const handleDeleteAccount = async () => {
        const success = await deleteUser();

        if (success) {
            alert('账号已注销');
            localStorage.clear();
            socketRef.current?.disconnect();
            tokenUtils.removeToken();
            globalThis.location.reload();
        } else {
            alert('注销失败，请稍后重试');
        }
    };

    // 在好友详情界面里删除好友的接口
    const handleFriendDetailDeleted = useCallback(() => {
        const userId = contactDetailUserId;
        if (!userId) return;
        
        setContactDetailUserId(null);
        setContactDetailGroupId(null);
        setActiveChatId(0);
        setSelectedContact(null);
        
        // 清理对应会话
        const convId = chatRooms.find(r => r.otherUserId === userId)?.id;
        if (convId) {
            setChatRooms(prev => prev.filter(r => r.id !== convId));
            setMessageStore(prev => {
                const next = { ...prev };
                delete next[convId];
                return next;
            });
        }
        
        void refreshFriendsAndRooms();
    }, [contactDetailUserId, chatRooms, refreshFriendsAndRooms]);

    // 在好友详情界面进入聊天
    const handleEnterChat = useCallback((userId: number) => {
        const matchedRoom =
            chatRooms.find(room => room.otherUserId === userId) ??
            chatRooms.find(room => !room.isGroup && room.name === selectedContact?.username);
        const roomId = matchedRoom?.id ?? 0;
        
        setContactDetailUserId(null);
        setContactDetailGroupId(null);
        setChatSessionInfoOpen(false);
        setActiveChatId(roomId);
        setEntryUnreadHintCount(matchedRoom ? Math.max(0, matchedRoom.unreadCount || 0) : 0);
    }, [chatRooms, selectedContact]);

    const handleContactGroupEnterChat = useCallback(
        (roomId: number) => {
            const groupRoom = chatRooms.find((room) => room.id === roomId);
            const hint = groupRoom ? Math.max(0, groupRoom.unreadCount || 0) : 0;
            setEntryUnreadHintCount(hint);
            setChatRooms((prev) => clearUnreadRoom(prev, roomId));
            setContactDetailGroupId(null);
            setChatSessionInfoOpen(false);
            setActiveChatId(roomId);
        },
        [chatRooms],
    );

    const handleContactGroupLeftOrDissolved = useCallback(
        (roomId: number) => {
            setActiveChatId((id) => (id === roomId ? 0 : id));
            setMessageStore((prev) => {
                const next = { ...prev };
                delete next[roomId];
                return next;
            });
            setChatRooms((prev) => prev.filter((r) => r.id !== roomId));
            void refreshFriendsAndRooms();
            void syncGroupList();
        },
        [refreshFriendsAndRooms, syncGroupList],
    );

    return (
        <div className="main">
            {groupSyncToast ? <GroupSyncToast message={groupSyncToast} /> : null}
            <MainSidebar
                myAvatar={myAvatar}
                userName={userName}
                activeTab={activeTab}
                totalUnreadCount={totalUnreadCount}
                pendingFriendRequestCount={pendingFriendRequestCount}
                chatIcon={CHATICON}
                contactIcon={CONTACTICON}
                configIcon={CONFIGICON}
                onOpenProfileSettings={() => {
                    setActiveTab('settings');
                    setSettingsPanel('profile');
                }}
                onSelectChat={() => {
                    setActiveTab('chat');
                    setSelectedContact(null);
                    setContactDetailUserId(null);
                    setContactDetailGroupId(null);
                }}
                onSelectContacts={() => setActiveTab('contacts')}
                onOpenSettingsMenu={() => {
                    setActiveTab('settings');
                    setSettingsPanel('menu');
                }}
            />

                <div className="list-area">
                {activeTab === 'settings' && (
                <SettingsListActions
                    settingsPanel={settingsPanel}
                    onSelectProfile={() => {
                        setActiveTab('settings');
                        setSettingsPanel('profile');
                    }}
                    onSelectSecurity={() => {
                        setActiveTab('settings');
                        setSettingsPanel('security');
                    }}
                    onLogout={handleLogout}
                    onDeleteAccount={handleDeleteAccount}
                />
                )}
                {activeTab === 'chat' && (
                    <ChatList
                        chats={chatListData}
                        activeId={activeChatId}
                        onChatClick={(chat) => {
                            const hint = Math.max(0, chat.unreadCount || 0);
                            setEntryUnreadHintCount(hint);
                            /** 与消息窗口内未读提示同源：点进会话即清列表角标，窗口内仍用 hint 跟踪直到读完 */
                            setChatRooms((prev) => clearUnreadRoom(prev, chat.id));
                            setActiveChatId(chat.id);
                            setSelectedContact(null);
                            setChatSessionInfoOpen(false);
                            setActiveTab('chat');
                        }}
                    />
                )}
                {activeTab === 'contacts' && (
                    <ContactList
                        friends={friends}
                        groups={groups}
                        currentUserId={currentUserId}
                        onItemClick={(item, type) => {
                            if (type === 'user') {
                                const userItem = item as User;
                                setSelectedContact(userItem);
                                setContactDetailGroupId(null);
                                setContactDetailUserId(userItem.id);
                                return;
                            }

                            const groupItem = item as { id: number };
                            setSelectedContact(null);
                            setContactDetailUserId(null);
                            setContactDetailGroupId(groupItem.id);
                            setChatSessionInfoOpen(false);
                        }}
                        onCreateGroup={handleCreateGroup}
                        onContactsChanged={refreshFriendsAndRooms}
                        pendingFriendRequestCount={pendingFriendRequestCount}
                        onClearFriendRequests={() => setPendingFriendRequestCount(0)}
                    />
                )}
                {/* settings 页面现在在主区域呈现（与聊天窗口平级），因此移除此处的渲染 */}
            </div>

            <main className="chat-area">
                {activeTab === 'settings' ? (
                    <SettingsPanel
                        isOpen
                        initialView={settingsPanel}
                        showMenuInMain={false}
                        onClose={() => setActiveTab('chat')}
                        onSubpanelChange={setSettingsPanel}
                        currentUser={{
                            userId: currentUserId,
                            username: userName,
                            email: userEmail,
                            avatar: myAvatar,
                            birthday: profileBirthday,
                            address: profileAddress,
                            signature: profileSignature,
                        }}
                        onAvatarUpdated={setMyAvatar}
                        onEmailUpdated={setUserEmail}
                        onProfileFieldsSaved={({ birthday, address, signature }) => {
                            setProfileBirthday(birthday);
                            setProfileAddress(address);
                            setProfileSignature(signature);
                            persistUserProfile({
                                username: userName,
                                avatar: myAvatar,
                                birthday,
                                address,
                                signature,
                            });
                        }}
                        onLogout={handleLogout}
                        onDeleteAccount={handleDeleteAccount}
                    />
                ) : contactDetailUserId != null ? (
                    <ContactSessionDetail
                        mode="friend"
                        userId={contactDetailUserId}
                        onBack={() => setContactDetailUserId(null)}
                        onEnterChat={handleEnterChat}
                        onDeleted={handleFriendDetailDeleted}
                    />
                ) : contactDetailGroupId != null ? (
                    <ContactSessionDetail
                        mode="group"
                        roomId={contactDetailGroupId}
                        currentUserId={currentUserId}
                        onBack={() => setContactDetailGroupId(null)}
                        onEnterChat={handleContactGroupEnterChat}
                        onLeftOrDissolved={handleContactGroupLeftOrDissolved}
                        onGroupProfileUpdated={() => {
                            void syncChatRoomsAndGroups();
                        }}
                    />
                ) : activeChatName ? (
                    chatSessionInfoOpen ? (
                        <ChatSessionDetail
                            roomId={activeChatId}
                            isGroup={activeChatIsGroup}
                            currentUserId={currentUserId}
                            otherUserId={activeChat?.otherUserId ?? null}
                            conversationMuted={activeChat?.isMuted === true}
                            onConversationMutedChange={handleConversationMutedChange}
                            conversationPinned={activeChat?.isPinned === true}
                            onConversationPinnedChange={handleConversationPinnedChange}
                            onBack={() => setChatSessionInfoOpen(false)}
                            onDeleted={handleChatDeleted}
                        />
                    ) : (
                        <ChatWindow
                            activeChatId={activeChatId}
                            activeChatName={activeChatName}
                            isGroupChat={activeChatIsGroup}
                            messages={messages}
                            initialUnreadCount={entryUnreadHintCount}
                            currentUserId={currentUserId}
                            onSendMessage={handleSendMessage}
                            onReadMessage={handleReadMessage}
                            onRetryMessage={handleRetryMessage}
                            onOpenSessionInfo={() => setChatSessionInfoOpen(true)}
                        />
                    )
                ) : (
                    <div className="empty-chat-placeholder">
                        <p>选择一个联系人开始聊天</p>
                    </div>
                )}
            </main>
        </div>
    );
}
