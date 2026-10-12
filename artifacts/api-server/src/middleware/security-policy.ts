import { parsePublishableKey } from "@clerk/shared/keys";
export function securityPolicy(publishableKey?: string) {
  const host = parsePublishableKey(publishableKey)?.frontendApi;
  const clerk = host ? [`https://${host}`] : [];
  return {
    scriptSrc: ["'self'", ...clerk, "https://challenges.cloudflare.com", "https://*.protect.clerk.com"],
    connectSrc: ["'self'", ...clerk, "https://*.protect.clerk.com", "https://clerk-telemetry.com", "https://*.clerk-telemetry.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "https://img.clerk.com"],
    workerSrc: ["'self'", "blob:"],
    frameSrc: ["'self'", "https://challenges.cloudflare.com", "https://*.protect.clerk.com"],
  };
}
