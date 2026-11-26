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

首页提供管理员和普通用户入口，分别通往 `/login?entry=admin` 和 `/login?entry=user`，两者使用相同的本站账号认证。共享页头从 `/api/accounts/session` 读取当前会话身份。账号管理和演示授权工作区位于 `/accounts`。注册默认待分配，新密码至少 7 个字符，含大写英文字母和至少一个标点或符号（含下划线）。注册时未达标显示弱，达标显示中；达到 12 个字符且同时含小写英文字母和数字显示强。旧账号沿用原密码登录。超级管理员从“账号管理 → 待审批申请”批准或拒绝各业务层级的申请。拒绝前会确认申请人的用户名，申请人登录后可看到“申请已拒绝”。如需复核，在“全站账号目录”对该账号选择“重新审核”。超级管理员可审批所有业务层级的账号，也可在“用户权限管理”直接设置其他用户的角色、辖区、模型、适用的普通用户可读记录及启用状态。由超级管理员直接管理的账号，其授权变更由超级管理员决定。采用逐级管理时，国家管理员负责本国直属区域管理员，区域管理员负责本区直属普通用户。公开地图、文献和本地规则评估可匿名访问。知识助手和在线 AI 对照另查本站模型授权。在线病种对照限公开内置示例或账户工作区中服务端选取的授权记录。

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

## 公开环境数据

在环境总览按位置、产品和有效时刻查预报、区域海况、历史再分析及来源。全球报告地图可叠加全球 Copernicus 海洋图层或 NOAA 近海样区，另显示五个气象参考点和一个近海点。卫星缺测、插值和过期分别标识；区域资料不填入塘口评分。

`npm run sync:environment` 从公共 API 生成或刷新 `public/data/environment/snapshot.json`。可用 `python3 scripts/sync_environment.py --output 路径` 更新指定快照。失败的来源保留旧值和原日期；全部失败时不发布。源站时间用 UTC，气旋时间按来源保留。低频预报和日海洋产品在同一 6 小时批次中检查，产品未变则保留原版本取得时间。仅从源代码仓库运行，无需账号库、设备或模型凭据。

默认分支的 Refresh public environment 工作流支持手动触发及 UTC 每 6 小时更新。发布位置为独立的 `environment-data` 分支的 `forecasts-v3.json`，历史提交保留各版预报和订正。/api/environment 校验发布快照，网络不可用时提供最近已验证版本或随站版。GitHub Actions 需要允许 contents:write，数据分支需允许该工作流常规推送。工作流首次合入默认分支后才开始按计划执行。

来源包括 Open-Meteo（非商业托管 API，CC BY 4.0 署名）、NASA POWER、NOAA CoastWatch/OISST、E.U. Copernicus Marine Service、Copernicus EMS/GloFAS、GDACS 事件背景和 INCOIS ABIS 产品目录。官方地区通告保留原文链接。图表显示来源网格、单位、版本时间和可重放的公开请求；模型场、遥感像元及插值各有独立产品名。

区域环境总览可切换五个陆地代表位置的 7 天逐时天气、NOAA GEFS 15 天集合天气、ECMWF EC46 周展望及 SEAS5 月展望。GEFS 使用 31 个成员（含控制成员），按日显示气温与降水的 P10、P50、P90。周、月距平直接取自 ECMWF 模式历史气候基准，正负分别表示高于或低于同期平均。页面显示 UTC 有效期及同步时间。原始接口不提供起报时刻，页面不作推算。上游通过 [Open-Meteo 集合接口](https://open-meteo.com/en/docs/ensemble-api)和[季节接口](https://open-meteo.com/en/docs/seasonal-forecast-api)提供；公开免费接口的使用条件见[服务条款](https://open-meteo.com/en/terms)。

同步器使用 Python 3.12。在虚拟环境执行 `python -m pip install -r scripts/requirements-environment.txt` 后运行 `npm run sync:environment`。NOAA PSL 的 NetCDF 每次修订仅提取最新起报的 HDF5 数据块；ETag 未变则沿用上次格网。全球地图展示保留增暖趋势的 1° 月度海洋热浪概率，格点值四舍五入为整数百分比，255 代表缺测。区域时序保留两位小数。ENSO 的 9 组滚动三个月概率取自 NOAA CPC 官方表。NASA GIBS 提供半小时 IMERG 平均降水率影像，保存每个代表点周边 6° 的影像、有效时间、原图与中心像元的官方色阶；透明区无可判读数值。各产品独立保留最后一次成功的快照。
