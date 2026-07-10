const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION || "v21.0"}`;

function token() {
  return process.env.META_TOKEN || "";
}

async function graph(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.meta = body?.error || null;
    throw err;
  }
  return body;
}

// Texto livre — só permitido dentro da janela de 24h do cliente.
export async function sendText(phoneNumberId, to, text) {
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
  const r = await graph(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.messages?.[0]?.id || null;
}

// Template aprovado — usado para iniciar conversa (disparo) fora da janela.
// components: array no formato da Cloud API (ex.: [{ type:"body", parameters:[{type:"text",text:"João"}] }])
export async function sendTemplate(phoneNumberId, to, templateName, lang = "pt_BR", components = []) {
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: lang },
      ...(components.length ? { components } : {}),
    },
  };
  const r = await graph(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.messages?.[0]?.id || null;
}

// Lista templates aprovados da WABA.
export async function listTemplates() {
  const wabaId = process.env.WABA_ID;
  if (!wabaId) return [];
  const r = await graph(
    `${GRAPH}/${wabaId}/message_templates?limit=200&fields=name,status,category,language,components`
  );
  return (r.data || []).map((t) => ({
    name: t.name,
    status: t.status,
    category: t.category,
    language: t.language,
    // extrai quantas variáveis {{n}} existem no corpo
    variables: countVars(t.components),
    components: t.components,
  }));
}

function countVars(components = []) {
  const body = components.find((c) => c.type === "BODY");
  if (!body?.text) return 0;
  const matches = body.text.match(/\{\{\d+\}\}/g) || [];
  return new Set(matches).size;
}
