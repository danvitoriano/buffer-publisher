// Cliente mínimo para a API GraphQL do Buffer.
// Docs: https://developers.buffer.com
const ENDPOINT = "https://api.buffer.com";

export async function bufferQuery(query, variables = {}) {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    throw new Error("BUFFER_API_KEY não definida. Copie .env.example para .env e preencha a chave.");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const retry = res.headers.get("Retry-After");
    throw new Error(`Rate limit atingido. Tente novamente em ${retry ?? "?"}s.`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error("GraphQL: " + json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}
