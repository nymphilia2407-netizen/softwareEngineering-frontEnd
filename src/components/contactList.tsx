import { useState } from 'react'

import { type User, type Group } from '../types/entity'

import '../styles/contactList.css'

interface ContactsProps{
    friends: User[];
    groups: Group[];
    onItemClick: (item: User | Group, type: 'user' | 'group') => void;
}

export default function ContactList({ friends, groups, onItemClick }: ContactsProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filteredFriends = friends.filter(f =>
        f.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredGroups = groups.filter(g =>
        g.groupname.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className='contact-list'>
            <div className='contacts-header'>
                <div className='search-container'>
                    <input
                        type='text'
                        placeholder='搜索联系人或群聊'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* 好友部分 */}
            <div className='section-container'>
                <div className='section-title'>联系人 ({filteredFriends.length})</div>
                <div className='list-render-area'>
                    {filteredFriends.map(user => (
                        <div key={user.id} className='contact-item' onClick={() => onItemClick(user, 'user')}>
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
                        </div>
                    ))}
                </div>
            </div>

            <div className='section-container'>
                <div className='section-title'>群聊 ({filteredGroups.length})</div>
                <div className='list-render-area'>
                    {filteredGroups.map(group => (
                        <div key={group.id} className='contact-item' onClick={() => onItemClick(group, 'group')}>
                            <div className='item-avatar'>
                                <img src={group.avatar} alt="avatar" />
                            </div>
                            <div className='item-info'>
                                <span className="item-name">{group.groupname}</span>
                                <span className="item-meta">{group.memberCount} 人</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}