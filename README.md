# xxt-dl

TypeScript + Node.js 版学习通作业内容保存工具。它只保存当前账号在浏览器里能看到的作业/测验页面，适合把自己的习毛概课程作业整理成 Markdown 和 HTML 复习资料。

## 安装

```bash
npm install
npx playwright install chromium
```

## 开发

```bash
npm run check
npm test
npm run build
```

## 安全说明

请不要提交 `.xxt-profile/` 和 `output/`：

- `.xxt-profile/` 是 Playwright/Chromium 的本地浏览器用户目录，可能包含 cookies、登录态和浏览记录。
- `output/` 是下载后的课程、作业和题库内容，可能包含课程资料、题目、答案或个人学习内容。

这两个目录已经写入 `.gitignore`。如果准备把仓库推到 GitHub 或其他远端，建议先运行 `git status --ignored` 确认它们处于 ignored 状态。

## 使用

```bash
npm start
```

运行后会打开 Chromium：

1. 手动登录学习通。
2. 如果停留在学习通二维码登录页，工具会自动采集 `#quickCode` 二维码并保存到 `output/login-qr.png`，可用学习通 App 扫码登录。
3. 可以停在“个人空间”的课程列表页，也可以进入习毛概课程的作业、测验或任务列表页。
4. 工具检测到个人空间、课程列表或课程页 URL 后会自动开始读取。
5. 如果当前页是课程列表，工具会列出课程，让你输入序号或关键词。
6. 等待工具保存详情页和汇总题库。

输出文件默认在 `output/`：

- `login-qr.png`：学习通扫码登录二维码，仅在检测到二维码登录页时生成。
- `login-qr.json`：二维码 URL、uuid、失效状态等调试信息。
- `assignment-links.json`：发现的疑似作业/测验链接。
- `manifest.json`：已保存页面清单。
- `*.md`：便于复习和搜索的 Markdown。
- `*.html`：原始页面正文 HTML。
- `*.clean.md`：清洗后的题目 + 正确答案。
- `*.questions.json`：结构化题目数据。
- `题库整理.md`：所有作业合并后的复习版题库，会在抓取完成后自动生成。

登录态保存在 `.xxt-profile/`，下次运行通常不需要重新登录。

## 常用参数

```bash
npm start -- --out review-notes
npm start -- --limit 3
npm start -- --course 习毛概
npm start -- --url https://i.chaoxing.com/
npm start -- --profile .xxt-profile
```

如果已经抓完 HTML，只想重新生成清洗版：

```bash
npm run clean
```

## 注意

- 请只保存你自己账号有权限查看的课程内容。
- 本工具不绕过验证码、权限控制或隐藏答案。
- 学习通页面结构可能变化。如果进入课程后仍没有发现链接，先手动点到课程内的“作业 / 考试 / 测验”页，再运行一次。

## 排查

如果终端提示“没有在当前页面发现疑似作业链接”，工具会在输出目录生成：

- `course-links.raw.json`：从当前页发现的原始课程入口。
- `course-links.json`：读取过标题的课程入口列表。
- `debug-page.json`：当前页面、iframe、候选链接和被过滤原因线索。
- `debug-page.html`：当前页面 HTML。
- `debug-page.png`：当前页面截图。

这通常说明你停留的页面不是作业列表页，或学习通把入口放在了特殊脚本里。可以先进入某一个具体作业/测验详情页，再运行一次；如果仍然失败，把 `output/debug-page.json` 和 `output/course-links.json` 发出来就能继续针对页面结构适配。
