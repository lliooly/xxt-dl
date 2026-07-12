"use client";

import { Download, GraduationCap } from "lucide-react";

import { DownloadWorkspace } from "@/components/download/download-workspace";
import { PracticeView } from "@/components/practice/practice-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Tabs defaultValue="download" className="gap-6">
        <TabsList aria-label="主要功能">
          <TabsTrigger value="download"><Download data-icon="inline-start" />作业整理</TabsTrigger>
          <TabsTrigger value="practice"><GraduationCap data-icon="inline-start" />刷题练习</TabsTrigger>
        </TabsList>
        <TabsContent value="download"><DownloadWorkspace /></TabsContent>
        <TabsContent value="practice"><PracticeView /></TabsContent>
      </Tabs>
    </main>
  );
}
