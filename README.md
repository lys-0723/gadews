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
