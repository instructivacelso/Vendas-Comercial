let token = localStorage.getItem("iv_token") || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem("iv_token", t);
  else localStorage.removeItem("iv_token");
}

export function getToken() {
  return token;
}

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  get: (u) => req("GET", u),
  post: (u, b) => req("POST", u, b),
  patch: (u, b) => req("PATCH", u, b),
  del: (u) => req("DELETE", u),
};
