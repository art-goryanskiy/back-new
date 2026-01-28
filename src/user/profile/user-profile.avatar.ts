import type { UpdateMyProfileInput } from '../gql/user.input';

export function normalizeAvatar(
  input: UpdateMyProfileInput,
): string | undefined {
  const rawAvatar = (input as { avatar?: unknown }).avatar;
  const newAvatar =
    typeof rawAvatar === 'string' ? rawAvatar.trim() : undefined;
  return newAvatar && newAvatar.length ? newAvatar : undefined;
}
