"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AUTH_TIMEOUT_MS = 3500;

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("Checking secure session...");
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setStatus("Taking longer than expected.");
      setShowFallback(true);
    }, AUTH_TIMEOUT_MS);

    const check = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        window.clearTimeout(timeout);
        router.replace(session ? "/inbox" : "/login");
      } catch {
        if (!active) return;
        window.clearTimeout(timeout);
        setStatus("We could not verify the session automatically.");
        setShowFallback(true);
      }
    };

    check();

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [router]);

  return (
    <>
      <style>{`
        .launch-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: linear-gradient(160deg, #1C1C1E 0%, #2C2C2E 52%, #113a68 100%);
          color: #ffffff;
        }

        .launch-panel {
          width: min(100%, 430px);
          text-align: center;
        }

        .launch-logo {
          width: min(72vw, 220px);
          height: auto;
          object-fit: contain;
          margin: 0 auto 24px;
          display: block;
        }

        .launch-spinner {
          width: 34px;
          height: 34px;
          border: 3px solid rgba(255,255,255,0.25);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin: 0 auto 18px;
        }

        .launch-title {
          margin: 0;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .launch-status {
          margin: 10px 0 0;
          color: rgba(255,255,255,0.78);
          font-size: 15px;
          font-weight: 700;
          line-height: 1.5;
        }

        .launch-actions {
          display: grid;
          gap: 10px;
          margin-top: 24px;
        }

        .launch-link {
          display: block;
          padding: 15px 16px;
          border-radius: 14px;
          text-decoration: none;
          font-size: 16px;
          font-weight: 900;
        }

        .launch-link.primary {
          background: #007AFF;
          color: #ffffff;
          box-shadow: 0 12px 30px rgba(0, 122, 255, 0.32);
        }

        .launch-link.secondary {
          background: rgba(255,255,255,0.12);
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.18);
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <main className="launch-page">
        <section className="launch-panel" aria-live="polite">
          <img className="launch-logo" src="/fonseca_clear.png" alt="Dr. Miguel Fonseca" />
          {!showFallback && <div className="launch-spinner" aria-hidden="true" />}
          <h1 className="launch-title">Portal Medico</h1>
          <p className="launch-status">{status}</p>

          {showFallback && (
            <div className="launch-actions">
              <Link className="launch-link primary" href="/login">
                Staff Login
              </Link>
              <Link className="launch-link secondary" href="/patient">
                Patient Access
              </Link>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
