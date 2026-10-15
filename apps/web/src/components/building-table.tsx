import { useMemo, useState } from "react";
import {
  useTable,
  tableFeatures,
  rowSortingFeature,
  rowPaginationFeature,
  createSortedRowModel,
  createPaginatedRowModel,
  sortFns,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Building } from "../types";
import { fmt, pct } from "../lib/format";
import { Status } from "./status";
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns,
});
type Props = {
  items: Building[];
  query: string;
  onQuery: (value: string) => void;
  onOpen: (id: string) => void;
  onClear: () => void;
  period: string;
};
export function BuildingTable({
  items,
  query,
  onQuery,
  onOpen,
  onClear,
  period,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "priority", desc: true },
  ]);
  const columns = useMemo<ColumnDef<typeof features, Building>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Building",
        cell: ({ row }) => (
          <button
            className="link building-link"
            onClick={() => onOpen(row.original.id)}
          >
            <span className="table-building-icon">
              <Building2 size={18} />
            </span>
            <span>
              {row.original.name}
              <small>
                {row.original.id} · {row.original.building_type} ·{" "}
                {fmt(row.original.heated_area_m2)} m²
              </small>
            </span>
          </button>
        ),
      },
      {
        accessorKey: "status",
        header: "Review status",
        cell: ({ row }) => (
          <>
            <Status value={row.original.status} />
            <small className="finding-context">
              {row.original.status === "investigate"
                ? `${row.original.flagged_months.length} flagged months`
                : "Own-history comparison"}
            </small>
          </>
        ),
      },
      {
        accessorKey: "observed_kwh",
        header: "Observed kWh",
        cell: ({ getValue }) => (
          <span className="number-cell">{fmt(getValue<number>())}</span>
        ),
      },
      {
        id: "deviation",
        accessorFn: (row) => row.deviation ?? undefined,
        header: "Deviation",
        sortUndefined: "last",
        cell: ({ row }) => (
          <span
            className={
              "deviation-value " +
              (row.original.status === "investigate" ? "attention" : "")
            }
          >
            {pct(row.original.deviation)}
          </span>
        ),
      },
      {
        accessorKey: "quality",
        header: "Data quality",
        cell: ({ row }) => (
          <span
            className={
              "quality-label " +
              (row.original.quality === "usable" ? "usable" : "needs-review")
            }
          >
            <i />
            {row.original.quality}
            <small>
              {row.original.missing_months
                ? `${row.original.missing_months} missing months`
                : "Evaluation coverage checked"}
            </small>
          </span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) =>
          row.original.priority ? (
            <div className="priority-cell">
              <span>
                {row.original.priority}
                <small>/100</small>
              </span>
              <div>
                <i style={{ width: `${row.original.priority}%` }} />
              </div>
            </div>
          ) : (
            <span className="muted">—</span>
          ),
      },
      {
        id: "open",
        header: "Details",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            aria-label={`Open ${row.original.name}`}
            className="icon-button"
            onClick={() => onOpen(row.original.id)}
          >
            <ArrowUpRight size={18} />
          </button>
        ),
      },
    ],
    [onOpen],
  );
  const table = useTable({
    features,
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <section className="panel building-table-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">INVESTIGATION QUEUE</p>
          <h2>
            Buildings to review{" "}
            <span className="table-count">{items.length}</span>
          </h2>
          <p className="section-description">
            Ranked for human review · {period}
          </p>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            maxLength={120}
            aria-label="Search buildings"
            placeholder="Search name, ID or type…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
      </div>
      <p className="table-scroll-hint">
        Swipe or scroll horizontally to see all columns.
      </p>
      <div
        className="table-wrap"
        role="region"
        aria-label="Building findings table"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">
            Synthetic buildings and investigation evidence. Sort using column
            headers.
          </caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp size={12} />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} />
                        )}
                      </button>
                    ) : (
                      <span className={header.id === "open" ? "sr-only" : ""}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length ? (
        <div className="empty">
          <Search size={28} />
          <h3>No buildings match this view</h3>
          <p>Try another name, period or filter.</p>
          <button className="secondary" onClick={onClear}>
            Clear search and filters
          </button>
        </div>
      ) : (
        <div className="table-footer">
          <span>
            Showing {table.state.pagination.pageIndex * 10 + 1}–
            {Math.min(
              (table.state.pagination.pageIndex + 1) * 10,
              items.length,
            )}{" "}
            of {items.length} buildings
          </span>
          <div className="pagination">
            <button
              className="icon-button"
              aria-label="Previous building page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {table.state.pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              className="icon-button"
              aria-label="Next building page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
