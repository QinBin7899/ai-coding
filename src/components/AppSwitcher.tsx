import { useMemo, useRef, useState } from "react";
import type { AppId } from "@/lib/api";
import type { VisibleApps } from "@/types";
import { ProviderIcon } from "@/components/ProviderIcon";
import { cn } from "@/lib/utils";
import { Monitor, Terminal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DockAppId = AppId | "bincode";

const APP_BADGE_ICON: Partial<
  Record<DockAppId, { icon: typeof Terminal; offsetY?: number }>
> = {
  claude: { icon: Terminal },
  "claude-desktop": { icon: Monitor, offsetY: 0.5 },
};

interface AppSwitcherProps {
  activeApp: DockAppId;
  onSwitch: (app: DockAppId) => void;
  visibleApps?: VisibleApps;
}

const ALL_APPS: DockAppId[] = [
  "claude",
  "claude-desktop",
  "codex",
  "gemini",
  "opencode",
  "bincode",
  "openclaw",
  "hermes",
];
const STORAGE_KEY = "cc-switch-last-app";

export function AppSwitcher({
  activeApp,
  onSwitch,
  visibleApps,
}: AppSwitcherProps) {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleSwitch = (app: DockAppId) => {
    if (app === activeApp) return;
    localStorage.setItem(STORAGE_KEY, app);
    onSwitch(app);
  };

  const appIconName: Record<DockAppId, string> = {
    claude: "claude",
    "claude-desktop": "claude",
    codex: "openai",
    gemini: "gemini",
    opencode: "opencode",
    bincode: "bincode",
    openclaw: "openclaw",
    hermes: "hermes",
  };
  const appDisplayName: Record<DockAppId, string> = {
    claude: "Claude Code",
    "claude-desktop": "Claude Desktop",
    codex: "Codex",
    gemini: "Gemini",
    opencode: "OpenCode",
    bincode: "bincode",
    openclaw: "OpenClaw",
    hermes: "Hermes",
  };

  const appsToShow = ALL_APPS.filter((app) => {
    if (!visibleApps) return true;
    return visibleApps[app];
  });

  const scales = useMemo(() => {
    return Object.fromEntries(
      appsToShow.map((app) => {
        if (mouseX === null) return [app, 1];
        const element = buttonRefs.current[app];
        if (!element) return [app, 1];
        const rect = element.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const distance = Math.abs(mouseX - center);
        const influence = Math.max(0, 1 - distance / 140);
        return [app, 1 + influence * 0.42];
      }),
    ) as Record<DockAppId, number>;
  }, [appsToShow, mouseX]);

  return (
    <TooltipProvider delayDuration={180}>
      <div
        className="flex items-end gap-2 overflow-visible"
        onMouseMove={(event) => setMouseX(event.clientX)}
        onMouseLeave={() => setMouseX(null)}
      >
        {appsToShow.map((app) => {
          const badgeConfig = APP_BADGE_ICON[app];
          const BadgeIcon = badgeConfig?.icon;
          const isActive = activeApp === app;
          const scale = scales[app] ?? 1;
          const iconSize = Math.round(28 * scale);
          const width = Math.round(60 + (scale - 1) * 44);
          return (
            <Tooltip key={app}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  title={appDisplayName[app]}
                  aria-label={appDisplayName[app]}
                  ref={(node) => {
                    buttonRefs.current[app] = node;
                  }}
                  onClick={() => handleSwitch(app)}
                  className={cn(
                    "group relative flex h-14 items-center justify-center rounded-[20px] border border-transparent transition-all duration-150 ease-out focus-visible:outline-none",
                    isActive
                      ? "bg-[rgba(232,214,196,0.58)] shadow-[0_10px_20px_rgba(255,140,56,0.12)]"
                      : "bg-transparent",
                  )}
                  style={{
                    width,
                    transform: `translateY(${(1 - scale) * 14}px) scale(${scale})`,
                  }}
                >
                  <span className="relative inline-flex shrink-0">
                    <ProviderIcon
                      icon={appIconName[app]}
                      name={appDisplayName[app]}
                      size={iconSize}
                      className={isActive ? "drop-shadow-sm" : undefined}
                      disableTitle
                    />
                    {BadgeIcon && (
                      <span
                        className={cn(
                          "absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-[4px]",
                          isActive
                            ? "bg-white/90 text-slate-900"
                            : "bg-black/40 text-white/80 group-hover:bg-white/80 group-hover:text-slate-900",
                        )}
                        aria-hidden="true"
                      >
                        <BadgeIcon
                          className="h-[9px] w-[9px]"
                          strokeWidth={2.5}
                          style={
                            badgeConfig?.offsetY
                              ? { transform: `translateY(${badgeConfig.offsetY}px)` }
                              : undefined
                          }
                        />
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-2 h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(255,140,56,0.45)]" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={12}>
                {appDisplayName[app]}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
