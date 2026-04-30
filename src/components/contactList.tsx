import { useEffect, useRef, useState } from 'react'

import { type User, type Group } from '../types/entity'

import '../styles/contactList.css'

interface CreateGroupFormValues {
    groupName: string;
    memberIds: number[];
}

interface ContactsProps{
    readonly friends: User[];
    readonly groups: Group[];
    readonly onItemClick: (item: User | Group, type: 'user' | 'group') => void;
    readonly onCreateGroup: (values: CreateGroupFormValues) => Promise<void> | void;
}

export default function ContactList(props: Readonly<ContactsProps>) {
    const { friends, groups, onItemClick, onCreateGroup } = props;
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isActionMenuOpen, setIsActionMenuOpen] = useState<boolean>(false);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState<boolean>(false);
    const [groupName, setGroupName] = useState<string>('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
    const actionMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            if (!actionMenuRef.current) {
                return;
            }

            if (!actionMenuRef.current.contains(event.target as Node)) {
                setIsActionMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentClick);

        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
        };
    }, []);

    const filteredFriends = friends.filter(f =>
        f.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredGroups = groups.filter(g =>
        g.groupname.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleMember = (memberId: number) => {
        setSelectedMemberIds((currentIds) => (
            currentIds.includes(memberId)
                ? currentIds.filter((id) => id !== memberId)
                : [...currentIds, memberId]
        ));
    };

    const handleCreateGroup = async () => {
        const trimmedGroupName = groupName.trim();

        if (!trimmedGroupName) {
            globalThis.alert('请输入群聊名称');
            return;
        }

        if (selectedMemberIds.length === 0) {
            globalThis.alert('请至少选择一位好友');
            return;
        }

        await onCreateGroup({
            groupName: trimmedGroupName,
            memberIds: selectedMemberIds,
        });

        setGroupName('');
        setSelectedMemberIds([]);
        setIsCreateGroupOpen(false);
    };

    return (
        <div className='contact-list'>
            <div className='contacts-header'>
                <div className='search-action-row' ref={actionMenuRef}>
                    <div className='search-container'>
                        <input
                            type='text'
                            placeholder='搜索联系人或群聊'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        type='button'
                        className='action-toggle-button'
                        aria-label='打开更多操作'
                        onClick={() => setIsActionMenuOpen((current) => !current)}
                    >
                        +
                    </button>

                    {isActionMenuOpen && (
                        <div className='action-menu'>
                            <button
                                type='button'
                                className='action-menu-item'
                                onClick={() => {
                                    setIsActionMenuOpen(false);
                                    globalThis.alert('添加好友/群聊 功能待接入');
                                }}
                            >
                                添加好友/群聊
                            </button>
                            <button
                                type='button'
                                className='action-menu-item'
                                onClick={() => {
                                    setIsActionMenuOpen(false);
                                    setIsCreateGroupOpen(true);
                                }}
                            >
                                新建群聊
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isCreateGroupOpen && (
                <div className='create-group-panel'>
                    <div className='create-group-field'>
                        <label htmlFor='group-name-input'>群聊名称</label>
                        <input
                            id='group-name-input'
                            type='text'
                            placeholder='输入群聊名称'
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                    </div>
                    <div className='create-group-field'>
                        <div className='create-group-label-row'>
                            <span className='create-group-member-list-label'>选择好友</span>
                            <span>{selectedMemberIds.length} 人已选</span>
                        </div>
                        <div className='create-group-member-list'>
                            {filteredFriends.map((friend) => (
                                <label key={friend.id} className='create-group-member-item'>
                                    <input
                                        type='checkbox'
                                        checked={selectedMemberIds.includes(friend.id)}
                                        onChange={() => toggleMember(friend.id)}
                                    />
                                    <span>{friend.username}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className='create-group-actions'>
                        <button type='button' className='create-group-secondary-button' onClick={() => setIsCreateGroupOpen(false)}>
                            取消
                        </button>
                        <button type='button' className='create-group-primary-button' onClick={() => void handleCreateGroup()}>
                            创建群聊
                        </button>
                    </div>
                </div>
            )}

            {/* 好友部分 */}
            <div className='section-container'>
                <div className='section-title'>联系人 ({filteredFriends.length})</div>
                <div className='list-render-area'>
                    {filteredFriends.map(user => (
                        <button key={user.id} type='button' className='contact-item contact-button' onClick={() => onItemClick(user, 'user')}>
                            <div className='item-avatar'>
                                <img src={user.avatar} alt="avatar" />
                                <span className={`status-badge ${user.status}`} />
                            </div>
                            <div className='item-info'>
                                <span className="item-name">{user.username}</span>
                                <span className={`item-meta status-${user.status}`}>
                                    {user.status === 'online' ? '在线' : '离线'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className='section-container'>
                <div className='section-title'>群聊 ({filteredGroups.length})</div>
                <div className='list-render-area'>
                    {filteredGroups.map(group => (
                        <button key={group.id} type='button' className='contact-item contact-button' onClick={() => onItemClick(group, 'group')}>
                            <div className='item-avatar'>
                                <img src={group.avatar} alt="avatar" />
                            </div>
                            <div className='item-info'>
                                <span className="item-name">{group.groupname}</span>
                                <span className="item-meta">{group.memberCount} 人</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}