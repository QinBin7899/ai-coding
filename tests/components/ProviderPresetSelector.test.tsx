import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import type { ProviderCategory } from "@/types";
import {
  ProviderPresetSelector,
  filterPresetEntries,
  getPresetDisplayName,
  getPresetSearchText,
  getVisiblePresetEntries,
  sortPresetEntries,
  type PresetSortMode,
} from "@/components/providers/forms/ProviderPresetSelector";

// Mock ProviderIcon 以避免依赖图标库的实际内容
vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({
    icon,
    name,
    color,
    size,
  }: {
    icon?: string;
    name: string;
    color?: string;
    size?: number;
  }) => (
    <span
      data-testid="provider-icon"
      data-icon={icon}
      data-name={name}
      data-color={color}
      data-size={size}
    />
  ),
}));

const presetCategoryLabels = {
  official: "官方",
  cn_official: "国产官方",
  aggregator: "聚合服务",
  third_party: "第三方",
};

const translations: Record<string, string> = {
  "preset.alpha": "Alpha 本地名",
  "preset.gamma": "Gamma 本地名",
};

const t = ((key: string) => translations[key] ?? key) as TFunction;

type TestPresetEntry = {
  id: string;
  preset: {
    name: string;
    nameKey?: string;
    websiteUrl: string;
    settingsConfig: Record<string, never>;
    category: ProviderCategory;
    primePartner?: boolean;
    isPartner?: boolean;
    icon?: string;
    iconColor?: string;
  };
};

const presetEntries: TestPresetEntry[] = [
  {
    id: "gamma",
    preset: {
      name: "Gamma Raw",
      nameKey: "preset.gamma",
      websiteUrl: "https://gamma.example.com",
      settingsConfig: {},
      category: "aggregator",
    },
  },
  {
    id: "alpha",
    preset: {
      name: "Alpha Raw",
      nameKey: "preset.alpha",
      websiteUrl: "https://alpha.example.com/v1",
      settingsConfig: {},
      category: "official",
    },
  },
  {
    id: "beta",
    preset: {
      name: "Beta Gateway",
      websiteUrl: "https://CN-Gateway.example.com",
      settingsConfig: {},
      category: "cn_official",
    },
  },
  {
    id: "delta",
    preset: {
      name: "Delta Mirror",
      websiteUrl: "https://delta.example.com",
      settingsConfig: {},
      category: "third_party",
    },
  },
] satisfies TestPresetEntry[];

function getIds(entries: ReadonlyArray<{ id: string }>) {
  return entries.map((entry) => entry.id);
}

function renderSelector({
  entries = presetEntries,
  onPresetChange = vi.fn(),
}: {
  entries?: TestPresetEntry[];
  onPresetChange?: (value: string) => void;
} = {}) {
  const Wrapper = () => {
    const form = useForm();

    return (
      <Form {...form}>
        <ProviderPresetSelector
          selectedPresetId="custom"
          presetEntries={entries}
          presetCategoryLabels={presetCategoryLabels}
          onPresetChange={onPresetChange}
        />
      </Form>
    );
  };

  return render(<Wrapper />);
}

function getPresetButtonTexts() {
  const knownNames = new Set([
    "自定义配置",
    ...presetEntries.flatMap((entry) => [
      entry.preset.name,
      entry.preset.nameKey ?? entry.preset.name,
    ]),
  ]);

  return screen
    .getAllByRole("button")
    .map((button) => button.textContent?.trim() ?? "")
    .filter((text) => knownNames.has(text));
}

function getSearchButton() {
  return screen.getByRole("button", {
    name: /providerPreset\.(search|searchAriaLabel|openSearch)|搜索|search/i,
  });
}

function getSortButton() {
  return screen.getByRole("button", {
    name: /providerPreset\.(sort|sortByName|restoreOriginalOrder)|按名称排序|恢复原顺序|sort/i,
  });
}

function getSearchInput() {
  return screen.getByRole("textbox", {
    name: /providerPreset\.(searchInput|searchPlaceholder)|搜索预设|search/i,
  });
}

describe("ProviderPresetSelector pure helpers", () => {
  it("优先使用 nameKey 翻译作为显示名，否则使用原始 name", () => {
    expect(getPresetDisplayName(presetEntries[1].preset, t)).toBe(
      "Alpha 本地名",
    );
    expect(getPresetDisplayName(presetEntries[2].preset, t)).toBe(
      "Beta Gateway",
    );
  });

  it("仅拼接显示名与原始名称、统一 lower-case，不含 URL 或分类 label", () => {
    const searchText = getPresetSearchText(presetEntries[1], t);

    expect(searchText).toContain("alpha 本地名");
    expect(searchText).toContain("alpha raw");
    expect(searchText).not.toContain("example.com");
    expect(searchText).not.toContain("官方");
    expect(searchText).toBe(searchText.toLowerCase());
  });

  it("空 query 返回原数组，非空 query 大小写不敏感匹配", () => {
    expect(filterPresetEntries(presetEntries, "   ", t)).toBe(presetEntries);
    expect(
      getIds(filterPresetEntries(presetEntries, "ALPHA 本地名", t)),
    ).toEqual(["alpha"]);
  });

  it("不再通过 URL 或分类 label 搜索（仅匹配名称）", () => {
    expect(
      getIds(filterPresetEntries(presetEntries, "cn-gateway.example.com", t)),
    ).toEqual([]);
    expect(getIds(filterPresetEntries(presetEntries, "聚合", t))).toEqual([]);
  });

  it("支持 A-Z 排序、original 模式保持预设文件顺序（分组由三栏 UI 负责），并且 getVisible 先 filter 再 sort", () => {
    const originalMode: PresetSortMode = "original";
    const nameAscMode: PresetSortMode = "nameAsc";

    const original = sortPresetEntries(presetEntries, originalMode, t);
    expect(original).not.toBe(presetEntries);
    // AI Coding 的 original 模式不做赞助商/官方分段，保持预设文件顺序；
    // 官方 / 国模 / 国际的分组由三栏选择器 UI 负责。
    expect(getIds(original)).toEqual(["gamma", "alpha", "beta", "delta"]);

    expect(getIds(sortPresetEntries(presetEntries, nameAscMode, t))).toEqual([
      "alpha",
      "beta",
      "delta",
      "gamma",
    ]);
    expect(getIds(presetEntries)).toEqual(["gamma", "alpha", "beta", "delta"]);

    expect(
      getIds(
        getVisiblePresetEntries(presetEntries, {
          query: "a",
          sortMode: nameAscMode,
          t,
        }),
      ),
    ).toEqual(["alpha", "beta", "delta", "gamma"]);
  });

  it("original 模式忽略 isPartner / primePartner 标记，完整保持传入顺序", () => {
    // AI Coding 去掉了赞助商排序：无论预设带什么伙伴标记，
    // original 模式都原样返回（新数组、同顺序），不会有置顶或按名重排。
    const mixed: TestPresetEntry[] = [
      {
        id: "restZulu",
        preset: {
          name: "Zulu Rest",
          websiteUrl: "https://rest-zulu.example.com",
          settingsConfig: {},
          category: "third_party",
        },
      },
      {
        id: "partnerZeta",
        preset: {
          name: "Zeta Partner",
          websiteUrl: "https://partner-zeta.example.com",
          settingsConfig: {},
          category: "aggregator",
          isPartner: true,
        },
      },
      {
        id: "primeAndPartner",
        preset: {
          name: "Prime And Partner",
          websiteUrl: "https://prime-and-partner.example.com",
          settingsConfig: {},
          category: "cn_official",
          primePartner: true,
          isPartner: true,
        },
      },
      {
        id: "officialOnly",
        preset: {
          name: "Official Only",
          websiteUrl: "https://official-only.example.com",
          settingsConfig: {},
          category: "official",
        },
      },
      {
        id: "officialPrime",
        preset: {
          name: "Official Prime",
          websiteUrl: "https://official-prime.example.com",
          settingsConfig: {},
          category: "official",
          primePartner: true,
        },
      },
      {
        id: "partnerAlpha",
        preset: {
          name: "Alpha Partner",
          websiteUrl: "https://partner-alpha.example.com",
          settingsConfig: {},
          category: "third_party",
          isPartner: true,
        },
      },
      {
        id: "restAlpha",
        preset: {
          name: "Alpha Rest",
          websiteUrl: "https://rest-alpha.example.com",
          settingsConfig: {},
          category: "aggregator",
        },
      },
    ];

    expect(getIds(sortPresetEntries(mixed, "original", t))).toEqual([
      "restZulu",
      "partnerZeta",
      "primeAndPartner",
      "officialOnly",
      "officialPrime",
      "partnerAlpha",
      "restAlpha",
    ]);
  });
});

describe("ProviderPresetSelector", () => {
  it("按国模、自定义、美模分组，每组默认保持预设传入顺序", () => {
    renderSelector();

    expect(getPresetButtonTexts()).toEqual([
      "preset.gamma",
      "Beta Gateway",
      "自定义配置",
      "preset.alpha",
      "Delta Mirror",
    ]);
    const domesticGroup = screen.getByText("国模").closest("section")!;
    const overseasGroup = screen.getByText("美模").closest("section")!;
    expect(
      within(domesticGroup)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["preset.gamma", "Beta Gateway"]);
    expect(
      within(overseasGroup)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["preset.alpha", "Delta Mirror"]);
  });

  it("点击排序按钮后各分组按 A-Z 排序，再点恢复组内原顺序", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(getSortButton());
    expect(getSortButton()).toHaveAttribute("aria-pressed", "true");
    expect(getPresetButtonTexts()).toEqual([
      "Beta Gateway",
      "preset.gamma",
      "自定义配置",
      "Delta Mirror",
      "preset.alpha",
    ]);

    await user.click(getSortButton());
    expect(getSortButton()).toHaveAttribute("aria-pressed", "false");
    expect(getPresetButtonTexts()).toEqual([
      "preset.gamma",
      "Beta Gateway",
      "自定义配置",
      "preset.alpha",
      "Delta Mirror",
    ]);
  });

  it("搜索只过滤普通预设，自定义配置始终保留且仍可选择", async () => {
    const user = userEvent.setup();
    const onPresetChange = vi.fn();
    renderSelector({ onPresetChange });

    await user.click(getSearchButton());
    await user.type(getSearchInput(), "gateway");
    expect(getPresetButtonTexts()).toEqual(["Beta Gateway", "自定义配置"]);

    await user.click(screen.getByRole("button", { name: "自定义配置" }));
    expect(onPresetChange).toHaveBeenCalledWith("custom");
  });

  it("搜索无普通预设结果时保留自定义配置并显示空状态", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(getSearchButton());
    await user.type(getSearchInput(), "not-found");

    expect(getPresetButtonTexts()).toEqual(["自定义配置"]);
    expect(screen.getByText("No matching presets.")).toBeInTheDocument();
    expect(screen.getByText("暂无国产预设")).toBeInTheDocument();
    expect(screen.getByText("暂无海外预设")).toBeInTheDocument();
  });

  it("搜索为空时每个预设和独立的自定义入口都可选中", async () => {
    const user = userEvent.setup();
    const onPresetChange = vi.fn();
    renderSelector({ onPresetChange });

    for (const entry of presetEntries) {
      await user.click(
        screen.getByRole("button", {
          name: entry.preset.nameKey ?? entry.preset.name,
        }),
      );
      expect(onPresetChange).toHaveBeenLastCalledWith(entry.id);
    }
    await user.click(screen.getByRole("button", { name: "自定义配置" }));
    expect(onPresetChange).toHaveBeenLastCalledWith("custom");
  });

  it("preset.icon 存在时按钮内渲染对应图标和颜色", () => {
    renderSelector({
      entries: [
        {
          id: "with-icon",
          preset: {
            name: "With Icon",
            websiteUrl: "https://icon.example.com",
            settingsConfig: {},
            category: "official",
            icon: "claude-api",
            iconColor: "#D4915D",
          },
        },
      ],
    });

    const button = screen.getByRole("button", { name: "With Icon" });
    const icon = within(button).getByTestId("provider-icon");
    expect(icon).toHaveAttribute("data-icon", "claude-api");
    expect(icon).toHaveAttribute("data-color", "#D4915D");
  });

  it("无图标的预设仍显示完整名称并保持可选择", async () => {
    const user = userEvent.setup();
    const onPresetChange = vi.fn();
    renderSelector({ onPresetChange });

    const button = screen.getByRole("button", { name: "Beta Gateway" });
    expect(
      within(button).queryByTestId("provider-icon"),
    ).not.toBeInTheDocument();
    await user.click(button);
    expect(onPresetChange).toHaveBeenCalledWith("beta");
  });

  it("自定义入口与说明留在独立分组", () => {
    renderSelector();

    const button = screen.getByRole("button", { name: "自定义配置" });
    const customGroup = button.closest("section")!;
    expect(within(customGroup).getAllByRole("button")).toEqual([button]);
    expect(
      within(customGroup).getByText("自定义配置需手动填写所有必要字段"),
    ).toBeInTheDocument();
  });

  it("点击放大镜打开搜索弹层，ESC 收起并清空筛选", async () => {
    const user = userEvent.setup();
    renderSelector();

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(getSearchButton());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(getSearchInput(), "gateway");
    expect(getPresetButtonTexts()).toEqual(["Beta Gateway", "自定义配置"]);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(getPresetButtonTexts()).toHaveLength(5);

    await user.click(getSearchButton());
    expect(getSearchInput()).toHaveValue("");
  });

  it("按 Ctrl+F 快捷键打开搜索并聚焦输入框", async () => {
    const user = userEvent.setup();
    renderSelector();

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.keyboard("{Control>}f{/Control}");
    await waitFor(() => expect(getSearchInput()).toHaveFocus());
  });

  it("搜索后选择预设关闭弹层但保留关键词和筛选结果", async () => {
    const user = userEvent.setup();
    const onPresetChange = vi.fn();
    renderSelector({ onPresetChange });

    await user.click(getSearchButton());
    await user.type(getSearchInput(), "gateway");
    await user.click(screen.getByRole("button", { name: "Beta Gateway" }));

    expect(onPresetChange).toHaveBeenCalledWith("beta");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(getPresetButtonTexts()).toEqual(["Beta Gateway", "自定义配置"]);

    await user.click(getSearchButton());
    expect(getSearchInput()).toHaveValue("gateway");
  });

  it("搜索弹层已关闭时 Ctrl+F 重新打开、聚焦并保留关键词", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(getSearchButton());
    await user.type(getSearchInput(), "gateway");
    await user.click(screen.getByRole("button", { name: "Beta Gateway" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.keyboard("{Control>}f{/Control}");
    await waitFor(() => expect(getSearchInput()).toHaveFocus());
    expect(getSearchInput()).toHaveValue("gateway");
    await user.keyboard("{Control>}f{/Control}");
    await waitFor(() => expect(getSearchInput()).toHaveFocus());
    expect(getSearchInput()).toHaveValue("gateway");
  });

  it("点击组件外区域收起弹层并保留筛选，重新打开后可清空恢复", async () => {
    const user = userEvent.setup();
    const Wrapper = () => {
      const form = useForm();
      return (
        <Form {...form}>
          <ProviderPresetSelector
            selectedPresetId="custom"
            presetEntries={presetEntries}
            presetCategoryLabels={presetCategoryLabels}
            onPresetChange={vi.fn()}
          />
          <div data-testid="outside">Outside</div>
        </Form>
      );
    };
    render(<Wrapper />);

    await user.click(getSearchButton());
    await user.type(getSearchInput(), "gateway");
    await user.click(screen.getByTestId("outside"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(getPresetButtonTexts()).toEqual(["Beta Gateway", "自定义配置"]);

    await user.click(getSearchButton());
    expect(getSearchInput()).toHaveValue("gateway");
    await user.clear(getSearchInput());
    expect(getPresetButtonTexts()).toHaveLength(5);
  });
});
