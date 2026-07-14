# 刷题模式可靠性修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复填空题无法作答、换题后选择状态残留以及错题复习无法按最新错题重新开始的问题，并建立练习模块回归测试。

**架构：** 保留现有 React 组件与练习引擎边界，在 `quiz-engine` 中按题型区分文本和选项答案归一化，并让统一会话工厂显式接收错题来源。`QuizCard` 只负责受控输入草稿与展示，`PracticeView` 在每次新一轮开始时读取当前错题本，仪表盘由父组件传入最新错题数量。

**技术栈：** TypeScript 5、React 19、Next.js 16、Base UI、Node.js `node:test`、Playwright 浏览器验证

---

## 文件结构

- 创建 `test/practice-quiz-engine.test.ts`：覆盖答案判定、会话状态与错题重建的回归行为。
- 修改 `src/practice/quiz-engine.ts`：按题型归一化答案，并让 `createSession` 支持显式错题题目来源。
- 修改 `components/practice/quiz-card.tsx`：增加填空输入，确保单选、多选和文本草稿在题目切换时保持受控并正确重置。
- 修改 `components/practice/practice-view.tsx`：每次错题新一轮都读取最新错题，并向仪表盘传递实时错题数。
- 修改 `components/practice/practice-dashboard.tsx`：使用父组件传入的错题数，移除只读取一次的本地缓存。

### 任务 1：建立练习引擎回归测试

**文件：**
- 创建：`test/practice-quiz-engine.test.ts`
- 测试：`test/practice-quiz-engine.test.ts`

- [ ] **步骤 1：编写中文填空判题失败测试**

使用 `node:test` 创建题目工厂，并断言中文答案、首尾空格和连续空格可正确比较，空白输入判错：

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  checkAnswer,
  createSession,
  createSessionFromQuestions,
  getResults,
  goToQuestion,
  nextQuestion,
  submitAnswer,
} from "../src/practice/quiz-engine.js";
import type { PracticeChapter } from "../src/practice/types.js";
import type { Question } from "../src/types.js";

function question(overrides: Partial<Question> = {}): Question {
  return {
    number: "1",
    type: "单选题",
    stem: "示例题",
    options: ["甲", "乙"],
    correctAnswer: "A",
    correctAnswerText: "甲",
    ...overrides,
  };
}

test("checkAnswer preserves Chinese text for fill-in questions", () => {
  const fill = question({
    type: "填空题",
    options: [],
    correctAnswer: "马克思主义 中国化",
    correctAnswerText: "",
  });

  assert.equal(checkAnswer(fill, "马克思主义 中国化"), true);
  assert.equal(checkAnswer(fill, "  马克思主义   中国化  "), true);
  assert.equal(checkAnswer(fill, "   "), false);
  assert.equal(checkAnswer(fill, "马克思主义"), false);
});
```

- [ ] **步骤 2：运行测试并确认中文填空测试按预期失败**

运行：`npm test -- --test-name-pattern="preserves Chinese"`

预期：FAIL；当前 `normaliseAnswer` 删除中文，错误信息显示期望 `true`、实际 `false`。

- [ ] **步骤 3：补充选择题与会话状态回归测试**

在同一文件增加以下行为：

```ts
test("checkAnswer keeps multi-select comparison order-independent and strict", () => {
  const multiple = question({ type: "多选题", correctAnswer: "AC" });
  assert.equal(checkAnswer(multiple, "C,A"), true);
  assert.equal(checkAnswer(multiple, "A"), false);
  assert.equal(checkAnswer(multiple, "ABC"), false);
});

test("submitting one question does not answer the question navigated to next", () => {
  const chapter: PracticeChapter = {
    id: "chapter-1",
    title: "第一章",
    questionCount: 2,
    path: "chapter-1.questions.json",
  };
  const chapterMap = new Map([
    [chapter.id, { chapter, questions: [question(), question({ number: "2" })] }],
  ]);
  const session = createSession(
    { mode: "chapter", chapterIds: [chapter.id], shuffle: false },
    chapterMap,
  );

  assert.equal(submitAnswer(session, 0, "A"), true);
  assert.equal(nextQuestion(session), 1);
  assert.equal(session.questions[1].userAnswer, null);
  assert.equal(goToQuestion(session, 0), true);
  assert.equal(session.questions[0].userAnswer, "A");
  const results = getResults(session);
  assert.equal(results.total, 2);
  assert.equal(results.correct, 1);
  assert.equal(results.wrong, 0);
  assert.equal(results.unanswered, 1);
  assert.equal(results.score, 50);
  assert.equal(results.questions, session.questions);
});
```

- [ ] **步骤 4：编写错题新一轮失败测试**

用同一配置依次传入一题和两题，证明工厂必须使用调用时的最新集合：

```ts
test("createSession rebuilds wrong-book rounds from the latest entries", () => {
  const config = { mode: "wrong-book", chapterIds: [], shuffle: false } as const;
  const first = { question: question(), chapterId: "chapter-1", chapterTitle: "第一章" };
  const second = {
    question: question({ number: "2" }),
    chapterId: "chapter-1",
    chapterTitle: "第一章",
  };

  assert.equal(createSession(config, new Map(), [first]).questions.length, 1);
  assert.equal(createSession(config, new Map(), [first, second]).questions.length, 2);
  assert.equal(createSessionFromQuestions([first], false).questions.length, 1);
});
```

- [ ] **步骤 5：运行测试并确认错题工厂测试因第三参数未实现而失败**

运行：`npm test -- --test-name-pattern="wrong-book rounds"`

预期：TypeScript 构建失败，指出 `createSession` 只接受两个参数；这是缺失行为导致的预期红灯。

- [ ] **步骤 6：提交测试红灯记录**

不提交无法编译的中间状态；保留测试文件，进入任务 2 完成绿灯后再提交测试与实现。

### 任务 2：按题型修复答案判定并支持最新错题建组

**文件：**
- 修改：`src/practice/quiz-engine.ts:22-55`
- 修改：`src/practice/quiz-engine.ts:61-141`
- 测试：`test/practice-quiz-engine.test.ts`

- [ ] **步骤 1：拆分选项答案与文本答案归一化**

将当前 `normaliseAnswer` 替换为两个职责明确的函数：

```ts
function normaliseChoiceAnswer(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9对错√×]/g, "");
}

function normaliseTextAnswer(raw: string): string {
  return raw.trim().replace(/[\s\u3000]+/gu, " ");
}

function isTextAnswerQuestion(question: Question): boolean {
  return question.type === "填空题" || question.options.length === 0;
}
```

`checkAnswer` 在文本题中比较 `normaliseTextAnswer` 的结果；选择题继续使用 `normaliseChoiceAnswer`，并保留多选集合比较。

- [ ] **步骤 2：扩展统一会话工厂的错题来源参数**

为 `createSession` 增加可选第三参数，并在 `wrong-book` 模式调用现有错题工厂：

```ts
type SessionQuestionSource = {
  question: Question;
  chapterId: string;
  chapterTitle: string;
};

export function createSession(
  config: PracticeConfig,
  chapterMap: Map<string, { chapter: PracticeChapter; questions: Question[] }>,
  wrongBookQuestions: SessionQuestionSource[] = [],
): PracticeSession {
  if (config.mode === "wrong-book") {
    return createSessionFromQuestions(wrongBookQuestions, config.shuffle);
  }
}
```

上面的代码展示签名和需要插入函数开头的完整守卫语句；守卫之后保留当前 `chapter` / `all` 的普通会话构造代码。把 `createSessionFromQuestions` 的参数类型改为复用 `SessionQuestionSource[]`，避免两个入口类型漂移。

- [ ] **步骤 3：运行练习引擎测试验证绿灯**

运行：`npm test -- --test-name-pattern="checkAnswer|submitting one|wrong-book rounds"`

预期：新增练习测试全部 PASS，现有测试也无失败。

- [ ] **步骤 4：提交引擎修复**

```bash
git add test/practice-quiz-engine.test.ts src/practice/quiz-engine.ts
git commit -m "fix(刷题): 修复填空判题与错题建组"
```

### 任务 3：修复题卡输入与换题残留状态

**文件：**
- 修改：`components/practice/quiz-card.tsx:3-240`
- 测试：`test/practice-quiz-engine.test.ts`

- [ ] **步骤 1：增加文本草稿并按题目身份重置**

导入 `Input`，增加文本题判断与草稿状态：

```tsx
import { Input } from "@/components/ui/input";

const isTextAnswer = question.type === "填空题" || question.options.length === 0;
const questionIdentity = `${qs.chapterId}::${question.number}`;
const [textAnswer, setTextAnswer] = useState(isTextAnswer ? (userAnswer ?? "") : "");

useEffect(() => {
  setSelectedMulti(answerMulti);
  setTextAnswer(isTextAnswer ? (userAnswer ?? "") : "");
}, [answerMulti, isTextAnswer, questionIdentity, userAnswer]);
```

- [ ] **步骤 2：保持单选组终身受控**

把单选组从：

```tsx
value={selectedForRadio || undefined}
```

改为：

```tsx
value={selectedForRadio}
```

同时让选项元素 ID 包含 `questionIdentity` 的安全派生值，避免不同章节相同题号出现重复关联。

- [ ] **步骤 3：渲染填空输入与提交按钮**

在现有多选和单选条件表达式前增加文本题分支，新增分支的完整内容为：

```tsx
(
  <Input
    value={textAnswer}
    onChange={(event) => setTextAnswer(event.target.value)}
    onKeyDown={(event) => {
      if (event.key === "Enter" && textAnswer.trim() && !showResult) {
        onAnswer(textAnswer);
      }
    }}
    placeholder="请输入答案"
    disabled={showResult}
    aria-label="填空答案"
  />
)
```

页脚未显示结果时，文本题展示提示，并提供显式提交按钮：

```tsx
{isTextAnswer && !showResult && (
  <Button
    variant="default"
    size="sm"
    disabled={!textAnswer.trim()}
    onClick={() => onAnswer(textAnswer)}
  >
    提交答案
    <ArrowRight data-icon="inline-end" />
  </Button>
)}
```

- [ ] **步骤 4：运行静态检查与练习测试**

运行：`npm run check && npm test`

预期：TypeScript 检查退出码 0；全部 Node 测试 PASS。

- [ ] **步骤 5：提交题卡修复**

```bash
git add components/practice/quiz-card.tsx
git commit -m "fix(刷题): 修复填空输入与换题状态残留"
```

### 任务 4：刷新错题来源与仪表盘计数

**文件：**
- 修改：`components/practice/practice-view.tsx:3-90`
- 修改：`components/practice/practice-dashboard.tsx:3-44`
- 测试：`test/practice-quiz-engine.test.ts`

- [ ] **步骤 1：在父组件读取当前错题来源**

从错题模块导入：

```ts
import { getWrongCount, getWrongEntriesForReview } from "@/src/practice/wrong-book";
```

增加转换辅助函数，所有错题会话入口复用同一数据形状：

```ts
function toSessionQuestions(entries: WrongEntry[]) {
  return entries.map((entry) => ({
    question: entry.question,
    chapterId: entry.chapterId,
    chapterTitle: entry.chapterTitle,
  }));
}
```

- [ ] **步骤 2：让“再来一轮”按当前错题本重新建组**

修改 `handleRestartSession`：

```ts
const handleRestartSession = useCallback(() => {
  if (view.kind !== "quiz") return;

  const wrongBookQuestions = view.session.config.mode === "wrong-book"
    ? toSessionQuestions(getWrongEntriesForReview())
    : [];
  const session = createSession(view.session.config, chapterMap, wrongBookQuestions);

  if (session.questions.length > 0) {
    setView({ kind: "quiz", session });
  } else if (view.session.config.mode === "wrong-book") {
    setView({ kind: "wrong-book" });
  }
}, [view, chapterMap]);
```

- [ ] **步骤 3：让仪表盘计数由父组件实时传入**

在 `PracticeView` 渲染仪表盘时传入：

```tsx
<PracticeDashboard
  chapters={chapters}
  wrongCount={getWrongCount()}
  onStartSession={handleStartSession}
  onViewWrongBook={() => setView({ kind: "wrong-book" })}
  loading={loading}
/>
```

在 `PracticeDashboardProps` 增加 `wrongCount: number`，删除 `getWrongCount` 导入和空依赖 `useMemo`。同时删除未使用的 `onStartWrongBookReview` 属性，保持接口只包含实际调用能力。

- [ ] **步骤 4：运行检查和全量测试**

运行：`npm run check && npm test`

预期：TypeScript 检查退出码 0；全部 Node 测试 PASS。

- [ ] **步骤 5：提交错题刷新修复**

```bash
git add components/practice/practice-view.tsx components/practice/practice-dashboard.tsx
git commit -m "fix(错题): 按最新错题刷新复习轮次"
```

### 任务 5：构建与浏览器验收

**文件：**
- 修改：仅当验证发现同一根因仍未解决时修改上述文件
- 验证：`output/*.questions.json` 只读使用，不暂存

- [ ] **步骤 1：运行仓库规定的完整验证**

依次运行：

```bash
git diff --check
npm run check
npm test
npm run build
```

预期：四条命令退出码均为 0，Node 测试零失败，Next.js 生产构建成功。

- [ ] **步骤 2：启动本地 Web 服务**

运行：`npm run web`

预期：服务监听 `http://127.0.0.1:8263`，练习 API 能读取现有本地题库。

- [ ] **步骤 3：浏览器验证填空与换题状态**

在浏览器进入“刷题练习”，使用现有题库执行：

1. 定位填空题，确认可输入、空白不可提交、正确中文答案可判定。
2. 找两道答案相同的单选题，答完第一题后切到第二题，确认没有残留选中状态且相同选项仍能触发提交。
3. 在已答题和未答题之间点击题号跳转，确认各题只显示自己的答案。

- [ ] **步骤 4：浏览器验证最新错题轮次**

制造至少两道错题后进入错题复习，完成一轮；在错题本标记或移除其中一道，再点击“再来一轮”，确认新会话题数与当前待复习错题一致。返回仪表盘，确认错题数同步更新。

- [ ] **步骤 5：审查工作区与提交边界**

运行：

```bash
git status --short
git diff --stat HEAD~3..HEAD
git log -4 --oneline
```

预期：不包含 `.xxt-profile/`、`output/` 或用户原有 `next-env.d.ts`；提交信息符合中文 Conventional Commits。
