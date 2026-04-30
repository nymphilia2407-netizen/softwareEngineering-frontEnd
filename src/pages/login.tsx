import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DEFAULT_AVATAR } from '../constants/string';
import { loginApi, registerApi } from '../services/auth';
import { checkPasswordStrength, tokenUtils } from '../utils/auth';

import '../styles/login.css';

interface LoginFormValues {
    username?: string;
    email: string;
    password: string;
    confirmPassword?: string;
}

interface PasswordStrengthMeta {
    label: string;
    meterClass: string;
    textClass: string;
}

const PASSWORD_STRENGTH_LEVELS: PasswordStrengthMeta[] = [
    { label: '弱', meterClass: 'strength-meter-fill--level-1', textClass: 'strength-text--level-1' },
    { label: '弱', meterClass: 'strength-meter-fill--level-2', textClass: 'strength-text--level-2' },
    { label: '中', meterClass: 'strength-meter-fill--level-3', textClass: 'strength-text--level-3' },
    { label: '强', meterClass: 'strength-meter-fill--level-4', textClass: 'strength-text--level-4' },
    { label: '极强', meterClass: 'strength-meter-fill--level-5', textClass: 'strength-text--level-5' },
];

const getStoredAvatar = () => {
    const storedProfile = localStorage.getItem('user_profile');
    if (!storedProfile) {
        return DEFAULT_AVATAR;
    }

    try {
        const parsed = JSON.parse(storedProfile) as { avatar?: string };
        return parsed.avatar ?? DEFAULT_AVATAR;
    } catch {
        return DEFAULT_AVATAR;
    }
};

interface LoginProps {
    readonly onLogInSuccess: () => void;
}

export default function Login({ onLogInSuccess }: LoginProps) {
    const [isLogin, setIsLogin] = useState<boolean>(true);
    const [avatar, setAvatar] = useState<string>(() => getStoredAvatar());

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
        setError,
    } = useForm<LoginFormValues>();

    const username = watch('username');
    const email = watch('email');
    const password = watch('password');
    const confirmPassword = watch('confirmPassword');

    const usernameLengthInvalid = !isLogin && !!username && (username.length < 3 || username.length > 20);
    const usernameCharInvalid = !isLogin && !!username && !/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username);
    const emailInvalid = !!email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    const passwordInconsistent = !isLogin && !!confirmPassword && password !== confirmPassword;

    const persistProfile = (usernameValue: string, avatarValue: string) => {
        localStorage.setItem('user_profile', JSON.stringify({
            username: usernameValue,
            avatar: avatarValue,
        }));
    };

    const handleRegister = async (data: LoginFormValues) => {
        const registerResponse = await registerApi({
            username: data.username ?? '',
            email: data.email,
            password: data.password,
        });

        if (registerResponse.code !== 0) {
            alert(registerResponse.info || '注册失败');
            return;
        }

        const loginResponse = await loginApi({
            email: data.email,
            password: data.password,
        });

        if (loginResponse.code !== 0 || !loginResponse.data) {
            alert(loginResponse.info || '注册成功，但自动登录失败');
            return;
        }

        alert('注册成功！');
        tokenUtils.setToken(loginResponse.data.token);
        persistProfile(data.username ?? data.email, avatar);
        onLogInSuccess();
    };

    const handleLogin = async (data: LoginFormValues) => {
        const response = await loginApi({
            email: data.email,
            password: data.password,
        });

        if (response.code !== 0 || !response.data) {
            alert(response.info || '登录失败');
            return;
        }

        alert('登录成功！');
        tokenUtils.setToken(response.data.token);
        persistProfile(data.email, avatar);
        onLogInSuccess();
    };

    const switchForm = () => {
        if (!isLogin) {
            setAvatar(getStoredAvatar());
        }
        setIsLogin((current) => !current);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        const imageUrl = URL.createObjectURL(file);
        setAvatar(imageUrl);
    };

    const onSubmit = async (data: LoginFormValues) => {
        try {
            if (isLogin) {
                await handleLogin(data);
                return;
            }

            const score = checkPasswordStrength(data.password);
            if (score === -1) {
                setError('password', { type: 'manual', message: '密码强度不符合要求' });
                alert('密码太简单或不合法，请重新设置！');
                return;
            }

            await handleRegister(data);
        } catch (error) {
            console.error('请求失败:', error);
            const requestError = error as { response?: { data?: { info?: string } } };
            alert(requestError.response?.data?.info || '请求失败');
        }
    };

    const strengthResult = useMemo(() => {
        if (!password || typeof password !== 'string') {
            return null;
        }

        const score = checkPasswordStrength(password);
        if (score === -1) {
            return {
                label: '不合法',
                meterClass: 'strength-meter-fill--invalid',
                textClass: 'strength-text--invalid',
            } satisfies PasswordStrengthMeta;
        }

        const index = Math.min(Math.max(0, score), PASSWORD_STRENGTH_LEVELS.length - 1);
        return PASSWORD_STRENGTH_LEVELS[index];
    }, [password]);

    return (
        <div className="login">
            <div className="login-form">
                <label
                    htmlFor={isLogin ? undefined : 'avatar-input'}
                    className={`upload-avatar ${isLogin ? '' : 'can-upload'}`}
                >
                    <div className="avatar">
                        <img src={avatar} alt="User Avatar" />
                        {!isLogin && (
                            <div className="avatar-change">
                                <span>更换头像</span>
                            </div>
                        )}
                    </div>
                    {!isLogin && (
                        <input
                            id="avatar-input"
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden-avatar-input"
                        />
                    )}
                </label>

                <form onSubmit={handleSubmit(onSubmit)}>
                    {!isLogin && (
                        <div className="input-item">
                            <input
                                type="text"
                                placeholder="请设置您的用户名"
                                {...register('username', {
                                    required: !isLogin,
                                    validate: () => !usernameCharInvalid && !usernameLengthInvalid,
                                })}
                            />
                            {errors.username?.type === 'required' && (
                                <div className="input-error-hint">请输入用户名！</div>
                            )}
                            {usernameLengthInvalid && (
                                <div className="input-error-hint">用户名只能有3-20个字符！</div>
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
                            type="text"
                            placeholder="请输入您的邮箱"
                            {...register('email', {
                                required: true,
                                validate: () => !emailInvalid,
                            })}
                        />
                        {errors.email?.type === 'required' && (
                            <div className="input-error-hint">请输入邮箱！</div>
                        )}
                        {emailInvalid && (
                            <div className="input-error-hint">邮箱格式不合法！</div>
                        )}
                    </div>

                    <div className="input-item">
                        <input
                            type="password"
                            placeholder="请输入您的密码"
                            {...register('password', { required: true })}
                        />
                        {errors.password?.type === 'required' && (
                            <div className="input-error-hint">请输入密码！</div>
                        )}
                        {!isLogin && strengthResult && (
                            <div className="password-strength-wrapper">
                                <div className="strength-info">
                                    <span>
                                        密码强度: <strong className={strengthResult.textClass}>{strengthResult.label}</strong>
                                    </span>
                                </div>
                                <div className="strength-meter-bg">
                                    <div className={`strength-meter-fill ${strengthResult.meterClass}`} />
                                </div>
                            </div>
                        )}
                    </div>

                    {!isLogin && (
                        <div className="input-item">
                            <input
                                type="password"
                                placeholder="请确认您的密码"
                                {...register('confirmPassword', {
                                    required: !isLogin,
                                    validate: (value) => value === password,
                                })}
                            />
                            {errors.confirmPassword?.type === 'required' && (
                                <div className="input-error-hint">请确认密码！</div>
                            )}
                            {passwordInconsistent && (
                                <div className="input-error-hint">两次输入密码不一致！</div>
                            )}
                        </div>
                    )}

                    <button type="submit">{isLogin ? '登录' : '注册'}</button>
                </form>

                <div className="form-footer">
                    <p>
                        {isLogin ? '没有账号？' : '已有账号？'}
                        <button type="button" onClick={switchForm}>
                            {isLogin ? '注册账号' : '返回登录'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
