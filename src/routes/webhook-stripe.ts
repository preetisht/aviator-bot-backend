import { Env } from "../types";
import { generateId, generateLicenseKey } from "../lib/crypto";

interface StripeEvent {
  type: string;
  data: { object: Record<string, any> };
}

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.text();
  const sigHeader = request.headers.get("stripe-signature") || "";

  // Verify Stripe signature
  const verified = await verifyStripeSignature(body, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event: StripeEvent = JSON.parse(body);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      const subscriptionId = session.subscription;
      const tier = session.metadata?.tier || "basic";

      if (!email || !subscriptionId) break;

      const existing = await env.DB
        .prepare("SELECT id FROM licenses WHERE email = ? OR subscription_id = ?")
        .bind(email, subscriptionId)
        .first<{ id: string }>();

      if (existing) {
        await env.DB
          .prepare("UPDATE licenses SET status = 'active', tier = ?, subscription_id = ?, payment_provider = 'stripe' WHERE id = ?")
          .bind(tier, subscriptionId, existing.id)
          .run();
      } else {
        const licenseKey = generateLicenseKey();
        const maxDevices = tier === "pro" ? 3 : 2;
        await env.DB
          .prepare(
            `INSERT INTO licenses (id, email, license_key, tier, status, payment_provider, subscription_id, max_devices)
             VALUES (?, ?, ?, ?, 'active', 'stripe', ?, ?)`
          )
          .bind(generateId(), email, licenseKey, tier, subscriptionId, maxDevices)
          .run();
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const subscription = event.data.object;
      const subId = subscription.id;

      await env.DB
        .prepare("UPDATE licenses SET status = 'expired' WHERE subscription_id = ?")
        .bind(subId)
        .run();
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const subId = subscription.id;
      const status = subscription.status;

      if (status === "active") {
        await env.DB
          .prepare("UPDATE licenses SET status = 'active' WHERE subscription_id = ?")
          .bind(subId)
          .run();
      } else if (status === "past_due" || status === "unpaid") {
        // Grace period — don't expire yet, Stripe will retry
        console.log(`[STRIPE] Subscription ${subId} is ${status}`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      console.log(`[STRIPE] Payment failed for subscription ${subId}`);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts["t"];
  const v1Signature = parts["v1"];
  if (!timestamp || !v1Signature) return false;

  // Reject if timestamp is more than 5 minutes old
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === v1Signature;
}
