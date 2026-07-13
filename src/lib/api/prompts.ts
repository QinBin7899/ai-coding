import { invoke } from "@tauri-apps/api/core";
import type { AppId } from "./types";

export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  enabled: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface MemorySyncTargetInfo {
  id: string;
  label: string;
  path: string;
  exists: boolean;
}

export interface MemorySyncOverview {
  sourcePath: string;
  sourceExists: boolean;
  targets: MemorySyncTargetInfo[];
}

export interface MemorySyncResult {
  syncedCount: number;
  targets: MemorySyncTargetInfo[];
}

export const promptsApi = {
  async getPrompts(app: AppId): Promise<Record<string, Prompt>> {
    return await invoke("get_prompts", { app });
  },

  async upsertPrompt(app: AppId, id: string, prompt: Prompt): Promise<void> {
    return await invoke("upsert_prompt", { app, id, prompt });
  },

  async deletePrompt(app: AppId, id: string): Promise<void> {
    return await invoke("delete_prompt", { app, id });
  },

  async enablePrompt(app: AppId, id: string): Promise<void> {
    return await invoke("enable_prompt", { app, id });
  },

  async importFromFile(app: AppId): Promise<string> {
    return await invoke("import_prompt_from_file", { app });
  },

  async getCurrentFileContent(app: AppId): Promise<string | null> {
    return await invoke("get_current_prompt_file_content", { app });
  },

  async getMemorySyncOverview(): Promise<MemorySyncOverview> {
    return await invoke("get_memory_sync_overview");
  },

  async syncMemoryFiles(targetIds: string[]): Promise<MemorySyncResult> {
    return await invoke("sync_memory_files", { targetIds });
  },
};
