import { useState, useEffect } from "react";

import ContactList from '../components/contactList'

import type { ActiveTabType } from "../types/ui";

import { tokenUtilis } from "../utilis/auth";

import { DEFAULT_AVATAR, CHATICON, CONTACTICON, CONFIGICON } from "../constants/string";

import '../styles/index.css'

// 模拟数据
import { MOCK_FRIENDS, MOCK_GROUPS } from '../mockData/contactListMock'

export default function Index(){
    const [userName, setUserName] = useState<string>('');
    const [myAvatar, setMyAvatar] = useState<string>(DEFAULT_AVATAR);
    const [activeTab, setActiveTab] = useState<ActiveTabType>('chat');
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if(token){
            const payload = tokenUtilis.decode(token);
            setUserName(payload.username);
            const savedAvatar = localStorage.getItem(`avatar-${payload.username}`)
            if(savedAvatar){
                setMyAvatar(savedAvatar);
            }
        }
    }, [])

    /**
     * @todo 增加跳转到显示按钮相应组件的功能(完成相应组件)
     */
    function chatClicked(){
        setActiveTab('chat');
    }
    function contactsClicked(){
        setActiveTab('contacts')
    }
    function configClicked(){
        setActiveTab('settings')
        setIsSettingsOpen(true);
    }

    const handleLogout = () => {
        const isConfirmed = window.confirm('确认要退出登录吗？')
        if(isConfirmed){
            localStorage.removeItem("token")
            window.location.href = '/login';
        }
    };

    return (
        <div className="main">
            <aside className="side-bar">
                <div className="nav-top">
                    <div className="user-avatar">
                        <img src={myAvatar} alt="myAvatar" />
                    </div>
                    <nav className="nav-menu">
                        <button
                            className={`nav-button ${activeTab === 'chat' ? 'active-button' : ''}`}
                            onClick={chatClicked}
                        >
                            <img src={CHATICON} alt='chat-icon' />
                        </button>
                        <button
                            className={`nav-button ${activeTab === 'contacts' ? 'active-button' : ''}`}
                            onClick={contactsClicked}
                        >
                            <img src={CONTACTICON} alt="contact-icon" />
                        </button>
                    </nav>
                </div>
                <div className="nav-bottom">
                    <button 
                        className={`nav-button ${activeTab === 'settings' ? 'active-button' : ''}`}
                        onClick={configClicked}
                    >
                        <img src={CONFIGICON} alt="config-icon" />
                    </button>
                </div>
            </aside>

            {isSettingsOpen && (
                <div className="overlay" onClick={() => setIsSettingsOpen(false)}>
                    <div className="config-panel" onClick={(e) => e.stopPropagation()}>
                        <button className="config-button">个人资料</button>
                        <button className="config-button">修改设置</button>
                        <button className="config-button">切换账号</button>
                        <button className="config-button log-out-item" onClick={handleLogout}>退出登录</button>
                    </div>
                </div>
            )}

            <div className="list-area">
                {activeTab === 'contacts' && (
                    <ContactList
                        friends={MOCK_FRIENDS}
                        groups={MOCK_GROUPS}
                        onItemClick={(item, type) => console.log(item, type)}
                    />
                )}
            </div>
        </div>
    )
}