import { Env } from "../types";
import { hmacVerify } from "../lib/crypto";
import { generateId, generateLicenseKey } from "../lib/crypto";

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscription };
    payment?: { entity: RazorpayPayment };
  };
}

interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  notes?: { email?: string; tier?: string };
}

interface RazorpayPayment {
  id: string;
  subscription_id?: string;
  status: string;
  notes?: { email?: string; tier?: string };
}

export async function handleRazorpayWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  const valid = await hmacVerify(body, signature, env.RAZORPAY_KEY_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const webhook: RazorpayWebhookPayload = JSON.parse(body);
  const event = webhook.event;

  switch (event) {
    case "subscription.activated":
    case "subscription.charged": {
      const sub = webhook.payload.subscription?.entity;
      if (!sub) break;

      const email = sub.notes?.email;
      const tier = sub.notes?.tier || "basic";
      if (!email) break;

      // Check if license already exists
      const existing = await env.DB
        .prepare("SELECT id FROM licenses WHERE subscription_id = ?")
        .bind(sub.id)
        .first<{ id: string }>();

      if (existing) {
        // Reactivate / extend
        await env.DB
          .prepare("UPDATE licenses SET status = 'active', tier = ? WHERE id = ?")
          .bind(tier, existing.id)
          .run();
      } else {
        // Create new license
        const licenseKey = generateLicenseKey();
        const maxDevices = tier === "pro" ? 3 : 2;
        await env.DB
          .prepare(
            `INSERT INTO licenses (id, email, license_key, tier, status, payment_provider, subscription_id, max_devices)
             VALUES (?, ?, ?, ?, 'active', 'razorpay', ?, ?)`
          )
          .bind(generateId(), email, licenseKey, tier, sub.id, maxDevices)
          .run();
      }
      break;
    }

    case "subscription.halted":
    case "subscription.cancelled":
    case "subscription.expired": {
      const sub = webhook.payload.subscription?.entity;
      if (!sub) break;

      await env.DB
        .prepare("UPDATE licenses SET status = 'expired' WHERE subscription_id = ?")
        .bind(sub.id)
        .run();
      break;
    }

    case "payment.failed": {
      const payment = webhook.payload.payment?.entity;
      if (!payment?.subscription_id) break;

      // Don't immediately expire — Razorpay will retry.
      // Flag for monitoring.
      console.log(`[WEBHOOK] Payment failed for subscription ${payment.subscription_id}`);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
