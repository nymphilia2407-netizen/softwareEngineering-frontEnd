interface GroupSyncToastProps {
    message: string;
}

export default function GroupSyncToast({ message }: GroupSyncToastProps) {
    return (
        <div className="group-sync-toast" role="status" aria-live="polite">
            {message}
        </div>
    );
}
