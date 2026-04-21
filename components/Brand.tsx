import Image from "next/image";
import Link from "next/link";

type BrandSize = "sm" | "md" | "lg";

interface BrandProps {
  size?: BrandSize;
  asLink?: boolean;
  href?: string;
  className?: string;
}

const dimensions: Record<BrandSize, { w: number; h: number; className: string }> = {
  sm: { w: 140, h: 40, className: "h-8 w-auto" },
  md: { w: 220, h: 64, className: "h-12 w-auto" },
  lg: { w: 420, h: 120, className: "h-24 w-auto" },
};

export function Brand({
  size = "md",
  asLink = true,
  href = "/",
  className = "",
}: BrandProps) {
  const d = dimensions[size];
  const img = (
    <Image
      src="/logo.png"
      alt="匿名ディベートチャット"
      width={d.w}
      height={d.h}
      priority={size === "lg"}
      className={`${d.className} select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]`}
    />
  );
  if (!asLink) {
    return <span className={className}>{img}</span>;
  }
  return (
    <Link
      href={href}
      aria-label="匿名ディベートチャット ホーム"
      className={`inline-flex items-center ${className}`}
    >
      {img}
    </Link>
  );
}
