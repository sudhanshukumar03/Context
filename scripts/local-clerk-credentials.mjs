import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export function validateClerkTestCredentials(accounts, root) {
  const publishableKeys = [accounts.CLERK_PUBLISHABLE_KEY, accounts.VITE_CLERK_PUBLISHABLE_KEY,
    accounts.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY].map(value => value?.trim()).filter(Boolean);
  const publishableKey = publishableKeys[0];
  const secretKey = accounts.CLERK_SECRET_KEY?.trim();
  if (!publishableKey?.startsWith("pk_test_") || /your|placeholder|xxx/i.test(publishableKey))
    throw new Error("Set a Clerk test Publishable Key in runtime/config/accounts.env.");
  const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
  const { parsePublishableKey } = require("@clerk/shared/keys");
  if (!parsePublishableKey(publishableKey)) throw new Error("The Clerk Publishable Key is invalid.");
  if (!/^sk_test_[A-Za-z0-9_-]{20,}$/.test(secretKey ?? "") || /your|placeholder|xxx/i.test(secretKey))
    throw new Error("Set a Clerk test Secret Key in runtime/config/accounts.env. Keep the key out of chat.");
  if (publishableKeys.some(value => value !== publishableKey))
    throw new Error("Frontend and API Clerk Publishable Keys must match.");
  if (Object.keys(accounts).some(name => name.startsWith("VITE_") && name !== "VITE_CLERK_PUBLISHABLE_KEY"))
    throw new Error("The account file must not contain other VITE_ variables, including secret keys.");
  return { publishableKey, secretKey };
}

export async function readClerkTestCredentials(root) {
  let contents;
  try { contents = await readFile(resolve(root, "runtime/config/accounts.env"), "utf8"); }
  catch { throw new Error("Run pnpm local:clerk-setup, then add the Clerk test Secret Key to the generated local file."); }
  return validateClerkTestCredentials(parseEnv(contents), root);
}
