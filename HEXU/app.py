"""HEXU — production web app.

Serves the static English site and provides JSON API endpoints:

  POST /api/contact             -> validates a sourcing requirement, logs it to
                                   submissions.log, and emails it to the owner.
  POST /api/feedback            -> validates a public suggestion, logs it to
                                   feedback.log, and emails it to the owner.
  POST /api/procurement-intake  -> validates a procurement problem from the
                                   /consultation form, logs it to intake.log,
                                   and emails it to the owner via Resend.

Run on a PaaS (Render / Railway / any Python host):

    gunicorn --bind 0.0.0.0:$PORT app:app

Or locally:

    python app.py      # listens on $PORT (default 5000), bound to 0.0.0.0

The Resend API key is read from the RESEND_API_KEY environment variable
(set it in the hosting dashboard). A local .env file is also supported for
development. The key is never sent to the browser.

Why Resend and not Gmail SMTP?
    Render's free tier blocks outbound SMTP (ports 25/465/587), so the standard
    `smtplib` approach fails with "Network is unreachable". Resend uses HTTPS
    (port 443) which IS allowed on Render free, plus the Python SDK is two
    lines. Free tier: 3000 emails/month / 100/day — plenty for this site.
"""

import os
import re
import json
import datetime

import resend
from flask import Flask, request, jsonify, send_from_directory

BASE = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)

# Recipient is hard-coded — every submission goes to the site owner.
RECIPIENT = "xu6118319@gmail.com"

# Default Resend-verified sender (works out of the box on the free tier).
# To make it look like it came from "HEXU <noreply@hexuhub.com>", verify
# hexuhub.com in the Resend dashboard (Domains -> Add Domain) and change
# this to "HEXU <noreply@hexuhub.com>".
RESEND_FROM = "onboarding@resend.dev"

SUBMISSION_LOG = os.path.join(BASE, "submissions.log")
FEEDBACK_LOG = os.path.join(BASE, "feedback.log")
INTAKE_LOG = os.path.join(BASE, "intake.log")

# Static files this app is allowed to serve (path-traversal safe allowlist).
ALLOWED = {
    "index.html",
    "about.html",
    "services.html",
    "process.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    "feedback.html",
    "survey.html",
    "consultation.html",
    "styles.css",
    "script.js",
    "i18n.js",
    "favicon.svg",
    "og-image.svg",
    "og-image.png",
    "robots.txt",
    "sitemap.xml",
    "supplier-evaluation-report.pdf",
}


def load_env(path):
    """Minimal .env loader (no external dependency)."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_env(os.path.join(BASE, ".env"))
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


@app.route("/")
def home():
    return send_from_directory(BASE, "index.html")


@app.route("/consultation")
def consultation():
    return send_from_directory(BASE, "consultation.html")


@app.route("/<path:filename>")
def serve(filename):
    if filename not in ALLOWED:
        return jsonify({"ok": False, "error": "Not found"}), 404
    return send_from_directory(BASE, filename)


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(os.path.join(BASE, "assets"), filename)


@app.route("/i18n/<path:filename>")
def serve_i18n(filename):
    return send_from_directory(os.path.join(BASE, "i18n"), filename)


@app.route("/api/contact", methods=["POST"])
def contact():
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip()
    requirements = (data.get("requirements") or "").strip()

    if not email or not requirements:
        return jsonify({"ok": False, "error": "Email and project requirements are required."}), 400
    if not _is_email(email):
        return jsonify({"ok": False, "error": "Please provide a valid email address."}), 400

    record = {
        "ts": datetime.datetime.now().isoformat(timespec="seconds"),
        "name": (data.get("name") or "").strip(),
        "email": email,
        "industry": (data.get("industry") or "").strip(),
        "product": (data.get("product") or "").strip(),
        "quantity": (data.get("quantity") or "").strip(),
        "timeline": (data.get("timeline") or "").strip(),
        "requirements": requirements,
        "additional": (data.get("additional") or "").strip(),
    }

    # Always persist so nothing is lost, even if email delivery is unavailable.
    try:
        with open(SUBMISSION_LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass

    delivered = False
    if RESEND_API_KEY:
        try:
            _send_email(record)
            delivered = True
        except Exception as exc:  # noqa: BLE001 - log and continue, data is safe
            app.logger.error("Email delivery failed: %s", exc)

    if delivered:
        return jsonify({"ok": True, "delivered": True})
    return jsonify({
        "ok": True,
        "delivered": False,
        "saved": True,
        "error": "Email delivery is not configured on this server.",
    }), 200


def _is_email(value):
    return re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value) is not None


def _send_email(r):
    params = {
        "from": RESEND_FROM,
        "to": [RECIPIENT],
        "subject": "HEXU requirement — " + (r["name"] or "New submission"),
        "text": "\n".join([
            "New sourcing requirement received via HEXU",
            "",
            "Name: " + r["name"],
            "Email: " + r["email"],
            "Industry: " + r["industry"],
            "Product information: " + r["product"],
            "Quantity: " + r["quantity"],
            "Timeline: " + r["timeline"],
            "",
            "Project requirements:",
            r["requirements"],
            "",
            "Additional requirements:",
            r["additional"],
            "",
            "Received at: " + r["ts"],
        ]),
    }
    if r["email"]:
        params["reply_to"] = [r["email"]]
    resend.Emails.send(params)


@app.route("/api/feedback", methods=["POST", "OPTIONS"])
def feedback():
    # CORS preflight support for any cross-origin API consumer.
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json(force=True, silent=True) or {}
    message = (data.get("message") or "").strip()
    email = (data.get("email") or "").strip()

    if not message:
        return jsonify({"ok": False, "error": "Please share your feedback before sending."}), 400
    if email and not _is_email(email):
        return jsonify({"ok": False, "error": "Please provide a valid email address."}), 400

    record = {
        "ts": datetime.datetime.now().isoformat(timespec="seconds"),
        "name": (data.get("name") or "").strip(),
        "email": email,
        "topic": (data.get("topic") or "").strip(),
        "message": message,
    }

    # Always persist so nothing is lost, even if email delivery is unavailable.
    try:
        with open(FEEDBACK_LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass

    delivered = False
    if RESEND_API_KEY:
        try:
            _send_feedback_email(record)
            delivered = True
        except Exception as exc:  # noqa: BLE001 - log and continue, data is safe
            app.logger.error("Feedback email delivery failed: %s", exc)

    if delivered:
        return jsonify({"ok": True, "delivered": True})
    return jsonify({
        "ok": True,
        "delivered": False,
        "saved": True,
        "error": "Email delivery is not configured on this server.",
    }), 200


def _send_feedback_email(r):
    params = {
        "from": RESEND_FROM,
        "to": [RECIPIENT],
        "subject": "HEXU feedback — " + (r["topic"] or "General"),
        "text": "\n".join([
            "New feedback received via HEXU",
            "",
            "Name: " + r["name"],
            "Email: " + r["email"],
            "Topic: " + r["topic"],
            "",
            "Message:",
            r["message"],
            "",
            "Received at: " + r["ts"],
        ]),
    }
    if r["email"]:
        params["reply_to"] = [r["email"]]
    resend.Emails.send(params)


@app.route("/api/procurement-intake", methods=["POST", "OPTIONS"])
def procurement_intake():
    # CORS preflight support for any cross-origin API consumer.
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip()
    problem = (data.get("problem") or "").strip()
    lang = (data.get("lang") or "").strip()

    if not email or not problem:
        return jsonify({"ok": False, "error": "Email and a description of your problem are required."}), 400
    if not _is_email(email):
        return jsonify({"ok": False, "error": "Please provide a valid email address."}), 400

    record = {
        "ts": datetime.datetime.now().isoformat(timespec="seconds"),
        "email": email,
        "problem": problem,
        "lang": lang,
    }

    # Always persist so nothing is lost, even if email delivery is unavailable.
    try:
        with open(INTAKE_LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass

    delivered = False
    if RESEND_API_KEY:
        try:
            _send_intake_email(record)
            delivered = True
        except Exception as exc:  # noqa: BLE001 - log and continue, data is safe
            app.logger.error("Intake email delivery failed: %s", exc)

    if delivered:
        return jsonify({"ok": True, "delivered": True})
    return jsonify({
        "ok": True,
        "delivered": False,
        "saved": True,
        "error": "Email delivery is not configured on this server.",
    }), 200


def _send_intake_email(r):
    params = {
        "from": RESEND_FROM,
        "to": [RECIPIENT],
        "subject": "HEXU procurement intake — " + r["email"],
        "text": "\n".join([
            "New procurement problem received via HEXU /consultation",
            "",
            "Email: " + r["email"],
            "Language: " + (r.get("lang") or "unknown"),
            "",
            "Problem described:",
            r["problem"],
            "",
            "Received at: " + r["ts"],
        ]),
    }
    params["reply_to"] = [r["email"]]
    resend.Emails.send(params)


@app.after_request
def _headers(resp):
    # Static files: long-lived cache so the browser reuses them across pages.
    # i18n.js can be large (619 KB), so it gets a 24 h cache.
    path = request.path
    if path.startswith("/assets/") or path.startswith("/i18n/") or path.endswith((".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".pdf", ".mp4", ".ico")):
        if "i18n.js" in path or path.startswith("/i18n/"):
            resp.headers["Cache-Control"] = "public, max-age=86400, s-maxage=86400"
        else:
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    # SEO / legal files change rarely; keep them cached briefly to balance freshness.
    if path in ("/robots.txt", "/sitemap.xml") or path.endswith(".html"):
        resp.headers["Cache-Control"] = "public, max-age=3600"

    # Permissive CORS for the API routes (harmless; useful if you later call
    # them from another origin such as a subdomain).
    if path.startswith("/api/"):
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
