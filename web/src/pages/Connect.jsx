import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { api } from "../api.js";

const REQS = [
  ["Conta WhatsApp Business", "É necessário ter uma conta WhatsApp Business ativa."],
  ["Verificação de empresa", "Sua empresa precisa estar verificada no Meta Business Manager."],
  ["Número de telefone", "Um número de telefone exclusivo para uso no WhatsApp Business."],
  ["Aprovação da Meta", "O nome de exibição do número passa por revisão da Meta."],
  ["Forma de pagamento válida", "Cadastre uma forma de pagamento no Meta Business Manager."],
];

function loadFB(appId, version) {
  return new Promise((resolve) => {
    if (window.FB) { resolve(window.FB); return; }
    window.fbAsyncInit = function () {
      window.FB.init({ appId, cookie: true, xfbml: true, version });
      resolve(window.FB);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true; s.defer = true;
      document.body.appendChild(s);
    }
  });
}

export default function ConnectModal({ onClose, onConnected }) {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const session = useRef({});

  useEffect(() => {
    api.get("/api/config").then(setCfg).catch(() => setCfg({}));
    const listener = (event) => {
      if (!String(event.origin).includes("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA")) {
          session.current = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id };
        }
      } catch {}
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  const missingConfig = cfg && (!cfg.fbAppId || !cfg.fbConfigId);

  const connect = async () => {
    setError(""); setOk("");
    if (missingConfig) return;
    setBusy(true);
    try {
      const FB = await loadFB(cfg.fbAppId, cfg.fbApiVersion);
      FB.login(async (response) => {
        const code = response?.authResponse?.code;
        if (!code) { setError("Conexão cancelada ou não autorizada."); setBusy(false); return; }
        const { wabaId, phoneNumberId } = session.current;
        if (!wabaId || !phoneNumberId) { setError("Não recebemos o número da Meta. Refaça o processo até o fim."); setBusy(false); return; }
        try {
          const r = await api.post("/api/admin/connect/embedded", { code, wabaId, phoneNumberId });
          setOk(`Número conectado${r.waPhone ? " (" + r.waPhone + ")" : ""}! Já aparece na lista.`);
          onConnected && onConnected();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
      }, {
        config_id: cfg.fbConfigId,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: 3 },
      });
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal connect-modal" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button className="connect-close" onClick={onClose}>×</button>
        <div className="connect-grid">
          <div className="connect-left">
            <div className="wa"><MessageCircle size={30} /></div>
            <h3>Conexão com WhatsApp Oficial</h3>
            <p>Use a API oficial do WhatsApp para conectar o número da sua equipe e atender com segurança, sem risco de banimento.</p>
          </div>
          <div className="connect-right">
            <h4>Requisitos para conexão</h4>
            {REQS.map(([t, d]) => (
              <div className="req" key={t}>
                <CheckCircle2 size={20} />
                <div><b>{t}</b><span>{d}</span></div>
              </div>
            ))}
          </div>
        </div>

        {missingConfig && (
          <div className="connect-note">
            Falta configurar o app da Meta. Defina <b>FB_APP_ID</b> e <b>FB_CONFIG_ID</b> nas variáveis do Railway
            (e <b>FB_APP_SECRET</b> no servidor). O <b>Config ID</b> vem do seu app em Login do Facebook para Empresas → Configuração do Embedded Signup.
          </div>
        )}
        {error && <div className="connect-note" style={{ color: "#ff8b7a", background: "rgba(255,90,70,0.12)" }}>{error}</div>}
        {ok && <div className="connect-ok">{ok}</div>}

        <div className="connect-foot">
          <button className="btn subtle" onClick={onClose} style={{ background: "#1c222d", color: "#c9cedd" }}>Fechar</button>
          <button className="btn wa" onClick={connect} disabled={busy || missingConfig}>
            <MessageCircle size={18} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            {busy ? "Conectando…" : "Conectar WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
