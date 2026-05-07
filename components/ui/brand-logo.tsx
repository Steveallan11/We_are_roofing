import Image from "next/image";

type Props = {
  size?: "sm" | "md" | "lg";
};

const widths = {
  sm: 120,
  md: 160,
  lg: 220
};

export function BrandLogo({ size = "md" }: Props) {
  const width = widths[size];
  return (
    <Image
      alt="We Are Roofing UK Ltd"
      src="/we-are-roofing-logo.png"
      width={width}
      height={Math.round(width * 0.63)}
      priority
    />
  );
}

