import { useState } from "react";
import { useForm } from "react-hook-form";
import { registerApi, loginApi } from "../api/auth";
import { DEFAULT_AVATAR } from "../constants/string";

import { tokenUtilis } from "../utils/auth";

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

    const email = watch("email")
    const emailInvalid = email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

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

    const onSubmit = async (data: any) => {
	const finalData = {
            ...data,
            avatar: avatar,
            loginType: isLogin ? 'Login' : 'Register',
            timestamp : new Date().getTime()
        };
        
	try{
            if(!isLogin){
                // 需要完善：信息的本地存储
		const response = await registerApi({
                    username: data.username,
                    email: data.email,
                    password: data.password
                });
            
                if (response.code === 0) {
                    alert('注册成功！');
                    onLogInSuccess();
                } else {
                    alert(response.info || '注册失败');  // 用 response.info
                }
		
		// 头像图片需要进一步处理逻辑
		localStorage.setItem('user_profile', JSON.stringify({
                    username: data.username,
                    avatar: avatar
                }));
                localStorage.setItem(`avatar-${data.username}`, avatar);
                
            }else{
                const response = await loginApi({
                    email: data.email,
                    password: data.password
            	});

		if (response.code === 0 && response.data) {
                    alert(`登录成功！`);
                    onLogInSuccess();
                } else {
                    alert(response.info || '登录失败');  // 用 response.info
                }
		    
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
	} catch (error) {
                console.error('请求失败:', error);
                alert(error?.response?.data?.info || '请求失败');
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
                            {...register("email", {
				required: true,
				validate: () => !emailInvalid
			    })}
                        />
			{emailInvalid && (
			    <div className="input-error-hint">
			    	邮箱格式不合法！
			    </div>
			)}
                    </div>
                    <div className="input-item">
                        <input
                            type='password'
                            placeholder="请输入您的密码"
                            {...register("password",{required: true})}
                        />
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
