import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import ConnectModal from "./Connect.jsx";

export default function Admin({ section }) {
  const [tab, setTab] = useState(section || "team");
  const [users, setUsers] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tplError, setTplError] = useState("");
  const [replies, setReplies] = useState([]);
  const [modal, setModal] = useState(null); // {type:'user'|'number'|'reply', data}

  useEffect(() => { if (section) setTab(section); }, [section]);

  const load = async () => {
    setUsers(await api.get("/api/admin/users").catch(() => []));
    setNumbers(await api.get("/api/admin/numbers").catch(() => []));
    setReplies(await api.get("/api/quickreplies").catch(() => []));
  };
  useEffect(() => {
    load();
    api.get("/api/templates").then(setTemplates).catch((e) => setTplError(e.message));
  }, []);

  const numName = (id) => numbers.find((n) => n.id === id)?.displayName || "—";

  const toggleDispatch = async (u) => {
    await api.patch(`/api/admin/users/${u.id}`, { canDispatch: !u.canDispatch });
    load();
  };

  return (
    <div>

      {tab === "team" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "flex-end", padding: 14 }}>
            <button className="btn sm" onClick={() => setModal({ type: "user", data: {} })}>Adicionar vendedor</button>
          </div>
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Número</th><th>Disparo</th><th></th></tr></thead>
            <tbody>
              {users.filter((u) => u.role === "seller").map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b></td>
                  <td className="muted">{u.email}</td>
                  <td>{numName(u.numberId)}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={u.canDispatch} onChange={() => toggleDispatch(u)} />
                      <span className="track" />
                      <span className="muted" style={{ fontSize: 12 }}>{u.canDispatch ? "Liberado" : "Bloqueado"}</span>
                    </label>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn subtle sm" onClick={() => setModal({ type: "user", data: u })}>Editar</button>
                  </td>
                </tr>
              ))}
              {users.filter((u) => u.role === "seller").length === 0 && (
                <tr><td colSpan="5" className="empty">Nenhum vendedor cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "numbers" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
            <span className="muted">Conecte o número oficial pela Meta ou cadastre um já registrado.</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm" onClick={() => setModal({ type: "connect" })}>Conectar número oficial</button>
              <button className="btn subtle sm" onClick={() => setModal({ type: "number", data: {} })}>Adicionar manualmente</button>
            </div>
          </div>
          <table>
            <thead><tr><th>Nome</th><th>Phone Number ID</th><th>Vendedor</th><th>IA</th><th></th></tr></thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n.id}>
                  <td><b>{n.displayName}</b>{n.waPhone ? <div className="muted" style={{ fontSize: 12 }}>+{n.waPhone}</div> : null}</td>
                  <td className="muted" style={{ fontFamily: "monospace", fontSize: 12 }}>{n.phoneNumberId}</td>
                  <td>{n.ownerName || <span className="muted">sem dono</span>}</td>
                  <td><span className={"pill " + (n.aiEnabled ? "on" : "off")}>{n.aiEnabled ? "Ligada" : "Depois"}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn subtle sm" onClick={async () => { if (confirm("Remover este número?")) { await api.del(`/api/admin/numbers/${n.id}`); load(); } }}>Remover</button>
                  </td>
                </tr>
              ))}
              {numbers.length === 0 && <tr><td colSpan="5" className="empty">Nenhum número cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "templates" && (
        <div className="card">
          {tplError && <div className="error" style={{ margin: 14 }}>Não consegui carregar os templates: {tplError}. Confira META_TOKEN e WABA_ID.</div>}
          <table>
            <thead><tr><th>Template</th><th>Categoria</th><th>Idioma</th><th>Variáveis</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.name}>
                  <td><b>{t.name}</b></td>
                  <td>{t.category?.toLowerCase()}</td>
                  <td>{t.language}</td>
                  <td>{t.variables}</td>
                </tr>
              ))}
              {templates.length === 0 && !tplError && <tr><td colSpan="4" className="empty">Nenhum template aprovado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "replies" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
            <span className="muted">Atalhos de texto que o vendedor insere no chat com um toque.</span>
            <button className="btn sm" onClick={() => setModal({ type: "reply", data: {} })}>Nova resposta</button>
          </div>
          <table>
            <thead><tr><th>Título</th><th>Texto</th><th></th></tr></thead>
            <tbody>
              {replies.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.title}</b></td>
                  <td className="muted">{r.text}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn subtle sm" onClick={async () => { if (confirm("Remover?")) { await api.del(`/api/quickreplies/${r.id}`); load(); } }}>Remover</button>
                  </td>
                </tr>
              ))}
              {replies.length === 0 && <tr><td colSpan="3" className="empty">Nenhuma resposta rápida cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "conexao" && <ConnSettings />}

      {modal?.type === "user" && <UserModal user={modal.data} numbers={numbers} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === "number" && <NumberModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === "reply" && <ReplyModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === "connect" && <ConnectModal onClose={() => setModal(null)} onConnected={() => load()} />}
    </div>
  );
}

function UserModal({ user, numbers, onClose, onSaved }) {
  const editing = !!user.id;
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [numberId, setNumberId] = useState(user.numberId || "");
  const [canDispatch, setCanDispatch] = useState(!!user.canDispatch);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    try {
      if (editing) {
        await api.patch(`/api/admin/users/${user.id}`, { name, numberId, canDispatch, ...(password ? { password } : {}) });
      } else {
        await api.post("/api/admin/users", { name, email, password, numberId, canDispatch });
      }
      onSaved();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? "Editar vendedor" : "Novo vendedor"}</h3>
        {error && <div className="error">{error}</div>}
        <label>Nome</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <label>E-mail</label>
        <input type="email" value={email} disabled={editing} onChange={(e) => setEmail(e.target.value)} />
        <label>{editing ? "Nova senha (deixe em branco para manter)" : "Senha"}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label>Número atribuído</label>
        <select value={numberId} onChange={(e) => setNumberId(e.target.value)}>
          <option value="">Sem número</option>
          {numbers.map((n) => <option key={n.id} value={n.id}>{n.displayName}</option>)}
        </select>
        <label style={{ marginTop: 16 }}>
          <span className="switch">
            <input type="checkbox" checked={canDispatch} onChange={(e) => setCanDispatch(e.target.checked)} />
            <span className="track" />
            Liberar disparo de campanhas
          </span>
        </label>
        <div className="actions">
          <button className="btn subtle" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function NumberModal({ onClose, onSaved }) {
  const [mode, setMode] = useState("register"); // register | manual
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>Adicionar número</h3>
        <div className="tabs" style={{ marginTop: 14, marginBottom: 6 }}>
          <button className={"btn sm " + (mode === "register" ? "" : "subtle")} onClick={() => setMode("register")}>Registrar novo na Meta</button>
          <button className={"btn sm " + (mode === "manual" ? "" : "subtle")} onClick={() => setMode("manual")}>Já tenho o ID</button>
        </div>
        {mode === "register" ? <RegisterWizard onSaved={onSaved} onClose={onClose} /> : <ManualNumber onSaved={onSaved} onClose={onClose} />}
      </div>
    </div>
  );
}

function ManualNumber({ onSaved, onClose }) {
  const [displayName, setDisplayName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try { await api.post("/api/admin/numbers", { displayName, phoneNumberId, waPhone }); onSaved(); }
    catch (e) { setError(e.message); }
  };
  return (
    <>
      <p className="muted" style={{ marginTop: 2 }}>Use se você já registrou o número no painel da Meta e só quer conectá-lo aqui.</p>
      {error && <div className="error">{error}</div>}
      <label>Nome interno</label>
      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Vendas · Letícia" />
      <label>Phone Number ID</label>
      <input type="text" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Ex.: 123456789012345" />
      <label>Número do WhatsApp (só exibição)</label>
      <input type="text" value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="Ex.: 5544999999999" />
      <div className="actions">
        <button className="btn subtle" onClick={onClose}>Cancelar</button>
        <button className="btn" onClick={save}>Salvar</button>
      </div>
    </>
  );
}

function RegisterWizard({ onSaved, onClose }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cc, setCc] = useState("55");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState("SMS");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");

  const call = async (fn) => { setError(""); setBusy(true); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  const start = () => call(async () => {
    const r = await api.post("/api/admin/numbers/onboard/start", { cc, phone, verifiedName: name, method });
    setPhoneNumberId(r.phoneNumberId);
    setStep(2);
  });
  const verify = () => call(async () => {
    await api.post("/api/admin/numbers/onboard/verify", { phoneNumberId, code });
    setStep(3);
  });
  const register = () => call(async () => {
    await api.post("/api/admin/numbers/onboard/register", { phoneNumberId, pin, displayName: name, waPhone: cc + phone });
    onSaved();
  });

  return (
    <>
      <p className="muted" style={{ marginTop: 2 }}>Passo {step} de 3 · o número precisa estar livre do WhatsApp e sua conta Meta verificada.</p>
      {error && <div className="error">{error}</div>}

      {step === 1 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10 }}>
            <div><label>DDI</label><input type="text" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
            <div><label>Número (com DDD, sem DDI)</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="44999999999" /></div>
          </div>
          <label>Nome de exibição (passa por revisão da Meta)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Escola Instructiva" />
          <label>Receber o código por</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="SMS">SMS</option>
            <option value="VOICE">Ligação</option>
          </select>
          <div className="actions">
            <button className="btn subtle" onClick={onClose}>Cancelar</button>
            <button className="btn" onClick={start} disabled={busy}>{busy ? "Enviando…" : "Enviar código"}</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label>Código recebido no número</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: 123456" />
          <div className="actions">
            <button className="btn subtle" onClick={() => setStep(1)}>Voltar</button>
            <button className="btn" onClick={verify} disabled={busy}>{busy ? "Verificando…" : "Verificar"}</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <label>PIN de 6 dígitos (verificação em duas etapas)</label>
          <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Ex.: 000000" />
          <p className="muted" style={{ fontSize: 12.5 }}>Esse é o PIN configurado na Central de Segurança da Meta. Se ainda não tiver, crie um lá antes.</p>
          <div className="actions">
            <button className="btn subtle" onClick={() => setStep(2)}>Voltar</button>
            <button className="btn" onClick={register} disabled={busy}>{busy ? "Registrando…" : "Registrar número"}</button>
          </div>
        </>
      )}
    </>
  );
}

function ReplyModal({ onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try { await api.post("/api/quickreplies", { title, text }); onSaved(); }
    catch (e) { setError(e.message); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nova resposta rápida</h3>
        {error && <div className="error">{error}</div>}
        <label>Título</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Saudação" />
        <label>Texto</label>
        <textarea style={{ height: 90 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Olá! Aqui é da Escola Instructiva, tudo bem?" />
        <div className="actions">
          <button className="btn subtle" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ConnSettings() {
  const [wabaId, setWabaId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const reload = () => api.get("/api/config").then((c) => { setWabaId(c.wabaId || ""); setConnected(c.connected); }).catch(() => {});
  useEffect(() => { reload(); }, []);

  const save = async () => {
    setMsg(""); setBusy(true);
    try {
      const r = await api.post("/api/admin/settings", { metaToken, wabaId });
      setConnected(r.connected); setWabaId(r.wabaId || ""); setMetaToken("");
      setMsg("ok");
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Status */}
      <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14, marginBottom: 18,
        borderLeft: `4px solid ${connected ? "var(--brand)" : "#d9c48a"}` }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center",
          background: connected ? "var(--green-soft)" : "var(--amber-soft)", color: connected ? "var(--green-ink)" : "var(--amber-ink)", fontSize: 22 }}>
          {connected ? "✓" : "•"}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{connected ? "WhatsApp conectado" : "Ainda não conectado"}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {connected ? `Conta ${wabaId ? "· WABA " + wabaId : ""} pronta para enviar e receber.` : "Escolha um dos caminhos abaixo para conectar seu número oficial."}
          </div>
        </div>
      </div>

      {/* Caminho 1: popup */}
      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="step-num">1</span>
          <h3 style={{ margin: 0, fontSize: 16 }}>Conectar pela Meta <span className="pill on" style={{ marginLeft: 6 }}>recomendado</span></h3>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>Abre o popup oficial do Facebook. Você escolhe ou cria seu número lá dentro e volta conectado — sem digitar código.</p>
        <button className="btn" onClick={() => setShowPopup(true)}>Conectar pelo popup da Meta</button>
      </div>

      {/* Caminho 2: manual */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="step-num">2</span>
          <h3 style={{ margin: 0, fontSize: 16 }}>Ou colar o token manualmente</h3>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          No painel da Meta, vá em <b>WhatsApp → Configuração da API</b>, copie o <b>Token de acesso</b> e a <b>Identificação da conta (WABA ID)</b> e cole aqui. Fica salvo no sistema — não precisa mexer no Railway.
        </p>

        <label>Identificação da conta (WABA ID)</label>
        <input type="text" value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="Ex.: 123456789012345" />

        <label>Token de acesso {connected && <span className="muted" style={{ fontWeight: 400 }}>· já salvo, preencha só para trocar</span>}</label>
        <input type="password" value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder={connected ? "•••••••••• (deixe em branco para manter)" : "Cole o token aqui"} />

        {msg === "ok" && <div style={{ color: "var(--green-ink)", marginTop: 12, fontWeight: 600 }}>Salvo! Credenciais atualizadas.</div>}
        {msg && msg !== "ok" && <div className="error">{msg}</div>}

        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar token"}</button>
        </div>
      </div>

      {showPopup && <ConnectModal onClose={() => setShowPopup(false)} onConnected={() => { setShowPopup(false); reload(); }} />}
    </div>
  );
}

