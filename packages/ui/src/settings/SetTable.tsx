/**
 * SetTable — slim list-style table for settings (members, invoices, …).
 *
 * Wraps shadcn Table with settings-tuned spacing. Header cells use
 * uppercase 11px font per design.
 */
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../_shadcn/table";
import { cn } from "../lib/utils";

interface Column<Row> {
  /** Stable id used as React key — required to avoid index-based keys. */
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface Props<Row> {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row, index: number) => string;
  empty?: ReactNode;
}

export function SetTable<Row>({ rows, columns, rowKey, empty }: Props<Row>) {
  if (rows.length === 0 && empty) {
    return <div className="py-3 text-xs text-muted-foreground">{empty}</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b-foreground/15">
          {columns.map((c) => (
            <TableHead
              key={c.id}
              className={cn(
                "h-8 text-xs font-medium uppercase tracking-wider text-muted-foreground",
                c.align === "right" && "text-right",
              )}
            >
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow
            key={rowKey(row, i)}
            className="border-b-foreground/10 last:border-b-0"
          >
            {columns.map((c) => (
              <TableCell
                key={c.id}
                className={cn(
                  "py-2.5 text-base",
                  c.align === "right" && "text-right",
                  c.className,
                )}
              >
                {c.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export type { Column as SetTableColumn };
