import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Admin() {
  const [tab, setTab] = useState("team");
  const [users, setUsers] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tplError, setTplError] = useState("");
  const [replies, setReplies] = useState([]);
  const [modal, setModal] = useState(null); // {type:'user'|'number'|'reply', data}

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
      <div className="tabs">
        {[["team", "Vendedores"], ["numbers", "Números"], ["templates", "Templates"], ["replies", "Respostas rápidas"]].map(([id, label]) => (
          <button key={id} className={"btn " + (tab === id ? "" : "subtle") + " sm"} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

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
            <span className="muted">Cadastre cada número conforme registra na Meta.</span>
            <button className="btn sm" onClick={() => setModal({ type: "number", data: {} })}>Adicionar número</button>
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

      {modal?.type === "user" && <UserModal user={modal.data} numbers={numbers} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === "number" && <NumberModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === "reply" && <ReplyModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
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
  const [displayName, setDisplayName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    try {
      await api.post("/api/admin/numbers", { displayName, phoneNumberId, waPhone });
      onSaved();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>Adicionar número</h3>
        <p className="muted" style={{ marginTop: 2 }}>O Phone Number ID aparece no painel da Meta, em WhatsApp → Configuração da API.</p>
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
      </div>
    </div>
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
