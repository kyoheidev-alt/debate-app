/**
 * Initial value for `/r/[id]/setup-nickname`.
 *
 * `handle_new_user` stores `login_id` (学籍番号) in `profiles.nickname`
 * until the student saves one, and leaves `has_set_nickname` false.
 * That placeholder, a real name, or a remembered student id must not
 * appear in the input. A nickname that was actually saved is kept.
 */
export function initialSetupNickname(profile: {
  nickname?: string | null;
  has_set_nickname: boolean;
}): string {
  if (!profile.has_set_nickname) return "";
  return (profile.nickname ?? "").trim();
}
