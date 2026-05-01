/** 注册/资料接口：本地选图原文件大小上限 */
export const MAX_AVATAR_FILE_BYTES = 4 * 1024 * 1024;

export async function readAvatarFileAsDataUrl(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件');
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
        throw new Error(`图片需不超过 ${Math.round(MAX_AVATAR_FILE_BYTES / (1024 * 1024))}MB`);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('读取文件失败'));
                return;
            }
            resolve(result);
        };
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(file);
    });
}
