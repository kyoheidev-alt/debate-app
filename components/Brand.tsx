import Image from "next/image";
import Link from "next/link";

type BrandSize = "sm" | "md" | "lg";

interface BrandProps {
  size?: BrandSize;
  asLink?: boolean;
  href?: string;
  className?: string;
}

const dimensions: Record<
  BrandSize,
  { w: number; h: number; className: string; src: string }
> = {
  sm: { w: 40, h: 40, className: "h-8 w-8 rounded-sm", src: "/icon.png" },
  md: { w: 220, h: 64, className: "h-12 w-auto", src: "/logo.png" },
  lg: {
    w: 1120,
    h: 320,
    className: "h-48 w-auto max-w-full sm:h-60 md:h-72",
    src: "/logo.png",
  },
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
      src={d.src}
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
