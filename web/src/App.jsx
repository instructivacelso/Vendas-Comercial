import React, { useEffect, useState } from "react";
import { LayoutDashboard, MessageSquare, Send, Users, Hash, FileText, Zap, Plug } from "lucide-react";
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

  const mainNav = [
    { id: "dashboard", label: "Painel", icon: LayoutDashboard },
    { id: "inbox", label: "Conversas", icon: MessageSquare },
    { id: "campaigns", label: "Campanhas", icon: Send },
  ];
  const adminNav = [
    { id: "conexao", label: "Conexão Meta", icon: Plug },
    { id: "numbers", label: "Números", icon: Hash },
    { id: "vendedores", label: "Vendedores", icon: Users },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "respostas", label: "Respostas rápidas", icon: Zap },
  ];

  const heads = {
    dashboard: ["Painel", "Visão geral das vendas em tempo real."],
    inbox: ["Conversas", "Atendimento por número."],
    campaigns: ["Campanhas de disparo", "Envios por template aprovado."],
    conexao: ["Conexão com a Meta", "Conecte o WhatsApp oficial da sua equipe."],
    numbers: ["Números", "Cadastre e gerencie seus números oficiais."],
    vendedores: ["Vendedores", "Acessos, número atribuído e permissão de disparo."],
    templates: ["Templates", "Modelos de mensagem aprovados pela Meta."],
    respostas: ["Respostas rápidas", "Atalhos de texto para a equipe."],
  };
  const [title, sub] = heads[view] || heads.dashboard;
  const avatarLetter = (user.name || "?").trim()[0]?.toUpperCase() || "?";

  const adminSections = { conexao: "conexao", numbers: "numbers", vendedores: "team", templates: "templates", respostas: "replies" };

  const NavBtn = (n) => {
    const Icon = n.icon;
    return (
      <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => setView(n.id)}>
        <Icon size={18} /> {n.label}
      </button>
    );
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="Instructiva" className="logo-img" />
          <div className="wm"><b>Instructiva</b><span>Vendas</span></div>
        </div>
        <nav className="nav">
          {mainNav.map(NavBtn)}
          {user.role === "admin" && (
            <>
              <div className="nav-label">Gestão</div>
              {adminNav.map(NavBtn)}
            </>
          )}
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
          {adminSections[view] && user.role === "admin" && <Admin section={adminSections[view]} />}
        </div>
      </div>
    </div>
  );
}
