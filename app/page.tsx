"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleStop,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  Play,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DesktopDoneResult, DesktopDownloadStatus, DesktopProgress, DesktopQrCode } from "@/src/desktop/downloader";
import { parseReleaseInline, parseReleaseMarkdown } from "@/src/desktop/release-markdown";
import type { ReleaseMarkdownBlock } from "@/src/desktop/release-markdown";
import type { DesktopUpdatePhase, DesktopUpdateState } from "@/src/desktop/update-state";
import type { CourseEntry } from "@/src/types";

type LogEntry = {
  id: number;
  message: string;
};

const statusLabels: Record<DesktopDownloadStatus, string> = {
  idle: "待开始",
  starting: "启动中",
  "waiting-login": "等待扫码",
  "selecting-course": "选择课程",
  collecting: "读取链接",
  downloading: "下载中",
  done: "已完成",
  error: "出错",
  stopped: "已停止",
};

const updateStatusLabels: Record<DesktopUpdatePhase, string> = {
  idle: "待检查",
  checking: "检查中",
  available: "有新版本",
  "not-available": "已是最新",
  downloading: "下载中",
  downloaded: "待安装",
  error: "更新出错",
  unsupported: "不可用",
};

const autoCheckUpdatesStorageKey = "xxt-dl:auto-check-updates";
const allowPrereleaseStorageKey = "xxt-dl:allow-prerelease-updates";

export default function Home() {
  const [status, setStatus] = useState<DesktopDownloadStatus>("idle");
  const [qr, setQr] = useState<DesktopQrCode | undefined>();
  const [courses, setCourses] = useState<CourseEntry[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("1");
  const [courseQuery, setCourseQuery] = useState("");
  const [limit, setLimit] = useState("");
  const [progress, setProgress] = useState<DesktopProgress | undefined>();
  const [done, setDone] = useState<DesktopDoneResult | undefined>();
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [updateState, setUpdateState] = useState<DesktopUpdateState | undefined>();
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true);
  const [allowPrerelease, setAllowPrerelease] = useState(false);
  const [updateSettingsLoaded, setUpdateSettingsLoaded] = useState(false);
  const [versionCardOpen, setVersionCardOpen] = useState(false);
  const startupUpdateCheckStarted = useRef(false);

  const isRunning = ["starting", "waiting-login", "selecting-course", "collecting", "downloading"].includes(status);
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  useEffect(() => {
    const api = window.xxt;
    const unsubs = [
      api.onStatus(setStatus),
      api.onQr(setQr),
      api.onCourses((items) => {
        setCourses(items);
        setSelectedCourse("1");
      }),
      api.onProgress(setProgress),
      api.onDone((result) => {
        setDone(result);
        appendLog(`完成：已整理 ${result.total} 个作业。`);
      }),
      api.onError((message) => {
        setError(message);
        appendLog(`错误：${message}`);
      }),
      api.onLog(appendLog),
      api.onUpdateState(setUpdateState),
    ];

    void api.getUpdateState().then(setUpdateState);

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    setAutoCheckUpdates(readStoredBoolean(autoCheckUpdatesStorageKey, true));
    setAllowPrerelease(readStoredBoolean(allowPrereleaseStorageKey, false));
    setUpdateSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!updateSettingsLoaded) {
      return;
    }

    window.localStorage.setItem(autoCheckUpdatesStorageKey, String(autoCheckUpdates));
  }, [autoCheckUpdates, updateSettingsLoaded]);

  useEffect(() => {
    if (!updateSettingsLoaded) {
      return;
    }

    window.localStorage.setItem(allowPrereleaseStorageKey, String(allowPrerelease));
  }, [allowPrerelease, updateSettingsLoaded]);

  useEffect(() => {
    if (
      !updateSettingsLoaded ||
      !autoCheckUpdates ||
      startupUpdateCheckStarted.current ||
      !updateState?.canCheck ||
      updateState.phase !== "idle"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      startupUpdateCheckStarted.current = true;
      void checkUpdate(allowPrerelease);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [allowPrerelease, autoCheckUpdates, updateSettingsLoaded, updateState?.canCheck, updateState?.phase]);

  const primaryHint = useMemo(() => {
    if (status === "waiting-login") {
      return "用学习通 App 扫码登录，登录完成后会自动读取课程。";
    }

    if (status === "selecting-course") {
      return "选择课程后会自动进入课程作业页。";
    }

    if (status === "downloading") {
      return "正在保存作业详情和整理题库。";
    }

    if (status === "done") {
      return "题库整理完成，可以打开 output 查看结果。";
    }

    return "点击开始后，后台会隐藏浏览器并等待扫码登录。";
  }, [status]);

  async function startDownload() {
    setError("");
    setDone(undefined);
    setCourses([]);
    setQr(undefined);
    setProgress(undefined);
    setLogs([]);
    await window.xxt.startDownload({
      courseQuery: courseQuery.trim() || undefined,
      limit: limit.trim() ? Number(limit) : undefined,
    });
  }

  async function stopDownload() {
    await window.xxt.stopDownload();
    setStatus("stopped");
  }

  async function submitCourse() {
    await window.xxt.selectCourse(selectedCourse);
  }

  async function checkUpdate(allowPrerelease = false) {
    const state = await window.xxt.checkForUpdates({ allowPrerelease });
    setUpdateState(state);
  }

  async function downloadUpdate() {
    const state = await window.xxt.downloadUpdate();
    setUpdateState(state);
  }

  async function installUpdate() {
    await window.xxt.installUpdate();
  }

  function appendLog(message: string) {
    setLogs((current) => [...current.slice(-80), { id: Date.now() + Math.random(), message }]);
  }

  return (
    <main className="mx-auto flex w-[min(1120px,calc(100vw-48px))] flex-col gap-4 py-8">
      <section className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex w-max items-center overflow-hidden rounded-md border bg-background text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="查看版本更新"
            aria-haspopup="dialog"
            aria-expanded={versionCardOpen}
            onClick={() => setVersionCardOpen(true)}
          >
            <span className="px-2 py-1 tracking-wider">XXT DL</span>
            <span className="border-l bg-muted/40 px-2 py-1 text-muted-foreground">{updateState?.currentVersion || "版本读取中"}</span>
          </button>
          <h1 className="text-4xl font-semibold tracking-normal">学习通作业整理</h1>
          <p className="text-sm text-muted-foreground">{primaryHint}</p>
        </div>
        <Badge variant={status === "error" ? "destructive" : status === "done" ? "default" : "outline"}>
          {statusLabels[status]}
        </Badge>
      </section>

      <section className="grid grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] gap-4">
        <Card className="border-foreground/15 shadow-sm">
          <CardHeader>
            <CardTitle>登录与启动</CardTitle>
            <CardDescription>扫码登录后，任务会在隐藏浏览器中继续运行。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3">
              <label className="flex flex-col gap-2 text-sm font-medium">
                默认课程关键词
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={courseQuery}
                    onChange={(event) => setCourseQuery(event.target.value)}
                    placeholder="留空则稍后手动选择"
                    disabled={isRunning}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                最多抓取数量
                <Input
                  value={limit}
                  onChange={(event) => setLimit(event.target.value.replace(/\D/g, ""))}
                  placeholder="留空为全部"
                  disabled={isRunning}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={startDownload} disabled={isRunning}>
                {isRunning ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Play data-icon="inline-start" />}
                开始
              </Button>
              <Button variant="outline" onClick={stopDownload} disabled={!isRunning}>
                <CircleStop data-icon="inline-start" />
                停止
              </Button>
              <Button variant="ghost" onClick={() => window.xxt.openOutput()}>
                <FolderOpen data-icon="inline-start" />
                打开输出
              </Button>
            </div>

            {courses.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
                <div>
                  <div className="text-sm font-medium">选择课程</div>
                  <div className="text-sm text-muted-foreground">直接选择序号，或输入关键词继续匹配。</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedCourse} onValueChange={(value) => value && setSelectedCourse(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择课程">
                        {courseLabel(courses, selectedCourse)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {courses.map((course) => (
                          <SelectItem key={`${course.index}-${course.href}`} value={String(course.index)}>
                            {courseLabel([course], String(course.index))}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button onClick={submitCourse}>进入课程</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-foreground/15 shadow-sm">
          <CardHeader>
            <CardTitle>扫码登录</CardTitle>
            <CardDescription>二维码只保存在本地 output 目录，不会进入 Git。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-muted/30">
              {qr?.dataUrl ? (
                <img className="size-56 [image-rendering:pixelated]" src={qr.dataUrl} alt="学习通扫码登录二维码" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <QrCode className="size-11" />
                  <span>等待登录页二维码</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="truncate">{qr?.uuid ? `uuid: ${qr.uuid}` : "尚未检测到二维码"}</span>
              {qr?.expired ? <Badge variant="destructive">已失效</Badge> : qr ? <Badge>可扫码</Badge> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)] gap-4">
        <Card className="border-foreground/15 shadow-sm">
          <CardHeader>
            <CardTitle>获取情况</CardTitle>
            <CardDescription>当前作业下载进度。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="truncate">{progress ? progress.label : done ? `完成 ${done.total} 个作业` : "尚未开始下载作业"}</span>
              <strong className="shrink-0 text-foreground">
                {progress ? `${progress.current}/${progress.total}` : done ? <CheckCircle2 /> : "0%"}
              </strong>
            </div>
            <Progress value={progressPercent} />
          </CardContent>
        </Card>

        <Card className="border-foreground/15 shadow-sm">
          <CardHeader>
            <CardTitle>运行日志</CardTitle>
            <CardDescription>{error || "最近的后台事件。"}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-44 rounded-lg border bg-muted/20 p-3">
              {logs.length === 0 ? (
                <span className="text-sm text-muted-foreground">暂无日志</span>
              ) : (
                <div className="flex flex-col gap-2 font-mono text-xs leading-relaxed">
                  {logs.map((log) => (
                    <p key={log.id}>{log.message}</p>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      {versionCardOpen ? (
        <VersionUpdateModal
          updateState={updateState}
          allowPrerelease={allowPrerelease}
          autoCheckUpdates={autoCheckUpdates}
          onAllowPrereleaseChange={setAllowPrerelease}
          onAutoCheckUpdatesChange={setAutoCheckUpdates}
          onCheckUpdate={() => checkUpdate(allowPrerelease)}
          onClose={() => setVersionCardOpen(false)}
          onDownloadUpdate={downloadUpdate}
          onInstallUpdate={installUpdate}
        />
      ) : null}
    </main>
  );
}

function courseLabel(courses: CourseEntry[], selectedCourse: string): string {
  const course = courses.find((item) => String(item.index) === selectedCourse);
  if (!course) {
    return selectedCourse;
  }

  return `${course.index}. ${course.title || course.text}`;
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isCheckingUpdate(updateState: DesktopUpdateState | undefined): boolean {
  return !updateState?.canCheck || updateState.phase === "checking";
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  const value = window.localStorage.getItem(key);

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function VersionUpdateModal({
  updateState,
  allowPrerelease,
  autoCheckUpdates,
  onAllowPrereleaseChange,
  onAutoCheckUpdatesChange,
  onCheckUpdate,
  onClose,
  onDownloadUpdate,
  onInstallUpdate,
}: {
  updateState: DesktopUpdateState | undefined;
  allowPrerelease: boolean;
  autoCheckUpdates: boolean;
  onAllowPrereleaseChange: (checked: boolean) => void;
  onAutoCheckUpdatesChange: (checked: boolean) => void;
  onCheckUpdate: () => void;
  onClose: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
}) {
  const updateProgressPercent = updateState?.progress ? Math.round(updateState.progress.percent) : 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-6 backdrop-blur-sm [animation:xxt-modal-backdrop-in_140ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-update-title"
      onClick={onClose}
    >
      <Card
        className="max-h-[calc(100vh-48px)] w-[min(720px,calc(100vw-48px))] border-foreground/15 shadow-xl [animation:xxt-version-card-in_180ms_cubic-bezier(.2,.8,.2,1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle id="version-update-title">版本更新</CardTitle>
              <CardDescription>{updateState?.message || "检查 GitHub Releases 上发布的新版本和更新说明。"}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {updateState ? (
                <Badge
                  variant={
                    updateState.phase === "error"
                      ? "destructive"
                      : updateState.phase === "available" || updateState.phase === "downloaded"
                        ? "default"
                        : "outline"
                  }
                >
                  {updateStatusLabels[updateState.phase]}
                </Badge>
              ) : null}
              <Button variant="ghost" size="icon" aria-label="关闭版本更新" onClick={onClose}>
                <X />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <section className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-muted-foreground">当前版本</div>
                <Button variant="ghost" size="icon-sm" title="前往 Release 页面" aria-label="前往 Release 页面" onClick={() => window.xxt.openReleasePage()}>
                  <ExternalLink />
                </Button>
              </div>
              <div className="mt-2 font-medium">{updateState?.currentVersion || "读取中"}</div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-muted-foreground">最新版本</div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={allowPrerelease ? "检查含预发布" : "检查稳定版"}
                  aria-label={allowPrerelease ? "检查含预发布" : "检查稳定版"}
                  onClick={onCheckUpdate}
                  disabled={isCheckingUpdate(updateState)}
                >
                  {updateState?.phase === "checking" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                </Button>
              </div>
              <div className="mt-2 font-medium">{updateState?.availableVersion || (updateState?.phase === "checking" ? "检查中" : "暂无")}</div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <SwitchSetting
              label="自动检查更新"
              description="打开应用后自动检查一次"
              checked={autoCheckUpdates}
              onCheckedChange={onAutoCheckUpdatesChange}
            />
            <SwitchSetting
              label="包含预发布版本"
              description="检查时允许 beta / rc release"
              checked={allowPrerelease}
              onCheckedChange={onAllowPrereleaseChange}
            />
          </section>

          {updateState?.canDownload ? (
            <section className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">发现新版本</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{updateState.availableVersion} 可下载更新。</div>
              </div>
              <Button onClick={onDownloadUpdate}>
                <Download data-icon="inline-start" />
                下载更新
              </Button>
            </section>
          ) : null}

          {updateState?.phase === "error" ? (
            <section className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-destructive">检查更新失败</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {updateState.error || updateState.message || "请检查网络连接，或稍后重试。"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">可以稍后重试，或前往 Release 页面手动下载安装包。</div>
              </div>
              <Button variant="outline" onClick={onCheckUpdate} disabled={isCheckingUpdate(updateState)}>
                <RefreshCw data-icon="inline-start" />
                重试检查
              </Button>
            </section>
          ) : null}

          {updateState?.phase === "downloading" ? (
            <section className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>下载进度</span>
                <strong className="text-foreground">{updateProgressPercent}%</strong>
              </div>
              <Progress value={updateProgressPercent} />
            </section>
          ) : null}

          {updateState?.canInstall ? (
            <section className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">更新已准备好</div>
                <div className="mt-0.5 text-xs text-muted-foreground">重启应用后安装新版本。</div>
              </div>
              <Button onClick={onInstallUpdate}>
                <RotateCcw data-icon="inline-start" />
                重启安装
              </Button>
            </section>
          ) : null}

          <section className="flex min-h-56 flex-col gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{updateState?.releaseName || "更新说明"}</span>
              <span className="shrink-0 text-muted-foreground">{formatDateTime(updateState?.releaseDate)}</span>
            </div>
            <ScrollArea className="h-52">
              {updateState?.releaseNotes ? (
                <MarkdownNotes markdown={updateState.releaseNotes} />
              ) : (
                <span className="text-sm text-muted-foreground">检查到新版本后会在这里显示 changelog。</span>
              )}
            </ScrollArea>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function SwitchSetting({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          checked ? "border-primary bg-primary" : "border-border bg-muted",
        )}
        onClick={() => onCheckedChange(!checked)}
      >
        <span
          className={cn(
            "absolute top-1/2 left-0.5 size-5 -translate-y-1/2 rounded-full bg-background shadow-sm transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

function MarkdownNotes({ markdown }: { markdown: string }) {
  const blocks = parseReleaseMarkdown(markdown);

  return (
    <div className="pr-3 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = block.level === 2 ? "h3" : "h4";
          return (
            <HeadingTag key={index} className="mt-3 first:mt-0 font-semibold text-foreground">
              {renderInlineMarkdown(block.text)}
            </HeadingTag>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="mt-2 list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "table") {
          return <MarkdownTable key={index} block={block} />;
        }

        return (
          <p key={index} className="mt-2 first:mt-0">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function MarkdownTable({ block }: { block: Extract<ReleaseMarkdownBlock, { type: "table" }> }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border bg-background">
      <table className="w-full min-w-max border-collapse text-left text-xs">
        <thead className="bg-muted/70 text-foreground">
          <tr>
            {block.headers.map((header, index) => (
              <th key={`${header}-${index}`} className="border-b px-3 py-2 font-medium">
                {renderInlineMarkdown(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-b-0">
              {block.headers.map((_, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top">
                  {renderInlineMarkdown(row[cellIndex] || "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  return parseReleaseInline(text).map((node, index) => {
    if (node.type === "strong") {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {node.text}
        </strong>
      );
    }

    if (node.type === "code") {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
          {node.text}
        </code>
      );
    }

    if (node.type === "link") {
      return (
        <a
          key={index}
          className="break-all font-medium text-foreground underline underline-offset-2"
          href={node.href}
          target="_blank"
          rel="noreferrer"
        >
          {node.text}
        </a>
      );
    }

    return node.text;
  });
}
