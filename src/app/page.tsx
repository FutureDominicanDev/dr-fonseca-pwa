"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  useEffect(() => {
    let redirected = false;
    const redirectTo = (path: "/inbox" | "/login") => {
      if (redirected) return;
      redirected = true;
      window.location.replace(path);
    };
    const fallback = window.setTimeout(() => redirectTo("/login"), 5000);

    const check = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const refreshed = await supabase.auth.refreshSession().catch(() => null);
          session = refreshed?.data?.session || null;
        }
        window.clearTimeout(fallback);
        redirectTo(session ? "/inbox" : "/login");
      } catch {
        window.clearTimeout(fallback);
        redirectTo("/login");
      }
    };
    check();

    return () => window.clearTimeout(fallback);
  }, []);

  return (
    <div style={{ height: "100dvh", background: "#0D0B2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
