import { read, write, id } from "./db.js";
import { hashPassword } from "./auth.js";

const users = read("users");
if (users.length) {
  console.log("Já existem usuários. Nada a fazer.");
  process.exit(0);
}

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

console.log("Usuário gestor criado:");
console.log("  e-mail:", email);
console.log("  senha :", password);
console.log("Troque a senha depois do primeiro acesso.");
