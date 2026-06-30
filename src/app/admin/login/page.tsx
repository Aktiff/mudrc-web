"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = "/admin";
    } else {
      setError("Nesprávne heslo");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="bg-brand-card rounded-2xl border border-brand-border shadow-lg p-10 w-full max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-6 h-6 text-brand-orange" />
        </div>
        <h1 className="font-display text-3xl text-brand-text text-center tracking-wide mb-1">MUDRC ADMIN</h1>
        <p className="text-brand-muted text-sm text-center mb-8">Zadaj heslo pre vstup</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo"
            autoFocus
            className="input py-3"
          />
          {password.length > 0 && (
            <p className="text-xs text-brand-muted text-right">{password.length} {password.length === 1 ? "znak" : password.length < 5 ? "znaky" : "znakov"}</p>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? "..." : "Vstup"}
          </button>
        </form>
      </div>
    </div>
  );
}
