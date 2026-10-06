/**
 * AuthContext for Class Up. Follows the Emergent Managed Google Auth playbook.
 * - Session_id captured from redirect URL (mobile hash fragment or web query/hash)
 * - Session_token stored in expo-secure-store on mobile, localStorage on web
 * - Exposes: loading, user, signIn, signOut, refresh
 * - Root layout owns navigation gating.
 */
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { api, setAuthToken } from "@/src/api/client";

WebBrowser.maybeCompleteAuthSession();

export type StudentUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  grade: string;
  section?: string;
  jornada?: string;
  birth_date?: string;
  student_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  profile_setup_completed: boolean;
  initial_assessment_completed: boolean;
  assessments_opened?: string[];
};

type AuthCtx = {
  loading: boolean;
  user: StudentUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
const TOKEN_KEY = "classup_session_token";

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeToken(token: string | null) {
  if (Platform.OS === "web") {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
    return;
  }
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<StudentUser | null>(null);
  const exchanged = useRef<Set<string>>(new Set());

  const applyToken = useCallback(async (token: string | null, userDoc: StudentUser | null) => {
    setAuthToken(token);
    await writeToken(token);
    setUser(userDoc);
  }, []);

  const exchangeSessionId = useCallback(
    async (sessionId: string) => {
      if (exchanged.current.has(sessionId)) return;
      exchanged.current.add(sessionId);
      try {
        const res = await api.post<{ session_token: string; user: StudentUser }>(
          "/auth/session",
          { session_id: sessionId },
        );
        await applyToken(res.session_token, res.user);
      } catch (e) {
        console.warn("session exchange failed", e);
      }
    },
    [applyToken],
  );

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get<StudentUser>("/auth/me");
      setUser(me);
    } catch (e: any) {
      if (e?.status === 401) {
        await applyToken(null, null);
      }
    }
  }, [applyToken]);

  // Mount: process session_id in the current URL, then existing token.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Web: parse window.location for session_id (hash or search)
      if (Platform.OS === "web") {
        try {
          const raw = window.location.href;
          const sid = extractSessionId(raw);
          if (sid) {
            await exchangeSessionId(sid);
            try {
              const url = new URL(window.location.href);
              url.hash = url.hash.replace(/[?#&]?session_id=[^&]+/, "").replace(/^#$/, "");
              url.searchParams.delete("session_id");
              window.history.replaceState(window.history.state, "", url.toString());
            } catch {}
          }
        } catch {}
      } else {
        // Mobile: cold-start URL may carry session_id
        try {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) await exchangeSessionId(sid);
        } catch {}
      }

      // Existing token check
      const token = await readToken();
      if (token && !cancelled) {
        setAuthToken(token);
        try {
          const me = await api.get<StudentUser>("/auth/me");
          if (!cancelled) setUser(me);
        } catch (e: any) {
          if (e?.status === 401) await applyToken(null, null);
        }
      }
      if (!cancelled) setLoading(false);
    };

    bootstrap();

    // Mobile: also listen for hot links
    const sub =
      Platform.OS !== "web"
        ? Linking.addEventListener("url", (evt) => {
            const sid = extractSessionId(evt.url);
            if (sid) exchangeSessionId(sid);
          })
        : null;

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [applyToken, exchangeSessionId]);

const signIn = useCallback(async () => {
  try {
    const res = await api.post<{ session_token: string; user: StudentUser }>(
      "/auth/dev-login",
    );
    await applyToken(res.session_token, res.user);
  } catch (e) {
    console.warn("dev login error", e);
  }
}, [applyToken]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await applyToken(null, null);
  }, [applyToken]);

  const value = useMemo(
    () => ({ loading, user, signIn, signOut, refreshUser }),
    [loading, user, signIn, signOut, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
