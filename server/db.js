import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const MSG_DIR = path.join(DATA_DIR, "messages");

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(MSG_DIR, { recursive: true });
}
ensureDirs();

function file(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

// Lê um arquivo de coleção (array), devolve [] se não existir.
export function read(name) {
  try {
    return JSON.parse(fs.readFileSync(file(name), "utf8"));
  } catch {
    return [];
  }
}

// Grava a coleção inteira. Escrita atômica para não corromper em deploy.
export function write(name, data) {
  const tmp = file(name) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file(name));
}

// Mensagens ficam em um arquivo por conversa, para não virar um monólito.
export function readMessages(convId) {
  try {
    return JSON.parse(fs.readFileSync(path.join(MSG_DIR, `${convId}.json`), "utf8"));
  } catch {
    return [];
  }
}

export function appendMessage(convId, message) {
  const list = readMessages(convId);
  list.push(message);
  const p = path.join(MSG_DIR, `${convId}.json`);
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, p);
  return message;
}

export function updateMessageStatus(convId, waMessageId, status) {
  const list = readMessages(convId);
  const m = list.find((x) => x.waMessageId === waMessageId);
  if (!m) return false;
  m.status = status;
  const p = path.join(MSG_DIR, `${convId}.json`);
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, p);
  return true;
}

export function id(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
