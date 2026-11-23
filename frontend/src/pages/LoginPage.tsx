import React, { useState } from "react";
import { Icon } from "../components/Icon";
import type { TokenResponse } from "../types/auth";
import "../styles/login.css";

const endpoint = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // OAuth2 Password Request Form expects URL-encoded form data
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const response = await fetch(`${endpoint}/admins/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Invalid credentials. Please try again.");
      }

      const data: TokenResponse = await response.json();

      // Store token in localStorage and context
      localStorage.setItem("access_token", data.access_token);
      onLoginSuccess(data.access_token);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during login.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-container">
      <section className="login-story" aria-label="FastBites operations">
        <a className="login-brand" href="/" aria-label="FastBites admin home">
          <span className="login-brand-mark">
            <img src="/fastbites-logo.png" alt="" />
          </span>
          <span className="login-brand-copy">
            <strong>FastBites</strong>
            <small>ADMIN CONSOLE</small>
          </span>
        </a>

        <div className="login-story-copy">
          <span className="login-story-kicker">
            <Icon name="spark" size={15} />
            FastBites operations
          </span>
          <h1>
            A clearer view of every <span>delivery.</span>
          </h1>
          <p>
            Keep orders moving, support your delivery team, and stay on top of
            every update from one place.
          </p>
          <ul className="login-benefits">
            <li>
              <Icon name="check" size={13} />
              Track orders and activity in real time
            </li>
            <li>
              <Icon name="check" size={13} />
              Review waiter applications with ease
            </li>
            <li>
              <Icon name="check" size={13} />
              Keep your operations organized
            </li>
          </ul>
        </div>

        <span className="login-story-footer">
          Made for smooth, dependable delivery operations.
        </span>
        <div className="login-decoration" aria-hidden="true" />
      </section>

      <section className="login-panel">
        <div className="login-card">
          <header className="login-header">
            <p className="login-eyebrow">Admin portal</p>
            <h2>Welcome back</h2>
            <p>Sign in to manage your FastBites operations.</p>
          </header>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Email or username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your email or username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                "Signing in..."
              ) : "Sign in"}
            </button>
          </form>

          <div className="login-security-note">
            <Icon name="shield" size={15} />
            <span>Admin access is restricted to authorized team members.</span>
          </div>
        </div>
      </section>
    </main>
  );
};