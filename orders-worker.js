// Проксі-сервер для прийому замовлень.
// Приймає замовлення з сайту (без токена на стороні клієнта) і дописує його
// у файл orders.json в репозиторії через GitHub API, використовуючи секрет,
// збережений тут, у Cloudflare — а не в коді сайту.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Тільки POST запити" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const order = await request.json();
      order.id = "order-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      order.createdAt = new Date().toISOString();
      order.status = order.status || "Нове";

      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
      const token = env.GITHUB_TOKEN;
      const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/orders.json`;

      // Читаємо поточний orders.json (якщо є)
      let orders = [];
      let sha = null;
      const getRes = await fetch(apiBase, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
      });

      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        const decoded = atob(fileData.content.replace(/\n/g, ""));
        const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
        orders = JSON.parse(new TextDecoder("utf-8").decode(bytes));
      } else if (getRes.status !== 404) {
        throw new Error("Не вдалося прочитати orders.json: HTTP " + getRes.status);
      }
      // якщо 404 — файлу ще немає, почнемо з пустого списку

      orders.unshift(order); // нові замовлення зверху

      const newContent = JSON.stringify(orders, null, 2);
      const utf8Bytes = new TextEncoder().encode(newContent);
      const base64Content = btoa(String.fromCharCode(...utf8Bytes));

      const putRes = await fetch(apiBase, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "New order: " + order.id,
          content: base64Content,
          ...(sha ? { sha } : {})
        })
      });

      if (!putRes.ok) {
        const errBody = await putRes.json().catch(() => ({}));
        throw new Error(errBody.message || "Не вдалося зберегти замовлення: HTTP " + putRes.status);
      }

      return new Response(JSON.stringify({ success: true, orderId: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: String(err.message || err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
