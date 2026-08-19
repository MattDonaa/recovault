import Image from "next/image";

import { BRAND, type BrandLogoVariant } from "@/config/brand";
import { cn } from "@/lib/utils";

const SPECS: Record<
  BrandLogoVariant,
  { src: string; width: number; height: number; alt: string }
> = {
  website: { src: BRAND.assets.website, width: 400, height: 160, alt: "RecoVault" },
  wordmark: { src: BRAND.assets.wordmark, width: 400, height: 160, alt: "RecoVault" },
  symbol: { src: BRAND.assets.symbol, width: 64, height: 64, alt: "" },
  favicon: { src: BRAND.assets.favicon, width: 32, height: 32, alt: "" },
};

/**
 * Renders a supplied RecoVault logo asset unaltered. Never recolors, stretches,
 * rotates, or recreates the mark. Decorative symbols use empty alt text.
 */
export function BrandLogo({
  variant,
  className,
  priority,
}: {
  variant: BrandLogoVariant;
  className?: string;
  priority?: boolean;
}) {
  const spec = SPECS[variant];
  return (
    <Image
      src={spec.src}
      width={spec.width}
      height={spec.height}
      alt={spec.alt}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
