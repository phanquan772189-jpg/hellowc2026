import Image from "next/image";

interface Props {
  src: string;
  alt: string;
  size: number;
  className?: string;
}

export default function LogoMark({ src, alt, size, className = "" }: Props) {
  return (
    <span
      className={`relative block shrink-0 ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-contain" unoptimized />
    </span>
  );
}
