import { Env } from "./types";
import { handleValidate, handleDeactivate } from "./routes/validate";
import { handleActivate } from "./routes/activate";
import { handleRazorpayWebhook } from "./routes/webhook-razorpay";
import { handleStripeWebhook } from "./routes/webhook-stripe";
import { handleAdmin } from "./routes/admin";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return handleCors(env);
    }

    let response: Response;

    try {
      switch (path) {
        case "/api/auth/validate":
          response = await handleValidate(request, env);
          break;
        case "/api/auth/deactivate":
          response = await handleDeactivate(request, env);
          break;
        case "/api/auth/activate":
          response = await handleActivate(request, env);
          break;
        case "/webhook/razorpay":
          response = await handleRazorpayWebhook(request, env);
          break;
        case "/webhook/stripe":
          response = await handleStripeWebhook(request, env);
          break;
        case "/api/admin":
          response = await handleAdmin(request, env);
          break;
        case "/api/health":
          response = new Response(JSON.stringify({ status: "ok", ts: Date.now() }), {
            headers: { "Content-Type": "application/json" },
          });
          break;
        default:
          response = new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
      }
    } catch (err: any) {
      console.error(`[ERROR] ${path}:`, err.message, err.stack);
      response = new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return addCorsHeaders(response, env);
  },
};

function handleCors(env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function addCorsHeaders(response: Response, env: Env): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", env.CORS_ORIGIN || "*");
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
