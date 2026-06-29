import { useFeatureTranslation } from "@repo/core/i18n";
import {
  type ListViewSettingOption,
  ListViewSettingPopover,
  type ListViewSettingProperty,
} from "@repo/ui/components/list-view-setting-popover";

export interface StoryListSettingOption {
  value: string;
  labelKey: string;
  disabled?: boolean;
}

export interface StoryListSettingProperty<T extends string> {
  id: T;
  labelKey: string;
  disabled?: boolean;
}

export interface StoryListSettingsPopoverProps<T extends string> {
  groupingValue: string;
  groupingOptions: StoryListSettingOption[];
  onGroupingChange: (value: string) => void;
  orderingValue: string;
  orderingOptions: StoryListSettingOption[];
  onOrderingChange: (value: string) => void;
  recentValue: string;
  recentOptions: StoryListSettingOption[];
  onRecentChange: (value: string) => void;
  properties: StoryListSettingProperty<T>[];
  visiblePropertyIds: T[];
  onVisiblePropertyIdsChange: (next: T[]) => void;
  showSubItems?: boolean;
  onShowSubItemsChange?: (checked: boolean) => void;
}

export function StoryListSettingsPopover<T extends string>({
  groupingValue,
  groupingOptions,
  onGroupingChange,
  orderingValue,
  orderingOptions,
  onOrderingChange,
  recentValue,
  recentOptions,
  onRecentChange,
  properties,
  visiblePropertyIds,
  onVisiblePropertyIdsChange,
  showSubItems,
  onShowSubItemsChange,
}: StoryListSettingsPopoverProps<T>) {
  const { t } = useFeatureTranslation("feature.story");
  const enabledIds = new Set(visiblePropertyIds);
  const translatedProperties: ListViewSettingProperty[] = properties.map((property) => ({
    id: property.id,
    label: t(property.labelKey),
    enabled: enabledIds.has(property.id),
    disabled: property.disabled,
  }));

  return (
    <ListViewSettingPopover
      labels={{
        trigger: t("list.settings.trigger"),
        title: t("list.settings.title"),
        description: t("list.settings.description"),
        grouping: t("list.settings.grouping"),
        ordering: t("list.settings.ordering"),
        recent: t("list.settings.recent"),
        showSubItems: t("list.settings.showSubItems"),
        displayProperties: t("list.settings.displayProperties"),
      }}
      groupingValue={groupingValue}
      groupingOptions={translateOptions(groupingOptions, t)}
      onGroupingChange={onGroupingChange}
      orderingValue={orderingValue}
      orderingOptions={translateOptions(orderingOptions, t)}
      onOrderingChange={onOrderingChange}
      recentValue={recentValue}
      recentOptions={translateOptions(recentOptions, t)}
      onRecentChange={onRecentChange}
      properties={translatedProperties}
      onPropertyToggle={(id, enabled) => {
        const nextIds = new Set(visiblePropertyIds);
        if (enabled) {
          nextIds.add(id as T);
        } else {
          nextIds.delete(id as T);
        }
        onVisiblePropertyIdsChange(
          properties.filter((property) => nextIds.has(property.id)).map((property) => property.id),
        );
      }}
      showSubItems={showSubItems}
      onShowSubItemsChange={onShowSubItemsChange}
    />
  );
}

function translateOptions(
  options: StoryListSettingOption[],
  t: (key: string) => string,
): ListViewSettingOption[] {
  return options.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
    disabled: option.disabled,
  }));
}
