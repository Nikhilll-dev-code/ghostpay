import React, { useState } from "react";
import { ArrowRight, Ghost, LockKey, WarningOctagon } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { Field, Notice } from "../components/ui";
import { SkipLink } from "./public/PublicChrome";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("owner@ghost.finance");
  const [password, setPassword] = useState("ghostpassword123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your workspace email.";
    else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = "Enter a valid email address, for example name@company.com.";
    if (!password) nextErrors.password = "Enter your password.";
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      window.location.hash = "#/app/overview";
    } catch (err: any) {
      setError(err.message || "Sign in failed. Check your email and password, then try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: "owner" | "operator") => {
    setFieldErrors({});
    setError(null);
    if (role === "owner") {
      setEmail("owner@ghost.finance");
      setPassword("ghostpassword123");
    } else {
      setEmail("operator@ghost.finance");
      setPassword("operatorpassword123");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm px-4 py-12">
      <SkipLink />
      <main id="main" tabIndex={-1} className="view-enter card w-full max-w-md space-y-6 p-8 focus:outline-none">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl border border-line bg-raised p-3">
            <Ghost size={32} weight="fill" aria-hidden="true" />
          </div>
          <h1 className="heading-5 gradient-heading">Sign in to Ghost 3.0</h1>
          <p className="body-6 text-fg-muted">Policy governed AI financial operations</p>
          <span className="badge badge-warn">
            <LockKey size={12} weight="bold" aria-hidden="true" />
            Demo workspace on PayPal Sandbox
          </span>
        </div>

        {error && (
          <Notice tone="bad" icon={WarningOctagon} role="alert">
            {error}
          </Notice>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field id="login-email" label="Workspace email" error={fieldErrors.email}>
            {(props) => (
              <input
                {...props}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
              />
            )}
          </Field>
          <Field id="login-password" label="Password" error={fieldErrors.password}>
            {(props) => (
              <input
                {...props}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field"
              />
            )}
          </Field>
          <button type="submit" disabled={loading} className="btn btn-primary btn-md w-full">
            <span>{loading ? "Signing in" : "Enter the control room"}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        <div className="space-y-2 border-t border-line pt-4">
          <div className="caption-3 text-center uppercase tracking-wider text-fg-subtle">Demo roles</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => fillDemo("owner")} className="btn btn-secondary">
              Owner, full control
            </button>
            <button type="button" onClick={() => fillDemo("operator")} className="btn btn-secondary">
              Operator, read and queue
            </button>
          </div>
          <p className="caption-5 text-center text-fg-subtle">
            Demo credentials are prefilled for the hackathon workspace. Remove them before any shared deployment.
          </p>
        </div>

        <a href="#/" className="body-5 block text-center text-fg-muted hover:text-fg motion-color">
          Back to home
        </a>
      </main>
    </div>
  );
};
