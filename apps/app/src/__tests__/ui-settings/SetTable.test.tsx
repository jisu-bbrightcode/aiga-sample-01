import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetTable } from "@repo/ui/settings/SetTable";

interface Row {
  id: string;
  name: string;
  age: number;
}

const rows: Row[] = [
  { id: "1", name: "재원", age: 30 },
  { id: "2", name: "예슬", age: 28 },
];

describe("SetTable", () => {
  it("renders header and rows", () => {
    render(
      <SetTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { id: "name", header: "이름", cell: (r) => r.name },
          { id: "age", header: "나이", cell: (r) => r.age, align: "right" },
        ]}
      />,
    );
    expect(screen.getByText("이름")).toBeInTheDocument();
    expect(screen.getByText("나이")).toBeInTheDocument();
    expect(screen.getByText("재원")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("shows empty state when rows are empty", () => {
    render(
      <SetTable<Row>
        rows={[]}
        rowKey={(r) => r.id}
        empty="비어 있음"
        columns={[{ id: "name", header: "이름", cell: (r) => r.name }]}
      />,
    );
    expect(screen.getByText("비어 있음")).toBeInTheDocument();
  });
});
