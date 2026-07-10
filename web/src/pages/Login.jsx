import React, { useState } from "react";
import { Send } from "lucide-react";
import { api, setToken } from "../api.js";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api.post("/api/login", { email, password });
      setToken(token);
      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand">
          <div className="logo"><Send size={19} /></div>
          <div className="wm"><b>Instructiva</b><span>Vendas</span></div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>Entre com sua conta de vendedor.</p>
        {error && <div className="error">{error}</div>}
        <label>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
        <label>Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="btn" style={{ width: "100%", marginTop: 22 }} onClick={submit} disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}
