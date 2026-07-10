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

// --- Mídia ---

// Sobe um arquivo para a Cloud API e devolve o media id.
export async function uploadMedia(phoneNumberId, buffer, mimeType, filename) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([buffer], { type: mimeType }), filename || "arquivo");
  const res = await fetch(`${GRAPH}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || "Falha no upload da mídia");
  return body.id;
}

// Envia mídia (image | audio | document) por um media id já subido.
export async function sendMedia(phoneNumberId, to, kind, mediaId, caption, filename) {
  const media = { id: mediaId };
  if (caption && (kind === "image" || kind === "document")) media.caption = caption;
  if (kind === "document" && filename) media.filename = filename;
  const body = { messaging_product: "whatsapp", to, type: kind, [kind]: media };
  const r = await graph(`${GRAPH}/${phoneNumberId}/messages`, { method: "POST", body: JSON.stringify(body) });
  return r.messages?.[0]?.id || null;
}

// --- Onboarding de número (registrar novo número na Cloud API) ---

// Passo 1: adiciona o número à WABA e devolve o phone_number_id.
export async function addPhoneNumber(cc, phone, verifiedName) {
  const wabaId = process.env.WABA_ID;
  if (!wabaId) throw new Error("WABA_ID não configurado nas variáveis.");
  const r = await graph(`${GRAPH}/${wabaId}/phone_numbers`, {
    method: "POST",
    body: JSON.stringify({ cc, phone_number: phone, verified_name: verifiedName }),
  });
  return r.id;
}

// Passo 2: pede o código de verificação por SMS ou VOICE.
export async function requestCode(phoneNumberId, method = "SMS", language = "pt_BR") {
  return graph(`${GRAPH}/${phoneNumberId}/request_code`, {
    method: "POST",
    body: JSON.stringify({ code_method: method, language }),
  });
}

// Passo 3: confirma o código recebido.
export async function verifyCode(phoneNumberId, code) {
  return graph(`${GRAPH}/${phoneNumberId}/verify_code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// Passo 4: registra o número no Cloud API com o PIN da verificação em duas etapas.
export async function registerNumber(phoneNumberId, pin) {
  return graph(`${GRAPH}/${phoneNumberId}/register`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
}

// Consulta status/nome do número.
export async function getNumberInfo(phoneNumberId) {
  return graph(`${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name,status,quality_rating`);
}

// Resolve a URL temporária de uma mídia recebida.
export async function getMediaUrl(mediaId) {
  const r = await graph(`${GRAPH}/${mediaId}`);
  return { url: r.url, mime: r.mime_type };
}

// Baixa os bytes de uma mídia (a URL exige o mesmo token no header).
export async function fetchMediaBytes(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Falha ao baixar a mídia");
  const buf = Buffer.from(await res.arrayBuffer());
  return { buffer: buf, mime: res.headers.get("content-type") || "application/octet-stream" };
}
