import bcrypt from "bcryptjs";
import { read, id } from "./db.js";

// Sessões em memória: token -> userId. Reset em deploy = novo login. Simples e suficiente para o MVP.
const sessions = new Map();

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function checkLogin(email, password) {
  const user = read("users").find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.passwordHash)) return null;
  const token = id("sess");
  sessions.set(token, user.id);
  return { token, user: publicUser(user) };
}

export function logout(token) {
  sessions.delete(token);
}

export function userFromToken(token) {
  const userId = sessions.get(token);
  if (!userId) return null;
  const user = read("users").find((u) => u.id === userId);
  return user || null;
}

export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    numberId: u.numberId || null,
    canDispatch: !!u.canDispatch,
  };
}

// Middleware
export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: "Sessão expirada. Entre novamente." });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Só o gestor pode fazer isso." });
  next();
}
