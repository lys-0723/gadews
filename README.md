# GADEWS 网站

水产养殖疫病早期预警门户。应用使用 Next.js 和 TypeScript，包含公开报告地图、知识库检索、风险评估和设备接口。

## 本地启动

使用 .nvmrc 指定的 Node 24.19.0、npm 11.20.0 和 Python 3。在仓库根目录执行：

```sh
npm ci
npm run data:restore
npm run dev
```

浏览器打开 http://localhost:3000。默认演示可以离线使用本地数据。设备、数据库和模型服务通过服务端环境变量配置，可用字段见 .env.example。

## 测试和数据

`npm run check` 核验公开资源、运行 lint、类型检查、离线测试及生产构建。CI 使用相同命令。公开检出按 SHA-256 核验已发布的罗非鱼知识 JSON，转换器测试使用合成工作簿。有受控原件时另运行 `python3 scripts/convert_tilapia_knowledge.py --check --workbook "/path/to/workbook.xlsx"`，逐字节复核转换结果。

页面在 app/，页面组件在 components/，规则与服务端代码在 lib/，公开网站资源在 public/，资源恢复输入在 data/，转换和检查脚本在 scripts/。贡献者接手任务先读 [AGENTS.md](AGENTS.md)。

## 原型账号与模型分配

进入 `/accounts` 可查看虚构权限预览、注册账号、登录和管理直属账号。注册默认待分配，使用用户名和至少 10 个字符的密码。系统管理员审批国家管理员，国家管理员审批本国区域管理员，区域管理员审批本区终端用户，并分别授予模型和记录。公开地图、文献和本地规则评估可匿名访问。知识助手和在线 AI 对照另查本站模型授权。在线病种对照限公开内置示例或账户工作区中服务端选取的授权记录。

本地 `npm run dev` 使用被忽略的 `.local-accounts/accounts.db`。从可信终端以环境变量提供初始维护账号后运行 `npm run accounts:init-admin`；不要把密码写入命令行参数或提交到 Git。以下适用于 macOS 的 zsh：

```sh
read "GADEWS_ADMIN_USERNAME?管理员用户名: "
read -s "GADEWS_ADMIN_PASSWORD?管理员密码: "
echo
export GADEWS_ADMIN_USERNAME GADEWS_ADMIN_PASSWORD
npm run accounts:init-admin
unset GADEWS_ADMIN_USERNAME GADEWS_ADMIN_PASSWORD
```

维护命令只新增一个管理员，已注册的同名账号不能借此升权。在持久磁盘上用生产构建演示时，显式设置绝对路径 `GADEWS_ACCOUNT_DB_URL=file:/path/to/accounts.db`。Vercel 多实例使用持久 libSQL 地址及服务端写令牌（见 .env.example）；初始化命令指向同一库。无需给设备接口配置凭据。为预览与正式环境分配不同账号库，原型只放虚构业务记录。
