# Instructiva · Vendas

Inbox de vendas multi-agente para WhatsApp na **Cloud API oficial** da Meta.
Cada vendedor entra com o próprio login, atende só o número dele, e (se o gestor liberar)
dispara campanhas com templates aprovados. Inbox humano agora; ganchos de IA já preparados.

## Como funciona, em uma frase

Um webhook único recebe tudo da Meta e distribui pra conversa/vendedor certo pelo `phone_number_id`.
Dentro da **janela de 24h** (cliente respondeu) o vendedor escreve texto livre, de graça.
Fora dela, só reabre com **template aprovado** — que é onde entra o disparo.

## Stack

- Backend: Node/Express puro ESM
- Frontend: React + Vite (sem TypeScript)
- Dados: arquivos JSON em volume persistente (um arquivo por conversa, para não virar monólito)
- Deploy: Railway

---

## 1. Deploy no Railway

1. Suba o repositório no GitHub e crie o projeto no Railway a partir dele.
2. Em **Variables**, cadastre (baseado no `.env.example`):
   - `META_TOKEN` — token do System User da sua WABA
   - `WABA_ID` — id da WhatsApp Business Account (para sincronizar templates)
   - `WEBHOOK_VERIFY_TOKEN` — um texto que você inventa (vai repetir no painel da Meta)
   - `SESSION_SECRET` — qualquer segredo
   - `DATA_DIR` — aponte para o volume, ex.: `/data`
3. Em **Volumes**, crie um volume e monte em `/data`.
4. O Railway roda `npm install` → `npm run build` (compila o front) → `npm start`.
5. No primeiro deploy, rode uma vez o seed para criar o gestor:
   `ADMIN_EMAIL=voce@instructiva.com.br ADMIN_PASSWORD=umasenhaforte npm run seed`
   (pelo shell do Railway, com o mesmo `DATA_DIR`). Troque a senha depois de entrar.

---

## 2. Checklist de registro na Meta (faça uma vez por número)

Você vai comprar os números e subir na Meta. Para **cada** número:

1. No **Meta Business Suite / Painel de Desenvolvedores**, dentro do app com produto WhatsApp:
   adicione o número em **WhatsApp → Configuração da API** e verifique por SMS/ligação.
2. Anote o **Phone Number ID** daquele número (é o que o sistema usa para enviar).
3. Todos os números ficam na **mesma WABA** — não precisa de dez contas. O mesmo `META_TOKEN`
   envia por todos eles.
4. Configure o **Webhook** do app apontando para `https://SEU-DOMINIO/webhook`, com o
   **Verify Token** igual ao `WEBHOOK_VERIFY_TOKEN`. Assine o campo `messages`.
5. Cadastre o número no sistema (aba **Números** → Adicionar número), colando o Phone Number ID.

### Templates
Crie os templates de disparo no painel da Meta (categoria **marketing** ou **utility**).
Lembrando das regras que já pegamos antes: toda `{{n}}` precisa de `example.body_text`, e
variável não pode ficar no começo nem no fim do corpo. Depois de **aprovados**, eles aparecem
sozinhos no sistema (aba Templates e no seletor da campanha).

---

## 3. Uso no dia a dia

- **Gestor** (aba Equipe e números): cadastra números, cadastra vendedores, atribui um número a
  cada um e liga/desliga o disparo por vendedor no botão de chave.
- **Vendedor**: vê só as conversas do número dele. Responde livre na janela aberta; fora da janela,
  reabre com template (se estiver liberado).
- **Campanhas**: escolhe número + template + sobe um CSV. O sistema envia respeitando o **ritmo**
  (mensagens por minuto) para não queimar número novo. Dá para pausar e retomar.

### Formato do CSV
Uma coluna `telefone` (ou `phone`/`numero`/`whatsapp`) é obrigatória. Coluna `nome` é opcional.
Colunas nomeadas `1`, `2`, `3`… preenchem as variáveis `{{1}}`, `{{2}}`… do template.

```
telefone,nome,1,2
5544999990001,João,João,ACELERAR+
5544999990002,Maria,Maria,ACELERAR+
```

---

## 4. Regras que mantêm os números vivos

- **Janela de 24h**: texto livre só depois que o cliente escreve. O sistema bloqueia sozinho.
- **Template para iniciar**: disparo frio = template aprovado. Sem exceção na API oficial.
- **Teto da Meta**: ~2 templates de marketing por usuário/dia, somando todas as empresas.
  Não adianta ter mais números — o limite é por destinatário. Priorize qualidade e timing.
- **Aquecimento**: número novo começa com limite baixo; suba o volume aos poucos.

---

## 5. Onde a IA entra depois

Cada número tem o campo `aiEnabled` (hoje desligado). Quando formos plugar a IA (qualificação /
resposta automática), o ponto de entrada é o handler de mensagens recebidas no webhook
(`server/index.js`, dentro de `app.post("/webhook")`): quando `number.aiEnabled` estiver ligado,
é ali que a mensagem do cliente vai para a IA antes/no lugar do atendente. Mesma lógica de
"IA por número" que já usamos no Sistema de Cobrança.

---

## Rodar local

```
npm install
npm run seed        # cria o gestor (admin@instructiva.com.br / instructiva)
npm run dev:server  # backend na 8080
npm run dev:web     # frontend na 5173 (proxy para a 8080)
```
