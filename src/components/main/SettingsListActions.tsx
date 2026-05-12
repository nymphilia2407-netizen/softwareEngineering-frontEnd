interface SettingsListActionsProps {
    settingsPanel: 'menu' | 'profile' | 'security';
    onSelectProfile: () => void;
    onSelectSecurity: () => void;
    onLogout: () => void;
    onDeleteAccount: () => void | Promise<void>;
}

export default function SettingsListActions({
    settingsPanel,
    onSelectProfile,
    onSelectSecurity,
    onLogout,
    onDeleteAccount,
}: SettingsListActionsProps) {
    return (
        <div className="list-actions">
            <button
                className={`list-action-button ${settingsPanel === 'profile' ? 'active' : ''}`}
                onClick={onSelectProfile}
                title="个人资料"
                type="button"
            >
                个人资料
            </button>

            <button
                className={`list-action-button ${settingsPanel === 'security' ? 'active' : ''}`}
                onClick={onSelectSecurity}
                title="安全信息"
                type="button"
            >
                安全信息
            </button>

            <button className="list-action-button" onClick={onLogout} title="退出登录" type="button">
                退出登录
            </button>

            <button
                className="list-action-button list-action-button--danger"
                onClick={async () => {
                    const confirmed = globalThis.confirm('确认要注销账号吗？此操作无法撤销！');
                    if (!confirmed) {
                        return;
                    }
                    await onDeleteAccount();
                }}
                title="注销账号"
                type="button"
            >
                注销账号
            </button>
        </div>
    );
}
