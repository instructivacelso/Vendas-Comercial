import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const initials = (s = "") => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

export default function Inbox({ user }) {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState({ messages: [], conversation: null });
  const [text, setText] = useState("");
  const [templates, setTemplates] = useState([]);
  const [chosenTpl, setChosenTpl] = useState("");
  const [tplVars, setTplVars] = useState({});
  const [error, setError] = useState("");
  const bodyRef = useRef(null);

  const loadConvs = () => api.get("/api/conversations").then(setConvs).catch(() => {});
  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 8000);
    api.get("/api/templates").then(setTemplates).catch(() => {});
    return () => clearInterval(t);
  }, []);

  const openConv = async (id) => {
    setActive(id);
    setError("");
    setChosenTpl("");
    setTplVars({});
    const data = await api.get(`/api/conversations/${id}/messages`);
    setThread(data);
    loadConvs();
  };

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [thread]);

  const conv = thread.conversation;
  const open = conv?.windowOpen;

  const sendText = async () => {
    if (!text.trim()) return;
    setError("");
    try {
      await api.post(`/api/conversations/${active}/send`, { text: text.trim() });
      setText("");
      openConv(active);
    } catch (e) { setError(e.message); }
  };

  const sendTpl = async () => {
    if (!chosenTpl) return setError("Escolha um template.");
    setError("");
    try {
      const tpl = templates.find((t) => t.name === chosenTpl);
      const vars = {};
      for (let i = 1; i <= (tpl?.variables || 0); i++) vars[i] = tplVars[i] || "";
      const components = tpl?.variables
        ? [{ type: "body", parameters: Object.keys(vars).map((k) => ({ type: "text", text: vars[k] })) }]
        : [];
      await api.post(`/api/conversations/${active}/send`, {
        templateName: chosenTpl, lang: tpl?.language || "pt_BR", components,
      });
      setChosenTpl("");
      setTplVars({});
      openConv(active);
    } catch (e) { setError(e.message); }
  };

  const chosen = templates.find((t) => t.name === chosenTpl);

  return (
    <div className="inbox">
      <div className="conv-list">
        {convs.length === 0 && <div className="empty">Sem conversas ainda.<br />Elas aparecem quando um cliente responde ou você inicia um disparo.</div>}
        {convs.map((c) => (
          <div key={c.id} className={"conv-item" + (c.id === active ? " active" : "")} onClick={() => openConv(c.id)}>
            <div className="avatar">{initials(c.contactName)}</div>
            <div className="conv-meta">
              <div className="row">
                <span className="nm">{c.contactName}</span>
                <span className="time">{time(c.lastMessageAt)}</span>
              </div>
              <div className="row">
                <span className="pv">{c.lastMessagePreview || "—"}</span>
                {c.unread > 0 && <span className="badge">{c.unread}</span>}
              </div>
              {user.role === "admin" && <span className="pv muted" style={{ fontSize: 11 }}>{c.numberName}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="chat">
        {!conv && <div className="empty" style={{ margin: "auto" }}>Selecione uma conversa para começar.</div>}
        {conv && (
          <>
            <div className="chat-head">
              <div>
                <div className="who">{conv.contactName}</div>
                <div className="sub">+{conv.contactPhone}</div>
              </div>
              <span className={"pill " + (open ? "open" : "closed")}>
                {open ? "Janela aberta · 24h" : "Janela fechada"}
              </span>
            </div>

            <div className="chat-body" ref={bodyRef}>
              {thread.messages.map((m) => (
                <div key={m.id} className={"bubble " + m.direction + (m.type === "template" ? " tpl" : "")}>
                  {m.text}
                  <div className="meta">
                    {m.direction === "out" ? (m.by ? m.by + " · " : "") + (m.status || "enviado") : "recebido"} · {time(m.at)}
                  </div>
                </div>
              ))}
            </div>

            <div className="composer">
              {error && <div className="error">{error}</div>}
              {open ? (
                <>
                  <div className="win-note muted"><span className="pill open">Grátis</span> Cliente respondeu — você pode escrever livremente por 24h.</div>
                  <div className="row">
                    <textarea placeholder="Escreva sua mensagem…" value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} />
                    <button className="btn" onClick={sendText}>Enviar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="win-note muted"><span className="pill closed">Fechada</span> Sem resposta nas últimas 24h — só dá para reabrir com um template aprovado.</div>
                  {!user.canDispatch && user.role !== "admin" ? (
                    <div className="muted">Seu gestor ainda não liberou disparo de template para você.</div>
                  ) : (
                    <div className="tpl-box">
                      <select value={chosenTpl} onChange={(e) => { setChosenTpl(e.target.value); setTplVars({}); }}>
                        <option value="">Escolha um template…</option>
                        {templates.map((t) => (
                          <option key={t.name} value={t.name}>{t.name} ({t.category?.toLowerCase()})</option>
                        ))}
                      </select>
                      {chosen && chosen.variables > 0 && (
                        <div style={{ marginTop: 10 }}>
                          {Array.from({ length: chosen.variables }, (_, i) => i + 1).map((n) => (
                            <input key={n} type="text" placeholder={`Variável {{${n}}}`} style={{ marginTop: 6 }}
                              value={tplVars[n] || ""} onChange={(e) => setTplVars({ ...tplVars, [n]: e.target.value })} />
                          ))}
                        </div>
                      )}
                      <button className="btn" style={{ marginTop: 12 }} onClick={sendTpl}>Enviar template</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
