// HEXU /api/feedback — Cloudflare Pages Function
// 逻辑与 app.py 的 feedback() 一致。

const RECIPIENT = "xu6118319@gmail.com";
const RESEND_FROM = "onboarding@resend.dev";

export async function onRequestPost(context) {
  const { request, env } = context;
  let data = {};
  try {
    data = await request.json();
  } catch (_) {
    data = {};
  }

  const message = (data.message || "").trim();
  const email = (data.email || "").trim();

  if (!message) {
    return json({ ok: false, error: "Please share your feedback before sending." }, 400);
  }
  if (email && !isEmail(email)) {
    return json({ ok: false, error: "Please provide a valid email address." }, 400);
  }

  const record = {
    ts: new Date().toISOString().replace(/\.\d+Z$/, ""),
    name: (data.name || "").trim(),
    email,
    topic: (data.topic || "").trim(),
    message,
  };

  const key = env.RESEND_API_KEY;
  let delivered = false;
  if (key) {
    try {
      await sendEmail(key, {
        from: RESEND_FROM,
        to: [RECIPIENT],
        reply_to: email || undefined,
        subject: "HEXU feedback — " + (record.topic || "General"),
        text: [
          "New feedback received via HEXU",
          "",
          "Name: " + record.name,
          "Email: " + record.email,
          "Topic: " + record.topic,
          "",
          "Message:",
          record.message,
          "",
          "Received at: " + record.ts,
        ].join("\n"),
      });
      delivered = true;
    } catch (err) {
      console.error("feedback email failed:", err && err.message ? err.message : err);
    }
  }

  if (delivered) return json({ ok: true, delivered: true });
  return json({ ok: true, delivered: false, error: "Email delivery is not configured." });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function isEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

async function sendEmail(apiKey, params) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    throw new Error("resend " + resp.status + ": " + (await resp.text()).slice(0, 200));
  }
}
