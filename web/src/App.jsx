import React, { useEffect, useState } from "react";
import { LayoutDashboard, MessageSquare, Send, Users } from "lucide-react";
import { api, setToken, getToken } from "./api.js";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inbox from "./pages/Inbox.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");

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
    { id: "dashboard", label: "Painel", icon: LayoutDashboard },
    { id: "inbox", label: "Conversas", icon: MessageSquare },
    { id: "campaigns", label: "Campanhas", icon: Send },
  ];
  if (user.role === "admin") nav.push({ id: "admin", label: "Equipe e números", icon: Users });

  const heads = {
    dashboard: ["Painel", "Visão geral das vendas em tempo real."],
    inbox: ["Conversas", "Atendimento por número."],
    campaigns: ["Campanhas de disparo", "Envios por template aprovado."],
    admin: ["Equipe e números", "Vendedores, números e templates."],
  };
  const [title, sub] = heads[view];
  const avatarLetter = (user.name || "?").trim()[0]?.toUpperCase() || "?";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo"><Send size={19} /></div>
          <div className="wm"><b>Instructiva</b><span>Vendas</span></div>
        </div>
        <nav className="nav">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => setView(n.id)}>
                <Icon size={18} /> {n.label}
              </button>
            );
          })}
        </nav>
        <div className="spacer" />
        <div className="userbox">
          <div className="who">
            <div className="ava">{avatarLetter}</div>
            <div>
              <div className="name">{user.name}</div>
              <div className="role">{user.role === "admin" ? "Gestor" : "Vendedor"}{user.canDispatch ? " · disparo liberado" : ""}</div>
            </div>
          </div>
          <button onClick={logout}>Sair</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="title"><span className="rule" /><h1>{title}</h1></div>
            <div className="sub">{sub}</div>
          </div>
        </div>
        <div className="content" style={view === "inbox" ? { paddingBottom: 12 } : undefined}>
          {view === "dashboard" && <Dashboard user={user} onGo={setView} />}
          {view === "inbox" && <Inbox user={user} />}
          {view === "campaigns" && <Campaigns user={user} />}
          {view === "admin" && user.role === "admin" && <Admin />}
        </div>
      </div>
    </div>
  );
}
