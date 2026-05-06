import { useEffect, useState, type ChangeEvent } from 'react';

import { updateUserProfile } from '../services/user';
import { persistUserProfile } from '../utils/auth';
import { readAvatarFileAsDataUrl } from '../utils/avatarFile';

import '../styles/config.css';

interface ConfigPanelProps {
	isOpen: boolean;
	onClose: () => void;
	initialView: PanelView;
	currentUser: {
		userId: number;
		username: string;
		avatar: string;
		birthday: string;
		address: string;
		signature: string;
	};
	onAvatarUpdated: (avatar: string) => void;
	onLogout: () => void;
	onDeleteAccount: () => Promise<void>;
}

type PanelView = 'menu' | 'profile';

export default function ConfigPanel({
	isOpen,
	onClose,
	initialView,
	currentUser,
	onAvatarUpdated,
	onLogout,
	onDeleteAccount,
}: Readonly<ConfigPanelProps>) {
	const [panelView, setPanelView] = useState<PanelView>('menu');
	const [profileBirthday, setProfileBirthday] = useState(currentUser.birthday);
	const [profileAddress, setProfileAddress] = useState(currentUser.address);
	const [profileSignature, setProfileSignature] = useState(currentUser.signature);
	const [isSaving, setIsSaving] = useState(false);
	const [avatar, setAvatar] = useState(currentUser.avatar);
	const [profileAvatarSaving, setProfileAvatarSaving] = useState(false);

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
	}, [currentUser.avatar, currentUser.address, currentUser.birthday, currentUser.signature]);

	const handleClose = () => {
		setPanelView('menu');
		onClose();
	};

	const handleSaveProfile = async () => {
		try {
			setIsSaving(true);
			await updateUserProfile({
				birthday: profileBirthday,
				address: profileAddress,
				signature: profileSignature,
			});
			alert('保存成功');
			setPanelView('menu');
		} catch (err) {
			alert(err instanceof Error ? err.message : '保存失败');
		} finally {
			setIsSaving(false);
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
			persistUserProfile(currentUser.username, dataUrl);
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
		<div
			className="overlay"
		>
			<button type="button" className="overlay-dismiss" onClick={handleClose} aria-label="关闭设置面板" />
			<div
				className={`config-panel ${panelView === 'profile' ? 'config-panel--profile' : ''}`}
			>
				{panelView === 'menu' ? (
					<>
						<button
							type="button"
							className="config-button"
							onClick={() => {
								setPanelView('menu');
								onClose();
							}}
						>
							关闭
						</button>
						<button type="button" className="config-button" onClick={() => setPanelView('profile')}>
							个人资料
						</button>
						<button type="button" className="config-button" onClick={handleLogout}>
							退出登录
						</button>
						<button type="button" className="config-button config-button--danger" onClick={handleDelete}>
							注销账号
						</button>
					</>
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

						<button type="button" className="config-button" onClick={handleSaveProfile}>
							{isSaving ? '保存中...' : '保存并提交'}
						</button>

						<button type="button" className="config-button" onClick={() => setPanelView('menu')}>
							返回
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
