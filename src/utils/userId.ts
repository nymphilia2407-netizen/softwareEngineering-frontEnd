/** 与 ChatWindow.isOtherMemberMessage 一致：避免 senderId / currentUserId 类型不一致或短暂为 0 时误判己方消息 */
export const sameUserId = (a: number, b: number) => Number(a) === Number(b);
