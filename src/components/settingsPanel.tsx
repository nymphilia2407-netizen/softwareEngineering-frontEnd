import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';

import { updateUserProfile } from '../services/user';
import { getPasswordStrengthDisplay, isPasswordAllowedForRegister, isValidEmailFormat, persistUserProfile } from '../utils/auth';
import { readAvatarFileAsDataUrl } from '../utils/avatar';

import '../styles/settings.css';

type PanelView = 'menu' | 'profile' | 'security';

export interface SettingsPanelProps {
	isOpen: boolean;
	onClose: () => void;
	initialView: PanelView;
	/** 为 true 时在主区域展示菜单按钮；侧栏已提供入口时可设为 false */
	showMenuInMain?: boolean;
	/** 与侧栏「个人资料 / 安全信息」高亮同步 */
	onSubpanelChange?: (view: PanelView) => void;
	currentUser: {
		userId: number;
		username: string;
		email: string;
		avatar: string;
		birthday: string;
		address: string;
		signature: string;
		phone: string;
	};
	onAvatarUpdated: (avatar: string) => void;
	onProfileFieldsSaved: (fields: { birthday: string; address: string; signature: string; phone: string }) => void;
	onEmailUpdated: (email: string) => void;
	onLogout: () => void;
	onDeleteAccount: () => Promise<void>;
}

export default function SettingsPanel({
	isOpen,
	onClose,
	initialView,
	showMenuInMain = false,
	onSubpanelChange,
	currentUser,
	onAvatarUpdated,
	onProfileFieldsSaved,
	onEmailUpdated,
	onLogout,
	onDeleteAccount,
}: Readonly<SettingsPanelProps>) {
	const [panelView, setPanelView] = useState<PanelView>(initialView);
	const [profileBirthday, setProfileBirthday] = useState(currentUser.birthday);
	const [profileAddress, setProfileAddress] = useState(currentUser.address);
	const [profileSignature, setProfileSignature] = useState(currentUser.signature);
	const [profilePhone, setProfilePhone] = useState(currentUser.phone);
	const [isSaving, setIsSaving] = useState(false);
	const [avatar, setAvatar] = useState(currentUser.avatar);
	const [profileAvatarSaving, setProfileAvatarSaving] = useState(false);

	const [nextEmail, setNextEmail] = useState(currentUser.email);
	const [emailAuthPassword, setEmailAuthPassword] = useState('');
	const [pwdCurrent, setPwdCurrent] = useState('');
	const [pwdNew, setPwdNew] = useState('');
	const [pwdConfirm, setPwdConfirm] = useState('');
	const [savingEmail, setSavingEmail] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);

	const newPasswordStrength = useMemo(() => getPasswordStrengthDisplay(pwdNew), [pwdNew]);

	const goPanel = useCallback(
		(next: PanelView) => {
			setPanelView(next);
			onSubpanelChange?.(next);
		},
		[onSubpanelChange],
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setPanelView(initialView);
	}, [initialView, isOpen]);

	useEffect(() => {
		setAvatar(currentUser.avatar);
		setProfileBirthday(currentUser.birthday);
		setProfileAddress(currentUser.address);
		setProfileSignature(currentUser.signature);
		setProfilePhone(currentUser.phone);
	}, [currentUser.avatar, currentUser.address, currentUser.birthday, currentUser.signature, currentUser.phone]);

	useEffect(() => {
		if (isOpen && panelView === 'security') {
			setNextEmail(currentUser.email);
		}
	}, [isOpen, panelView, currentUser.email]);

	useEffect(() => {
		if (panelView !== 'security') {
			setEmailAuthPassword('');
			setPwdCurrent('');
			setPwdNew('');
			setPwdConfirm('');
		}
	}, [panelView]);

	const handleClose = () => {
		goPanel('menu');
		onClose();
	};

	const handleSaveProfile = async () => {
		try {
			setIsSaving(true);
			await updateUserProfile({
				birthday: profileBirthday,
				address: profileAddress,
				signature: profileSignature,
				phone: profilePhone,
			});
			onProfileFieldsSaved({
				birthday: profileBirthday,
				address: profileAddress,
				signature: profileSignature,
				phone: profilePhone,
			});
			alert('保存成功');
			goPanel('menu');
		} catch (err) {
			alert(err instanceof Error ? err.message : '保存失败');
		} finally {
			setIsSaving(false);
		}
	};

	const handleSaveEmail = async () => {
		const trimmed = nextEmail.trim();
		if (!trimmed) {
			alert('请输入新邮箱');
			return;
		}
		if (!isValidEmailFormat(trimmed)) {
			alert('邮箱格式不合法');
			return;
		}
		if (trimmed === currentUser.email.trim()) {
			alert('新邮箱与当前邮箱相同');
			return;
		}
		if (!emailAuthPassword) {
			alert('请输入当前登录密码以验证身份');
			return;
		}

		try {
			setSavingEmail(true);
			await updateUserProfile({
				email: trimmed,
				old_password: emailAuthPassword,
			});
			onEmailUpdated(trimmed);
			setEmailAuthPassword('');
			alert('邮箱已更新');
			goPanel('menu');
		} catch (err) {
			alert(err instanceof Error ? err.message : '更新邮箱失败');
		} finally {
			setSavingEmail(false);
		}
	};

	const handleSavePassword = async () => {
		if (!pwdCurrent) {
			alert('请输入当前登录密码');
			return;
		}
		if (!pwdNew) {
			alert('请输入新密码');
			return;
		}
		if (!isPasswordAllowedForRegister(pwdNew)) {
			alert('密码太简单或不合法，请重新设置（要求与注册时一致）');
			return;
		}
		if (pwdNew !== pwdConfirm) {
			alert('两次输入的新密码不一致');
			return;
		}
		if (pwdNew === pwdCurrent) {
			alert('新密码不能与当前密码相同');
			return;
		}

		try {
			setSavingPassword(true);
			await updateUserProfile({
				password: pwdNew,
				old_password: pwdCurrent,
			});
			setPwdCurrent('');
			setPwdNew('');
			setPwdConfirm('');
			alert('登录密码已更新');
			goPanel('menu');
		} catch (err) {
			alert(err instanceof Error ? err.message : '更新密码失败');
		} finally {
			setSavingPassword(false);
		}
	};

	const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			setProfileAvatarSaving(true);
			const dataUrl = await readAvatarFileAsDataUrl(file);
			await updateUserProfile({ avatar: dataUrl });
			setAvatar(dataUrl);
			onAvatarUpdated(dataUrl);
			persistUserProfile({ username: currentUser.username, avatar: dataUrl });
			alert('头像已更新');
		} catch (err) {
			alert(err instanceof Error ? err.message : '上传失败');
		} finally {
			setProfileAvatarSaving(false);
			e.target.value = '';
		}
	};

	const handleLogout = () => {
		const isConfirmed = globalThis.confirm('确认要退出登录吗？');
		if (!isConfirmed) {
			return;
		}

		onLogout();
	};

	const handleDelete = async () => {
		const isConfirmed = globalThis.confirm('确认要注销账号吗？此操作无法撤销！');
		if (!isConfirmed) {
			return;
		}

		await onDeleteAccount();
	};

	if (!isOpen) return null;

	return (
		<div className="config-nav">
			<header className="config-nav-header">
				<button type="button" className="config-nav-back" onClick={handleClose}>
					返回
				</button>
				<h1 className="config-nav-title">设置</h1>
				<span className="config-nav-header-spacer" aria-hidden />
			</header>

			<div className="config-nav-body">
				{panelView === 'menu' && showMenuInMain ? (
					<div className="config-nav-menu">
						<button type="button" className="config-nav-button" onClick={() => goPanel('profile')}>
							个人资料
						</button>
						<button type="button" className="config-nav-button" onClick={() => goPanel('security')}>
							安全信息
						</button>
						<button type="button" className="config-nav-button" onClick={handleLogout}>
							退出登录
						</button>
						<button type="button" className="config-nav-button config-nav-button--danger" onClick={handleDelete}>
							注销账号
						</button>
					</div>
				) : panelView === 'security' ? (
					<div className="profile-settings security-settings">
						<div className="profile-settings-title">当前登录邮箱</div>
						<p className="security-current-email">{currentUser.email || '（尚未同步）'}</p>

						<div className="profile-settings-title">修改邮箱</div>
						<input
							type="email"
							className="profile-settings-input"
							value={nextEmail}
							autoComplete="email"
							placeholder="新邮箱地址"
							title="新邮箱地址"
							onChange={(e) => setNextEmail(e.target.value)}
						/>
						<div className="profile-settings-title">当前密码（验证）</div>
						<input
							type="password"
							className="profile-settings-input"
							value={emailAuthPassword}
							autoComplete="current-password"
							placeholder="请输入当前登录密码"
							title="修改邮箱时的身份验证"
							onChange={(e) => setEmailAuthPassword(e.target.value)}
						/>
						<button
							type="button"
							className="config-nav-button"
							disabled={savingEmail}
							onClick={() => void handleSaveEmail()}
						>
							{savingEmail ? '保存中…' : '保存新邮箱'}
						</button>

						<hr className="security-settings-divider" />

						<div className="profile-settings-title">修改登录密码</div>
						<div className="profile-settings-title security-settings-sub">当前密码</div>
						<input
							type="password"
							className="profile-settings-input"
							value={pwdCurrent}
							autoComplete="current-password"
							placeholder="当前登录密码"
							title="当前登录密码"
							onChange={(e) => setPwdCurrent(e.target.value)}
						/>
						<div className="profile-settings-title security-settings-sub">新密码</div>
						<input
							type="password"
							className="profile-settings-input"
							value={pwdNew}
							autoComplete="new-password"
							placeholder="新密码"
							title="新密码"
							onChange={(e) => setPwdNew(e.target.value)}
						/>
						{newPasswordStrength && (
							<div className="security-password-strength">
								<div className="security-strength-info">
									密码强度:{' '}
									<strong className={newPasswordStrength.textClass}>{newPasswordStrength.label}</strong>
								</div>
								<div className="security-strength-meter-bg">
									<div className={`security-strength-meter-fill ${newPasswordStrength.meterClass}`} />
								</div>
							</div>
						)}
						<p className="profile-settings-hint">
							须同时包含字母、数字、特殊符号中的至少两类；不可为单一字符集。
						</p>
						<div className="profile-settings-title security-settings-sub">确认新密码</div>
						<input
							type="password"
							className="profile-settings-input"
							value={pwdConfirm}
							autoComplete="new-password"
							placeholder="再次输入新密码"
							title="确认新密码"
							onChange={(e) => setPwdConfirm(e.target.value)}
						/>
						<button
							type="button"
							className="config-nav-button"
							disabled={savingPassword}
							onClick={() => void handleSavePassword()}
						>
							{savingPassword ? '保存中…' : '保存新密码'}
						</button>

						<div className="profile-settings-actions">
							<button type="button" className="config-nav-button config-nav-button--secondary" onClick={() => showMenuInMain ? goPanel('menu') : onClose()}>
								返回
							</button>
						</div>
					</div>
				) : (
					<div className="profile-settings">
						<div className="profile-settings-title">头像</div>
						<div className="profile-settings-avatar-wrap">
							<img src={avatar} alt="" className="profile-settings-avatar-preview" />
						</div>
						<label className="profile-settings-file-label">
							<input
								type="file"
								accept="image/*"
								className="profile-settings-file-input"
								disabled={profileAvatarSaving}
								onChange={handleAvatarChange}
							/>
							{profileAvatarSaving ? '保存中…' : '选择图片并上传'}
						</label>
						<p className="profile-settings-hint">支持常见图片格式，单张不超过 4MB。</p>

						<div className="profile-settings-title">生日</div>
						<input
							type="date"
							className="profile-settings-input"
							value={profileBirthday}
							title="选择生日"
							onChange={(e) => setProfileBirthday(e.target.value)}
						/>

						<div className="profile-settings-title">地址</div>
						<input
							type="text"
							className="profile-settings-input"
							value={profileAddress}
							placeholder="输入你的地址"
							title="输入你的地址"
							onChange={(e) => setProfileAddress(e.target.value)}
						/>

						<div className="profile-settings-title">个性签名</div>
						<input
							type="text"
							className="profile-settings-input"
							value={profileSignature}
							placeholder="输入你的个性签名"
							title="个性签名，最多 100 字"
							onChange={(e) => setProfileSignature(e.target.value)}
						/>

						<div className="profile-settings-title">手机号</div>
						<input
							type="tel"
							className="profile-settings-input"
							value={profilePhone}
							placeholder="输入你的手机号"
							title="手机号"
							onChange={(e) => setProfilePhone(e.target.value)}
						/>

						<div className="profile-settings-actions">
							<button type="button" className="config-nav-button" onClick={handleSaveProfile}>
								{isSaving ? '保存中...' : '保存并提交'}
							</button>
							<button type="button" className="config-nav-button config-nav-button--secondary" onClick={() => showMenuInMain ? goPanel('menu') : onClose()}>
								返回
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
