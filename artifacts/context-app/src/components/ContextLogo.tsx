const assetBase = import.meta.env.BASE_URL;

export function ContextMark({ className = "", decorative = false }: { className?: string; decorative?: boolean }) {
  return <img src={`${assetBase}logo.svg`} alt={decorative ? "" : "Context"}
    aria-hidden={decorative || undefined} width={64} height={64} className={`shrink-0 ${className}`} />;
}

export default function ContextLogo({ className = "", dark = false, compact = false }: {
  className?: string; dark?: boolean; compact?: boolean;
}) {
  return <span className={`context-logo ${dark ? "context-logo-dark" : ""} ${compact ? "context-logo-compact" : ""} ${className}`}>
    <img src={`${assetBase}branding/context-logo-v1.png`} alt="Context" width={2172} height={724} />
    {/* Only the wordmark changes color; preserve the approved symbol's colors. */}
    <img src={`${assetBase}branding/context-logo-v1.png`} alt="" aria-hidden="true"
      width={2172} height={724} className="context-logo-light-wordmark" />
    {compact && <ContextMark className="context-logo-mobile-mark" />}
  </span>;
}
