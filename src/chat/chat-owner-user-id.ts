import { Types } from 'mongoose';
import type { ChatDocument } from './chat.schema';

/** Id владельца чата: `chat.user` как ObjectId или после populate. */
export function chatOwnerUserId(chat: ChatDocument): string {
  const u = chat.user as unknown;
  if (u instanceof Types.ObjectId) {
    return u.toString();
  }
  if (typeof u === 'object' && u !== null && '_id' in u) {
    const raw = (u as { _id: Types.ObjectId | string })._id;
    return raw instanceof Types.ObjectId ? raw.toString() : String(raw);
  }
  return String(u);
}
