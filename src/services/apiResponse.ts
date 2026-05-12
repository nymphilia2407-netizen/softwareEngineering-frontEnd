/** 与后端 JSON 约定一致：code === 0 表示成功 */
export interface ApiResponse<T> {
    code: number;
    info: string;
    data?: T;
}

export function unwrapApiData<T>(response: ApiResponse<T>, fallbackMessage: string): T {
    if (response.code !== 0 || response.data === undefined) {
        throw new Error(response.info || fallbackMessage);
    }

    return response.data;
}

export function assertApiSuccess(response: ApiResponse<unknown>, fallbackMessage: string): void {
    if (response.code !== 0) {
        throw new Error(response.info || fallbackMessage);
    }
}
