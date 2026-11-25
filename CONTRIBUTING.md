# GitHub 开发流程

新功能、行为变化和缺陷先建或复用 Issue。写明使用场景、预期行为和验收例子。重构先约定要保留的行为，再拆成可以单独审阅的增量。错字、链接等小改动可直接开 PR。

1. 从最新的 `origin/main` 建短分支，例如 `codex/map-missing-data`。依赖尚未合并的变更时，注明分支起点与 PR 的目标分支。
2. 完成一个可验收的改动，运行定向测试。应用变更运行 `npm run check`，页面变更补查桌面与移动端；纯文档改动核对内容和链接。
3. 用 `git add -- <文件>` 暂存相关文件，查看 `git diff --cached`。一笔 commit 写明一个改动，修复和对应的回归测试可一起提交。无关改动另开分支。
4. 用 `git push -u origin <分支>` 推送当前任务分支。一个 PR 对应一个验收目标，可以包含多笔提交。在 PR 写清变更、验证结果和仍待确认的事项。目标为默认分支且完整解决 Issue 时，在描述中写 `Closes #123`，换成实际编号。
5. 审查 Files changed 和 Checks，按验收例子核对后合并。单人开发也检查最终差异。发布另行记录环境、部署提交和验证结果。

公开 Issue、commit 和 PR 只使用可共享的信息。内部方案原件、工作簿、凭据及含内部材料的历史分支留在项目工作区。

参考 [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow) 和 [Google 小改动评审指南](https://google.github.io/eng-practices/review/developer/small-cls.html)。
