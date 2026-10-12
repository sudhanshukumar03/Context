import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/react";

export const isDevAuthBypass = import.meta.env.DEV && import.meta.env.VITE_ALLOW_DEV_AUTH_BYPASS === "true";
type Session = { getToken: () => Promise<string | null>; orgId: string | null; user: {
  id: string; firstName: string | null; fullName: string | null; createdAt: Date | null;
  emailAddresses: { emailAddress: string }[];
} | null };
const localSession: Session = { getToken: async () => null, orgId: null,
  user: { id: "user_local_dev", firstName: "Local", fullName: "Local Developer", createdAt: new Date(0), emailAddresses: [] } };
const SessionContext = createContext<Session | null>(null);
export function DevSession({ children }: { children: ReactNode }) {
  return <SessionContext.Provider value={localSession}>{children}</SessionContext.Provider>;
}
export function ClerkSession({ children }: { children: ReactNode }) {
  const { getToken, orgId } = useClerkAuth(); const { user } = useClerkUser();
  const session = useMemo(() => ({ getToken, orgId: orgId ?? null, user: user ?? null }), [getToken, orgId, user]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
export function useAuth() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Authentication session provider is missing");
  return session;
}
export const useUser = useAuth;
