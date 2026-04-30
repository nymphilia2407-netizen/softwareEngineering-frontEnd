import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";

import { registerApi, loginApi } from "../services/auth";
import { DEFAULT_AVATAR } from "../constants/string";

import { tokenUtils, checkPasswordStrength } from "../utils/auth";

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
        setError
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
        if (!isLogin) {
            const score = checkPasswordStrength(data.password);
            if (score === -1) {
                // 这里可以设置一个 react-hook-form 的错误，或者直接提示
                setError("password", { type: "manual", message: "密码强度不符合要求" });
                alert("密码太简单或不合法，请重新设置！");
                return; // 拦截，不执行后续逻辑
            }
        }

        try{
            if(!isLogin){
                const response = await registerApi({
                        username: data.username,
                        email: data.email,
                        password: data.password
                    });
                
                if (response.code === 0) {
                    const loginResponse = await loginApi({
                        email: data.email,
                        password: data.password
                    });

                    if (loginResponse.code === 0 && loginResponse.data) {
                        alert('注册成功！');
                        tokenUtils.setToken(loginResponse.data.token);
                        onLogInSuccess();
                    } else {
                        alert(loginResponse.info || '注册成功，但自动登录失败');
                    }
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
                    tokenUtils.setToken(response.data.token);
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
                    
                // 可以找机会统一一下用户信息的存储格式
                localStorage.setItem('user_profile', JSON.stringify({
                    username: data.username,
                    avatar: savedAvatar
                }))
            }
        } catch (error) {
                console.error('请求失败:', error);
            const requestError = error as { response?: { data?: { info?: string } } };
            alert(requestError.response?.data?.info || '请求失败');
        }

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
			    {errors.username?.type === 'required' && (
			        <div className="input-error-hint">
				    请输入用户名！
				</div>
			    )}
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
                            type='text'
                            placeholder="请输入您的邮箱"
                            {...register("email", {
				required: true,
				validate: () => !emailInvalid
			    })}
                        />
			{errors.email?.type === 'required' && (
			    <div className="input-error-hint">
			        请输入邮箱！
			    </div>
			)}
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
			{errors.password?.type === 'required' && (
			    <div className="input-error-hint">
			        请输入密码！
			    </div>
			)}
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
			    {errors.confirmPassword?.type === 'required' && (
			        <div className="input-error-hint">
        			    请确认密码！
    				</div>
			    )}
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
