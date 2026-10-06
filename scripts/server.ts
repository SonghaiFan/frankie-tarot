import http from "node:http";
import {
  runTarotPipeline,
  listAvailableSpreads,
  TarotRequest,
  Locale,
} from "../src/core";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // 1. Health check
  if (pathname === "/health" || pathname === "/api/health") {
    return sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
  }

  // 2. List Spreads
  if (req.method === "GET" && pathname === "/api/tarot/spreads") {
    const locale = (url.searchParams.get("locale") as Locale) || "zh-CN";
    const spreads = listAvailableSpreads(locale);
    return sendJson(res, 200, { spreads });
  }

  // 3. Predict & Generate Tarot Reading
  if (req.method === "POST" && pathname === "/api/tarot/predict") {
    let bodyStr = "";
    req.on("data", (chunk) => {
      bodyStr += chunk;
    });

    req.on("end", async () => {
      try {
        const body = bodyStr ? JSON.parse(bodyStr) : {};

        const requestOptions: TarotRequest = {
          question: body.question || "",
          spread: body.spread || "AUTO",
          locale: body.locale || "zh-CN",
          reversedProbability: body.reversedProbability,
          customCards: body.customCards,
        };

        const result = await runTarotPipeline(requestOptions);
        return sendJson(res, 200, result);
      } catch (err: any) {
        console.error("Tarot API Error:", err);
        return sendJson(res, 500, {
          error: "Internal Server Error",
          message: err?.message || String(err),
        });
      }
    });
    return;
  }

  // 404
  return sendJson(res, 404, { error: "Not Found", pathname });
});

server.listen(PORT, () => {
  console.log(`\n🔮 Tarot Headless API Server running at http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  - GET  http://localhost:${PORT}/api/health`);
  console.log(`  - GET  http://localhost:${PORT}/api/tarot/spreads`);
  console.log(`  - POST http://localhost:${PORT}/api/tarot/predict\n`);
});
