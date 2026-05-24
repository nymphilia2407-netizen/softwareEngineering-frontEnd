import { memo } from 'react';

interface GroupSyncToastProps {
    message: string;
}

function GroupSyncToast({ message }: GroupSyncToastProps) {
    return (
        <div className="group-sync-toast" role="status" aria-live="polite">
            {message}
        </div>
    );
}

export default memo(GroupSyncToast);
