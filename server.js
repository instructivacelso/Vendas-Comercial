const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');

function readLeads() {
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

function readSales() {
  try {
    return JSON.parse(fs.readFileSync(SALES_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeSales(sales) {
  fs.writeFileSync(SALES_FILE, JSON.stringify(sales, null, 2));
}

function readStats() {
  try {
    var s = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    if (typeof s.popupViews !== 'number') s.popupViews = 0;
    if (!s.visits || typeof s.visits !== 'object') s.visits = { total: 0, byDay: {} };
    if (typeof s.visits.total !== 'number') s.visits.total = 0;
    if (!s.visits.byDay || typeof s.visits.byDay !== 'object') s.visits.byDay = {};
    return s;
  } catch (e) {
    return { popupViews: 0, visits: { total: 0, byDay: {} } };
  }
}

// data no fuso de Brasilia (YYYY-MM-DD) pra agrupar visitas por dia
function brDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function writeStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// salva um lead novo (nome, email, telefone, se ja e tecnico)
app.post('/api/leads', (req, res) => {
  const { name, email, phone, isTechnician, source } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: 'Nome e WhatsApp sao obrigatorios.' });
  }

  const lead = {
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    isTechnician: isTechnician || 'nao_informado',
    source: source || 'popup_saida',
    createdAt: new Date().toISOString(),
  };

  const leads = readLeads();
  leads.push(lead);
  writeLeads(leads);

  console.log('Novo lead capturado:', lead.name, lead.phone);
  res.json({ ok: true });
});

// conta quantas vezes o popup apareceu (pra calcular taxa de conversao)
// disparado pelo popup.js, sem senha (so incrementa um contador)
app.post('/api/popup-view', (req, res) => {
  const stats = readStats();
  stats.popupViews = (stats.popupViews || 0) + 1;
  writeStats(stats);
  res.json({ ok: true });
});

// conta uma visita (uma vez por sessao, disparado em toda pagina pelo popup.js)
// mesmo que a pessoa nao preencha nada, essa visita e contabilizada
app.post('/api/visit', (req, res) => {
  const stats = readStats();
  const day = brDateKey();
  stats.visits.total = (stats.visits.total || 0) + 1;
  stats.visits.byDay[day] = (stats.visits.byDay[day] || 0) + 1;
  writeStats(stats);
  res.json({ ok: true });
});

// pega o primeiro valor que existir entre varios caminhos possiveis do payload
function pick(obj, paths) {
  for (var i = 0; i < paths.length; i++) {
    var parts = paths[i].split('.');
    var cur = obj, ok = true;
    for (var j = 0; j < parts.length; j++) {
      if (cur && typeof cur === 'object' && parts[j] in cur) cur = cur[parts[j]];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return '';
}

// WEBHOOK DE VENDAS DA GREENN
// A Greenn faz um POST aqui toda vez que uma venda muda de status.
// Configurar em: Produto > Sistema Externo > Entrega via Webhook (evento "Venda paga").
// Seguranca opcional: defina WEBHOOK_TOKEN e use a URL /api/webhook/greenn?token=SEUTOKEN
app.post('/api/webhook/greenn', (req, res) => {
  // checagem de token (se configurado)
  var expected = process.env.WEBHOOK_TOKEN;
  if (expected && req.query.token !== expected) {
    return res.status(401).json({ ok: false, error: 'token invalido' });
  }

  var p = req.body || {};
  var status = String(pick(p, ['currentStatus', 'status', 'sale.status']) || '').toLowerCase();
  var saleId = String(pick(p, ['sale.id', 'id', 'saleId', 'transaction.id']) || ('greenn_' + Date.now()));

  var venda = {
    id: 'greenn_' + saleId,
    platform: 'Greenn',
    product: pick(p, ['product.name', 'product', 'productName']) || 'Produto',
    name: pick(p, ['client.name', 'buyer.name', 'customer.name', 'lead.name', 'client_name']) || '',
    email: pick(p, ['client.email', 'buyer.email', 'customer.email', 'lead.email', 'client_email']) || '',
    phone: pick(p, ['client.cellphone', 'buyer.cellphone', 'client.phone', 'customer.cellphone', 'lead.cellphone']) || '',
    amount: pick(p, ['product.amount', 'amount', 'sale.amount', 'total', 'value']) || 0,
    method: pick(p, ['method', 'product.method', 'payment_method', 'sale.method']) || '',
    status: status || 'desconhecido',
    createdAt: new Date().toISOString(),
    raw: p, // guarda o payload cru pra podermos ajustar o parser se algum campo vier diferente
  };

  var sales = readSales();
  var idx = sales.findIndex(function (s) { return s.id === venda.id; });
  if (idx >= 0) {
    // venda ja existe: atualiza status (ex: virou reembolso/chargeback)
    sales[idx].status = venda.status;
    sales[idx].updatedAt = venda.createdAt;
  } else {
    sales.unshift(venda);
  }
  writeSales(sales);

  res.json({ ok: true });
});

// senha simples pra ver os leads - troque isso direto no Railway em
// Settings -> Variables, criando uma variavel chamada LEADS_SECRET
const LEADS_SECRET = process.env.LEADS_SECRET || 'troque-esta-senha';

// lista os leads salvos - exige ?senha=... na URL pra nao ficar publico
app.get('/api/leads', (req, res) => {
  if (req.query.senha !== LEADS_SECRET) {
    return res.status(401).json({ ok: false, error: 'Senha invalida. Use ?senha=SUA_SENHA na URL.' });
  }
  res.json(readLeads());
});

// dados do painel: leads + contador de views do popup (protegido por senha)
app.get('/api/dashboard', (req, res) => {
  if (req.query.senha !== LEADS_SECRET) {
    return res.status(401).json({ ok: false, error: 'Senha invalida.' });
  }
  const leads = readLeads();
  const stats = readStats();
  const sales = readSales();
  res.json({ ok: true, leads, sales, popupViews: stats.popupViews || 0, visits: stats.visits || { total: 0, byDay: {} } });
});

// fallback: qualquer rota desconhecida cai na home
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Instructiva site rodando na porta ${PORT}`);
});
