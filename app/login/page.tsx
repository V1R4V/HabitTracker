"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-row">
          <div className="brand-mark">HC</div>
          <div>
            <p className="eyebrow">Private tracker</p>
            <h1>Habit Command Center</h1>
          </div>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            Email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {message ? <p className="form-message">{message}</p> : null}
          <button className="primary" disabled={loading}>
            {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button className="link-button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need to create your account?" : "Already have an account?"}
        </button>
      </section>
    </main>
  );
}
