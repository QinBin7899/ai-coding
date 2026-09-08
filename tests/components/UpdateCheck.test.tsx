import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { AboutSection } from "@/components/settings/AboutSection";
import { UpdateProvider, useUpdate } from "@/contexts/UpdateContext";
import { settingsApi } from "@/lib/api";
import { checkForUpdate } from "@/lib/updater";

vi.mock("@/lib/updater", () => ({
  checkForUpdate: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function UpdateState() {
  const { error, isChecking, hasUpdate } = useUpdate();
  return (
    <div data-testid="update-state">
      {JSON.stringify({ error, isChecking, hasUpdate })}
    </div>
  );
}

describe("update check failure details", () => {
  beforeEach(() => {
    vi.spyOn(settingsApi, "getToolVersions").mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [
      "a plugin string rejection",
      "TLS certificate rejected",
      "TLS certificate rejected",
    ],
    [
      "an Error rejection",
      new Error("Update endpoint unavailable"),
      "Update endpoint unavailable",
    ],
    [
      "a structured rejection",
      { message: "Invalid update signature" },
      "Invalid update signature",
    ],
    ["an unrecognized rejection", null, undefined],
  ])(
    "shows the reason from %s in both context and toast",
    async (_name, failure, description) => {
      vi.mocked(checkForUpdate).mockRejectedValue(failure);
      render(
        <UpdateProvider>
          <AboutSection isPortable={false} />
          <UpdateState />
        </UpdateProvider>,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "settings.checkForUpdates" }),
      );

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("settings.checkUpdateFailed", {
          description,
          closeButton: true,
        }),
      );
      expect(
        JSON.parse(screen.getByTestId("update-state").textContent!),
      ).toEqual({
        error: description ?? "检查更新失败",
        isChecking: false,
        hasUpdate: false,
      });
    },
  );
});
