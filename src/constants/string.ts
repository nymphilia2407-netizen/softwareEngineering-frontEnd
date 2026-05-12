import defaultAvatar from '../assets/default.png';
import chatIcon from '../assets/chat-icon.jpg';
import contactIcon from '../assets/contact-icon.jpg';
import configIcon from '../assets/config-icon.webp';

export const DEFAULT_AVATAR = defaultAvatar;
export const CHATICON = chatIcon;
export const CONTACTICON = contactIcon;
export const CONFIGICON = configIcon;

// 与 request 保持一致：优先环境变量，兜底本地
export const BACKENDURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:80';

/** 收不到 WS 回执时的等待上限；过长易被当成卡死，过短易误判弱网失败 */
export const SEND_ACK_TIMEOUT_MS = 8000;
export const SEND_ACK_GRACE_MS = 2000;