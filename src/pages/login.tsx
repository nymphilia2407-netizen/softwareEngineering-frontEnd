import React, { useState } from "react";

import { DEFAULT_AVATAR } from "../constants/string";
import '../styles/login.css'

export default function Login(){
    const [isLogin, setIsLogin] = useState<boolean>(true); // login or register
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('') // only for register
    const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR)

    function switchForm(){
        if(!isLogin){
            setAvatar(DEFAULT_AVATAR);
        }
        setIsLogin(!isLogin);
    }

    // register: 上传自定义头像
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(file){
            if(!file.type.startsWith('image/')){
                alert('请选择图片文件')
                return;
            }
            // 创建临时本地 URL 并更新状态
            const imageUrl = URL.createObjectURL(file);
            setAvatar(imageUrl);
        }
    }

    return(
        <div className="login">
            <div className="login-form">
                {
                    /**
                     * @todo 增加逻辑，根据上次登录账号选择对应的头像
                     */
                }
                <label 
                    htmlFor={!isLogin ? 'avatar-input' : undefined}
                    className={`upload-avatar ${!isLogin ? 'can-upload' : ''}`}
                > 
                    <div className="avatar">
                        <img
                            src={avatar}
                            alt="User Avatar"
                        />
                        {!isLogin &&(
                            <div className="avatar-change">
                                <span>更换头像</span>
                            </div>
                        )}
                    </div>
                    {!isLogin &&(
                        <input
                            id="avatar-input"
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            style={{ display: 'none' }}
                        />
                    )}
                </label>
                <form>
                    <div className="input-item">
                        <input
                            type='text'
                            placeholder="请输入您的用户名"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-item">
                        <input
                            type='password'
                            placeholder="请输入您的密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {/*only for register*/
                        !isLogin && (
                            <div className="input-item">
                                <input
                                    type="password"
                                    placeholder="请确认您的密码"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        )
                    }
                    <button type="submit">
                        {isLogin ? "登录" : "注册"}
                    </button>
                </form>
                <div className="form-footer">
                    <p>
                        {isLogin ? '没有账号？':'已有账号？'}
                        <button 
                            type='button'
                            onClick={switchForm}
                        >
                            {isLogin ? '注册账号' : '返回登录'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}