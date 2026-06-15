"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleStop, FolderOpen, Loader2, Play, QrCode, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DesktopDoneResult, DesktopDownloadStatus, DesktopProgress, DesktopQrCode } from "@/src/desktop/downloader";
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
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

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

  function appendLog(message: string) {
    setLogs((current) => [...current.slice(-80), { id: Date.now() + Math.random(), message }]);
  }

  return (
    <main className="mx-auto flex w-[min(1120px,calc(100vw-48px))] flex-col gap-4 py-8">
      <section className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="w-max rounded-md border px-2 py-1 text-xs font-medium tracking-wider">XXT DL</div>
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
