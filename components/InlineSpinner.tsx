/** 送信待ちなど用のインラインスピナー */
export function InlineSpinner({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent opacity-90 ${className}`}
      aria-hidden
    />
  );
}
