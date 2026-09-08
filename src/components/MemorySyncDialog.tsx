import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { promptsApi } from "@/lib/api";
import { extractErrorMessage } from "@/utils/errorUtils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MemorySyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemorySyncDialog({
  open,
  onOpenChange,
}: MemorySyncDialogProps) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof promptsApi.getMemorySyncOverview>
  > | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadOverview = async () => {
    setIsLoading(true);
    try {
      const data = await promptsApi.getMemorySyncOverview();
      setOverview(data);
      setSelectedTargets((current) => {
        const next = { ...current };
        for (const target of data.targets) {
          if (!(target.id in next)) {
            next[target.id] = true;
          }
        }
        return next;
      });
    } catch (error) {
      toast.error(
        extractErrorMessage(error) ||
          t("memorySync.loadFailed", {
            defaultValue: "读取记忆同步状态失败",
          }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadOverview();
    }
  }, [open]);

  const handleSync = async () => {
    if (!overview) return;
    if (!overview.sourceExists) {
      toast.error(
        t("memorySync.sourceMissing", {
          defaultValue: "没有找到 Claude Code 的 CLAUDE.md，暂时无法同步",
        }),
      );
      return;
    }
    const enabledTargetIds = overview.targets
      .filter((target) => selectedTargets[target.id] ?? true)
      .map((target) => target.id);

    if (enabledTargetIds.length === 0) {
      toast.error(
        t("memorySync.selectTarget", {
          defaultValue: "请至少保留一个同步目标",
        }),
      );
      return;
    }

    setIsSyncing(true);
    try {
      const result = await promptsApi.syncMemoryFiles(enabledTargetIds);
      toast.success(
        t("memorySync.syncSuccess", {
          defaultValue: "已同步到 {{count}} 个目标",
          count: result.syncedCount,
        }),
      );
      await loadOverview();
    } catch (error) {
      toast.error(
        extractErrorMessage(error) ||
          t("memorySync.syncFailed", {
            defaultValue: "记忆同步失败",
          }),
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-190px)] w-[calc(100vw-32px)] max-w-[680px] overflow-hidden rounded-[24px] border border-white/10 bg-[#161618]/95 p-0 text-foreground shadow-2xl shadow-black/45 backdrop-blur-2xl">
        <DialogHeader className="border-white/5 bg-transparent px-6 py-5">
          <DialogTitle className="text-[22px] font-semibold">
            {t("memorySync.title", {
              defaultValue: "跨工具记忆同步",
            })}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("memorySync.description", {
              defaultValue: "一键将 Claude Code 记忆推送到其他编程工具",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5">
          <div className="rounded-[20px] border border-white/10 bg-card/70 p-4">
            <div className="mb-2 text-sm font-medium text-primary">
              {t("memorySync.sourceFile", {
                defaultValue: "源文件",
              })}
            </div>
            <div className="text-base font-semibold">Claude Code</div>
            <div className="mt-1 break-all text-sm text-muted-foreground">
              {overview?.sourcePath ?? "~/.claude/CLAUDE.md"}
            </div>
            <div className="mt-3 text-sm">
              {isLoading ? (
                <span className="text-muted-foreground">
                  {t("common.loading")}
                </span>
              ) : overview?.sourceExists ? (
                <span className="text-primary">
                  {t("memorySync.sourceReady", {
                    defaultValue: "已检测到源记忆文件，可以同步",
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("memorySync.sourceMissing", {
                    defaultValue: "未找到 ~/.claude/CLAUDE.md，请先创建",
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">
                {t("memorySync.targets", {
                  defaultValue: "同步到",
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadOverview()}
                disabled={isLoading || isSyncing}
                className="gap-2 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <RefreshCw
                  className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                />
                {t("common.refresh")}
              </Button>
            </div>

            <div className="space-y-3 pr-1">
              {isLoading && !overview ? (
                <div className="flex items-center justify-center rounded-[20px] border border-white/6 bg-card/70 py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : !overview?.targets?.length ? (
                <div className="rounded-[20px] border border-dashed border-white/10 bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
                  {t("memorySync.noTargets", {
                    defaultValue: "暂时没有可同步的目标工具",
                  })}
                </div>
              ) : (
                overview?.targets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-center justify-between gap-4 rounded-[20px] border border-primary/10 bg-card/65 px-5 py-4 transition-colors hover:border-primary/25"
                  >
                    <div className="min-w-0">
                      <div className="text-xl font-semibold">
                        {target.label}
                      </div>
                      <div className="mt-1 break-all text-sm text-muted-foreground">
                        {target.path}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {target.exists
                          ? t("memorySync.targetExists", {
                              defaultValue: "已存在，将直接覆盖同步",
                            })
                          : t("memorySync.targetWillCreate", {
                              defaultValue: "首次同步时会自动创建",
                            })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Switch
                        checked={selectedTargets[target.id] ?? true}
                        onCheckedChange={(checked) =>
                          setSelectedTargets((current) => ({
                            ...current,
                            [target.id]: checked,
                          }))
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {target.exists
                          ? t("memorySync.ready", {
                              defaultValue: "可覆盖同步",
                            })
                          : t("memorySync.createOnSync", {
                              defaultValue: "同步时创建",
                            })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-white/5 bg-[#161618]/98 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
            className="rounded-xl"
          >
            {t("common.close", { defaultValue: "关闭" })}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSync()}
            disabled={isLoading || isSyncing}
            className="gap-2 rounded-xl px-5"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {t("memorySync.syncNow", {
              defaultValue: "一键同步全部",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
