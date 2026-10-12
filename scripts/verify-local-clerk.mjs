import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readClerkTestCredentials } from "./local-clerk-credentials.mjs";
import { createRequire } from "node:module";

// Read-only calls to Clerk's intended backend; never log keys, user data or raw errors.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const { secretKey, publishableKey } = await readClerkTestCredentials(root);
  async function get(path) {
    const response = await fetch(`https://api.clerk.com/v1${path}`, {
      method: "GET", headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (!response.ok) throw new Error(`Clerk rejected the read-only configuration check (HTTP ${response.status}).`);
    return response.json();
  }
  const instance = await get("/instance");
  if (instance.environment_type !== "development") throw new Error("The secret did not identify a Clerk development instance.");
  console.log("PASS: Clerk accepted the Secret Key for a development instance.");
  const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
  const { parsePublishableKey } = require("@clerk/shared/keys");
  const expectedHost = parsePublishableKey(publishableKey).frontendApi;
  const response = await get("/domains");
  const domains = Array.isArray(response) ? response : response.data;
  const matching = Array.isArray(domains) && domains.some(domain => {
    if (typeof domain.frontend_api_url !== "string") return false;
    try { return new URL(domain.frontend_api_url.includes("://") ? domain.frontend_api_url : `https://${domain.frontend_api_url}`).hostname === expectedHost; }
    catch { return false; }
  });
  if (!matching) throw new Error("Clerk keys could not be matched to the same instance's frontend domain.");
  console.log("PASS: Publishable and Secret Keys identify the same Clerk instance.");
  const organizations = await get("/instance/organization_settings");
  console.log(`Organizations: ${organizations.enabled === true ? "enabled" : organizations.enabled === false ? "disabled" : "check in Clerk Dashboard"}`);
  console.log(`Personal accounts: ${organizations.force_organization_selection === false ? "allowed" : organizations.force_organization_selection === true ? "organization required" : "check in Clerk Dashboard"}`);
  console.log("No Clerk settings, memberships or invitations were changed by this verification command. A real signed-in API request still needs checking.");
} catch (error) {
  if (error instanceof Error && /^(Set |Run |The Clerk |Frontend |The account |Clerk rejected |Clerk keys |The secret )/.test(error.message)) console.error(error.message);
  else console.error("Clerk configuration could not be checked. Check connectivity and the saved test keys.");
  process.exitCode = 1;
}
