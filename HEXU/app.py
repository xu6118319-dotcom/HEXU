"""HEXU — production web app.

Serves the static English site and provides two JSON API endpoints:

  POST /api/contact   -> validates a sourcing requirement, logs it to
                         submissions.log, and emails it to the owner via Gmail SMTP.
  POST /api/feedback  -> validates a public suggestion, logs it to feedback.log,
                         and emails it to the owner via Gmail SMTP.

Run on a PaaS (Render / Railway / any Python host):

    gunicorn --bind 0.0.0.0:$PORT app:app

Or locally:

    python app.py      # listens on $PORT (default 5000), bound to 0.0.0.0

The Gmail "App Password" is read from the HEXU_GMAIL_APP_PASSWORD environment
variable (set it in the hosting dashboard). A local .env file is also supported
for development. The password is never sent to the browser.
"""

import os
import re
import json
import ssl
import smtplib
import datetime

from email.message import EmailMessage
from flask import Flask, request, jsonify, send_from_directory

BASE = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SENDER = "xu6118319@gmail.com"
RECIPIENT = "xu6118319@gmail.com"
SUBMISSION_LOG = os.path.join(BASE, "submissions.log")
FEEDBACK_LOG = os.path.join(BASE, "feedback.log")

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
    "styles.css",
    "script.js",
    "favicon.svg",
    "og-image.svg",
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
APP_PASSWORD = os.environ.get("HEXU_GMAIL_APP_PASSWORD", "").strip()


@app.route("/")
def home():
    return send_from_directory(BASE, "index.html")


@app.route("/<path:filename>")
def serve(filename):
    if filename not in ALLOWED:
        return jsonify({"ok": False, "error": "Not found"}), 404
    return send_from_directory(BASE, filename)


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
    if APP_PASSWORD:
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
    msg = EmailMessage()
    msg["Subject"] = "HEXU requirement — " + (r["name"] or "New submission")
    msg["From"] = SENDER
    msg["To"] = RECIPIENT
    msg["Reply-To"] = r["email"]

    lines = [
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
    ]
    msg.set_content("\n".join(lines))

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.starttls(context=context)
        server.login(SENDER, APP_PASSWORD)
        server.send_message(msg)


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
    if APP_PASSWORD:
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
    msg = EmailMessage()
    msg["Subject"] = "HEXU feedback — " + (r["topic"] or "General")
    msg["From"] = SENDER
    msg["To"] = RECIPIENT
    if r["email"]:
        msg["Reply-To"] = r["email"]

    lines = [
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
    ]
    msg.set_content("\n".join(lines))

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.starttls(context=context)
        server.login(SENDER, APP_PASSWORD)
        server.send_message(msg)


@app.after_request
def _cors(resp):
    # Permissive CORS for the API routes (harmless; useful if you later call
    # them from another origin such as a subdomain).
    if request.path.startswith("/api/"):
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
