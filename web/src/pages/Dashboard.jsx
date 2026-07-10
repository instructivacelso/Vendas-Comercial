import React, { useEffect, useState } from "react";
import { MessageCircle, Unlock, Send, TrendingUp, Hash, Users } from "lucide-react";
import { api } from "../api.js";

function Stat({ color, icon: Icon, label, value, sub }) {
  return (
    <div className={"stat " + color}>
      <div className="tile"><Icon size={24} /></div>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

export default function Dashboard({ user }) {
  const [s, setS] = useState(null);

  useEffect(() => {
    const load = () => api.get("/api/stats").then(setS).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!s) return <div className="muted">Carregando…</div>;

  const maxConv = Math.max(1, ...s.perNumber.map((p) => p.conversations));

  return (
    <div>
      <div className="stat-grid">
        <Stat color="blue" icon={MessageCircle} label="Conversas ativas" value={s.conversations}
          sub={`${s.windowsOpen} com janela aberta`} />
        <Stat color="green" icon={Unlock} label="Janelas abertas · 24h" value={s.windowsOpen}
          sub="atendimento livre e gratuito" />
        <Stat color="orange" icon={Send} label="Campanhas rodando" value={s.campaignsRunning}
          sub="disparos em andamento" />
        <Stat color="" icon={TrendingUp} label="Disparos hoje" value={s.sentToday}
          sub="mensagens de template enviadas" />
      </div>

      {s.isAdmin && (
        <div className="stat-grid" style={{ marginTop: 18, gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Stat color="green" icon={Hash} label="Números ativos" value={s.numbersActive}
            sub="na conta oficial" />
          <Stat color="blue" icon={Users} label="Vendedores" value={s.sellers}
            sub="com acesso ao sistema" />
        </div>
      )}

      <div className="card panel">
        <h3>Conversas por número</h3>
        {s.perNumber.length === 0 ? (
          <div className="empty">Nenhum número cadastrado ainda. Cadastre em Equipe e números.</div>
        ) : (
          s.perNumber.map((p, i) => (
            <div className="bar-row" key={i}>
              <span className="nm">{p.name}</span>
              <div className="bar"><i style={{ width: (p.conversations / maxConv) * 100 + "%" }} /></div>
              <span className="n">{p.conversations}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
