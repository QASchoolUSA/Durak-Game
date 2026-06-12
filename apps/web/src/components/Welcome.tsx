import React, { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useGameStore } from "../store/gameStore";

export const Welcome: React.FC = () => {
  const { signIn } = useAuthActions();
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const setOnlineDisplayName = useGameStore((s) => s.setOnlineDisplayName);

  const [mode, setMode] = useState<"signIn" | "signUp">("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!email.trim() || !password) {
      setError("Please fill out all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signUp" && !handle.trim()) {
      setError("Please pick a handle/display name.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // Execute Convex Auth credentials sign-in/up
      await signIn("password", {
        email: email.trim(),
        password,
        flow: mode,
      });

      // If sign-up, set display name
      if (mode === "signUp" && handle.trim()) {
        setOnlineDisplayName(handle.trim());
      }
      
      setOnboarded(true);
    } catch (err: any) {
      console.error(err);
      setError(
        mode === "signUp"
          ? "Could not create account. The email may already be in use."
          : "Invalid email or password."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="welcome-container">
      <div className="hero-panel">
        <div className="card-fan">
          <div className="deco-card" />
          <div className="deco-card" />
          <div className="deco-card" />
          <div className="deco-card" />
        </div>
        
        <h1 className="glow-title">DURAK</h1>
        <p className="tagline">Classic Russian Card Game</p>

        <div className="form-tabs">
          <div
            className={`form-tab ${mode === "signUp" ? "active" : ""}`}
            onClick={() => {
              setMode("signUp");
              setError(null);
            }}
          >
            CREATE ACCOUNT
          </div>
          <div
            className={`form-tab ${mode === "signIn" ? "active" : ""}`}
            onClick={() => {
              setMode("signIn");
              setError(null);
            }}
          >
            SIGN IN
          </div>
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "signUp" && (
            <div className="form-group">
              <label className="form-label">Player Handle</label>
              <input
                className="form-input"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 12))}
                placeholder="Choose a username"
                disabled={busy}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={busy}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={busy}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button className="btn btn-primary btn-md" type="submit" disabled={busy}>
            {busy ? "Loading..." : mode === "signUp" ? "Register" : "Sign In"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>— OR —</div>
          <button className="btn btn-secondary btn-md" onClick={() => setOnboarded(true)}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};
