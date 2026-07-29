# HEXU 英文站 — 部署指南（Cloudflare 域名 + Python 托管平台）

本文件夹 `deploy/` 是一个**自包含的生产部署包**：英文网页 + Flask 后端（联系/建议表单 + Gmail 发信）。
中文站只是你本地审核用的，不在此包内。

部署分两块，你只需做"平台账号 + DNS"两步，代码我已经打包好。

---

## 第 0 步：准备一个 GitHub 仓库（托管平台要从这里拉代码）

1. 打开 https://github.com → New repository（仓库名随意，例如 `hexu-site`），选 **Private** 也行。
2. 把本 `deploy/` 文件夹里的**所有文件**上传进去（直接拖拽，或用 GitHub Desktop）。
   - 注意：不要上传真实 `.env`（含密码）。仓库里只放 `.env.example` 即可。
3. 记住仓库地址，下一步要用。

> 不想用 GitHub？Railway 支持"上传文件夹直接部署"（`railway up`），可跳过本步。

---

## 第 1 步：部署后端到 Render（免费额度）

1. 打开 https://render.com → 用 GitHub 登录 → **New → Web Service**。
2. 连接刚才的 GitHub 仓库。
3. 设置：
   - **Name**：hexu（随意）
   - **Region**：选离你近的（Singapore / Oregon）
   - **Runtime**：Python 3
   - **Build Command**：`pip install -r requirements.txt`
   - **Start Command**：`gunicorn --bind 0.0.0.0:$PORT app:app`
     （有 `Procfile` 的话 Render 会自动用它，这行可留空）
4. 展开 **Advanced → Add Environment Variable**：
   - Key: `HEXU_GMAIL_APP_PASSWORD`
   - Value: 你的 16 位 Gmail 应用专用密码（如 `pfad dbnu otew ucts`）
5. 点 **Create Web Service**。等 1–2 分钟构建完成。
6. 完成后 Render 会给一个地址，形如 `https://hexu-xxxx.onrender.com`。
   - 打开它，应该能看到网站。
   - 在 Contact / Feedback 表单填测试内容提交，去 `xu6118319@gmail.com` 收件箱确认收到邮件。

> **免费版冷启动提示**：Render 免费版在 15 分钟无访问后会"休眠"，下次访问要等约 30 秒唤醒。
> 介意的话用 **Railway**（有 $5 试用额度、不休眠）：流程几乎一样，仓库连上后 Start Command 相同。

---

## 第 2 步：在 Cloudflare 把你的域名指过来（免费 HTTPS）

你域名在 Cloudflare 买的，DNS 和证书都是现成的。

1. 登录 https://dash.cloudflare.com → 选你的域名。
2. 左侧 **DNS → Records**。
3. 添加两条 **CNAME** 记录（如果已有同名的旧记录，先删掉）：

   | Type | Name | Target | Proxy |
   |------|------|--------|-------|
   | CNAME | `@` | `hexu-xxxx.onrender.com` | **Proxied（橙云）** |
   | CNAME | `www` | `hexu-xxxx.onrender.com` | **Proxied（橙云）** |

   （把 `hexu-xxxx.onrender.com` 换成你 Render 实际给的地址。）
4. 左侧 **SSL/TLS → Overview**，加密模式设为 **Full**（因为 Render 自带有效证书）。
5. 等 DNS 生效（通常几分钟，最多几小时）。然后浏览器打开你的域名（如 `https://hexu.com`）：
   - 地址栏应出现小锁（HTTPS 由 Cloudflare 免费提供）。
   - 表单提交应正常，并把邮件发到你 Gmail。

---

## 第 3 步：常见问题

- **打开域名显示 Cloudflare 占位页 / 1000 错误？**
  → DNS 的 CNAME Target 写错了，或忘了开"橙云"（Proxy 必须是 Proxied）。
- **表单提交后没收到邮件？**
  → 检查 Render 环境变量 `HEXU_GMAIL_APP_PASSWORD` 是否填对（16 位、含空格）；
    也看下 Gmail 收件箱"垃圾邮件"和 Google 账号的"安全提醒"（新 IP 发信可能被拦一次）。
- **想换域名/加子域名？**
  → 在 Cloudflare DNS 加对应 CNAME 即可，后端不用改。
- **以后改了网站内容？**
  → 改完 `deploy/` 里的文件 → 重新推到 GitHub → Render 自动重新部署（或手动点 Deploy）。

---

## 本地试运行（可选，验证部署包本身没问题）

```bash
cd deploy
pip install -r requirements.txt
cp .env.example .env        # 填入真实密码
python app.py               # 默认 http://localhost:5000
```
