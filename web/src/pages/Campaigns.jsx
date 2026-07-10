import React, { useEffect, useState } from "react";
import { api } from "../api.js";

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
  const phoneIdx = headers.findIndex((h) => ["phone", "telefone", "numero", "número", "whatsapp"].includes(h));
  const nameIdx = headers.findIndex((h) => ["nome", "name", "cliente"].includes(h));
  return lines.slice(1).map((line) => {
    const cols = line.split(/[;,]/).map((c) => c.trim());
    const vars = {};
    headers.forEach((h, i) => { if (/^\d+$/.test(h)) vars[h] = cols[i] || ""; });
    return {
      phone: (cols[phoneIdx] || "").replace(/\D/g, ""),
      name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
      vars,
    };
  }).filter((c) => c.phone.length >= 10);
}

export default function Campaigns({ user }) {
  const [list, setList] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = () => api.get("/api/campaigns").then(setList).catch(() => {});
  useEffect(() => {
    load();
    api.get("/api/admin/numbers").then(setNumbers).catch(() => {});
    api.get("/api/templates").then(setTemplates).catch(() => {});
    const t = setInterval(() => { load(); if (detail) api.get(`/api/campaigns/${detail.id}`).then(setDetail).catch(() => {}); }, 5000);
    return () => clearInterval(t);
  }, [detail?.id]);

  const canDispatch = user.role === "admin" || user.canDispatch;
  const myNumbers = user.role === "admin" ? numbers : numbers.filter((n) => n.id === user.numberId);

  const togglePause = async (id) => { await api.post(`/api/campaigns/${id}/pause`); load(); };

  const statusPill = (s) => {
    const map = { running: ["on", "Enviando"], paused: ["off", "Pausada"], done: ["on", "Concluída"] };
    const [cls, label] = map[s] || ["off", s];
    return <span className={"pill " + cls}>{label}</span>;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <p className="muted" style={{ margin: 0 }}>Cada disparo usa um template aprovado. Respeite o ritmo para não queimar número novo.</p>
        {canDispatch && <button className="btn" onClick={() => setShowNew(true)}>Nova campanha</button>}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty">Nenhuma campanha ainda.</div>
        ) : (
          <table>
            <thead><tr><th>Campanha</th><th>Template</th><th>Progresso</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => {
                const pct = c.total ? Math.round(((c.sent || 0) / c.total) * 100) : 0;
                return (
                  <tr key={c.id}>
                    <td><b>{c.name}</b><div className="muted" style={{ fontSize: 12 }}>por {c.createdBy}</div></td>
                    <td>{c.templateName}</td>
                    <td style={{ minWidth: 180 }}>
                      <div className="bar"><i style={{ width: pct + "%" }} /></div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {c.sent || 0}/{c.total} enviados · {c.delivered || 0} entregues · {c.failed || 0} falhas
                      </div>
                    </td>
                    <td>{statusPill(c.status)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn subtle sm" onClick={() => setDetail(c)}>Ver</button>{" "}
                      {canDispatch && c.status !== "done" && (
                        <button className="btn ghost sm" onClick={() => togglePause(c.id)}>
                          {c.status === "paused" ? "Retomar" : "Pausar"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewCampaign numbers={myNumbers} templates={templates} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
      )}
      {detail && <CampaignDetail campaign={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function NewCampaign({ numbers, templates, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [numberId, setNumberId] = useState(numbers[0]?.id || "");
  const [templateName, setTemplateName] = useState("");
  const [rate, setRate] = useState(10);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tpl = templates.find((t) => t.name === templateName);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setContacts(parseCSV(String(reader.result)));
    reader.readAsText(f);
  };

  const create = async () => {
    setError("");
    if (!name || !numberId || !templateName) return setError("Preencha nome, número e template.");
    if (!contacts.length) return setError("Suba um CSV com ao menos um contato válido.");
    setBusy(true);
    try {
      await api.post("/api/campaigns", { name, numberId, templateName, lang: tpl?.language || "pt_BR", ratePerMinute: Number(rate), contacts });
      onCreated();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nova campanha</h3>
        <p className="muted" style={{ marginTop: 2 }}>O CSV precisa de uma coluna <b>telefone</b>. Colunas <b>1</b>, <b>2</b>… preenchem as variáveis do template.</p>
        {error && <div className="error">{error}</div>}
        <label>Nome da campanha</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reativação turma agosto" />
        <label>Número de envio</label>
        <select value={numberId} onChange={(e) => setNumberId(e.target.value)}>
          {numbers.map((n) => <option key={n.id} value={n.id}>{n.displayName}</option>)}
        </select>
        <label>Template aprovado</label>
        <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
          <option value="">Escolha…</option>
          {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category?.toLowerCase()}) · {t.variables} var.</option>)}
        </select>
        <label>Ritmo (mensagens por minuto)</label>
        <input type="number" min="1" max="60" value={rate} onChange={(e) => setRate(e.target.value)} />
        <label>Lista de contatos (CSV)</label>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        {contacts.length > 0 && <div className="muted" style={{ marginTop: 8 }}>{contacts.length} contatos válidos carregados.</div>}
        <div className="actions">
          <button className="btn subtle" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={create} disabled={busy}>{busy ? "Criando…" : "Iniciar disparo"}</button>
        </div>
      </div>
    </div>
  );
}

function CampaignDetail({ campaign, onClose }) {
  const c = campaign;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h3>{c.name}</h3>
        <p className="muted" style={{ marginTop: 2 }}>Template {c.templateName} · {c.ratePerMinute}/min</p>
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>Telefone</th><th>Nome</th><th>Status</th></tr></thead>
          <tbody>
            {c.contacts.map((ct, i) => (
              <tr key={i}>
                <td>+{ct.phone}</td>
                <td>{ct.name || "—"}</td>
                <td>{ct.status}{ct.error ? ` · ${ct.error}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions"><button className="btn subtle" onClick={onClose}>Fechar</button></div>
      </div>
    </div>
  );
}
