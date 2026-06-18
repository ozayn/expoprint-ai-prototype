import { EvalDetailField } from "./EvalViewerField";
import {
  formatDuplicateVariantsForDisplay,
  type DuplicateUrlVariant,
} from "@/lib/evalLocal/evalCanonicalDedup";

type Props = {
  variants: DuplicateUrlVariant[];
  label?: string;
};

export function DuplicateUrlVariantsDetail({
  variants,
  label = "Also seen as",
}: Props) {
  const labels = formatDuplicateVariantsForDisplay(variants);
  if (labels.length === 0) return null;

  return (
    <EvalDetailField
      label={label}
      value={labels.join(", ")}
      mono
    />
  );
}
