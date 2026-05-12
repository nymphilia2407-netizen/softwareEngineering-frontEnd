/** 收不到 WS 回执时的等待上限；过长易被当成卡死，过短易误判弱网失败 */
export const SEND_ACK_TIMEOUT_MS = 8000;
export const SEND_ACK_GRACE_MS = 2000;
