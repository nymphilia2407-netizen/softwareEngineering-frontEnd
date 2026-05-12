import type { User } from '../../types/entity';
import { readAvatarFileAsDataUrl } from '../../utils/avatar';

export interface CreateGroupPanelProps {
    filteredFriends: User[];
    groupName: string;
    onGroupNameChange: (value: string) => void;
    selectedMemberIds: number[];
    onToggleMember: (memberId: number) => void;
    groupAvatarPreview: string;
    groupAvatarDataUrl: string | null;
    onAvatarPicked: (dataUrl: string) => void;
    onAvatarClear: () => void;
    isSubmitting: boolean;
    onSubmit: () => void;
    onCancel: () => void;
}

export default function CreateGroupPanel({
    filteredFriends,
    groupName,
    onGroupNameChange,
    selectedMemberIds,
    onToggleMember,
    groupAvatarPreview,
    groupAvatarDataUrl,
    onAvatarPicked,
    onAvatarClear,
    isSubmitting,
    onSubmit,
    onCancel,
}: CreateGroupPanelProps) {
    return (
        <div className="create-group-panel">
            <div className="create-group-field">
                <label htmlFor="group-name-input">群聊名称</label>
                <input
                    id="group-name-input"
                    type="text"
                    placeholder="输入群聊名称"
                    value={groupName}
                    onChange={(e) => onGroupNameChange(e.target.value)}
                />
            </div>
            <div className="create-group-field">
                <span className="create-group-member-list-label">群头像（可选）</span>
                <div className="create-group-avatar-row">
                    <img className="create-group-avatar-preview" src={groupAvatarPreview} alt="" />
                    <div className="create-group-avatar-actions">
                        <label className="create-group-avatar-upload">
                            选择图片
                            <input
                                type="file"
                                accept="image/*"
                                className="create-group-avatar-file"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) {
                                        return;
                                    }
                                    void (async () => {
                                        try {
                                            const dataUrl = await readAvatarFileAsDataUrl(file);
                                            onAvatarPicked(dataUrl);
                                        } catch (err) {
                                            alert(err instanceof Error ? err.message : '选择图片失败');
                                        } finally {
                                            e.target.value = '';
                                        }
                                    })();
                                }}
                            />
                        </label>
                        {groupAvatarDataUrl && (
                            <button type="button" className="create-group-avatar-clear" onClick={onAvatarClear}>
                                使用默认
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="create-group-field">
                <div className="create-group-label-row">
                    <span className="create-group-member-list-label">选择好友</span>
                    <span>{selectedMemberIds.length} 人已选</span>
                </div>
                <div className="create-group-member-list">
                    {filteredFriends.map((friend) => (
                        <label key={friend.id} className="create-group-member-item">
                            <input
                                type="checkbox"
                                checked={selectedMemberIds.includes(friend.id)}
                                onChange={() => onToggleMember(friend.id)}
                            />
                            <span>{friend.username}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="create-group-actions">
                <button type="button" className="create-group-secondary-button" onClick={onCancel}>
                    取消
                </button>
                <button
                    type="button"
                    className="create-group-primary-button"
                    onClick={() => void onSubmit()}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '创建中…' : '创建群聊'}
                </button>
            </div>
        </div>
    );
}
