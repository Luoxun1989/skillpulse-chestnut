# SkillPulse 部署总入口

本目录（chestnut / skillpulse-api / skillpulse-crawler）三仓统一部署手册。

## 部署顺序

| Step | 仓库 | 文档 | 产物 |
|------|------|------|------|
| 1 | skillpulse-api | 本仓 [DEPLOY.md](../DEPLOY.md) + 后端 jar | `target/skillpulse-api-1.0.0.jar` |
| 2 | skillpulse-chestnut | 本仓 README.md | `.next/standalone/` |
| 3 | skillpulse-crawler | [skillpulse-crawler/DEPLOY.md](../skillpulse-crawler/DEPLOY.md) | cron 部署 |

**推荐顺序**：先跑后端 → 验证 → 上前端 → 最后装爬虫 → 跑一轮 dry-run 验证。

## 服务器端首次部署 checklist

- [ ] 服务器装好：MySQL 8+、JDK 1.8、Nginx、Node.js 18
- [ ] DNS A 记录 `www.skillpulse.cn` → 服务器 IP
- [ ] 创建服务器独立凭证（**禁止复用 dev 默认 admin/admin123**）：
  - DB root 密码
  - 后端 admin 账号密码（写入 application-prod.yml）
  - JWT secret（64 字节以上）
- [ ] DB 建库 `CREATE DATABASE skillpulse DEFAULT CHARSET utf8mb4`
- [ ] **导入初始数据 SQL**：`mysql -u root -p skillpulse < sql/init_full_data.sql`
- [ ] 启动后端：`nohup java -jar skillpulse-api-1.0.0.jar --spring.profiles.active=prod &`
- [ ] 验证后端：`curl http://127.0.0.1:8081/api/categories`
- [ ] 上传前端 standalone + PM2 启动
- [ ] 配置 Nginx 反代 + certbot SSL
- [ ] 部署爬虫 + 配置 cron（每 3 小时）
- [ ] 跑一轮爬虫 dry-run + 全源 run，验证入库

## 初始化数据

**重要**：dev 环境的全 2024 条数据已经导出到 [skillpulse-crawler/sql/init_full_data.sql](../skillpulse-crawler/sql/init_full_data.sql)。
首次部署服务器 DB 时直接 import，避免空库起步。

```bash
# 在爬虫目录拷过来
scp skillpulse-crawler/sql/init_full_data.sql user@server:/tmp/
ssh user@server "mysql -u root -p skillpulse < /tmp/init_full_data.sql"
```

**注意**：导出的 SQL 包含所有历史 issue（36/99/102-116/20260923/20260924）。服务器导入后首页就能看到完整历史。

## 文件索引

```
chestnut/                              # 前端 (Next.js)
├── .next/standalone/                  # 已打包的 standalone
├── DEPLOY.md (本文件)                  # 总入口
└── src/ ...

skillpulse-api/                        # 后端 (Spring Boot)
├── target/skillpulse-api-1.0.0.jar     # 已打包
├── DEPLOY.md                           # 后端 + Nginx + SSL 详细步骤
└── src/ ...

skillpulse-crawler/                    # 爬虫 (Python)
├── DEPLOY.md                           # 爬虫部署详细步骤
├── sql/init_full_data.sql              # 初始化数据（4 表 2024 条）
├── scripts/replay_all.py               # 全源回填脚本
├── scripts/export_full_sql.py          # dev 后端 → 全表 SQL
├── .env.example                        # 环境变量模板
└── skillpulse_crawler/ ...
```

## 关键凭证（部署前要替换）

| 位置 | 占位符 | 说明 |
|------|--------|------|
| `application-prod.yml` | `DB_PASSWORD: ${DB_PASSWORD:...}` | MySQL root 密码 |
| `application-prod.yml` | `jwt.secret: ${JWT_SECRET:...}` | 64 字节 JWT 签名密钥 |
| `application-prod.yml` | `hmac.secret: ${HMAC_SECRET:...}` | HMAC 签名密钥 |
| `.env` (crawler) | `ADMIN_PASS=__REPLACE_ME__` | 后端 admin 密码 |
| `deploy.sh` (后端) | 同上 | 同上 |
| `.env.production` (前端) | `NEXT_PUBLIC_API_BASE_URL` | 站点域名 |

**生产环境务必：**
- 重置所有 dev 默认密码
- 用 64+ 字节随机 JWT secret（`openssl rand -base64 64`）
- 关闭 dev profile，强制 prod
- HTTPS 强制（certbot 重定向）
- 数据库不允许外网访问（只 bind 127.0.0.1 或 unix socket）

## 验证部署

```bash
# 后端
curl http://127.0.0.1:8081/api/weekly-digest/issues
# 期望：JSON 含 issues 列表（来自导入的 SQL）

# 前端
curl -I https://www.skillpulse.cn
# 期望：200 OK

# 爬虫（手动跑一次）
cd /data/skillpulse-crawler
.venv/bin/python -m skillpulse_crawler run --source news_huxiu
# 期望：raw>0 inserted>0（或 skipped 已存在）
```

## 故障排查

详见各仓 DEPLOY.md 故障排查章节。

最常见问题：
- 后端 401：JWT secret 不匹配，重新生成并重启
- 前端 404 静态资源：standalone/.next/static 缺失，重新 `cp -r .next/static .next/standalone/.next/`
- 爬虫 401：`.env` 的 ADMIN_PASS 与 application-prod.yml 不一致
