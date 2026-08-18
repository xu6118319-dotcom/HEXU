// HEXU /api/contact — Cloudflare Pages Function
// 逻辑与 app.py 的 contact() 一致：校验 email+requirements，经 Resend 发到站主邮箱。

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

  const email = (data.email || "").trim();
  const requirements = (data.requirements || "").trim();

  if (!email || !requirements) {
    return json({ ok: false, error: "Email and project requirements are required." }, 400);
  }
  if (!isEmail(email)) {
    return json({ ok: false, error: "Please provide a valid email address." }, 400);
  }

  const record = {
    ts: new Date().toISOString().replace(/\.\d+Z$/, ""),
    name: (data.name || "").trim(),
    email,
    industry: (data.industry || "").trim(),
    product: (data.product || "").trim(),
    quantity: (data.quantity || "").trim(),
    timeline: (data.timeline || "").trim(),
    requirements,
    additional: (data.additional || "").trim(),
  };

  const key = env.RESEND_API_KEY;
  let delivered = false;
  if (key) {
    try {
      await sendEmail(key, {
        from: RESEND_FROM,
        to: [RECIPIENT],
        reply_to: email,
        subject: "HEXU requirement — " + (record.name || "New submission"),
        text: [
          "New sourcing requirement received via HEXU",
          "",
          "Name: " + record.name,
          "Email: " + record.email,
          "Industry: " + record.industry,
          "Product information: " + record.product,
          "Quantity: " + record.quantity,
          "Timeline: " + record.timeline,
          "",
          "Project requirements:",
          record.requirements,
          "",
          "Additional requirements:",
          record.additional,
          "",
          "Received at: " + record.ts,
        ].join("\n"),
      });
      delivered = true;
    } catch (err) {
      console.error("contact email failed:", err && err.message ? err.message : err);
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
