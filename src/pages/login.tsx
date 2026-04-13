import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";

import { DEFAULT_AVATAR } from "../constants/string";

import { tokenUtilis, checkPasswordStrength } from "../utilis/auth";

import '../styles/login.css'

interface LoginProps{
    readonly onLogInSuccess: () => void
}

export default function Login({ onLogInSuccess }: LoginProps){
    const [isLogin, setIsLogin] = useState<boolean>(true); // login or register
    const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);

    const{
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors }
    } = useForm();

    // 实时捕捉，检测合法性
    const username = watch("username");
    const usernameLengthInvalid = !isLogin && username && (username.length < 3 || username.length > 20);
    const usernameCharInvalid = !isLogin && username && !/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username);

    const password = watch("password");
    const confirmPassword = watch("confirmPassword");
    const passwordInconsistent = !isLogin && confirmPassword && password !== confirmPassword;

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

    const onSubmit = (data: any) => {
    if (!isLogin) {
        const score = checkPasswordStrength(data.password);
        if (score === -1) {
            // 这里可以设置一个 react-hook-form 的错误，或者直接提示
            setError("password", { type: "manual", message: "密码强度不符合要求" });
            alert("密码太简单或不合法，请重新设置！");
            return; // 拦截，不执行后续逻辑
        }
    }

	const finalData = {
            ...data,
            avatar: avatar,
            loginType: isLogin ? 'Login' : 'Register',
            timestamp : new Date().getTime()
        };

        if(!isLogin){
            localStorage.setItem('user_profile', JSON.stringify({
                username: data.username,
                avatar: avatar
            }));
            localStorage.setItem(`avatar-${data.username}`, avatar);
            alert('注册成功！')
        }else{
            /**
             * @todo 修正逻辑，从后端拿到数据再修改
             */

            const savedAvatar = localStorage.getItem(`avatar-${data.username}`);
            if(savedAvatar){
                setAvatar(savedAvatar);
            }else{
                setAvatar(DEFAULT_AVATAR);
            }
            localStorage.setItem('user_profile', JSON.stringify({
                username: data.username,
                avatar: savedAvatar
            }))
        }

        // 无后端 - 生成伪token
        const token = tokenUtilis.generate(data.username);

        localStorage.setItem("token", token);
        onLogInSuccess();
    }

    const strengthResult = useMemo(() => {
        if(!password || typeof password !== 'string'){
            return null;
        }
        
        const score = checkPasswordStrength(password);
        
        if (score === -1) {
            return { label: '不合法', color: '#ff4d4f', width: '30%' };
        }
        
        const levels = [
            { label: '弱', color: '#ffa940', width: '20%' },
            { label: '弱', color: '#ffa940', width: '40%' },
            { label: '中', color: '#8ec5fc', width: '60%' },
            { label: '强', color: '#a1c4fd', width: '80%' },
            { label: '极强', color: '#e0c3fc', width: '100%' }
        ];

        // 确保索引不越界 (0-4)
        const index = Math.min(Math.max(0, score), 4);
        return levels[index];
    }, [password]);

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
                            <div className="avatar-changegit config --global http.proxy http://127.0.0.1:7897">
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
                <form onSubmit={handleSubmit(onSubmit)}>
                    {!isLogin &&(
                        <div className="input-item">
                            <input
                                type="text"
                                placeholder="请设置您的用户名"
                                {...register('username',{
                                    required: !isLogin,
                                    validate: () => !usernameCharInvalid && !usernameLengthInvalid
                                })}
                            />
			    {usernameLengthInvalid && (
				<div className="input-error-hint">
				   用户名只能有3-20个字符！
				</div>
			    )}
			    {usernameCharInvalid && (
				<div className="input-error-hint">
			       	   用户名只能包括字母、数字、下划线和中文字符！
			   	</div>
		     	    )}		
                        </div>
                    )}
                    <div className="input-item">
                        <input
                            type='email'
                            placeholder="请输入您的邮箱"
                            {...register("email", {required: true})}
                        />
                    </div>
                    <div className="input-item">
                        <input
                            type='password'
                            placeholder="请输入您的密码"
                            {...register("password",{required: true})}
                        />
                        {!isLogin && strengthResult && (
                            <div className="password-strength-wrapper">
                                <div className="strength-info">
                                    <span>密码强度: <strong style={{ color: strengthResult.color }}>{strengthResult.label}</strong></span>
                                </div>
                                <div className="strength-meter-bg">
                                    <div 
                                        className="strength-meter-fill"
                                        style={{ 
                                            width: strengthResult.width, 
                                            backgroundColor: strengthResult.color,
                                            boxShadow: `0 0 10px ${strengthResult.color}44` 
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {!isLogin && (
                        <div className="input-item">
                            <input
                                type="password"
                                placeholder="请确认您的密码"
                                {...register("confirmPassword",{
                                    required: !isLogin,
                                    validate: (value) => value === password
                                })}
                            />
                            {passwordInconsistent && (
                                <div className="input-error-hint">
                                    两次输入密码不一致！
                                </div>
                            )}
                        </div>
                    )}
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
