import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** `redirect()` が Server Action 内で投げる制御用エラー。画面に文言として出さないこと。 */
export function isNextRedirectError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
    return true;
  }
  return err instanceof Error && err.message === "NEXT_REDIRECT";
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ANIMALS = [
  "ライオン", "パンダ", "ペンギン", "イルカ", "コアラ", "キリン",
  "カピバラ", "ハリネズミ", "アザラシ", "フクロウ", "リス", "カワウソ",
  "シマウマ", "アルパカ", "オオカミ", "タヌキ", "ハムスター", "クジラ",
];

export function generateNickname(): string {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${animal}${num}`;
}
