# HEXU 英文站 — 部署指南（Cloudflare 域名 + Python 托管平台）

本文件夹 `HEXU/` 是一个**自包含的生产部署包**:英文网页 + Flask 后端(联系/建议表单 + Resend 邮件 API)。
中文站只是你本地审核用的,不在此包内。

部署分两块,你只需做"平台账号 + DNS"两步,代码我已经打包好。

---

## 第 0 步:准备一个 GitHub 仓库(托管平台要从这里拉代码)

1. 打开 https://github.com → New repository(仓库名随意,例如 `hexu-site`),选 **Private** 也行。
2. 把本 `HEXU/` 文件夹里的**所有文件**上传进去(直接拖拽,或用 GitHub Desktop)。
   - 注意:不要上传真实 `.env`(含密钥)。仓库里只放 `.env.example` 即可。
3. 记住仓库地址,下一步要用。

> 不想用 GitHub?Railway 支持"上传文件夹直接部署"(`railway up`),可跳过本步。

---

## 第 1 步:部署后端到 Render(免费额度)

1. 打开 https://render.com → 用 GitHub 登录 → **New → Web Service**。
2. 连接刚才的 GitHub 仓库。
3. 设置:
   - **Name**:hexu(随意)
   - **Region**:选离你近的(Singapore / Oregon)
   - **Runtime**:Python 3
   - **Build Command**:`pip install -r requirements.txt`
   - **Start Command**:`gunicorn --bind 0.0.0.0:$PORT app:app`
     (有 `Procfile` 的话 Render 会自动用它,这行可留空)
4. 展开 **Advanced → Add Environment Variable**:
   - Key: `RESEND_API_KEY`
   - Value: 你的 Resend API Key(从 https://resend.com/api-keys 拿到,形如 `re_xxxxxxxx`)
5. 点 **Create Web Service**。等 1–2 分钟构建完成。
6. 完成后 Render 会给一个地址,形如 `https://hexu-xxxx.onrender.com`。
   - 打开它,应该能看到网站。
   - 在 Contact / Feedback 表单填测试内容提交,去 `xu6118319@gmail.com` 收件箱确认收到邮件。
   - 第一次访问可能 30 秒冷启动,会"转圈"一下才出来。

> **为什么用 Resend 而不是 Gmail SMTP?**
> Render 免费版会**封锁对外的 SMTP 连接**(端口 25/465/587),所以走 `smtplib` 会被
> 平台在网络层直接截掉,日志里会出现 `Network is unreachable` 报错。Resend 用
> HTTPS(443 端口,Render 不拦),免费版每月 3000 封/每天 100 封,够用。

> **免费版冷启动提示**:Render 免费版在 15 分钟无访问后会"休眠",下次访问要等约 30 秒唤醒。
> 介意的话用 **Railway**(有 $5 试用额度、不休眠):流程几乎一样,仓库连上后 Start Command 相同。

---

## 第 2 步:在 Cloudflare 把你的域名指过来(免费 HTTPS)

你域名在 Cloudflare 买的,DNS 和证书都是现成的。

1. 登录 https://dash.cloudflare.com → 选你的域名。
2. 左侧 **DNS → Records**。
3. 添加两条 **CNAME** 记录(如果已有同名的旧记录,先删掉):

   | Type | Name | Target | Proxy |
   |------|------|--------|-------|
   | CNAME | `@` | `hexu-xxxx.onrender.com` | **DNS only(灰云)** |
   | CNAME | `www` | `hexu-xxxx.onrender.com` | **DNS only(灰云)** |

   (把 `hexu-xxxx.onrender.com` 换成你 Render 实际给的地址。)
   > 灰云(DNS only)即可——**不要开橙云**,否则会出现 Error 1000。
4. 左侧 **SSL/TLS → Overview**,加密模式设为 **Full**(因为 Render 自带有效证书)。
5. 等 DNS 生效(通常几分钟,最多几小时)。然后浏览器打开你的域名(如 `https://hexuhub.com`):
   - 地址栏应出现小锁(HTTPS 由 Cloudflare 免费提供)。
   - 表单提交应正常,并把邮件发到你 Gmail。

---

## 第 3 步:常见问题

- **打开域名显示 Cloudflare 占位页 / 1000 错误?**
  → DNS 的 CNAME Target 写错了,或开了"橙云"(Proxy 必须是 DNS only / 灰云)。
- **表单提交后没收到邮件?**
  → 检查 Render 环境变量 `RESEND_API_KEY` 是否填对(必须以 `re_` 开头);
    查 Gmail 收件箱"垃圾邮件"和"Promotions"标签;
    Render → Logs 搜 `Email delivery failed` 看具体错误。
- **想在邮件里显示发件人是 HEXU 而不是 `onboarding@resend.dev`?**
  → Resend 后台 → **Domains** → Add Domain → 输入 `hexuhub.com`
  → 按它给的 3 条 DNS 记录去 Cloudflare 加 → 验证通过后
  → 改 `app.py` 里 `RESEND_FROM = "HEXU <noreply@hexuhub.com>"` → 重新部署。
- **想换域名/加子域名?**
  → 在 Cloudflare DNS 加对应 CNAME 即可,后端不用改。
- **以后改了网站内容?**
  → 改完 `HEXU/` 里的文件 → 重新推到 GitHub → Render 自动重新部署(或手动点 Deploy)。

---

## 本地试运行(可选,验证部署包本身没问题)

```bash
cd HEXU
pip install -r requirements.txt
cp .env.example .env        # 填入真实 RESEND_API_KEY
python app.py               # 默认 http://localhost:5000
```
