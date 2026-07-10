import React, { useEffect, useState } from "react";
import { api, setToken, getToken } from "./api.js";
import Login from "./pages/Login.jsx";
import Inbox from "./pages/Inbox.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("inbox");

  useEffect(() => {
    if (!getToken()) return setLoading(false);
    api.get("/api/me").then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="login-wrap"><div className="muted">Carregando…</div></div>;
  if (!user) return <Login onLogin={setUser} />;

  const logout = async () => {
    try { await api.post("/api/logout"); } catch {}
    setToken(null);
    setUser(null);
  };

  const nav = [
    { id: "inbox", label: "Conversas" },
    { id: "campaigns", label: "Campanhas" },
  ];
  if (user.role === "admin") nav.push({ id: "admin", label: "Equipe e números" });

  const titles = { inbox: "Conversas", campaigns: "Campanhas de disparo", admin: "Equipe e números" };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><b>Instructiva</b><span>·vendas</span></div>
        <nav className="nav">
          {nav.map((n) => (
            <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => setView(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <div className="userbox">
          <div className="name">{user.name}</div>
          <div className="role">{user.role === "admin" ? "Gestor" : "Vendedor"}{user.canDispatch ? " · disparo liberado" : ""}</div>
          <button onClick={logout}>Sair</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar"><h1>{titles[view]}</h1></div>
        <div className="content" style={view === "inbox" ? { padding: 0 } : undefined}>
          {view === "inbox" && <Inbox user={user} />}
          {view === "campaigns" && <Campaigns user={user} />}
          {view === "admin" && user.role === "admin" && <Admin />}
        </div>
      </div>
    </div>
  );
}
