import { useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "ai-coding-session-organizer";

interface OrganizerState {
  pinned: string[];
  archived: string[];
}

const emptyState = (): OrganizerState => ({ pinned: [], archived: [] });

const sanitizeKeys = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const readState = (): OrganizerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<OrganizerState>;
    return {
      pinned: sanitizeKeys(parsed.pinned),
      archived: sanitizeKeys(parsed.archived),
    };
  } catch {
    return emptyState();
  }
};

const writeState = (state: OrganizerState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可用时静默降级为仅内存状态
  }
};

/**
 * 会话置顶 / 归档状态管理。
 * 状态持久化在 localStorage，key 为会话的 getSessionKey 结果。
 */
export function useSessionOrganizer() {
  const [state, setState] = useState<OrganizerState>(readState);

  const pinnedKeys = useMemo(() => new Set(state.pinned), [state.pinned]);
  const archivedKeys = useMemo(() => new Set(state.archived), [state.archived]);

  const pinnedOrder = useCallback(
    (key: string) => state.pinned.indexOf(key),
    [state.pinned],
  );

  const update = useCallback(
    (updater: (current: OrganizerState) => OrganizerState) => {
      setState((current) => {
        const next = updater(current);
        if (next === current) return current;
        writeState(next);
        return next;
      });
    },
    [],
  );

  const togglePin = useCallback(
    (key: string) => {
      update((current) =>
        current.pinned.includes(key)
          ? { ...current, pinned: current.pinned.filter((k) => k !== key) }
          : { ...current, pinned: [...current.pinned, key] },
      );
    },
    [update],
  );

  const toggleArchive = useCallback(
    (key: string) => {
      update((current) =>
        current.archived.includes(key)
          ? { ...current, archived: current.archived.filter((k) => k !== key) }
          : {
              ...current,
              archived: [...current.archived, key],
              // 归档时同时移除置顶，避免归档列表里残留置顶状态
              pinned: current.pinned.filter((k) => k !== key),
            },
      );
    },
    [update],
  );

  // 会话被删除后清掉残留的置顶/归档记录
  const pruneMissing = useCallback(
    (validKeys: Set<string>) => {
      update((current) => {
        const pinned = current.pinned.filter((key) => validKeys.has(key));
        const archived = current.archived.filter((key) => validKeys.has(key));
        if (
          pinned.length === current.pinned.length &&
          archived.length === current.archived.length
        ) {
          return current;
        }
        return { pinned, archived };
      });
    },
    [update],
  );

  return {
    pinnedKeys,
    archivedKeys,
    pinnedOrder,
    togglePin,
    toggleArchive,
    pruneMissing,
  };
}
