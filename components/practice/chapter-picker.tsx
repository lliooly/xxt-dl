"use client";

import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PracticeChapter } from "@/src/practice/types";

interface ChapterPickerProps {
  chapters: PracticeChapter[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ChapterPicker({
  chapters,
  selectedIds,
  onSelectionChange,
  onConfirm,
  onCancel,
}: ChapterPickerProps) {
  const allSelected = chapters.length > 0 && selectedIds.length === chapters.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(chapters.map((c) => c.id));
    }
  }

  function toggleOne(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">选择章节</div>
        <Button variant="link" size="xs" onClick={toggleAll}>
          {allSelected ? "取消全选" : "全选"}
        </Button>
      </div>

      {chapters.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
          暂无可用的章节题库
        </div>
      ) : (
        <ScrollArea className="max-h-64">
          <div className="flex flex-col gap-1 pr-3">
            {chapters.map((ch) => {
              const isSelected = selectedIds.includes(ch.id);
              return (
                <Label
                  key={ch.id}
                  htmlFor={`chapter-${ch.id}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    isSelected
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent bg-muted/20 hover:bg-muted/40",
                  )}
                >
                  <Checkbox id={`chapter-${ch.id}`} checked={isSelected} onCheckedChange={() => toggleOne(ch.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{ch.title}</div>
                    <div className="text-xs text-muted-foreground">{ch.questionCount} 道题</div>
                  </div>
                </Label>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {allSelected ? (
            <span className="inline-flex items-center gap-1">
              <CheckIcon className="size-3" />已选择全部 {chapters.length} 个章节
            </span>
          ) : someSelected ? (
            `已选择 ${selectedIds.length}/${chapters.length} 个章节`
          ) : (
            "未选择任何章节"
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            返回
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={selectedIds.length === 0}>
            开始刷题
          </Button>
        </div>
      </div>
    </div>
  );
}
