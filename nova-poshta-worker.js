// Проксі-сервер для Nova Poshta API.
// Ключ API зберігається в Cloudflare (Settings → Variables → Secret),
// а НЕ в цьому файлі — тому його можна спокійно тримати в публічному репозиторії.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Браузер перед справжнім запитом іноді шле "перевірочний" OPTIONS-запит — просто підтверджуємо його
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const method = url.searchParams.get("method");   // "cities" або "warehouses"
    const query = url.searchParams.get("query") || "";
    const cityRef = url.searchParams.get("cityRef") || "";

    let body;

    if (method === "cities") {
      body = {
        apiKey: env.NOVA_POSHTA_API_KEY, // ключ підставляється з секрету Cloudflare, не з коду
        modelName: "Address",
        calledMethod: "getCities",
        methodProperties: { FindByString: query, Limit: "10" }
      };
    } else if (method === "warehouses") {
      body = {
        apiKey: env.NOVA_POSHTA_API_KEY,
        modelName: "Address",
        calledMethod: "getWarehouses",
        methodProperties: { CityRef: cityRef, Limit: "300" }
      };
    } else {
      return new Response(JSON.stringify({ error: "Невідомий метод. Використовуй ?method=cities або ?method=warehouses" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const npResponse = await fetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await npResponse.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Помилка звернення до Nova Poshta API", details: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
