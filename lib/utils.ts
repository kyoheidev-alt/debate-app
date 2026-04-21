import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
