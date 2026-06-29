import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, type ReactNode } from "react";
import { cn } from "../lib/utils";

export interface DataTableGroup<TData> {
  label: string;
  rows: TData[];
}

interface Props<TData> {
  columns: ColumnDef<TData, unknown>[];
  data?: TData[];
  groups?: DataTableGroup<TData>[];
  empty?: ReactNode;
  /** Max height in px. Body scrolls vertically; header stays sticky. */
  maxHeight?: number;
}

function GroupBody<TData>({
  columns,
  rows,
}: {
  columns: ColumnDef<TData, unknown>[];
  rows: TData[];
}) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {table.getRowModel().rows.map((row) => (
        <tr key={row.id} className="group h-8">
          {row.getVisibleCells().map((cell) => (
            <td
              key={cell.id}
              className="px-3 text-sm transition-colors first:rounded-l-md last:rounded-r-md group-hover:bg-muted"
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DataTable<TData>({
  columns,
  data,
  groups,
  empty,
  maxHeight,
}: Props<TData>) {
  const headerTable = useReactTable({
    data: [] as TData[],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const renderGroups: DataTableGroup<TData>[] = groups ?? [
    { label: "", rows: data ?? [] },
  ];
  const totalRows = renderGroups.reduce((n, g) => n + g.rows.length, 0);

  if (totalRows === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {empty ?? "표시할 항목이 없습니다."}
      </div>
    );
  }

  const tableEl = (
    <table className="w-full text-sm">
      <thead className={maxHeight ? "sticky top-0 z-10 bg-background" : undefined}>
        {headerTable.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th
                key={h.id}
                className={cn(
                  "h-8 px-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground",
                )}
                style={h.column.columnDef.size ? { width: h.column.columnDef.size } : undefined}
              >
                {h.isPlaceholder
                  ? null
                  : flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {renderGroups.map((group) => (
          <Fragment key={group.label || "__default"}>
            {group.label && group.rows.length > 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-1">
                  <span className="inline-flex items-baseline gap-2 rounded-md bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground">
                    <span>{group.label}</span>
                    <span className="text-muted-foreground">{group.rows.length}</span>
                  </span>
                </td>
              </tr>
            ) : null}
            <GroupBody columns={columns} rows={group.rows} />
          </Fragment>
        ))}
      </tbody>
    </table>
  );

  if (maxHeight) {
    return (
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {tableEl}
      </div>
    );
  }
  return tableEl;
}
