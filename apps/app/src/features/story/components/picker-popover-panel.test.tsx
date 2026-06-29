import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PickerVirtualList } from "./picker-popover-panel";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: { count: number; estimateSize: (index: number) => number }) => ({
    getTotalSize: () => options.count * options.estimateSize(0),
    getVirtualItems: () => [],
    measure: vi.fn(),
    scrollToOffset: vi.fn(),
  }),
}));

describe("PickerVirtualList", () => {
  it("renders first rows when the virtualizer has not produced a range yet", () => {
    render(
      <PickerVirtualList
        items={[{ id: "char-raynor", name: "짐 레이너" }]}
        empty={<div>비어 있음</div>}
        renderRow={(item, row) => (
          <div key={item.id} style={row.style}>
            {item.name}
          </div>
        )}
      />,
    );

    expect(screen.getByText("짐 레이너")).toBeInTheDocument();
    expect(screen.queryByText("비어 있음")).not.toBeInTheDocument();
  });

  it("anchors virtual rows to the top of the scroll content before translating", () => {
    let rowStyle: React.CSSProperties | undefined;

    render(
      <PickerVirtualList
        items={[{ id: "char-raynor", name: "짐 레이너" }]}
        empty={<div>비어 있음</div>}
        renderRow={(item, row) => {
          rowStyle = row.style;
          return (
            <div key={item.id} style={row.style}>
              {item.name}
            </div>
          );
        }}
      />,
    );

    expect(rowStyle).toMatchObject({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    });
  });

  it("keeps a stable viewport height for popover virtualization", () => {
    const { container } = render(
      <PickerVirtualList
        items={Array.from({ length: 20 }, (_, index) => ({
          id: `char-${index}`,
          name: `캐릭터 ${index}`,
        }))}
        maxHeight={84}
        empty={<div>비어 있음</div>}
        renderRow={(item, row) => (
          <div key={item.id} style={row.style}>
            {item.name}
          </div>
        )}
      />,
    );

    expect(container.querySelector("[data-picker-virtual-list]")).toHaveStyle({
      height: "84px",
      maxHeight: "84px",
    });
  });
});
