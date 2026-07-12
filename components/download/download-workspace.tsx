"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleStop, Loader2, Play, QrCode, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WebDownloadSnapshot } from "@/src/web/download-task-service";

const idleState: WebDownloadSnapshot = { status: "idle", courses: [], logs: [] };
const activeStatuses = new Set(["starting", "waiting-login", "selecting-course", "collecting", "downloading"]);
const statusLabels: Record<WebDownloadSnapshot["status"], string> = {
  idle: "待开始",
  starting: "启动中",
  "waiting-login": "等待扫码",
  "selecting-course": "选择课程",
  collecting: "读取链接",
  downloading: "整理中",
  done: "已完成",
  error: "出错",
  stopped: "已停止",
};

export function DownloadWorkspace() {
  const [state, setState] = useState<WebDownloadSnapshot>(idleState);
  const [courseQuery, setCourseQuery] = useState("");
  const [limit, setLimit] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("1");
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);

  const isRunning = activeStatuses.has(state.status);
  const progressPercent = state.progress?.total
    ? Math.round((state.progress.current / state.progress.total) * 100)
    : state.done ? 100 : 0;

  const refresh = useCallback(async () => {
    try {
      const next = await requestState();
      setState(next);
      setRequestError("");
    } catch (error) {
      setRequestError(toMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, refresh]);

  useEffect(() => {
    if (state.courses.length > 0 && !state.courses.some((course) => String(course.index) === selectedCourse)) {
      setSelectedCourse(String(state.courses[0]?.index ?? 1));
    }
  }, [selectedCourse, state.courses]);

  const hint = useMemo(() => {
    if (state.status === "waiting-login") return "请用学习通 App 扫码，登录后会自动读取课程。";
    if (state.status === "selecting-course") return "选择要整理的课程后继续。";
    if (state.status === "downloading") return "正在保存作业详情并生成结构化题库。";
    if (state.status === "done") return "题库整理完成，可以切换到刷题练习。";
    return "任务在本机运行，登录态和课程内容不会上传。";
  }, [state.status]);

  async function start() {
    setRequestError("");
    try {
      setState(await postState("/api/download/start", {
        courseQuery: courseQuery.trim() || undefined,
        limit: limit ? Number(limit) : undefined,
      }));
    } catch (error) {
      setRequestError(toMessage(error));
    }
  }

  async function stop() {
    if (!state.taskId) return;
    try {
      setState(await postState("/api/download/stop", { taskId: state.taskId }));
      setRequestError("");
    } catch (error) {
      setRequestError(toMessage(error));
    }
  }

  async function chooseCourse() {
    if (!state.taskId) return;
    try {
      setState(await postState("/api/download/course", { taskId: state.taskId, course: selectedCourse }));
      setRequestError("");
    } catch (error) {
      setRequestError(toMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <Badge variant="outline">本地 Web</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">学习通作业整理</h1>
          <p className="text-sm text-muted-foreground">{loading ? "正在连接本地服务…" : hint}</p>
        </div>
        <Badge variant={state.status === "error" ? "destructive" : state.status === "done" ? "default" : "outline"}>
          {statusLabels[state.status]}
        </Badge>
      </section>

      {(requestError || state.error) && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>任务处理失败</AlertTitle>
          <AlertDescription>{requestError || state.error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <Card className="border-foreground/15 shadow-sm">
          <CardHeader>
            <CardTitle>登录与启动</CardTitle>
            <CardDescription>Playwright 在本机后台运行，首次使用需要扫码登录。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="course-query">默认课程关键词</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="course-query" className="pl-8" value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder="留空则稍后选择" disabled={isRunning} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="download-limit">最多抓取数量</Label>
                <Input id="download-limit" inputMode="numeric" value={limit} onChange={(event) => setLimit(event.target.value.replace(/\D/g, ""))} placeholder="留空为全部" disabled={isRunning} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={start} disabled={isRunning || loading}>
                {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
                开始整理
              </Button>
              <Button variant="outline" onClick={stop} disabled={!isRunning || !state.taskId}>
                <CircleStop />停止
              </Button>
              <span className="text-xs text-muted-foreground">输出保存在项目的 output 目录</span>
            </div>

            {state.courses.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                <div>
                  <div className="text-sm font-medium">选择课程</div>
                  <div className="text-xs text-muted-foreground">课程只会用于本次本地整理任务。</div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={selectedCourse} onValueChange={(value) => value && setSelectedCourse(value)}>
                    <SelectTrigger className="w-full"><SelectValue>{courseLabel(state, selectedCourse)}</SelectValue></SelectTrigger>
                    <SelectContent><SelectGroup>{state.courses.map((course) => (
                      <SelectItem key={`${course.index}-${course.href}`} value={String(course.index)}>{course.index}. {course.title || course.text}</SelectItem>
                    ))}</SelectGroup></SelectContent>
                  </Select>
                  <Button onClick={chooseCourse}>进入课程</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-foreground/15 shadow-sm">
          <CardHeader><CardTitle>扫码登录</CardTitle><CardDescription>二维码和登录状态仅保存在本机。</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-muted/30 p-4">
              {state.qr?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="size-52 max-w-full [image-rendering:pixelated]" src={state.qr.dataUrl} alt="学习通扫码登录二维码" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground"><QrCode className="size-11" /><span>开始后显示登录二维码</span></div>
              )}
            </div>
            {state.qr && <Badge variant={state.qr.expired ? "destructive" : "outline"}>{state.qr.expired ? "二维码已失效" : "等待扫码"}</Badge>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
        <Card className="border-foreground/15 shadow-sm">
          <CardHeader><CardTitle>整理进度</CardTitle><CardDescription>{state.progress?.label || (state.done ? `已整理 ${state.done.total} 个作业` : "尚未开始")}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm"><span>{progressPercent}%</span>{state.done && <CheckCircle2 className="size-5" />}</div>
            <Progress value={progressPercent} />
          </CardContent>
        </Card>
        <Card className="border-foreground/15 shadow-sm">
          <CardHeader><CardTitle>运行日志</CardTitle><CardDescription>最近 100 条本地任务事件。</CardDescription></CardHeader>
          <CardContent>
            <ScrollArea className="h-44 rounded-lg border bg-muted/20 p-3">
              {state.logs.length === 0 ? <span className="text-sm text-muted-foreground">暂无日志</span> : (
                <div className="flex flex-col gap-2 pr-3 font-mono text-xs leading-relaxed">{state.logs.map((log) => <p key={log.id}>{log.message}</p>)}</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

async function requestState(): Promise<WebDownloadSnapshot> {
  const response = await fetch("/api/download/state", { cache: "no-store" });
  return parseResponse(response);
}

async function postState(url: string, body: unknown): Promise<WebDownloadSnapshot> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return parseResponse(response);
}

async function parseResponse(response: Response): Promise<WebDownloadSnapshot> {
  const payload = await response.json() as { state?: WebDownloadSnapshot; error?: string };
  if (!response.ok || !payload.state) throw new Error(payload.error || "本地服务请求失败。");
  return payload.state;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "本地服务请求失败。";
}

function courseLabel(state: WebDownloadSnapshot, selectedCourse: string): string {
  const course = state.courses.find((item) => String(item.index) === selectedCourse);
  return course ? `${course.index}. ${course.title || course.text}` : "选择课程";
}
