import { useState } from "react";

import { DEFAULT_AVATAR } from "../constants/string";
import '../style/login.css'

export default function Login(){
    const [isLogin, setIsLogin] = useState<boolean>(true); // login or register
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('') // only for register
    const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR)

    function switchForm(){
        setIsLogin(!isLogin);
    }

    return(
        <div className="login">
            <div className="login-form">
                {
                    /**
                     * @todo 增加逻辑，根据上次登录账号选择对应的头像
                     */
                }
                <div className="avatar">
                    <img
                        src={avatar}
                        alt="User Avatar"
                    />
                </div>
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