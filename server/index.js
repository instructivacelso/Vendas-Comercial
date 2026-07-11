import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { read, write, readMessages, appendMessage, updateMessageStatus, id, readObject, writeObject } from "./db.js";
import { sendText, sendTemplate, listTemplates, uploadMedia, sendMedia, getMediaUrl, fetchMediaBytes, addPhoneNumber, requestCode, verifyCode, registerNumber, getNumberInfo, exchangeCode, subscribeApp } from "./whatsapp.js";
import { checkLogin, logout, requireAuth, requireAdmin, publicUser, hashPassword, userFromToken } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

const DAY_MS = 24 * 60 * 60 * 1000;
const windowOpen = (conv) => conv.lastInboundAt && Date.now() - new Date(conv.lastInboundAt).getTime() < DAY_MS;

// ---------------------------------------------------------------------------
// WEBHOOK — verificação + recebimento
// ---------------------------------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  res.sendStatus(200); // responde rápido, processa depois
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const number = read("numbers").find((n) => n.phoneNumberId === phoneNumberId);
        if (!number) continue;

        // Mensagens recebidas → abrem janela de 24h
        for (const msg of value.messages || []) {
          const contactPhone = msg.from;
          const contactName = value.contacts?.[0]?.profile?.name || contactPhone;
          const conv = getOrCreateConversation(number, contactPhone, contactName);
          conv.lastInboundAt = new Date().toISOString();
          conv.lastMessageAt = conv.lastInboundAt;
          conv.lastMessagePreview = previewOf(msg);
          conv.unread = (conv.unread || 0) + 1;
          saveConversation(conv);
          appendMessage(conv.id, {
            id: id("m"),
            direction: "in",
            type: msg.type,
            text: previewOf(msg),
            raw: msg,
            at: conv.lastInboundAt,
          });
        }

        // Status de entrega dos disparos
        for (const st of value.statuses || []) {
          applyStatus(st);
        }
      }
    }
  } catch (e) {
    console.error("Erro processando webhook:", e);
  }
});

function previewOf(msg) {
  if (msg.type === "text") return msg.text?.body || "";
  if (msg.type === "image") return "📷 Imagem";
  if (msg.type === "audio") return "🎤 Áudio";
  if (msg.type === "document") return "📄 Documento";
  if (msg.type === "button") return msg.button?.text || "Resposta rápida";
  return `(${msg.type})`;
}

function getOrCreateConversation(number, contactPhone, contactName) {
  const convs = read("conversations");
  let conv = convs.find((c) => c.numberId === number.id && c.contactPhone === contactPhone);
  if (!conv) {
    conv = {
      id: id("conv"),
      numberId: number.id,
      phoneNumberId: number.phoneNumberId,
      contactPhone,
      contactName,
      assignedTo: number.ownerUserId || null,
      lastInboundAt: null,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: "",
      unread: 0,
    };
    convs.push(conv);
    write("conversations", convs);
  }
  return conv;
}

function saveConversation(conv) {
  const convs = read("conversations");
  const idx = convs.findIndex((c) => c.id === conv.id);
  if (idx >= 0) convs[idx] = conv;
  else convs.push(conv);
  write("conversations", convs);
}

function applyStatus(st) {
  // st.id é o wa message id; procuramos em campanhas e conversas
  const campaigns = read("campaigns");
  let touched = false;
  for (const c of campaigns) {
    const item = c.contacts.find((x) => x.waMessageId === st.id);
    if (item) {
      item.status = st.status;
      if (st.status === "delivered") c.delivered = (c.delivered || 0) + 1;
      if (st.status === "failed") {
        c.failed = (c.failed || 0) + 1;
        item.error = st.errors?.[0]?.title || "Falha na entrega";
      }
      touched = true;
    }
  }
  if (touched) write("campaigns", campaigns);

  const convs = read("conversations");
  for (const conv of convs) {
    if (updateMessageStatus(conv.id, st.id, st.status)) break;
  }
}

// ---------------------------------------------------------------------------
// AUTENTICAÇÃO
// ---------------------------------------------------------------------------
app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const result = checkLogin(email, password);
  if (!result) return res.status(401).json({ error: "E-mail ou senha incorretos." });
  res.json(result);
});

app.post("/api/logout", requireAuth, (req, res) => {
  logout((req.headers.authorization || "").replace(/^Bearer /, ""));
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => res.json(publicUser(req.user)));

// Números do Painel
app.get("/api/stats", requireAuth, (req, res) => {
  const numbers = read("numbers");
  const users = read("users");
  const allConvs = read("conversations");
  let camps = read("campaigns");
  const isAdmin = req.user.role === "admin";

  const myNumbers = isAdmin ? numbers : numbers.filter((n) => n.id === req.user.numberId);
  let convs = isAdmin ? allConvs : allConvs.filter((c) => c.numberId === req.user.numberId);
  if (!isAdmin) camps = camps.filter((c) => c.numberId === req.user.numberId);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const sentToday = camps
    .filter((c) => new Date(c.createdAt) >= startToday)
    .reduce((a, c) => a + (c.sent || 0), 0);

  const perNumber = myNumbers.map((n) => {
    const cs = allConvs.filter((c) => c.numberId === n.id);
    return { name: n.displayName, conversations: cs.length, open: cs.filter(windowOpen).length };
  });

  res.json({
    isAdmin,
    conversations: convs.length,
    windowsOpen: convs.filter(windowOpen).length,
    campaignsRunning: camps.filter((c) => c.status === "running").length,
    sentToday,
    numbersActive: myNumbers.filter((n) => n.active).length,
    sellers: users.filter((u) => u.role === "seller").length,
    perNumber,
  });
});

// ---------------------------------------------------------------------------
// CONVERSAS
// ---------------------------------------------------------------------------
app.get("/api/conversations", requireAuth, (req, res) => {
  const numbers = read("numbers");
  let convs = read("conversations");
  if (req.user.role !== "admin") {
    convs = convs.filter((c) => c.numberId === req.user.numberId);
  } else if (req.query.numberId) {
    convs = convs.filter((c) => c.numberId === req.query.numberId);
  }
  convs = convs
    .map((c) => ({
      ...c,
      numberName: numbers.find((n) => n.id === c.numberId)?.displayName || "—",
      windowOpen: windowOpen(c),
    }))
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  res.json(convs);
});

app.get("/api/conversations/:id/messages", requireAuth, (req, res) => {
  const conv = read("conversations").find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });
  if (req.user.role !== "admin" && conv.numberId !== req.user.numberId)
    return res.status(403).json({ error: "Essa conversa é de outro número." });
  // zera não lidas
  conv.unread = 0;
  saveConversation(conv);
  res.json({ conversation: { ...conv, windowOpen: windowOpen(conv) }, messages: readMessages(conv.id) });
});

// Enviar mensagem numa conversa (texto se janela aberta; template se fechada e tem permissão)
app.post("/api/conversations/:id/send", requireAuth, async (req, res) => {
  const conv = read("conversations").find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });
  if (req.user.role !== "admin" && conv.numberId !== req.user.numberId)
    return res.status(403).json({ error: "Essa conversa é de outro número." });

  const { text, templateName, lang, components } = req.body || {};
  try {
    let waId, preview;
    if (windowOpen(conv) && text) {
      waId = await sendText(conv.phoneNumberId, conv.contactPhone, text);
      preview = text;
    } else {
      if (!templateName) return res.status(400).json({ error: "Janela de 24h fechada. Envie um template para reabrir a conversa." });
      if (!canDispatch(req.user)) return res.status(403).json({ error: "Seu gestor não liberou disparo de template para você." });
      waId = await sendTemplate(conv.phoneNumberId, conv.contactPhone, templateName, lang || "pt_BR", components || []);
      preview = `[template] ${templateName}`;
    }
    const msg = appendMessage(conv.id, {
      id: id("m"),
      direction: "out",
      type: text && windowOpen(conv) ? "text" : "template",
      text: preview,
      waMessageId: waId,
      status: "sent",
      by: req.user.name,
      at: new Date().toISOString(),
    });
    conv.lastMessageAt = msg.at;
    conv.lastMessagePreview = preview;
    saveConversation(conv);
    res.json({ ok: true, message: msg });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

function canDispatch(user) {
  return user.role === "admin" || user.canDispatch === true;
}

// Nota interna por conversa
app.patch("/api/conversations/:id/note", requireAuth, (req, res) => {
  const convs = read("conversations");
  const conv = convs.find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });
  if (req.user.role !== "admin" && conv.numberId !== req.user.numberId)
    return res.status(403).json({ error: "Essa conversa é de outro número." });
  conv.note = (req.body?.note || "").slice(0, 2000);
  write("conversations", convs);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// RESPOSTAS RÁPIDAS
// ---------------------------------------------------------------------------
app.get("/api/quickreplies", requireAuth, (req, res) => {
  res.json(read("quickreplies"));
});

app.post("/api/quickreplies", requireAuth, requireAdmin, (req, res) => {
  const { title, text } = req.body || {};
  if (!title || !text) return res.status(400).json({ error: "Título e texto são obrigatórios." });
  const list = read("quickreplies");
  const item = { id: id("qr"), title, text };
  list.push(item);
  write("quickreplies", list);
  res.json(item);
});

app.delete("/api/quickreplies/:id", requireAuth, requireAdmin, (req, res) => {
  write("quickreplies", read("quickreplies").filter((q) => q.id !== req.params.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// MÍDIA
// ---------------------------------------------------------------------------
// Proxy de mídia recebida. Aceita token pelo header OU query (?t=) para <img>/<audio>.
app.get("/api/media/:mediaId", async (req, res) => {
  const t = (req.headers.authorization || "").replace(/^Bearer /, "") || req.query.t;
  if (!userFromToken(t)) return res.sendStatus(401);
  try {
    const { url } = await getMediaUrl(req.params.mediaId);
    const { buffer, mime } = await fetchMediaBytes(url);
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(buffer);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Enviar mídia numa conversa (só dentro da janela de 24h). Recebe base64.
app.post("/api/conversations/:id/send-media", requireAuth, async (req, res) => {
  const conv = read("conversations").find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada." });
  if (req.user.role !== "admin" && conv.numberId !== req.user.numberId)
    return res.status(403).json({ error: "Essa conversa é de outro número." });
  if (!windowOpen(conv)) return res.status(400).json({ error: "Janela de 24h fechada. Mídia só pode ser enviada com a conversa aberta." });

  const { filename, mimeType, dataBase64, caption } = req.body || {};
  if (!dataBase64 || !mimeType) return res.status(400).json({ error: "Arquivo inválido." });
  const kind = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : "document";
  try {
    const buffer = Buffer.from(dataBase64, "base64");
    const mediaId = await uploadMedia(conv.phoneNumberId, buffer, mimeType, filename);
    const waId = await sendMedia(conv.phoneNumberId, conv.contactPhone, kind, mediaId, caption, filename);
    const preview = kind === "image" ? "📷 Imagem" : kind === "audio" ? "🎤 Áudio" : `📄 ${filename || "Documento"}`;
    const msg = appendMessage(conv.id, {
      id: id("m"), direction: "out", type: kind, text: caption || preview,
      waMessageId: waId, status: "sent", by: req.user.name, at: new Date().toISOString(),
    });
    conv.lastMessageAt = msg.at;
    conv.lastMessagePreview = preview;
    saveConversation(conv);
    res.json({ ok: true, message: msg });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// TEMPLATES
// ---------------------------------------------------------------------------
app.get("/api/templates", requireAuth, async (req, res) => {
  try {
    const templates = await listTemplates();
    res.json(templates.filter((t) => t.status === "APPROVED"));
  } catch (e) {
    res.status(502).json({ error: e.message, templates: [] });
  }
});

// ---------------------------------------------------------------------------
// CAMPANHAS (disparo)
// ---------------------------------------------------------------------------
app.get("/api/campaigns", requireAuth, (req, res) => {
  let list = read("campaigns");
  if (req.user.role !== "admin") list = list.filter((c) => c.numberId === req.user.numberId);
  res.json(list.map(({ contacts, ...c }) => ({ ...c, total: contacts.length })).reverse());
});

app.get("/api/campaigns/:id", requireAuth, (req, res) => {
  const c = read("campaigns").find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Campanha não encontrada." });
  res.json(c);
});

app.post("/api/campaigns", requireAuth, (req, res) => {
  if (!canDispatch(req.user)) return res.status(403).json({ error: "Você não tem permissão de disparo." });
  const { name, numberId, templateName, lang, contacts, ratePerMinute } = req.body || {};
  if (!name || !numberId || !templateName || !Array.isArray(contacts) || !contacts.length)
    return res.status(400).json({ error: "Preencha nome, número, template e ao menos um contato." });

  const number = read("numbers").find((n) => n.id === numberId);
  if (!number) return res.status(400).json({ error: "Número inválido." });
  if (req.user.role !== "admin" && number.id !== req.user.numberId)
    return res.status(403).json({ error: "Você só pode disparar pelo seu número." });

  const campaign = {
    id: id("camp"),
    name,
    numberId,
    phoneNumberId: number.phoneNumberId,
    templateName,
    lang: lang || "pt_BR",
    ratePerMinute: Math.max(1, Math.min(ratePerMinute || 10, 60)),
    createdBy: req.user.name,
    createdAt: new Date().toISOString(),
    status: "running",
    sent: 0,
    delivered: 0,
    failed: 0,
    contacts: contacts.map((ct) => ({
      phone: String(ct.phone).replace(/\D/g, ""),
      name: ct.name || "",
      vars: ct.vars || {},
      status: "queued",
      waMessageId: null,
      error: null,
    })),
  };
  const list = read("campaigns");
  list.push(campaign);
  write("campaigns", list);
  runCampaign(campaign.id);
  res.json({ ok: true, id: campaign.id });
});

// Processa a fila com pacing, para não queimar número novo.
const running = new Set();
async function runCampaign(campaignId) {
  if (running.has(campaignId)) return;
  running.add(campaignId);
  const delay = () => {
    const list = read("campaigns");
    const c = list.find((x) => x.id === campaignId);
    return c ? Math.ceil(60000 / c.ratePerMinute) : 6000;
  };

  const step = async () => {
    const list = read("campaigns");
    const c = list.find((x) => x.id === campaignId);
    if (!c || c.status === "paused") {
      running.delete(campaignId);
      return;
    }
    const next = c.contacts.find((x) => x.status === "queued");
    if (!next) {
      c.status = "done";
      write("campaigns", list);
      running.delete(campaignId);
      return;
    }
    try {
      const components = buildComponents(next.vars);
      const waId = await sendTemplate(c.phoneNumberId, next.phone, c.templateName, c.lang, components);
      next.status = "sent";
      next.waMessageId = waId;
      c.sent = (c.sent || 0) + 1;
    } catch (e) {
      next.status = "failed";
      next.error = e.message;
      c.failed = (c.failed || 0) + 1;
    }
    write("campaigns", list);
    setTimeout(step, delay());
  };
  step();
}

function buildComponents(vars) {
  const keys = Object.keys(vars || {}).sort((a, b) => Number(a) - Number(b));
  if (!keys.length) return [];
  return [
    {
      type: "body",
      parameters: keys.map((k) => ({ type: "text", text: String(vars[k]) })),
    },
  ];
}

app.post("/api/campaigns/:id/pause", requireAuth, (req, res) => {
  if (!canDispatch(req.user)) return res.status(403).json({ error: "Sem permissão." });
  const list = read("campaigns");
  const c = list.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Campanha não encontrada." });
  c.status = c.status === "paused" ? "running" : "paused";
  write("campaigns", list);
  if (c.status === "running") runCampaign(c.id);
  res.json({ ok: true, status: c.status });
});

// ---------------------------------------------------------------------------
// ADMIN — vendedores e números
// ---------------------------------------------------------------------------
app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  res.json(read("users").map(publicUser));
});

app.post("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const { name, email, password, numberId, canDispatch } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
  const users = read("users");
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ error: "Já existe um usuário com esse e-mail." });
  const user = {
    id: id("user"),
    name,
    email,
    passwordHash: hashPassword(password),
    role: "seller",
    numberId: numberId || null,
    canDispatch: !!canDispatch,
  };
  users.push(user);
  write("users", users);
  linkNumberOwner(numberId, user.id);
  res.json(publicUser(user));
});

app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const users = read("users");
  const u = users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
  const { name, numberId, canDispatch, password } = req.body || {};
  if (name !== undefined) u.name = name;
  if (canDispatch !== undefined) u.canDispatch = !!canDispatch;
  if (password) u.passwordHash = hashPassword(password);
  if (numberId !== undefined) {
    u.numberId = numberId || null;
    linkNumberOwner(numberId, u.id);
  }
  write("users", users);
  res.json(publicUser(u));
});

function linkNumberOwner(numberId, userId) {
  if (!numberId) return;
  const numbers = read("numbers");
  const n = numbers.find((x) => x.id === numberId);
  if (n) {
    n.ownerUserId = userId;
    write("numbers", numbers);
  }
}

app.get("/api/admin/numbers", requireAuth, (req, res) => {
  const users = read("users");
  res.json(
    read("numbers").map((n) => ({
      ...n,
      ownerName: users.find((u) => u.id === n.ownerUserId)?.name || null,
    }))
  );
});

// Config pública do front para o Embedded Signup (App ID e config são públicos).
app.get("/api/config", requireAuth, requireAdmin, (req, res) => {
  const settings = readObject("settings");
  res.json({
    fbAppId: process.env.FB_APP_ID || "",
    fbConfigId: process.env.FB_CONFIG_ID || "",
    fbApiVersion: process.env.FB_API_VERSION || "v22.0",
    connected: !!(settings.metaToken || process.env.META_TOKEN),
    wabaId: settings.wabaId || process.env.WABA_ID || "",
  });
});

// Finaliza o Embedded Signup: troca o código, salva token/WABA, assina o webhook e cadastra o número.
app.post("/api/admin/connect/embedded", requireAuth, requireAdmin, async (req, res) => {
  const { code, wabaId: waba, phoneNumberId, displayName } = req.body || {};
  if (!code || !waba || !phoneNumberId) return res.status(400).json({ error: "Conexão incompleta. Refaça o processo pela Meta." });
  try {
    const accessToken = await exchangeCode(code);
    writeObject("settings", { ...readObject("settings"), metaToken: accessToken, wabaId: waba });
    // faz o webhook começar a receber daquela conta
    try { await subscribeApp(waba); } catch (e) { console.warn("subscribe_apps:", e.message); }
    // busca dados do número e salva
    let info = {};
    try { info = await getNumberInfo(phoneNumberId); } catch {}
    const numbers = read("numbers");
    if (!numbers.some((n) => n.phoneNumberId === phoneNumberId)) {
      numbers.push({
        id: id("num"),
        displayName: displayName || info.verified_name || info.display_phone_number || phoneNumberId,
        phoneNumberId,
        waPhone: (info.display_phone_number || "").replace(/\D/g, ""),
        active: true,
        aiEnabled: false,
        ownerUserId: null,
      });
      write("numbers", numbers);
    }
    res.json({ ok: true, displayName: info.verified_name || null, waPhone: info.display_phone_number || null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Assistente: registrar um número novo direto na Meta (4 passos)
app.post("/api/admin/numbers/onboard/start", requireAuth, requireAdmin, async (req, res) => {
  const { cc, phone, verifiedName, method } = req.body || {};
  if (!cc || !phone || !verifiedName) return res.status(400).json({ error: "Informe DDI, número e nome de exibição." });
  try {
    const phoneNumberId = await addPhoneNumber(String(cc).replace(/\D/g, ""), String(phone).replace(/\D/g, ""), verifiedName);
    await requestCode(phoneNumberId, method === "VOICE" ? "VOICE" : "SMS");
    res.json({ ok: true, phoneNumberId });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post("/api/admin/numbers/onboard/verify", requireAuth, requireAdmin, async (req, res) => {
  const { phoneNumberId, code } = req.body || {};
  if (!phoneNumberId || !code) return res.status(400).json({ error: "Código obrigatório." });
  try {
    await verifyCode(phoneNumberId, String(code).replace(/\D/g, ""));
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post("/api/admin/numbers/onboard/register", requireAuth, requireAdmin, async (req, res) => {
  const { phoneNumberId, pin, displayName, waPhone } = req.body || {};
  if (!phoneNumberId || !pin) return res.status(400).json({ error: "PIN de 6 dígitos obrigatório." });
  try {
    await registerNumber(phoneNumberId, String(pin).replace(/\D/g, ""));
    // salva no nosso banco
    const numbers = read("numbers");
    if (!numbers.some((n) => n.phoneNumberId === phoneNumberId)) {
      numbers.push({
        id: id("num"),
        displayName: displayName || waPhone || phoneNumberId,
        phoneNumberId,
        waPhone: waPhone || "",
        active: true,
        aiEnabled: false,
        ownerUserId: null,
      });
      write("numbers", numbers);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post("/api/admin/numbers", requireAuth, requireAdmin, (req, res) => {
  const { displayName, phoneNumberId, waPhone } = req.body || {};
  if (!displayName || !phoneNumberId) return res.status(400).json({ error: "Nome e Phone Number ID são obrigatórios." });
  const numbers = read("numbers");
  if (numbers.some((n) => n.phoneNumberId === phoneNumberId))
    return res.status(409).json({ error: "Esse número já foi cadastrado." });
  const number = {
    id: id("num"),
    displayName,
    phoneNumberId,
    waPhone: waPhone || "",
    active: true,
    aiEnabled: false, // gancho para a IA que entra depois
    ownerUserId: null,
  };
  numbers.push(number);
  write("numbers", numbers);
  res.json(number);
});

app.delete("/api/admin/numbers/:id", requireAuth, requireAdmin, (req, res) => {
  write("numbers", read("numbers").filter((n) => n.id !== req.params.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Frontend estático (build do Vite)
// ---------------------------------------------------------------------------
const dist = path.join(__dirname, "..", "web", "dist");
// Página de Política de Privacidade (necessária para publicar o app na Meta)
app.get("/privacidade", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade — Instructiva Vendas</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#182823;line-height:1.6}h1{color:#14a89e}h2{margin-top:28px}small{color:#6f7d76}</style>
</head><body>
<h1>Política de Privacidade</h1>
<small>Escola Instructiva · última atualização: julho de 2026</small>
<p>Esta política descreve como a Escola Instructiva trata os dados no uso do sistema de atendimento e vendas via WhatsApp.</p>
<h2>Dados que tratamos</h2>
<p>Coletamos apenas os dados necessários ao atendimento: nome, número de telefone e o conteúdo das mensagens trocadas entre a empresa e o cliente pelo WhatsApp Business Platform (API oficial da Meta).</p>
<h2>Como usamos</h2>
<p>Os dados são usados exclusivamente para atendimento, suporte e comunicação comercial solicitada pelo cliente. Não vendemos nem compartilhamos dados com terceiros para fins publicitários.</p>
<h2>Armazenamento e segurança</h2>
<p>As mensagens e informações de contato ficam armazenadas em ambiente controlado e de acesso restrito à equipe autorizada.</p>
<h2>Seus direitos</h2>
<p>O titular pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelos canais de atendimento da Escola Instructiva.</p>
<h2>Contato</h2>
<p>Dúvidas sobre esta política: entre em contato pelos canais oficiais da Escola Instructiva (escolainstructiva.com.br).</p>
</body></html>`);
});

app.use(express.static(dist));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) return res.sendStatus(404);
  res.sendFile(path.join(dist, "index.html"));
});

const PORT = process.env.PORT || 8080;

// Garante que sempre exista um gestor para entrar, sem depender de rodar o seed manual.
function ensureAdmin() {
  const users = read("users");
  if (users.length) return;
  const email = process.env.ADMIN_EMAIL || "admin@instructiva.com.br";
  const password = process.env.ADMIN_PASSWORD || "instructiva";
  users.push({
    id: id("user"),
    name: "Gestor",
    email,
    passwordHash: hashPassword(password),
    role: "admin",
    numberId: null,
    canDispatch: true,
  });
  write("users", users);
  console.log(`Gestor criado no primeiro acesso: ${email} (troque a senha depois).`);
}
ensureAdmin();

app.listen(PORT, () => console.log(`Instructiva Vendas rodando na porta ${PORT}`));
