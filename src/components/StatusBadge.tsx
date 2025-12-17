export const StatusBadge = (props: { success: boolean }) => {
    if (props.success) {
        return (
            <span className="moveleft inline-flex items-center justify-center py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 status-badge-width">
                Success
            </span>
        );
    } else {
        return (
            <span className="moveleft inline-flex items-center justify-center py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 status-badge-width">
                Failed
            </span>
        );
    }
};