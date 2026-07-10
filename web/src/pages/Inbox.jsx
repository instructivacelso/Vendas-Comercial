import React, { useEffect, useRef, useState } from "react";
import { Search, Paperclip, Zap, StickyNote, FileText } from "lucide-react";
import { api, getToken } from "../api.js";

const initials = (s = "") => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

function InboundMedia({ raw }) {
  const t = getToken();
  if (!raw) return null;
  if (raw.type === "image" && raw.image?.id)
    return <img src={`/api/media/${raw.image.id}?t=${t}`} alt="imagem" />;
  if (raw.type === "sticker" && raw.sticker?.id)
    return <img src={`/api/media/${raw.sticker.id}?t=${t}`} alt="sticker" />;
  if (raw.type === "audio" && raw.audio?.id)
    return <audio controls src={`/api/media/${raw.audio.id}?t=${t}`} />;
  if (raw.type === "document" && raw.document?.id)
    return <a className="doc" href={`/api/media/${raw.document.id}?t=${t}`} target="_blank" rel="noreferrer"><FileText size={16} />{raw.document.filename || "Documento"}</a>;
  return null;
}

export default function Inbox({ user }) {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState({ messages: [], conversation: null });
  const [text, setText] = useState("");
  const [templates, setTemplates] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [chosenTpl, setChosenTpl] = useState("");
  const [tplVars, setTplVars] = useState({});
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showQr, setShowQr] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const bodyRef = useRef(null);
  const fileRef = useRef(null);

  const loadConvs = () => api.get("/api/conversations").then(setConvs).catch(() => {});
  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 8000);
    api.get("/api/templates").then(setTemplates).catch(() => {});
    api.get("/api/quickreplies").then(setQuickReplies).catch(() => {});
    return () => clearInterval(t);
  }, []);

  const openConv = async (id) => {
    setActive(id); setError(""); setChosenTpl(""); setTplVars({}); setShowQr(false); setShowNote(false);
    const data = await api.get(`/api/conversations/${id}/messages`);
    setThread(data);
    setNote(data.conversation?.note || "");
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
      setText(""); openConv(active);
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
        ? [{ type: "body", parameters: Object.keys(vars).map((k) => ({ type: "text", text: vars[k] })) }] : [];
      await api.post(`/api/conversations/${active}/send`, { templateName: chosenTpl, lang: tpl?.language || "pt_BR", components });
      setChosenTpl(""); setTplVars({}); openConv(active);
    } catch (e) { setError(e.message); }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataBase64 = String(reader.result).split(",")[1];
      setError("");
      try {
        await api.post(`/api/conversations/${active}/send-media`, { filename: f.name, mimeType: f.type, dataBase64 });
        openConv(active);
      } catch (err) { setError(err.message); }
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const saveNote = async () => {
    await api.patch(`/api/conversations/${active}/note`, { note });
    setShowNote(false);
    setThread((t) => ({ ...t, conversation: { ...t.conversation, note } }));
  };

  const chosen = templates.find((t) => t.name === chosenTpl);

  const filtered = convs.filter((c) => {
    if (search && !(`${c.contactName} ${c.contactPhone}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filter === "unread") return c.unread > 0;
    if (filter === "open") return c.windowOpen;
    if (filter === "closed") return !c.windowOpen;
    return true;
  });

  return (
    <div className="inbox">
      <div className="conv-list">
        <div className="conv-search">
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "var(--slate-2)" }} />
            <input style={{ paddingLeft: 32 }} placeholder="Buscar nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="chips">
            {[["all", "Todas"], ["unread", "Não lidas"], ["open", "Janela aberta"], ["closed", "Fechadas"]].map(([id, label]) => (
              <span key={id} className={"chip" + (filter === id ? " active" : "")} onClick={() => setFilter(id)}>{label}</span>
            ))}
          </div>
        </div>
        {filtered.length === 0 && <div className="empty">Nenhuma conversa aqui.</div>}
        {filtered.map((c) => (
          <div key={c.id} className={"conv-item" + (c.id === active ? " active" : "")} onClick={() => openConv(c.id)}>
            <div className="avatar">{initials(c.contactName)}</div>
            <div className="conv-meta">
              <div className="row"><span className="nm">{c.contactName}</span><span className="time">{time(c.lastMessageAt)}</span></div>
              <div className="row"><span className="pv">{c.lastMessagePreview || "—"}</span>{c.unread > 0 && <span className="badge">{c.unread}</span>}</div>
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
              <div className="head-actions">
                <span className={"pill " + (open ? "open" : "closed")}>{open ? "Janela aberta · 24h" : "Janela fechada"}</span>
                <button className="icon-btn" title="Nota interna" onClick={() => setShowNote((v) => !v)}><StickyNote size={17} /></button>
              </div>
            </div>

            {showNote ? (
              <div className="note-bar" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <textarea placeholder="Nota interna sobre esse cliente (só a equipe vê)" value={note} onChange={(e) => setNote(e.target.value)} style={{ height: 60, background: "#fff" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn sm" onClick={saveNote}>Salvar nota</button>
                  <button className="btn subtle sm" onClick={() => { setShowNote(false); setNote(conv.note || ""); }}>Cancelar</button>
                </div>
              </div>
            ) : conv.note ? (
              <div className="note-bar"><StickyNote size={15} /> {conv.note}</div>
            ) : null}

            <div className="chat-body" ref={bodyRef}>
              {thread.messages.map((m) => (
                <div key={m.id} className={"bubble " + m.direction + (m.type === "template" ? " tpl" : "")}>
                  {m.direction === "in" && ["image", "audio", "document", "sticker"].includes(m.raw?.type)
                    ? <InboundMedia raw={m.raw} /> : m.text}
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
                  <div className="tools">
                    <button className="icon-btn" title="Respostas rápidas" onClick={() => setShowQr((v) => !v)}><Zap size={17} /></button>
                    <button className="icon-btn" title="Anexar imagem, áudio ou PDF" onClick={() => fileRef.current?.click()}><Paperclip size={17} /></button>
                    <input ref={fileRef} type="file" accept="image/*,audio/*,application/pdf" style={{ display: "none" }} onChange={onFile} />
                    {showQr && (
                      <div className="qr-menu">
                        {quickReplies.length === 0 && <div className="qr-item muted">Nenhuma resposta rápida. O gestor cadastra em Equipe e números.</div>}
                        {quickReplies.map((q) => (
                          <div key={q.id} className="qr-item" onClick={() => { setText((t) => (t ? t + " " : "") + q.text); setShowQr(false); }}>
                            <b>{q.title}</b><span>{q.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                        {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category?.toLowerCase()})</option>)}
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
