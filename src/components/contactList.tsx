import { useState } from 'react'

import { type User, type Group } from '../types/entity'


interface ContactsProps{
    friends: User[];
    groups: Group[];
    onItemClick: (item: User | Group, type: 'user' | 'group') => void;
}

export default function ContactList({ friends, groups, onItemClick }: ContactsProps){
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

            <div className='friends'>
                <div className='list-title'>
                    联系人{filteredFriends.length}
                </div>
                {filteredFriends.map(user => (
                    <div
                        key={user.id}
                        className='contact-item'
                        onClick={() => onItemClick(user, 'user')}
                    >
                        <div className='avatar'>
                            <img src={user.avatar} alt="user-avatar" />
                            <span className={`status-badge ${user.status}`} />
                        </div>
                        <div className='contact-info'>
                            <span className="contact-name">{user.username}</span>
                            <span className={`status-text ${user.status}`}>
                                {user.status === 'online' ? '在线' : user.status === 'busy' ? '忙碌' : '离线'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            {filteredGroups.length > 0 && (
                <div className="contact-group-wrapper">
                    <div className="group-title">群聊 ({filteredGroups.length})</div>
                    {filteredGroups.map(group => (
                        <div 
                            key={group.id} 
                            className="contact-item"
                            onClick={() => onItemClick(group, 'group')}
                        >
                            <div className="avatar-wrapper">
                                <img src={group.avatar} alt="group-avatar" className="group-img" />
                            </div>
                            <div className="contact-info">
                                <span className="contact-name">{group.groupname}</span>
                                <span className="contact-meta">{group.memberCount} 人</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}