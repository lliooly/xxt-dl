# 全仓库可靠性审计与修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复本地 API、下载任务并发锁和刷题状态中的已确认缺陷，并完成覆盖采集、解析、CLI、Web 与练习模块的证据化代码审查。

**架构：** 保持现有模块边界，将题库文件读取与响应校验提取为可测试纯逻辑；下载服务用任务 Promise 的真实生命周期持有互斥锁；刷题引擎按题型处理答案，React 组件只维护受控草稿。每项行为先写失败测试，再做最小修复。

**技术栈：** TypeScript 5、Node.js `node:test`、Next.js 16 Route Handlers、React 19、Playwright、Base UI

---

## 文件结构

- 创建 `src/web/practice-library.ts`：发现、读取并校验本地 `.questions.json` 文件。
- 创建 `test/web-practice-library.test.ts`：覆盖空目录、损坏 JSON、非法题目结构和正常加载。
- 修改 `app/api/practice-chapters/route.ts`：把文件逻辑委托给题库加载模块并返回正确状态码。
- 修改 `src/practice/question-loader.ts`：严格处理 API 非成功响应和无效响应体。
- 创建 `test/practice-question-loader.test.ts`：覆盖客户端响应解析。
- 修改 `src/web/download-task-service.ts`：以真实任务生命周期持锁，并原子处理课程选择。
- 修改 `test/web-download-task-service.test.ts`：覆盖完成、错误、停止和重复选课窗口。
- 创建 `test/practice-quiz-engine.test.ts`：覆盖答案归一化、会话导航和错题重建。
- 修改 `src/practice/quiz-engine.ts`：区分选择题与文本题，并统一会话来源。
- 修改 `components/practice/quiz-card.tsx`：添加填空输入并修复切题状态。
- 修改 `components/practice/practice-view.tsx`：刷新错题来源和计数。
- 修改 `components/practice/practice-dashboard.tsx`：接收实时错题数。
- 创建 `src/cli-options.ts`：解析并校验 CLI 参数，不触发浏览器主流程。
- 创建 `test/cli-options.test.ts`：覆盖缺失参数和非法数量。
- 修改 `src/cli.ts`：使用已校验的 CLI 配置。
- 按审计发现修改 `src/browser.ts`、`src/core.ts`、`src/clean.ts` 或 `src/collector/download-job.ts`：只处理有失败测试支持的缺陷。

### 任务 1：修复题库 API 的错误语义与数据校验

**文件：**
- 创建：`src/web/practice-library.ts`
- 创建：`test/web-practice-library.test.ts`
- 修改：`app/api/practice-chapters/route.ts`

- [ ] **步骤 1：编写题库加载失败测试**

使用临时目录构造正常、损坏和结构非法文件：

```ts
test("loadPracticeLibrary distinguishes an absent directory from corrupt files", async () => {
  assert.deepEqual(await loadPracticeLibrary(join(tempRoot, "missing")), {
    chapters: [],
    questions: {},
  });

  await writeFile(join(tempRoot, "001-broken.questions.json"), "{invalid");
  await assert.rejects(
    loadPracticeLibrary(tempRoot),
    (error: unknown) => error instanceof PracticeLibraryError && error.code === "INVALID_FILE",
  );
});
```

再断言空数组为合法但不生成章节，缺少 `stem`、`options` 或答案字段的对象被拒绝。

- [ ] **步骤 2：运行测试并确认红灯**

运行：`npm test -- --test-name-pattern="loadPracticeLibrary"`

预期：构建失败，提示 `src/web/practice-library.ts` 不存在。

- [ ] **步骤 3：实现严格题库加载器**

```ts
export async function loadPracticeLibrary(outputDir: string): Promise<PracticeLibraryPayload> {
  let files: string[];
  try {
    files = await readdir(outputDir);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return emptyPayload();
    throw new PracticeLibraryError("READ_FAILED", "读取本地题库失败。", { cause: error });
  }

  for (const file of files.filter(isQuestionFile).sort()) {
    const value = await readQuestionFile(join(outputDir, file), file);
    if (value.length === 0) continue;
    // 使用文件名生成稳定章节 ID 与标题，并写入 payload。
  }
  return payload;
}
```

`readQuestionFile` 捕获 JSON 语法错误，并逐项校验 `number`、`type`、`stem`、`options`、`correctAnswer` 和 `correctAnswerText` 的类型。

- [ ] **步骤 4：让 Route Handler 映射错误**

```ts
export async function GET() {
  try {
    return NextResponse.json(await loadPracticeLibrary(resolve(process.cwd(), "output")));
  } catch (error) {
    const message = error instanceof PracticeLibraryError
      ? error.message
      : "本地题库接口处理失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **步骤 5：运行题库加载测试验证绿灯**

运行：`npm test -- --test-name-pattern="PracticeLibrary|loadPracticeLibrary"`

预期：新增测试全部通过。

### 任务 2：修复题库客户端对错误 API 的处理

**文件：**
- 修改：`src/practice/question-loader.ts`
- 创建：`test/practice-question-loader.test.ts`

- [ ] **步骤 1：为响应解析编写失败测试**

```ts
test("parsePracticeResponse rejects non-success and malformed payloads", async () => {
  await assert.rejects(
    parsePracticeResponse(new Response(JSON.stringify({ error: "题库损坏" }), { status: 500 })),
    /题库损坏/,
  );
  await assert.rejects(
    parsePracticeResponse(new Response(JSON.stringify({ chapters: "bad", questions: {} }))),
    /响应格式无效/,
  );
});
```

- [ ] **步骤 2：运行测试验证红灯**

运行：`npm test -- --test-name-pattern="parsePracticeResponse"`

预期：FAIL，`parsePracticeResponse` 尚未导出。

- [ ] **步骤 3：实现响应解析并接入 Hook**

```ts
export async function parsePracticeResponse(response: Response): Promise<PracticePayload> {
  const value: unknown = await response.json().catch(() => {
    throw new Error("题库接口返回了无效 JSON。");
  });
  if (!response.ok) throw new Error(readApiError(value));
  if (!isPracticePayload(value)) throw new Error("题库接口响应格式无效。");
  return value;
}
```

`usePracticeData` 统一调用该函数；任何失败都清空章节和题目 Map，并设置可见错误，不再把非 2xx 当作正常空题库。

- [ ] **步骤 4：运行客户端解析测试验证绿灯**

运行：`npm test -- --test-name-pattern="parsePracticeResponse"`

预期：全部通过。

### 任务 3：修复下载任务运行锁和重复选课竞态

**文件：**
- 修改：`test/web-download-task-service.test.ts`
- 修改：`src/web/download-task-service.ts`

- [ ] **步骤 1：编写生命周期锁失败测试**

```ts
test("service keeps the lock until run settles after done or error", async () => {
  const harness = createHarness();
  harness.service.start({});
  harness.job.handlers.done?.({ outDir: "/tmp/output", total: 1 });
  assert.throws(() => harness.service.start({}), hasCode("ACTIVE_TASK"));
  harness.job.finish();
  await tick();
  assert.doesNotThrow(() => harness.service.start({}));
});
```

增加同类 `error` 用例，并让任务 ID 工厂每次返回不同 ID，验证旧回调不能覆盖新任务。

- [ ] **步骤 2：编写重复选课失败测试**

第一次有效选择后立即再次选择，预期第二次抛出 `INVALID_STATE`，而不是成功但不执行。

- [ ] **步骤 3：运行任务服务测试确认红灯**

运行：`npm test -- --test-name-pattern="keeps the lock|duplicate course"`

预期：当前服务在 `done` / `error` 状态提前放行，或接受重复选课。

- [ ] **步骤 4：以任务 Promise 生命周期持锁**

```ts
start(input: StartDownloadInput): WebDownloadSnapshot {
  if (this.activeJob) throw new WebDownloadTaskError("ACTIVE_TASK", "已有下载任务正在运行或清理中。");
  // 初始化快照并创建 job。
  this.activeJob = job;
  const runPromise = Promise.resolve().then(() => job.run());
  void runPromise.catch(handleError).finally(() => {
    if (this.snapshot.taskId === taskId && this.activeJob === job) this.activeJob = undefined;
  });
  return this.getSnapshot();
}
```

课程选择校验通过后，先把快照状态更新为 `collecting`，再调用 `job.selectCourse(value)`；如果同步调用失败，则恢复错误快照并抛出。

- [ ] **步骤 5：运行任务服务全量测试验证绿灯**

运行：`npm test -- --test-name-pattern="WebDownloadTaskService|service keeps|duplicate course"`

预期：全部通过。

### 任务 4：修复刷题答案判定和会话来源

**文件：**
- 创建：`test/practice-quiz-engine.test.ts`
- 修改：`src/practice/quiz-engine.ts`

- [ ] **步骤 1：编写中文填空、多选和会话失败测试**

```ts
test("checkAnswer preserves Unicode text for text questions", () => {
  const fill = question({ type: "填空题", options: [], correctAnswer: "马克思主义 中国化" });
  assert.equal(checkAnswer(fill, "  马克思主义   中国化  "), true);
  assert.equal(checkAnswer(fill, "   "), false);
});

test("createSession uses the latest wrong-book source", () => {
  const config = { mode: "wrong-book", chapterIds: [], shuffle: false } as const;
  assert.equal(createSession(config, new Map(), [source(question())]).questions.length, 1);
  assert.equal(createSession(config, new Map(), [source(question()), source(question({ number: "2" }))]).questions.length, 2);
});
```

同时覆盖多选顺序无关但集合严格相等、提交一题不污染下一题、结果统计和空会话。

- [ ] **步骤 2：运行练习引擎测试确认红灯**

运行：`npm test -- --test-name-pattern="Unicode text|latest wrong-book"`

预期：中文填空比较失败，`createSession` 第三个参数尚不存在。

- [ ] **步骤 3：实现按题型归一化和统一会话工厂**

```ts
function normaliseChoiceAnswer(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9对错√×]/g, "");
}

function normaliseTextAnswer(raw: string): string {
  return raw.trim().replace(/[\s\u3000]+/gu, " ");
}

function isTextQuestion(question: Question): boolean {
  return question.type === "填空题" || question.options.length === 0;
}
```

`createSession` 接受可选的最新错题来源，并在 `wrong-book` 模式调用 `createSessionFromQuestions`。

- [ ] **步骤 4：运行练习引擎测试验证绿灯**

运行：`npm test -- --test-name-pattern="checkAnswer|createSession|submitting"`

预期：新增测试全部通过。

### 任务 5：修复题卡受控状态和错题刷新

**文件：**
- 修改：`components/practice/quiz-card.tsx`
- 修改：`components/practice/practice-view.tsx`
- 修改：`components/practice/practice-dashboard.tsx`

- [ ] **步骤 1：让题卡按题目身份重置草稿**

引入 `Input`，使用 `${qs.chapterId}::${question.number}` 作为题目身份；在身份、题型或已提交答案变化时重置多选与文本草稿。

- [ ] **步骤 2：保持单选组终身受控并增加填空输入**

```tsx
<RadioGroup value={selectedForRadio} onValueChange={handleSingleSelect} />

<Input
  value={textAnswer}
  onChange={(event) => setTextAnswer(event.target.value)}
  disabled={showResult}
  aria-label="填空答案"
/>
```

文本题提供禁用空白答案的提交按钮；选项展示时去除已存储的 `A.` 前缀，避免多选题显示重复标签，但不改变持久化题目内容。

- [ ] **步骤 3：每次错题新一轮读取最新存储**

`PracticeView` 在启动和重启错题模式时调用 `getWrongEntriesForReview()`；若结果为空则返回错题本。父组件维护刷新版本并把 `wrongCount` 传给 `PracticeDashboard`。

- [ ] **步骤 4：运行静态检查与全量测试**

运行：`npm run check`

预期：退出码 0。

运行：`npm test`

预期：所有测试通过。

### 任务 6：审查 CLI、采集、解析和导出边界

**文件：**
- 审查：`src/cli.ts`
- 审查：`src/browser.ts`
- 审查：`src/core.ts`
- 审查：`src/clean.ts`
- 审查：`src/clean-output.ts`
- 审查：`src/collector/download-job.ts`
- 创建：`src/cli-options.ts`
- 创建：`test/cli-options.test.ts`
- 创建：`test/download-job.test.ts`
- 创建：`src/web/download-client.ts`
- 创建：`test/web-download-client.test.ts`
- 测试：`test/core.test.ts`
- 测试：`test/clean.test.ts`
- 测试：`test/practice-wrong-book.test.ts`

- [ ] **步骤 1：逐文件执行审计清单**

对每个导出函数检查输入边界、URL 与文件路径处理、异常吞噬、资源关闭、Promise 取消和重复逻辑。每个确认缺陷记录「输入 → 当前结果 → 期望结果 → 根因」。

- [ ] **步骤 2：为已确认的 CLI 参数缺陷增加失败测试**

```ts
test("parseCliOptions rejects invalid or missing limit values", () => {
  for (const args of [["--limit", "0"], ["--limit", "-1"], ["--limit", "abc"], ["--limit"]]) {
    assert.throws(() => parseCliOptions(args), /--limit/);
  }
  assert.throws(() => parseCliOptions(["--out", "--limit", "3"]), /--out/);
});
```

`parseCliOptions` 返回带类型的 `out`、`profile`、`url`、`course` 和 `limit` 字段。未知 flag 与缺少值均抛出 `CliInputError`，避免拼写错误被静默忽略。

- [ ] **步骤 3：逐项运行目标测试验证红灯**

运行：`npm test -- --test-name-pattern="parseCliOptions"`

预期：构建失败，提示 `src/cli-options.ts` 不存在。

- [ ] **步骤 4：逐项实施最小修复并验证绿灯**

实现 `parseCliOptions` 并在 `src/cli.ts` 中替换当前 `Record<string, string>` 与二次 `Number()` 转换。运行 `npm test -- --test-name-pattern="parseCliOptions"`，预期全部通过。

静态审查若发现 CLI 参数之外的新缺陷，先把精确复现、目标文件和验证命令补入本计划，再进入对应的红—绿修复。对于故意忽略第三方 iframe、截图失败或 `networkidle` 超时的 catch，保留现有容错并补充限定性注释，不把预期降级改成致命错误。

- [ ] **步骤 5：修复静态审查确认的额外缺陷**

1. 在 `test/core.test.ts` 断言 `normalizeUrl("httpx://example.test", baseUrl)` 和 FTP URL 返回空字符串；`src/core.ts` 在构造 `URL` 后只接受 `http:` 与 `https:`。
2. 在 `test/practice-wrong-book.test.ts` 用纯函数断言 `[null]`、缺少字段和字段类型错误的 localStorage 数据返回空数组；`src/practice/wrong-book.ts` 导出并复用严格的 `parseWrongEntries(raw)`。
3. 在 `test/download-job.test.ts` 注入一个 `newPage()` 抛错、`close()` 可观测的浏览器上下文，断言 `DownloadJob.run()` 拒绝后仍关闭上下文并发送错误状态；`src/collector/download-job.ts` 把上下文创建和首页创建纳入同一个 `try/catch/finally`。
4. 在 `test/web-download-client.test.ts` 断言下载 API 的非 JSON、错误响应和缺失状态字段均产生可读错误；`src/web/download-client.ts` 负责响应解析，`components/download/download-workspace.tsx` 不再使用未经校验的类型断言。

分别运行：

```bash
npm test -- --test-name-pattern="normalizeUrl rejects|parseWrongEntries|closes the browser context|parseDownloadResponse"
```

预期：新增测试先因现有错误行为失败，最小修复后全部通过。

- [ ] **步骤 6：统一涉及文件的代码风格**

统一类型导入、错误变量类型、换行和辅助函数命名；不对未修改文件进行纯机械格式化，不引入新格式化依赖。

### 任务 7：完整验证与浏览器冒烟检查

**文件：**
- 验证：全部改动文件

- [ ] **步骤 1：运行差异检查**

运行：`git diff --check`

预期：无空白错误。

- [ ] **步骤 2：运行类型检查、测试和生产构建**

运行：`npm run check`

运行：`npm test`

运行：`npm run build`

预期：3 个命令退出码均为 0；记录测试总数。

- [ ] **步骤 3：启动本地 Web 并验证 API**

运行：`npm run web`

浏览器检查 `/api/download/state`、无题库时的 `/api/practice-chapters`、损坏题库错误提示、填空题输入、连续相同答案单选题和错题「再来一轮」。不启动真实学习通下载任务。

- [ ] **步骤 4：检查工作区边界**

运行：`git status --short`

确认 `next-env.d.ts` 仍是用户已有改动，且没有 `.xxt-profile/`、`output/`、`release/` 或个人课程资料进入提交范围。

- [ ] **步骤 5：汇总审计结果**

最终报告列出：已修复根因、测试证据、浏览器检查结果、未能离线验证的学习通线上风险和所有保留的用户改动。
