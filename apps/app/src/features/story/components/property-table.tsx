/**
 * Key-value property table: grid 100px + 1fr, 13px text, py-xs per row.
 * Keys: text-muted-foreground. Values: text-muted-foreground (secondary).
 * "+ 속성 추가" link at bottom.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";

interface PropertyItem {
  label: string;
  value: string | number | null | undefined;
  valueClassName?: string;
}

interface Props {
  properties: PropertyItem[];
  onAdd?: () => void;
  className?: string;
  "data-el"?: string;
}

export function PropertyTable({ properties, onAdd, className, "data-el": dataEl }: Props) {
  const { t } = useFeatureTranslation("feature.story");
  const filledProperties = properties.filter((p) => p.value != null && p.value !== "");

  return (
    <div data-el={dataEl} className={cn("flex flex-col", className)}>
      {filledProperties.length > 0 ? (
        <div className="flex flex-col">
          {filledProperties.map((prop) => (
            <PropertyRow
              key={prop.label}
              label={prop.label}
              value={prop.value}
              valueClassName={prop.valueClassName}
            />
          ))}
        </div>
      ) : (
        <p className="text-base text-muted-foreground">{t("property.empty")}</p>
      )}
      {onAdd ? (
        <div className="py-xs">
          <span
            className="cursor-default text-base text-muted-foreground"
            onClick={onAdd}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onAdd();
            }}
          >
            {t("property.add")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* Components */

interface PropertyRowProps {
  label: string;
  value: string | number | null | undefined;
  valueClassName?: string;
}

function PropertyRow({ label, value, valueClassName }: PropertyRowProps) {
  return (
    <div
      className="grid items-center gap-sm py-xs text-base"
      style={{ gridTemplateColumns: "100px 1fr" }}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-muted-foreground", valueClassName)}>{String(value)}</span>
    </div>
  );
}
