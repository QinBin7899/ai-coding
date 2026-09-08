import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommonConfigEditor } from "@/components/providers/forms/CommonConfigEditor";

vi.mock("@/components/common/FullScreenPanel", () => ({
  FullScreenPanel: ({
    isOpen,
    title,
    onClose,
    children,
    footer,
  }: {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="common-config-panel">
        <button type="button" onClick={onClose}>
          panel-close
        </button>
        <h2>{title}</h2>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

vi.mock("@/components/JsonEditor", () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

function renderEditor(
  value: string,
  onChange = vi.fn(),
  isModalOpen = false,
) {
  render(
    <CommonConfigEditor
      value={value}
      onChange={onChange}
      useCommonConfig={false}
      onCommonConfigToggle={() => {}}
      commonConfigSnippet="{}"
      onCommonConfigSnippetChange={() => {}}
      commonConfigError=""
      onEditClick={() => {}}
      isModalOpen={isModalOpen}
      onModalClose={() => {}}
    />,
  );
  return onChange;
}

const effortCheckbox = () =>
  screen.getByRole("checkbox", { name: "claudeConfig.effortMax" });

describe("CommonConfigEditor accessibility", () => {
  it("names both JSON editors", () => {
    renderEditor("{}", vi.fn(), true);

    expect(
      screen.getByRole("textbox", { name: "provider.configJson" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: "claudeConfig.editCommonConfigTitle",
      }),
    ).toBeInTheDocument();
  });
});

describe("CommonConfigEditor max effort toggle", () => {
  it("does not treat legacy top-level effortLevel=max as checked", () => {
    renderEditor(JSON.stringify({ effortLevel: "max" }, null, 2));

    expect(effortCheckbox()).not.toBeChecked();
  });

  it("writes max effort through CLAUDE_CODE_EFFORT_LEVEL env", () => {
    const onChange = renderEditor("{}");

    fireEvent.click(effortCheckbox());

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextConfig = JSON.parse(onChange.mock.calls[0][0]);
    expect(nextConfig).toEqual({
      env: {
        CLAUDE_CODE_EFFORT_LEVEL: "max",
      },
    });
    expect(nextConfig).not.toHaveProperty("effortLevel");
  });

  it("removes only the CLAUDE_CODE_EFFORT_LEVEL env entry when unchecked", () => {
    const onChange = renderEditor(
      JSON.stringify(
        {
          effortLevel: "max",
          env: {
            CLAUDE_CODE_EFFORT_LEVEL: "max",
            ENABLE_TOOL_SEARCH: "true",
          },
        },
        null,
        2,
      ),
    );

    fireEvent.click(effortCheckbox());

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextConfig = JSON.parse(onChange.mock.calls[0][0]);
    expect(nextConfig).toEqual({
      effortLevel: "max",
      env: {
        ENABLE_TOOL_SEARCH: "true",
      },
    });
  });
});
