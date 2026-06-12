import {
  EVAL_TABLE_COLUMN_WIDTHS_PX,
  EVAL_TABLE_EXPAND_COL_WIDTH_PX,
} from "./evalTableLayout";
import type { EvalTableColumnId } from "@/lib/evalLocal/evalTableColumns";

type Props = {
  columns: EvalTableColumnId[];
};

export function EvalTableColGroup({ columns }: Props) {
  return (
    <colgroup>
      <col style={{ width: EVAL_TABLE_EXPAND_COL_WIDTH_PX }} />
      {columns.map((columnId) => (
        <col
          key={columnId}
          style={{ width: EVAL_TABLE_COLUMN_WIDTHS_PX[columnId] }}
        />
      ))}
    </colgroup>
  );
}
