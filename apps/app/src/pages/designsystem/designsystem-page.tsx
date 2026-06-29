import { useFeatureTranslation } from "@repo/core/i18n";
import ActionsDemo from "@repo/ui/ai/actions";
import AgentDemo from "@repo/ui/ai/agent";
import ArtifactDemo from "@repo/ui/ai/artifact";
import AttachmentsDemo from "@repo/ui/ai/attachments";
import AudioPlayerDemo from "@repo/ui/ai/audio-player";
import BranchDemo from "@repo/ui/ai/branch";
import CanvasDemo from "@repo/ui/ai/canvas";
import ChainOfThoughtDemo from "@repo/ui/ai/chain-of-thought";
import CheckpointDemo from "@repo/ui/ai/checkpoint";
import CodeBlockDemo from "@repo/ui/ai/code-block";
import CommitDemo from "@repo/ui/ai/commit";
import ConfirmationDemo from "@repo/ui/ai/confirmation";
import ConnectionDemo from "@repo/ui/ai/connection";
import ContextDemo from "@repo/ui/ai/context";
import ControlsDemo from "@repo/ui/ai/controls";
import ConversationDemo from "@repo/ui/ai/conversation";
import EdgeDemo from "@repo/ui/ai/edge";
import EnvironmentVariablesDemo from "@repo/ui/ai/environment-variables";
import FileTreeDemo from "@repo/ui/ai/file-tree";
import ImageDemo from "@repo/ui/ai/image";
import InlineCitationDemo from "@repo/ui/ai/inline-citation";
import LoaderDemo, { Loader } from "@repo/ui/ai/loader";
import MessageDemo from "@repo/ui/ai/message";
import MicSelectorDemo from "@repo/ui/ai/mic-selector";
import ModelSelectorDemo from "@repo/ui/ai/model-selector";
import NodeDemo, { Node, NodeContent, NodeHeader, NodeTitle } from "@repo/ui/ai/node";
import OpenInChatDemo from "@repo/ui/ai/open-in-chat";
import PackageInfoDemo from "@repo/ui/ai/package-info";
import PanelDemo from "@repo/ui/ai/panel";
import PersonaDemo from "@repo/ui/ai/persona";
import PlanDemo from "@repo/ui/ai/plan";
import PromptInputDemo, {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@repo/ui/ai/prompt-input";
import QueueDemo from "@repo/ui/ai/queue";
import ReasoningDemo, {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/ui/ai/reasoning";
import SandboxDemo from "@repo/ui/ai/sandbox";
import SchemaDisplayDemo from "@repo/ui/ai/schema-display";
import { Shimmer } from "@repo/ui/ai/shimmer";
import SnippetDemo from "@repo/ui/ai/snippet";
import SourcesDemo from "@repo/ui/ai/sources";
import SpeechInputDemo from "@repo/ui/ai/speech-input";
import StackTraceDemo from "@repo/ui/ai/stack-trace";
import SuggestionDemo from "@repo/ui/ai/suggestion";
import TaskDemo from "@repo/ui/ai/task";
import TerminalDemo from "@repo/ui/ai/terminal";
import TestResultsDemo from "@repo/ui/ai/test-results";
import ToolDemo from "@repo/ui/ai/tool";
import ToolbarDemo from "@repo/ui/ai/toolbar";
import TranscriptionDemo from "@repo/ui/ai/transcription";
import VoiceSelectorDemo from "@repo/ui/ai/voice-selector";
import WebPreviewDemo from "@repo/ui/ai/web-preview";
import { EntitySubbar, type StatusTab } from "@repo/ui/components/entity-subbar";
import {
  AssigneeStack,
  EntityTable,
  type EntityTag,
  NameCell,
  StatusPill,
  TagChip,
} from "@repo/ui/components/entity-table";
import {
  ListViewSettingPopover,
  type ListViewSettingProperty,
} from "@repo/ui/components/list-view-setting-popover";
import { PageLayout } from "@repo/ui/components/page-layout";
import { EmptyState } from "@repo/ui/components/primitives/empty-state";
import { StackedCard } from "@repo/ui/components/stacked-card";
import { cn } from "@repo/ui/lib/utils";
import {
  EmptyComingSoon,
  HueAvatar,
  Pill,
  SetDangerZone,
  SetListRow,
  SettingItem,
  SettingsSidebarNav,
} from "@repo/ui/settings";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/shadcn/alert";
import { Badge } from "@repo/ui/shadcn/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/shadcn/breadcrumb";
import { Button } from "@repo/ui/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/shadcn/card";
import { Checkbox } from "@repo/ui/shadcn/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@repo/ui/shadcn/combobox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@repo/ui/shadcn/command";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@repo/ui/shadcn/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/shadcn/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/ui/shadcn/field";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/shadcn/form";
import { Input } from "@repo/ui/shadcn/input";
import { Kbd, KbdGroup } from "@repo/ui/shadcn/kbd";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/ui/shadcn/popover";
import { Progress, ProgressLabel, ProgressValue } from "@repo/ui/shadcn/progress";
import { RadioGroup, RadioGroupItem } from "@repo/ui/shadcn/radio-group";
import { ScrollArea } from "@repo/ui/shadcn/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Separator } from "@repo/ui/shadcn/separator";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Slider } from "@repo/ui/shadcn/slider";
import { Spinner } from "@repo/ui/shadcn/spinner";
import { Switch } from "@repo/ui/shadcn/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/shadcn/tabs";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/shadcn/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/shadcn/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Component,
  Eye,
  EyeOff,
  FileText,
  Grid2X2,
  Keyboard,
  Layers,
  Link2,
  List,
  MoreHorizontal,
  Palette,
  Plus,
  Rows3,
  Settings,
  Sparkles,
  Star,
  Tag,
  Users,
} from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ProjectCardSurface } from "@/features/project/components/project-card";
import { defaultPatternFor } from "@/features/project/patterns";
import {
  MetaSection,
  SidebarAvatarField,
  SidebarChipToggleField,
  SidebarIconMultiToggleField,
  SidebarIconToggleField,
  SidebarInputField,
  SidebarItem,
  SidebarItemAdd,
  SidebarNumberField,
  SidebarSelectField,
  SidebarTextareaField,
  SidebarTimeField,
  SidebarToggleButtonField,
  SidebarToggleField,
} from "@/features/story/layouts/detail-layout";
import { DetailPageShell } from "@/features/story/layouts/detail-page-shell";
import {
  DEFAULT_DESIGN_SYSTEM_SECTION_ID,
  DESIGN_SYSTEM_GROUPS,
  type DesignSystemGroupId,
  type DesignSystemSection,
  getDesignSystemSection,
  groupDesignSystemSections,
} from "./designsystem-registry";

const STATUS_TABS: StatusTab[] = [
  { value: "all", label: "전체" },
  { value: "draft", label: "작성중" },
  { value: "progress", label: "진행중" },
  { value: "review", label: "리뷰" },
  { value: "done", label: "완료" },
];

interface DesignEntityRow {
  id: string;
  num: number;
  name: string;
  status: string;
  priority: "P0" | "P1" | "P2" | "P3";
  priorityRank: number;
  tags: EntityTag[];
  due: string;
  dueRank: number;
  updatedAt: string;
  updatedDays: number;
  assignees: Array<{ id: string; initial: string; color: string; name: string }>;
  subRows?: DesignEntityRow[];
}

const DESIGN_ENTITY_ROWS: DesignEntityRow[] = [
  {
    id: "aethon",
    num: 1,
    name: "Aethon",
    status: "done",
    priority: "P1",
    priorityRank: 1,
    tags: [{ label: "주인공", color: "#5A7A8F" }],
    due: "5월 18일",
    dueRank: 18,
    updatedAt: "2시간",
    updatedDays: 0,
    assignees: [{ id: "hana", initial: "H", color: "#C9A861", name: "Hana" }],
    subRows: [
      {
        id: "aethon-arc",
        num: 2,
        name: "Aethon / 내적 갈등",
        status: "progress",
        priority: "P2",
        priorityRank: 2,
        tags: [{ label: "arc", color: "#8B5CF6" }],
        due: "5월 20일",
        dueRank: 20,
        updatedAt: "4시간",
        updatedDays: 0,
        assignees: [{ id: "kai", initial: "K", color: "#5A7A8F", name: "Kai" }],
      },
    ],
  },
  {
    id: "nova",
    num: 3,
    name: "Nova",
    status: "writing",
    priority: "P0",
    priorityRank: 0,
    tags: [{ label: "조력자", color: "#4F7A3E" }],
    due: "5월 24일",
    dueRank: 24,
    updatedAt: "1일",
    updatedDays: 1,
    assignees: [
      { id: "hana", initial: "H", color: "#C9A861", name: "Hana" },
      { id: "vera", initial: "V", color: "#8B5CF6", name: "Vera" },
    ],
  },
  {
    id: "mira",
    num: 4,
    name: "Mira",
    status: "review",
    priority: "P3",
    priorityRank: 3,
    tags: [],
    due: "—",
    dueRank: 999,
    updatedAt: "3일",
    updatedDays: 3,
    assignees: [],
  },
];

type DesignPropertyId = "status" | "priority" | "tags" | "due" | "updated" | "assignees";
type DesignColumnId = "name" | DesignPropertyId;

const DESIGN_LIST_PROPERTY_IDS: DesignPropertyId[] = [
  "status",
  "priority",
  "assignees",
  "due",
  "tags",
  "updated",
];

const DEFAULT_VISIBLE_PROPERTIES: DesignPropertyId[] = [
  "status",
  "priority",
  "assignees",
  "due",
  "tags",
  "updated",
];

const DESIGN_COLUMN_WIDTH: Record<DesignColumnId, string> = {
  name: "minmax(360px,1fr)",
  status: "110px",
  priority: "90px",
  assignees: "90px",
  due: "110px",
  tags: "180px",
  updated: "80px",
};

const DESIGN_ENTITY_COLUMN_BY_ID: Record<DesignColumnId, ColumnDef<DesignEntityRow>> = {
  name: {
    id: "name",
    header: "이름",
    cell: ({ row }) => (
      <NameCell
        num={row.original.num}
        title={row.original.name}
        depth={row.depth}
        canExpand={row.getCanExpand()}
        expanded={row.getIsExpanded()}
        onToggle={() => row.toggleExpanded()}
      />
    ),
  },
  status: {
    id: "status",
    header: "상태",
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  priority: {
    id: "priority",
    header: "우선순위",
    cell: ({ row }) => (
      <span className="text-base font-medium text-sidebar-foreground">{row.original.priority}</span>
    ),
  },
  tags: {
    id: "tags",
    header: "태그",
    cell: ({ row }) => {
      if (row.original.tags.length === 0) {
        return <span className="text-base text-muted-foreground">—</span>;
      }
      return (
        <div className="flex items-center gap-1 overflow-hidden">
          {row.original.tags.map((tag) => (
            <TagChip key={tag.label} label={tag.label} color={tag.color} />
          ))}
        </div>
      );
    },
  },
  due: {
    id: "due",
    header: "마감일",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-base text-sidebar-foreground">
        <Calendar className="size-3.5 text-muted-foreground" />
        {row.original.due}
      </span>
    ),
  },
  updated: {
    id: "updated",
    header: "업데이트",
    cell: ({ row }) => (
      <span className="text-base text-muted-foreground">{row.original.updatedAt}</span>
    ),
  },
  assignees: {
    id: "assignees",
    header: "담당자",
    cell: ({ row }) => <AssigneeStack assignees={row.original.assignees} />,
  },
};

const GROUP_ICON: Record<DesignSystemGroupId, ReactNode> = {
  foundation: <Palette className="size-3.5" />,
  components: <Component className="size-3.5" />,
  patterns: <Layers className="size-3.5" />,
};

function readSectionIdFromLocation(): string {
  if (typeof window === "undefined") return DEFAULT_DESIGN_SYSTEM_SECTION_ID;
  const searchSectionId = new URLSearchParams(window.location.search).get("section");
  return getDesignSystemSection(searchSectionId ?? DEFAULT_DESIGN_SYSTEM_SECTION_ID).id;
}

function writeSectionIdToLocation(sectionId: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("section", sectionId);
  window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function DesignSystemPage() {
  const [activeSectionId, setActiveSectionId] = useState(readSectionIdFromLocation);
  const section = getDesignSystemSection(activeSectionId);
  const groupedSections = groupDesignSystemSections();

  useEffect(() => {
    const handlePopState = () => setActiveSectionId(readSectionIdFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[18rem_1fr]">
        <aside className="border-border/70 border-b bg-sidebar/80 lg:border-r lg:border-b-0">
          <div className="flex h-full flex-col">
            <header className="space-y-3 p-6">
              <Badge variant="outline" className="bg-background">
                packages/ui
              </Badge>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Product Builder Design System</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  실제 공통 컴포넌트와 화면 패턴을 보는 인벤토리.
                </p>
              </div>
            </header>

            <ScrollArea className="min-h-0 flex-1 px-4 pb-6">
              <nav aria-label="Design system sections" className="space-y-6">
                {groupedSections.map(({ group, sections }) => (
                  <section key={group.id} aria-labelledby={`designsystem-${group.id}`}>
                    <div
                      id={`designsystem-${group.id}`}
                      className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {GROUP_ICON[group.id]}
                      {group.title}
                    </div>
                    <div className="space-y-1">
                      {sections.map((item) => (
                        <Button
                          key={item.id}
                          type="button"
                          variant={item.id === section.id ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => {
                            setActiveSectionId(item.id);
                            writeSectionIdToLocation(item.id);
                          }}
                        >
                          {item.title}
                        </Button>
                      ))}
                    </div>
                  </section>
                ))}
              </nav>
            </ScrollArea>
          </div>
        </aside>

        <main className="min-w-0">
          <section className="border-border/70 border-b bg-background/95 px-6 py-8 backdrop-blur lg:px-10">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {DESIGN_SYSTEM_GROUPS.find((group) => group.id === section.group)?.title}
                </Badge>
                <Badge variant="outline">existing source</Badge>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{section.description}</p>
            </div>
          </section>

          <section className="space-y-6 p-6 lg:p-10">
            <SectionPreview section={section} />
            {section.id === "ai-components" ? null : <CodeReferences section={section} />}
          </section>
        </main>
      </div>
    </div>
  );
}

function SectionPreview({ section }: { section: DesignSystemSection }) {
  if (section.group === "foundation") return <FoundationPreview section={section} />;
  if (section.group === "patterns") return <PatternPreview section={section} />;
  return <ComponentPreview section={section} />;
}

function FoundationPreview({ section }: { section: DesignSystemSection }) {
  if (section.id === "colors") return <ColorPreview />;
  if (section.id === "typography") return <TypographyPreview />;
  return <RhythmPreview title={section.title} />;
}

function ColorPreview() {
  return (
    <PreviewCard title="Semantic Surfaces">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TokenSwatch name="background" className="border bg-background text-foreground" />
        <TokenSwatch name="foreground" className="bg-foreground text-background" />
        <TokenSwatch name="card" className="border bg-card text-card-foreground" />
        <TokenSwatch name="primary" className="bg-primary text-primary-foreground" />
        <TokenSwatch name="secondary" className="bg-secondary text-secondary-foreground" />
        <TokenSwatch name="muted" className="bg-muted text-muted-foreground" />
        <TokenSwatch name="destructive" className="bg-destructive/10 text-destructive" />
        <TokenSwatch name="sidebar" className="border bg-sidebar text-sidebar-foreground" />
      </div>
    </PreviewCard>
  );
}

function TypographyPreview() {
  const sample = "가나다라마바사아자차카타파하abcdef~";

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-base font-semibold tracking-wide text-muted-foreground uppercase">
          Product type scale
        </p>
        <h3 className="text-2xl font-semibold tracking-tight">14px 기반 UI 밀도</h3>
        <p className="max-w-2xl text-base leading-5 text-muted-foreground">
          제품 전체 기본 UI 텍스트는 14px(text-base)이다. 13px(text-sm)은 rare compact metadata
          예외로만 둔다. 스케일은 절대값 토큰(text-2xs 11 … text-7xl 60)이며 상대 calc 을 쓰지 않는다.
        </p>
      </section>

      <section className="space-y-5">
        <TypographyScaleRow
          name="Display"
          className="text-3xl font-semibold tracking-tight"
          sample={sample}
          token="text-3xl / font-semibold / tracking-tight"
        />
        <TypographyScaleRow
          name="Page title"
          className="text-2xl font-semibold tracking-normal"
          sample={sample}
          token="text-2xl / font-semibold"
        />
        <TypographyScaleRow
          name="Editor body"
          className="text-editor-base leading-5 text-foreground/80"
          sample={sample}
          token="text-editor-base (15px) / leading-5"
        />
        <TypographyScaleRow
          name="UI default"
          className="text-base leading-5 text-foreground"
          sample={sample}
          token="text-base"
        />
        <TypographyScaleRow
          name="UI medium"
          className="text-base font-medium leading-5 text-foreground"
          sample={sample}
          token="text-base / font-medium"
        />
        <TypographyScaleRow
          name="UI muted"
          className="text-base leading-5 text-muted-foreground"
          sample={sample}
          token="text-base / muted"
        />
        <TypographyScaleRow
          name="Mono"
          className="font-mono text-base leading-5 text-muted-foreground"
          sample={sample}
          token="font-mono / text-base"
        />
        <TypographyScaleRow
          name="Compact meta"
          className="text-sm leading-4 text-muted-foreground"
          sample={sample}
          token="text-sm / rare"
        />
      </section>
    </div>
  );
}

function TypographyScaleRow({
  name,
  className,
  sample,
  token,
}: {
  name: string;
  className: string;
  sample: string;
  token: string;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[8rem_minmax(0,1fr)_16rem] md:items-baseline">
      <div className="text-base font-medium tracking-wide text-muted-foreground uppercase">
        {name}
      </div>
      <div className={cn("min-w-0", className)}>{sample}</div>
      <code className="font-mono text-base text-muted-foreground">{token}</code>
    </div>
  );
}

function RhythmPreview({ title }: { title: string }) {
  return (
    <PreviewCard title={`${title} Samples`}>
      <div className="grid gap-4 md:grid-cols-3">
        <RhythmCard title="Toolbar" detail="gap-2 / h-6 controls" className="gap-1 p-3" />
        <RhythmCard title="Card" detail="gap-3 / p-5 content" className="gap-3 p-5" />
        <RhythmCard title="Page" detail="gap-6 / p-10 sections" className="gap-5 p-7" />
      </div>
    </PreviewCard>
  );
}

function ComponentPreview({ section }: { section: DesignSystemSection }) {
  switch (section.id) {
    case "buttons":
      return <ButtonsPreview />;
    case "inputs":
      return <InputsPreview />;
    case "custom-caret":
      return <CustomCaretPreview />;
    case "card":
      return <CardPreview />;
    case "paper-card":
      return <PaperCardPreview />;
    case "checkbox":
      return <CheckboxPreview />;
    case "radio-group":
      return <RadioGroupPreview />;
    case "switch":
      return <SwitchPreview />;
    case "toggle-group":
      return <ToggleGroupPreview />;
    case "slider":
      return <SliderPreview />;
    case "form":
      return <FormPreview />;
    case "navigation-controls":
      return <NavigationControlsPreview />;
    case "toolbar":
      return <ToolbarPreview />;
    case "sidebar":
      return <SidebarPreview />;
    case "popover":
      return <PopoverPreview />;
    case "combobox":
      return <ComboboxPreview />;
    case "command":
      return <CommandPreview />;
    case "context-menu":
      return <ContextMenuPreview />;
    case "dropdown-menu":
      return <DropdownMenuPreview />;
    case "table":
      return <TablePreview />;
    case "dialog":
      return <DialogPreview />;
    case "empty-state":
      return <EmptyStatePreview />;
    case "feedback":
      return <FeedbackPreview />;
    case "ai-components":
      return <AiComponentsPreview />;
    case "settings-components":
      return <SettingsComponentsPreview />;
    default:
      return <GenericComponentPreview section={section} />;
  }
}

function ButtonsPreview() {
  return (
    <PreviewCard title="Button Component">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StateFrame title="Default">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
        </StateFrame>
        <StateFrame title="Outline / Ghost">
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </StateFrame>
        <StateFrame title="Destructive / Disabled">
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline" disabled>
            Disabled
          </Button>
        </StateFrame>
        <StateFrame title="Icon">
          <Button size="icon" aria-label="추가">
            <Plus className="size-3.5" />
          </Button>
          <Button size="sm" variant="secondary">
            <Sparkles className="size-3.5" />
            Small
          </Button>
        </StateFrame>
      </div>
    </PreviewCard>
  );
}

function InputsPreview() {
  return (
    <PreviewCard title="Input Components">
      <div className="grid gap-4 lg:grid-cols-3">
        <FieldFrame label="Input / empty">
          <Input placeholder="Placeholder" />
        </FieldFrame>
        <FieldFrame label="Input / filled">
          <Input defaultValue="Filled value" />
        </FieldFrame>
        <FieldFrame label="Textarea">
          <Textarea defaultValue="Long form value" />
        </FieldFrame>
      </div>
    </PreviewCard>
  );
}

interface CustomCaretState {
  x: number;
  y: number;
  height: number;
  isInsideText: boolean;
  isTyping: boolean;
  visible: boolean;
}

type CustomCaretShape = "rectangle" | "square";

const CUSTOM_CARET_SHAPES: Array<{ value: CustomCaretShape; label: string }> = [
  { value: "rectangle", label: "Rectangle" },
  { value: "square", label: "Small square" },
];

function CustomCaretPreview() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [caretWidth, setCaretWidth] = useState(8);
  const [caretShape, setCaretShape] = useState<CustomCaretShape>("rectangle");
  const { caretState, updateCaret, hideCaret, markTyping } = useCustomCaretOverlay(
    hostRef,
    editorRef,
  );

  return (
    <PreviewCard title="Custom Caret Overlay">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <CustomCaretEditor
          caretShape={caretShape}
          caretState={caretState}
          caretWidth={caretWidth}
          editorRef={editorRef}
          hostRef={hostRef}
          hideCaret={hideCaret}
          markTyping={markTyping}
          updateCaret={updateCaret}
        />
        <CustomCaretControls
          caretShape={caretShape}
          caretState={caretState}
          caretWidth={caretWidth}
          setCaretShape={setCaretShape}
          setCaretWidth={setCaretWidth}
        />
      </div>
    </PreviewCard>
  );
}

function useCustomCaretOverlay(
  hostRef: RefObject<HTMLDivElement | null>,
  editorRef: RefObject<HTMLDivElement | null>,
) {
  const [caretState, setCaretState] = useState<CustomCaretState>({
    x: 0,
    y: 0,
    height: 24,
    isInsideText: false,
    isTyping: false,
    visible: false,
  });
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<number | null>(null);

  function hideCaret() {
    if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    setCaretState((current) => ({ ...current, isTyping: false, visible: false }));
  }

  function markTyping() {
    isTypingRef.current = true;
    updateCaret();
    if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      isTypingRef.current = false;
      updateCaret();
    }, 650);
  }

  function updateCaret() {
    const host = hostRef.current;
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!host || !editor || !selection?.isCollapsed || selection.rangeCount === 0) {
      hideCaret();
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) {
      hideCaret();
      return;
    }
    const range = selection.getRangeAt(0).cloneRange();
    const rangeText =
      range.startContainer.nodeType === globalThis.Node.TEXT_NODE
        ? range.startContainer.textContent
        : null;
    const isInsideText =
      typeof rangeText === "string" &&
      range.startOffset > 0 &&
      range.startOffset < rangeText.length;
    let rect = range.getClientRects()[0] ?? null;
    let probe: HTMLSpanElement | null = null;

    if (!rect) {
      probe = document.createElement("span");
      probe.textContent = "\u200b";
      range.insertNode(probe);
      rect = probe.getBoundingClientRect();
      probe.remove();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const isInsideTextLine = isCaretInsideTextLine(editor, rect);
    const hostRect = host.getBoundingClientRect();
    const editorStyles = window.getComputedStyle(editor);
    const fallbackHeight = Number.parseFloat(editorStyles.lineHeight) || 24;
    setCaretState({
      x: rect.left - hostRect.left + host.scrollLeft,
      y: rect.top - hostRect.top + host.scrollTop,
      height: rect.height || fallbackHeight,
      isInsideText: isInsideText || isInsideTextLine,
      isTyping: isTypingRef.current,
      visible: document.activeElement === editor,
    });
  }

  useEffect(() => {
    document.addEventListener("selectionchange", updateCaret);
    window.addEventListener("resize", updateCaret);
    return () => {
      if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current);
      document.removeEventListener("selectionchange", updateCaret);
      window.removeEventListener("resize", updateCaret);
    };
  });

  return { caretState, hideCaret, markTyping, updateCaret };
}

function isCaretInsideTextLine(editor: HTMLElement, caretRect: DOMRect): boolean {
  const contentRange = document.createRange();
  contentRange.selectNodeContents(editor);
  const caretY = caretRect.top + caretRect.height / 2;
  const lineRects = Array.from(contentRange.getClientRects()).filter((rect) => {
    const hasSize = rect.width > 0 && rect.height > 0;
    const sameLine = caretY >= rect.top - 1 && caretY <= rect.bottom + 1;
    return hasSize && sameLine;
  });

  return lineRects.some((lineRect) => {
    const leftInset = lineRect.left + 1;
    const rightInset = lineRect.right - 1;
    return caretRect.left > leftInset && caretRect.left < rightInset;
  });
}

function CustomCaretEditor({
  caretShape,
  caretState,
  caretWidth,
  editorRef,
  hideCaret,
  hostRef,
  markTyping,
  updateCaret,
}: {
  caretShape: CustomCaretShape;
  caretState: CustomCaretState;
  caretWidth: number;
  editorRef: RefObject<HTMLDivElement | null>;
  hideCaret: () => void;
  hostRef: RefObject<HTMLDivElement | null>;
  markTyping: () => void;
  updateCaret: () => void;
}) {
  const squareSize = 8;
  const isNativeLike = caretState.isInsideText;
  const overlayHeight =
    caretShape === "square" && !isNativeLike
      ? Math.min(squareSize, caretState.height)
      : caretState.height;
  const overlayTop =
    caretShape === "square" && !isNativeLike
      ? caretState.y + Math.max((caretState.height - overlayHeight) / 2, 0)
      : caretState.y;
  const overlayWidth = isNativeLike ? 1 : caretShape === "square" ? squareSize : caretWidth;
  const overlayStyle = {
    display: caretState.visible ? "block" : "none",
    height: `${overlayHeight}px`,
    left: `${caretState.x}px`,
    top: `${overlayTop}px`,
    width: `${overlayWidth}px`,
  };

  return (
    <div className="space-y-3">
      <div
        ref={hostRef}
        className="relative min-h-44 overflow-auto rounded-xl border bg-background p-4"
        data-el="designsystem.custom-caret-host"
      >
        <div
          ref={editorRef}
          aria-label="Custom caret editor"
          className="min-h-32 whitespace-pre-wrap text-base leading-6 outline-none caret-transparent"
          contentEditable
          data-el="designsystem.custom-caret-editor"
          onBeforeInput={markTyping}
          onBlur={hideCaret}
          onFocus={updateCaret}
          onInput={markTyping}
          onKeyDown={markTyping}
          onKeyUp={updateCaret}
          onMouseUp={updateCaret}
          role="textbox"
          suppressContentEditableWarning
        >
          {`커스텀 caret 테스트 영역입니다.
여기서 클릭하거나 입력하면 native caret은 숨기고 overlay div를 이동시킵니다.
width 버튼으로 caret 넓이를 바꿔보세요.`}
        </div>
        <div
          aria-hidden="true"
          className={
            caretState.isTyping
              ? "pointer-events-none absolute bg-primary opacity-100 shadow-[0_0_0_1px_hsl(var(--background)),0_0_10px_hsl(var(--primary)/0.35)]"
              : "pointer-events-none absolute animate-[custom-caret-blink_1s_steps(1,end)_infinite] bg-primary shadow-[0_0_0_1px_hsl(var(--background)),0_0_10px_hsl(var(--primary)/0.35)]"
          }
          data-el="designsystem.custom-caret-overlay"
          data-native-like={isNativeLike ? "true" : "false"}
          data-shape={caretShape}
          data-typing={caretState.isTyping ? "true" : "false"}
          style={overlayStyle}
        />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        기본 caret의 width/height를 바꾸는 것이 아니라, `caret-color: transparent` 계열로 숨긴 뒤
        collapsed selection의 `Range#getClientRects()` 좌표에 rectangle 또는 small square overlay를
        맞춘다. 텍스트 중간 offset에서는 shape를 무시하고 1px native-like bar로 전환한다.
      </p>
    </div>
  );
}

function CustomCaretControls({
  caretShape,
  caretState,
  caretWidth,
  setCaretShape,
  setCaretWidth,
}: {
  caretShape: CustomCaretShape;
  caretState: CustomCaretState;
  caretWidth: number;
  setCaretShape: (shape: CustomCaretShape) => void;
  setCaretWidth: (width: number) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">Caret shape</p>
        <p className="mt-1 text-sm text-muted-foreground">현재 shape: {caretShape}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CUSTOM_CARET_SHAPES.map((shape) => (
          <Button
            key={shape.value}
            size="sm"
            variant={caretShape === shape.value ? "default" : "outline"}
            onClick={() => setCaretShape(shape.value)}
          >
            {shape.label}
          </Button>
        ))}
      </div>
      <Separator />
      <div>
        <p className="text-sm font-medium">Caret width</p>
        <p className="mt-1 text-sm text-muted-foreground">현재 overlay width: {caretWidth}px</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[2, 4, 8].map((width) => (
          <Button
            key={width}
            size="sm"
            variant={caretWidth === width ? "default" : "outline"}
            onClick={() => setCaretWidth(width)}
          >
            {width}px
          </Button>
        ))}
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted-foreground">x</span>
        <span className="font-mono">{Math.round(caretState.x)}px</span>
        <span className="text-muted-foreground">y</span>
        <span className="font-mono">{Math.round(caretState.y)}px</span>
        <span className="text-muted-foreground">height</span>
        <span className="font-mono">{Math.round(caretState.height)}px</span>
        <span className="text-muted-foreground">inside text</span>
        <span className="font-mono">{caretState.isInsideText ? "yes" : "no"}</span>
      </div>
    </div>
  );
}

function CardPreview() {
  return (
    <PreviewCard title="Card Components">
      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,24rem)_1fr]">
        <FieldFrame label="Project list card">
          <StackedCard layers={3} className="max-w-72" radius="rounded-lg">
            <div
              className={cn(
                "relative z-10 flex aspect-[2/3] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
              )}
            >
              <div className="relative flex flex-1 bg-[linear-gradient(145deg,#d8c7a2_0%,#8ca1a3_52%,#334155_100%)]">
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="absolute right-2 top-2 flex gap-1">
                  <Button size="icon" variant="secondary" className="size-7 bg-card/80">
                    <MoreHorizontal className="size-3.5" />
                    <span className="sr-only">프로젝트 메뉴</span>
                  </Button>
                </div>
              </div>
              <div className="flex flex-none flex-col gap-2 border-t border-border-subtle bg-card px-3.5 py-5">
                <div className="min-w-0 text-lg font-medium leading-tight">고대 항구</div>
                <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  해안 도시의 권력 이동과 실종 사건을 추적하는 프로젝트.
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>12개 문서</span>
                  <span>최근 1일</span>
                </div>
              </div>
            </div>
          </StackedCard>
        </FieldFrame>

        <FieldFrame label="shadcn card surface">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>월드 빌딩</CardTitle>
                <CardDescription>프로젝트 개요와 최근 작업 요약.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">상태</span>
                    <Badge variant="secondary">작성중</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">최근 업데이트</span>
                    <span>오늘</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">열기</Button>
                <Button size="sm" variant="outline">
                  공유
                </Button>
              </CardFooter>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>작은 표면</CardTitle>
                <CardDescription>사이드바와 팝오버 내부 밀도.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Card는 기본 표면, ProjectCard는 실제 프로젝트 목록 표면이다.
                </div>
              </CardContent>
            </Card>
          </div>
        </FieldFrame>
      </div>
    </PreviewCard>
  );
}

function PaperCardPreview() {
  const examples = [
    {
      id: "design-system-paper-card-a",
      name: "고대 항구",
      summary: "해안 도시의 권력 이동과 실종 사건을 추적하는 프로젝트.",
      timeAgo: "1일 전",
      pinned: true,
    },
    {
      id: "design-system-paper-card-b",
      name: "황혼의 기록관",
      summary: "금지된 연대기와 기억을 거래하는 인물들의 장기 플롯.",
      timeAgo: "3시간 전",
      pinned: false,
    },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-base font-semibold tracking-wide text-muted-foreground uppercase">
          Project list paper card
        </p>
        <h3 className="text-2xl font-semibold tracking-tight">프로젝트 목록 카드 표면</h3>
        <p className="max-w-2xl text-base leading-5 text-muted-foreground">
          Paper Card는 프로젝트 목록의 실제 `ProjectCardSurface`를 기준으로 관리한다. 겉보기용
          프레임이나 별도 목업 카드는 두지 않는다.
        </p>
      </section>

      <section className="grid max-w-4xl grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
        {examples.map((project) => (
          <ProjectCardSurface
            key={project.id}
            id={project.id}
            name={project.name}
            summary={project.summary}
            cover={defaultPatternFor(project.id)}
            timeAgo={project.timeAgo}
            ownerInitial="Y"
            actions={<ProjectCardDemoActions pinned={project.pinned} />}
          />
        ))}
      </section>

      <section className="space-y-5">
        <TypographyScaleRow
          name="Ratio"
          className="text-base leading-5 text-foreground"
          sample="aspect-[2/3] / cover + info strip"
          token="ProjectCardSurface"
        />
        <TypographyScaleRow
          name="Stack"
          className="text-base leading-5 text-foreground"
          sample="StackedCard layers={3}"
          token="StackedCard"
        />
        <TypographyScaleRow
          name="Surface"
          className="text-base leading-5 text-foreground"
          sample="border-border-strong/30 / bg-surface-elevated / shadow-sm"
          token="ProjectCardSurface"
        />
      </section>
    </div>
  );
}

function ProjectCardDemoActions({ pinned }: { pinned: boolean }) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={pinned ? "즐겨찾기 해제" : "즐겨찾기"}
        className={cn(
          "size-7 rounded-md p-0 transition-opacity duration-150 ease-out",
          "bg-surface-elevated/75 text-foreground/70 backdrop-blur-md",
          "hover:bg-muted hover:text-foreground",
          pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          pinned && "text-primary hover:bg-primary/10 hover:text-primary",
        )}
      >
        <Star className={cn("size-3.5", pinned && "fill-current")} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="더 보기"
        className={cn(
          "size-7 rounded-md p-0 transition-opacity duration-150 ease-out",
          "bg-surface-elevated/75 text-foreground/70 backdrop-blur-md",
          "hover:bg-muted hover:text-foreground",
          "opacity-0 group-hover:opacity-100",
        )}
      >
        <MoreHorizontal className="size-3.5" />
      </Button>
    </>
  );
}

function CheckboxPreview() {
  return (
    <PreviewCard title="Checkbox Component">
      <div className="grid gap-6 lg:grid-cols-2">
        <FieldSet>
          <FieldLegend>Display properties</FieldLegend>
          <FieldGroup data-slot="checkbox-group">
            {[
              {
                id: "status",
                title: "상태",
                description: "목록 행에 상태 pill을 표시한다.",
                checked: true,
              },
              {
                id: "assignee",
                title: "담당자",
                description: "담당자 avatar stack을 표시한다.",
                checked: true,
              },
              {
                id: "due",
                title: "마감일",
                description: "마감일과 지연 상태를 표시한다.",
                checked: true,
              },
              {
                id: "links",
                title: "링크",
                description: "연결된 문서/퀘스트 링크 수를 표시한다.",
                checked: false,
              },
            ].map(({ id, title, description, checked }) => (
              <Field orientation="horizontal" key={id}>
                <Checkbox id={`checkbox-${id}`} defaultChecked={checked} />
                <FieldContent>
                  <FieldLabel htmlFor={`checkbox-${id}`}>{title}</FieldLabel>
                  <FieldDescription>{description}</FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>States</FieldLegend>
          <FieldGroup data-slot="checkbox-group">
            <Field orientation="horizontal">
              <Checkbox id="checkbox-checked" defaultChecked />
              <FieldLabel htmlFor="checkbox-checked">Checked</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="checkbox-empty" />
              <FieldLabel htmlFor="checkbox-empty">Unchecked</FieldLabel>
            </Field>
            <Field orientation="horizontal" data-disabled>
              <Checkbox id="checkbox-disabled" disabled />
              <FieldLabel htmlFor="checkbox-disabled">Disabled</FieldLabel>
            </Field>
          </FieldGroup>
        </FieldSet>
      </div>
    </PreviewCard>
  );
}

function RadioGroupPreview() {
  const [scope, setScope] = useState("active");

  return (
    <PreviewCard title="Radio Group Component">
      <FieldSet className="max-w-xl">
        <FieldLegend>Scope</FieldLegend>
        <FieldDescription>한 번에 하나만 선택되는 목록 범위.</FieldDescription>
        <RadioGroup value={scope} onValueChange={setScope} className="grid gap-3">
          {[
            ["all", "전체 항목", "보관된 항목까지 포함한다."],
            ["active", "진행 중", "작성 중이거나 진행 중인 항목만 본다."],
            ["archived", "보관됨", "보관 처리된 항목만 본다."],
          ].map(([value, title, description]) => (
            <Field orientation="horizontal" key={value}>
              <RadioGroupItem id={`radio-${value}`} value={value} />
              <FieldContent>
                <FieldLabel htmlFor={`radio-${value}`}>{title}</FieldLabel>
                <FieldDescription>{description}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
    </PreviewCard>
  );
}

function SwitchPreview() {
  const [showReferences, setShowReferences] = useState(true);

  return (
    <PreviewCard title="Switch Component">
      <FieldSet className="max-w-xl">
        <FieldLegend>View options</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="switch-references">연결 표시</FieldLabel>
              <FieldDescription>목록과 상세에서 연결된 노드를 표시한다.</FieldDescription>
            </FieldContent>
            <Switch
              id="switch-references"
              checked={showReferences}
              onCheckedChange={setShowReferences}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="switch-archived">보관 항목 포함</FieldLabel>
              <FieldDescription>검색 결과에 보관된 항목을 포함한다.</FieldDescription>
            </FieldContent>
            <Switch id="switch-archived" />
          </Field>
          <Field orientation="horizontal" data-disabled>
            <FieldContent>
              <FieldLabel htmlFor="switch-disabled">자동 동기화</FieldLabel>
              <FieldDescription>현재 workspace에서는 비활성화된 설정.</FieldDescription>
            </FieldContent>
            <Switch id="switch-disabled" disabled />
          </Field>
        </FieldGroup>
      </FieldSet>
    </PreviewCard>
  );
}

function ToggleGroupPreview() {
  const [mode, setMode] = useState(["relations"]);
  const [properties, setProperties] = useState(["status", "priority"]);

  return (
    <PreviewCard title="Toggle Group Component">
      <div className="grid gap-6 lg:grid-cols-2">
        <FieldSet>
          <FieldLegend>Single selection</FieldLegend>
          <ToggleGroup
            value={mode}
            onValueChange={(values) => values.length > 0 && setMode([values.at(-1) ?? "plain"])}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="plain" aria-label="Plain" className="flex-1">
              Plain
            </ToggleGroupItem>
            <ToggleGroupItem value="relations" aria-label="Relations" className="flex-1">
              Relations
            </ToggleGroupItem>
            <ToggleGroupItem value="meta" aria-label="Meta" className="flex-1">
              Meta
            </ToggleGroupItem>
          </ToggleGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Multiple selection</FieldLegend>
          <ToggleGroup
            value={properties}
            onValueChange={setProperties}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="status" aria-label="Status" className="flex-1">
              Status
            </ToggleGroupItem>
            <ToggleGroupItem value="priority" aria-label="Priority" className="flex-1">
              Priority
            </ToggleGroupItem>
            <ToggleGroupItem value="links" aria-label="Links" className="flex-1">
              Links
            </ToggleGroupItem>
          </ToggleGroup>
        </FieldSet>
      </div>
    </PreviewCard>
  );
}

function SliderPreview() {
  const [signal, setSignal] = useState([68]);

  return (
    <PreviewCard title="Slider Component">
      <FieldSet className="max-w-xl">
        <FieldLegend>Importance signal</FieldLegend>
        <FieldDescription>단일 수치 값을 조정하는 실제 slider 밀도.</FieldDescription>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-base text-muted-foreground">
            <span>중요도 신호</span>
            <span>{signal[0]}%</span>
          </div>
          <Slider
            value={signal}
            onValueChange={(value) => setSignal(Array.isArray(value) ? [...value] : [value])}
            max={100}
            step={1}
          />
        </div>
      </FieldSet>
    </PreviewCard>
  );
}

interface DesignSystemFormValues {
  name: string;
  visibility: "draft" | "active" | "hidden";
  pinned: boolean;
}

function FormPreview() {
  const form = useForm<DesignSystemFormValues>({
    defaultValues: {
      name: "Aethon",
      visibility: "active",
      pinned: true,
    },
  });

  return (
    <PreviewCard title="Form Component">
      <Form {...form}>
        <form className="max-w-xl space-y-5" onSubmit={(event) => event.preventDefault()}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Entity name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="Name" {...field} />
                </FormControl>
                <FormDescription>목록과 상세 상단에 표시되는 이름.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visibility</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid gap-3"
                  >
                    {[
                      ["draft", "Draft"],
                      ["active", "Active"],
                      ["hidden", "Hidden"],
                    ].map(([value, label]) => (
                      <Field orientation="horizontal" key={value}>
                        <RadioGroupItem id={`form-visibility-${value}`} value={value} />
                        <FieldLabel htmlFor={`form-visibility-${value}`}>{label}</FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormDescription>
                  폼 내부에서도 radio group을 같은 방식으로 조합한다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pinned"
            render={({ field }) => (
              <FormItem>
                <Field orientation="horizontal">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <FieldContent>
                    <FormLabel>Pin to sidebar</FormLabel>
                    <FormDescription>중요한 항목을 상세 sidebar 상단에 고정한다.</FormDescription>
                  </FieldContent>
                </Field>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Form>
    </PreviewCard>
  );
}

function NavigationControlsPreview() {
  return (
    <PreviewCard title="Navigation Controls">
      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <FieldFrame label="Breadcrumb / shortcut">
          <div className="space-y-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>세계관</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>캐릭터</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Aethon</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
              <Keyboard className="size-3.5" />
              <span>빠른 전환</span>
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </div>
          </div>
        </FieldFrame>

        <FieldFrame label="Tabs">
          <Tabs defaultValue="outline" className="w-full">
            <TabsList>
              <TabsTrigger value="outline">Outline</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
            </TabsList>
            <TabsContent value="outline" className="mt-4 text-base text-foreground">
              주요 설정, 관계, 상태를 한 화면에서 훑는 상세 탭.
            </TabsContent>
            <TabsContent value="notes" className="mt-4 text-base text-foreground">
              작성 중 메모와 편집 히스토리.
            </TabsContent>
            <TabsContent value="links" className="mt-4 text-base text-foreground">
              연결된 캐릭터, 장소, 퀘스트.
            </TabsContent>
          </Tabs>
        </FieldFrame>
      </div>
    </PreviewCard>
  );
}

function ToolbarPreview() {
  return (
    <PreviewCard title="Toolbar States">
      <div className="space-y-4">
        <ToolbarSurface title="Character list">
          <EntitySubbar
            status="all"
            statusTabs={STATUS_TABS}
            count={24}
            onStatusChange={() => undefined}
            onSettings={() => undefined}
            onSort={() => undefined}
            onViewModeChange={() => undefined}
            viewMode="list"
            viewTabs={["list", "board", "canvas"]}
          />
        </ToolbarSurface>
        <ToolbarSurface title="Canvas">
          <EntitySubbar
            status="draft"
            statusTabs={STATUS_TABS}
            count={8}
            onStatusChange={() => undefined}
            onSettings={() => undefined}
            onViewModeChange={() => undefined}
            viewMode="canvas"
            viewTabs={["list", "canvas"]}
          />
        </ToolbarSurface>
        <ToolbarSurface title="View off">
          <EntitySubbar
            status="review"
            statusTabs={STATUS_TABS}
            count={12}
            allowViewModeOff
            onStatusChange={() => undefined}
            onViewModeChange={() => undefined}
            viewMode={null}
            viewTabs={["list", "board", "canvas"]}
          />
        </ToolbarSurface>
      </div>
    </PreviewCard>
  );
}

function SidebarPreview() {
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("p1");
  const [locked, setLocked] = useState(false);
  const [memoPressed, setMemoPressed] = useState(true);
  const [density, setDensity] = useState("comfortable");
  const [visibleTools, setVisibleTools] = useState(["preview", "links"]);
  const [documentCount, setDocumentCount] = useState(12);
  const [deadline, setDeadline] = useState("18:30");
  const [selectedTags, setSelectedTags] = useState(["main", "arc"]);

  return (
    <PreviewCard title="Sidebar Components">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SidebarRowsPreview />
        <SidebarTextFieldsPreview />
        <SidebarNumberTimePreview
          documentCount={documentCount}
          deadline={deadline}
          onDocumentCountChange={setDocumentCount}
          onDeadlineChange={setDeadline}
        />
        <SidebarSelectFieldsPreview
          status={status}
          priority={priority}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
        />
        <SidebarToggleFieldsPreview
          locked={locked}
          memoPressed={memoPressed}
          selectedTags={selectedTags}
          onLockedChange={setLocked}
          onMemoPressedChange={setMemoPressed}
          onSelectedTagsChange={setSelectedTags}
        />
        <SidebarIconToggleFieldsPreview
          density={density}
          visibleTools={visibleTools}
          onDensityChange={setDensity}
          onVisibleToolsChange={setVisibleTools}
        />
        <SidebarAvatarFieldsPreview />
      </div>
    </PreviewCard>
  );
}

function SidebarRowsPreview() {
  return (
    <SidebarPreviewCard>
      <MetaSection
        title="기본 행"
        icon={<CheckCircle2 className="size-3.5 text-muted-foreground" />}
        count={3}
      >
        <SidebarItem primary="상태" secondary="작성 중" />
        <SidebarItem primary="수정" secondary="2시간 전" />
        <SidebarItemAdd label="연결 추가" onClick={() => undefined} />
      </MetaSection>
    </SidebarPreviewCard>
  );
}

function SidebarTextFieldsPreview() {
  return (
    <SidebarPreviewCard>
      <MetaSection title="입력" icon={<BookOpen className="size-3.5 text-muted-foreground" />}>
        <SidebarInputField label="표시 이름" defaultValue="Aethon" description="짧은 단일 값." />
        <SidebarTextareaField
          label="요약"
          defaultValue="선택의 결과가 관계와 세계 상태에 누적되는 인물."
          description="긴 메모와 설명."
        />
      </MetaSection>
    </SidebarPreviewCard>
  );
}

function SidebarNumberTimePreview({
  documentCount,
  deadline,
  onDocumentCountChange,
  onDeadlineChange,
}: {
  documentCount: number;
  deadline: string;
  onDocumentCountChange: (value: number) => void;
  onDeadlineChange: (value: string) => void;
}) {
  return (
    <SidebarPreviewCard>
      <MetaSection title="수치" icon={<Calendar className="size-3.5 text-muted-foreground" />}>
        <SidebarNumberField
          label="문서 수"
          value={documentCount}
          min={0}
          max={99}
          unit="개"
          description="숫자 입력과 단위."
          onValueChange={(next) => onDocumentCountChange(next ?? 0)}
        />
        <SidebarTimeField
          label="마감 시간"
          value={deadline}
          description="시간 입력."
          onValueChange={onDeadlineChange}
        />
        <SidebarTimeField
          label="마감일"
          type="date"
          defaultValue="2026-05-18"
          description="날짜 입력."
        />
      </MetaSection>
    </SidebarPreviewCard>
  );
}

function SidebarSelectFieldsPreview({
  status,
  priority,
  onStatusChange,
  onPriorityChange,
}: {
  status: string;
  priority: string;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
}) {
  return (
    <SidebarPreviewCard>
      <MetaSection title="선택" icon={<Tag className="size-3.5 text-muted-foreground" />}>
        <SidebarSelectField
          label="상태"
          value={status}
          onValueChange={onStatusChange}
          options={[
            { value: "draft", label: "초안" },
            { value: "active", label: "작성 중" },
            { value: "done", label: "완료" },
          ]}
        />
        <SidebarSelectField
          label="우선순위"
          value={priority}
          onValueChange={onPriorityChange}
          options={[
            { value: "p0", label: "P0" },
            { value: "p1", label: "P1" },
            { value: "p2", label: "P2" },
          ]}
        />
      </MetaSection>
    </SidebarPreviewCard>
  );
}

function SidebarToggleFieldsPreview({
  locked,
  memoPressed,
  selectedTags,
  onLockedChange,
  onMemoPressedChange,
  onSelectedTagsChange,
}: {
  locked: boolean;
  memoPressed: boolean;
  selectedTags: string[];
  onLockedChange: (value: boolean) => void;
  onMemoPressedChange: (value: boolean) => void;
  onSelectedTagsChange: (value: string[]) => void;
}) {
  return (
    <SidebarPreviewCard>
      <MetaSection title="토글" icon={<Sparkles className="size-3.5 text-muted-foreground" />}>
        <SidebarToggleField
          label="고정"
          description="상세 rail 상단에 유지."
          checked={locked}
          onCheckedChange={onLockedChange}
        />
        <SidebarToggleButtonField
          label="작가 메모"
          description="버튼형 boolean 상태."
          pressed={memoPressed}
          buttonLabel={memoPressed ? "On" : "Off"}
          onPressedChange={onMemoPressedChange}
        />
        <SidebarChipToggleField
          label="태그"
          selectedIds={selectedTags}
          onToggle={(id, selected) =>
            onSelectedTagsChange(
              selected ? [...selectedTags, id] : selectedTags.filter((item) => item !== id),
            )
          }
          options={[
            { id: "main", label: "주인공" },
            { id: "arc", label: "arc" },
            { id: "hidden", label: "비공개" },
          ]}
        />
      </MetaSection>
    </SidebarPreviewCard>
  );
}

function SidebarIconToggleFieldsPreview({
  density,
  visibleTools,
  onDensityChange,
  onVisibleToolsChange,
}: {
  density: string;
  visibleTools: string[];
  onDensityChange: (value: string) => void;
  onVisibleToolsChange: (value: string[]) => void;
}) {
  return (
    <SidebarPreviewCard>
      <MetaSection title="아이콘 토글" icon={<Rows3 className="size-3.5 text-muted-foreground" />}>
        <SidebarIconToggleField
          label="밀도"
          description="Toolbar icon toggle과 같은 단일 선택."
          value={density}
          onValueChange={onDensityChange}
          options={[
            { id: "compact", label: "Compact", icon: <Rows3 className="size-3.5" /> },
            { id: "comfortable", label: "Comfortable", icon: <List className="size-3.5" /> },
            { id: "grid", label: "Grid", icon: <Grid2X2 className="size-3.5" /> },
          ]}
        />
        <SidebarIconMultiToggleField
          label="표시 도구"
          description="복수 아이콘 토글."
          selectedIds={visibleTools}
          onValueChange={onVisibleToolsChange}
          options={[
            { id: "preview", label: "Preview", icon: <Eye className="size-3.5" /> },
            { id: "hidden", label: "Hidden", icon: <EyeOff className="size-3.5" /> },
            { id: "links", label: "Links", icon: <Link2 className="size-3.5" /> },
          ]}
        />
      </MetaSection>
    </SidebarPreviewCard>
  );
}

function SidebarAvatarFieldsPreview() {
  return (
    <SidebarPreviewCard>
      <MetaSection title="아바타" icon={<Users className="size-3.5 text-muted-foreground" />}>
        <SidebarAvatarField
          label="담당자"
          description="단일/복수 avatar 표시."
          avatars={[
            { id: "hana", name: "Hana", initials: "H", color: "#C9A861" },
            { id: "kai", name: "Kai", initials: "K", color: "#5A7A8F" },
            { id: "vera", name: "Vera", initials: "V", color: "#8B5CF6" },
            { id: "zion", name: "Zion", initials: "Z", color: "#4F7A3E" },
          ]}
        />
        <SidebarAvatarField
          label="검토자"
          avatars={[{ id: "remy", name: "Remy", initials: "R", color: "#D4675A" }]}
        />
      </MetaSection>
    </SidebarPreviewCard>
  );
}

function SidebarPreviewCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">{children}</CardContent>
    </Card>
  );
}

function PopoverPreview() {
  return (
    <PreviewCard title="Popover Component">
      <div className="grid gap-4 lg:grid-cols-2">
        <PopoverComponentPreview />
        <PopoverPanelPreview />
      </div>
    </PreviewCard>
  );
}

function ComboboxPreview() {
  return (
    <PreviewCard title="Combobox Component">
      <div className="grid gap-4 lg:grid-cols-2">
        <FieldFrame label="Single select">
          <Combobox
            items={["캐릭터", "장소", "세력", "용어"]}
            name="designsystem-entity-type"
            defaultValue="캐릭터"
          >
            <ComboboxInput
              name="designsystem-entity-type"
              placeholder="엔티티 타입 선택"
              showClear
            />
            <ComboboxContent>
              <ComboboxEmpty>검색 결과 없음</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </FieldFrame>

        <FieldFrame label="Object items">
          <Combobox
            items={[
              { label: "Aethon", value: "aethon", type: "캐릭터" },
              { label: "오래된 항구", value: "old-harbor", type: "장소" },
              { label: "북부 연합", value: "north-union", type: "세력" },
            ]}
            name="designsystem-entity"
            itemToStringValue={(item) => item.label}
            defaultValue={{ label: "Aethon", value: "aethon", type: "캐릭터" }}
          >
            <ComboboxInput name="designsystem-entity" placeholder="엔티티 검색" showClear />
            <ComboboxContent>
              <ComboboxEmpty>검색 결과 없음</ComboboxEmpty>
              <ComboboxList>
                {(item: { label: string; value: string; type: string }) => (
                  <ComboboxItem key={item.value} value={item}>
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.type}</span>
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </FieldFrame>
      </div>
    </PreviewCard>
  );
}

function CommandPreview() {
  return (
    <PreviewCard title="Command Component">
      <FieldFrame label="Command">
        <Command className="h-auto max-w-sm rounded-lg border shadow-xs">
          <CommandInput name="designsystem-command" placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>Calendar</CommandItem>
              <CommandItem>Search Emoji</CommandItem>
              <CommandItem>Calculator</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Settings">
              <CommandItem>
                Profile
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
              <CommandItem>
                Billing
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
              <CommandItem>
                Settings
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </FieldFrame>
    </PreviewCard>
  );
}

function ContextMenuPreview() {
  return (
    <PreviewCard title="Context Menu Component">
      <div className="grid gap-4 lg:grid-cols-2">
        <FieldFrame label="Right click trigger">
          <ContextMenu>
            <ContextMenuTrigger className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground">
              우클릭 또는 길게 눌러 액션 열기
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              <ContextMenuGroup>
                <ContextMenuLabel>캐릭터</ContextMenuLabel>
                <ContextMenuItem>
                  <FileText className="size-3.5" />
                  상세 열기
                  <ContextMenuShortcut>↵</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem>
                  <Link2 className="size-3.5" />
                  링크 복사
                  <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuGroup>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem checked>속성 표시</ContextMenuCheckboxItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>상태 변경</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-40">
                  <ContextMenuRadioGroup defaultValue="writing">
                    <ContextMenuRadioItem value="draft">초안</ContextMenuRadioItem>
                    <ContextMenuRadioItem value="writing">작성중</ContextMenuRadioItem>
                    <ContextMenuRadioItem value="done">완료</ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuContent>
          </ContextMenu>
        </FieldFrame>

        <FieldFrame label="Static anatomy">
          <Card size="sm">
            <CardHeader>
              <CardTitle>구성 요소</CardTitle>
              <CardDescription>
                Trigger, Content, Group, Item, Checkbox, Radio, Submenu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="rounded-md bg-muted px-3 py-2">ContextMenuItem + shortcut</div>
                <div className="rounded-md bg-muted px-3 py-2">ContextMenuCheckboxItem</div>
                <div className="rounded-md bg-muted px-3 py-2">ContextMenuSub + RadioGroup</div>
              </div>
            </CardContent>
          </Card>
        </FieldFrame>
      </div>
    </PreviewCard>
  );
}

function DropdownMenuPreview() {
  return (
    <PreviewCard title="Dropdown Menu Component">
      <FieldFrame label="Menu / tooltip">
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              정렬 기준
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>목록 보기</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked>우선순위</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={false}>업데이트</DropdownMenuCheckboxItem>
                <DropdownMenuItem>
                  <Settings className="size-3.5 text-muted-foreground" />
                  고급 설정
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger render={<Button variant="secondary" size="icon" />}>
              <MoreHorizontal className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">추가 액션</TooltipContent>
          </Tooltip>
        </div>
      </FieldFrame>
    </PreviewCard>
  );
}

function TablePreview() {
  return (
    <PreviewCard title="EntityTable Component">
      <ActualEntityTableFrame addLabel="새 캐릭터 추가" />
    </PreviewCard>
  );
}

function DialogPreview() {
  return (
    <PreviewCard title="Dialog Component">
      <Dialog>
        <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>Dialog description text sits below the title.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PreviewCard>
  );
}

function EmptyStatePreview() {
  return (
    <PreviewCard title="Empty State Component">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={<BookOpen className="size-8" />}
            title="No items"
            description="Empty state with one action."
            actionLabel="Add item"
            onAction={() => undefined}
          />
        </div>
        <div className="rounded-2xl border border-dashed bg-muted/30">
          <EmptyComingSoon
            icon={<Sparkles className="size-8" />}
            title="Coming soon"
            description="Passive empty state without action."
          />
        </div>
      </div>
    </PreviewCard>
  );
}

function FeedbackPreview() {
  return (
    <PreviewCard title="Feedback Components">
      <div className="grid gap-4 xl:grid-cols-2">
        <FieldFrame label="Alert / progress">
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="size-3.5" />
              <AlertTitle>동기화 지연</AlertTitle>
              <AlertDescription>
                일부 변경사항이 저장 대기 중이다. 연결이 복구되면 자동으로 반영된다.
              </AlertDescription>
            </Alert>
            <Progress value={64}>
              <ProgressLabel className="text-base">초안 저장</ProgressLabel>
              <ProgressValue className="text-base" />
            </Progress>
          </div>
        </FieldFrame>

        <FieldFrame label="Loading surfaces">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-base text-muted-foreground">
              <Spinner />
              <span>관계 그래프를 불러오는 중</span>
            </div>
            <Separator />
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
        </FieldFrame>
      </div>
    </PreviewCard>
  );
}

type AiComponentInventoryItem = {
  id: string;
  name: string;
  path: string;
};

const AI_COMPONENT_INVENTORY: AiComponentInventoryItem[] = [
  { id: "actions", name: "Actions", path: "packages/ui/src/components/ai/actions.tsx" },
  { id: "agent", name: "Agent", path: "packages/ui/src/components/ai/agent.tsx" },
  { id: "artifact", name: "Artifact", path: "packages/ui/src/components/ai/artifact.tsx" },
  { id: "attachments", name: "Attachments", path: "packages/ui/src/components/ai/attachments.tsx" },
  {
    id: "audio-player",
    name: "Audio Player",
    path: "packages/ui/src/components/ai/audio-player.tsx",
  },
  { id: "branch", name: "Branch", path: "packages/ui/src/components/ai/branch.tsx" },
  { id: "canvas", name: "Canvas", path: "packages/ui/src/components/ai/canvas.tsx" },
  {
    id: "chain-of-thought",
    name: "Chain Of Thought",
    path: "packages/ui/src/components/ai/chain-of-thought.tsx",
  },
  { id: "checkpoint", name: "Checkpoint", path: "packages/ui/src/components/ai/checkpoint.tsx" },
  { id: "code-block", name: "Code Block", path: "packages/ui/src/components/ai/code-block.tsx" },
  { id: "commit", name: "Commit", path: "packages/ui/src/components/ai/commit.tsx" },
  {
    id: "confirmation",
    name: "Confirmation",
    path: "packages/ui/src/components/ai/confirmation.tsx",
  },
  { id: "connection", name: "Connection", path: "packages/ui/src/components/ai/connection.tsx" },
  { id: "context", name: "Context", path: "packages/ui/src/components/ai/context.tsx" },
  { id: "controls", name: "Controls", path: "packages/ui/src/components/ai/controls.tsx" },
  {
    id: "conversation",
    name: "Conversation",
    path: "packages/ui/src/components/ai/conversation.tsx",
  },
  { id: "edge", name: "Edge", path: "packages/ui/src/components/ai/edge.tsx" },
  {
    id: "environment-variables",
    name: "Environment Variables",
    path: "packages/ui/src/components/ai/environment-variables.tsx",
  },
  { id: "file-tree", name: "File Tree", path: "packages/ui/src/components/ai/file-tree.tsx" },
  { id: "image", name: "Image", path: "packages/ui/src/components/ai/image.tsx" },
  {
    id: "inline-citation",
    name: "Inline Citation",
    path: "packages/ui/src/components/ai/inline-citation.tsx",
  },
  { id: "loader", name: "Loader", path: "packages/ui/src/components/ai/loader.tsx" },
  { id: "message", name: "Message", path: "packages/ui/src/components/ai/message.tsx" },
  {
    id: "mic-selector",
    name: "Mic Selector",
    path: "packages/ui/src/components/ai/mic-selector.tsx",
  },
  {
    id: "model-selector",
    name: "Model Selector",
    path: "packages/ui/src/components/ai/model-selector.tsx",
  },
  { id: "node", name: "Node", path: "packages/ui/src/components/ai/node.tsx" },
  {
    id: "open-in-chat",
    name: "Open In Chat",
    path: "packages/ui/src/components/ai/open-in-chat.tsx",
  },
  {
    id: "package-info",
    name: "Package Info",
    path: "packages/ui/src/components/ai/package-info.tsx",
  },
  { id: "panel", name: "Panel", path: "packages/ui/src/components/ai/panel.tsx" },
  { id: "persona", name: "Persona", path: "packages/ui/src/components/ai/persona.tsx" },
  { id: "plan", name: "Plan", path: "packages/ui/src/components/ai/plan.tsx" },
  {
    id: "prompt-input",
    name: "Prompt Input",
    path: "packages/ui/src/components/ai/prompt-input.tsx",
  },
  { id: "queue", name: "Queue", path: "packages/ui/src/components/ai/queue.tsx" },
  { id: "reasoning", name: "Reasoning", path: "packages/ui/src/components/ai/reasoning.tsx" },
  { id: "sandbox", name: "Sandbox", path: "packages/ui/src/components/ai/sandbox.tsx" },
  {
    id: "schema-display",
    name: "Schema Display",
    path: "packages/ui/src/components/ai/schema-display.tsx",
  },
  { id: "shimmer", name: "Shimmer", path: "packages/ui/src/components/ai/shimmer.tsx" },
  { id: "snippet", name: "Snippet", path: "packages/ui/src/components/ai/snippet.tsx" },
  { id: "sources", name: "Sources", path: "packages/ui/src/components/ai/sources.tsx" },
  {
    id: "speech-input",
    name: "Speech Input",
    path: "packages/ui/src/components/ai/speech-input.tsx",
  },
  { id: "stack-trace", name: "Stack Trace", path: "packages/ui/src/components/ai/stack-trace.tsx" },
  { id: "suggestion", name: "Suggestion", path: "packages/ui/src/components/ai/suggestion.tsx" },
  { id: "task", name: "Task", path: "packages/ui/src/components/ai/task.tsx" },
  { id: "terminal", name: "Terminal", path: "packages/ui/src/components/ai/terminal.tsx" },
  {
    id: "test-results",
    name: "Test Results",
    path: "packages/ui/src/components/ai/test-results.tsx",
  },
  { id: "tool", name: "Tool", path: "packages/ui/src/components/ai/tool.tsx" },
  { id: "toolbar", name: "Toolbar", path: "packages/ui/src/components/ai/toolbar.tsx" },
  {
    id: "transcription",
    name: "Transcription",
    path: "packages/ui/src/components/ai/transcription.tsx",
  },
  {
    id: "voice-selector",
    name: "Voice Selector",
    path: "packages/ui/src/components/ai/voice-selector.tsx",
  },
  { id: "web-preview", name: "Web Preview", path: "packages/ui/src/components/ai/web-preview.tsx" },
];

const AI_ON_DEMAND_COMPONENT_IDS = new Set([
  "attachments",
  "audio-player",
  "canvas",
  "edge",
  "mic-selector",
  "persona",
  "speech-input",
  "voice-selector",
  "web-preview",
]);

const AI_COMPONENT_DEMOS: Record<string, () => ReactNode> = {
  actions: ActionsDemo,
  agent: AgentDemo,
  artifact: ArtifactDemo,
  attachments: AttachmentsDemo,
  "audio-player": AudioPlayerDemo,
  branch: BranchDemo,
  canvas: CanvasDemo,
  "chain-of-thought": ChainOfThoughtDemo,
  checkpoint: CheckpointDemo,
  "code-block": CodeBlockDemo,
  commit: CommitDemo,
  confirmation: ConfirmationDemo,
  connection: ConnectionDemo,
  context: ContextDemo,
  controls: ControlsDemo,
  conversation: ConversationDemo,
  edge: EdgeDemo,
  "environment-variables": EnvironmentVariablesDemo,
  "file-tree": FileTreeDemo,
  image: ImageDemo,
  "inline-citation": InlineCitationDemo,
  loader: LoaderDemo,
  message: MessageDemo,
  "mic-selector": MicSelectorDemo,
  "model-selector": ModelSelectorDemo,
  node: NodeDemo,
  "open-in-chat": OpenInChatDemo,
  "package-info": PackageInfoDemo,
  panel: PanelDemo,
  persona: PersonaDemo,
  plan: PlanDemo,
  "prompt-input": PromptInputDemo,
  queue: QueueDemo,
  reasoning: ReasoningDemo,
  sandbox: SandboxDemo,
  "schema-display": SchemaDisplayDemo,
  snippet: SnippetDemo,
  sources: SourcesDemo,
  "speech-input": SpeechInputDemo,
  "stack-trace": StackTraceDemo,
  suggestion: SuggestionDemo,
  task: TaskDemo,
  terminal: TerminalDemo,
  "test-results": TestResultsDemo,
  tool: ToolDemo,
  toolbar: ToolbarDemo,
  transcription: TranscriptionDemo,
  "voice-selector": VoiceSelectorDemo,
  "web-preview": WebPreviewDemo,
};

function AiComponentsPreview() {
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const primaryComponents = AI_COMPONENT_INVENTORY.filter(
    (item) => !AI_ON_DEMAND_COMPONENT_IDS.has(item.id),
  );
  const onDemandComponents = AI_COMPONENT_INVENTORY.filter((item) =>
    AI_ON_DEMAND_COMPONENT_IDS.has(item.id),
  );
  const activeComponent = onDemandComponents.find((item) => item.id === activeComponentId);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 divide-y divide-border">
        {primaryComponents.map((item) => (
          <AiComponentInventoryRow item={item} key={item.id} />
        ))}
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="space-y-1">
          <h3 className="font-medium text-base">On-demand Components</h3>
          <p className="text-base text-muted-foreground">
            무거운 media, canvas, voice 계열은 이 영역에서 하나씩 연다.
          </p>
        </div>
        <div className="divide-y divide-border border-y">
          {onDemandComponents.map((item) => (
            <section
              className="space-y-2 py-3"
              data-el="designsystem.ai-component-row"
              key={item.id}
            >
              <Button
                className="h-auto w-full justify-start px-0 text-left"
                variant="ghost"
                onClick={() => setActiveComponentId(item.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-base">{item.name}</span>
                  <span className="block truncate font-mono text-base text-muted-foreground">
                    {item.path}
                  </span>
                </span>
              </Button>
            </section>
          ))}
        </div>
        {activeComponent ? (
          <div className="space-y-3 border-t pt-4">
            <div className="space-y-1">
              <h3 className="font-medium text-base">{activeComponent.name}</h3>
              <div className="truncate font-mono text-base text-muted-foreground">
                {activeComponent.path}
              </div>
            </div>
            <AiComponentInventorySample id={activeComponent.id} name={activeComponent.name} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function AiComponentInventoryRow({ item }: { item: AiComponentInventoryItem }) {
  return (
    <section
      className="grid gap-4 py-5 lg:grid-cols-[240px_minmax(0,1fr)]"
      data-el="designsystem.ai-component-row"
    >
      <div className="min-w-0 space-y-1">
        <h3 className="font-medium text-base">{item.name}</h3>
        <div className="truncate font-mono text-base text-muted-foreground">{item.path}</div>
      </div>
      <AiComponentInventorySample id={item.id} name={item.name} />
    </section>
  );
}

function AiComponentInventorySample({ id, name }: { id: string; name: string }) {
  if (id === "shimmer") {
    return (
      <div className="text-base">
        <Shimmer>관계: 보호자 → 배신자 → 협력자</Shimmer>
      </div>
    );
  }

  const Demo = AI_COMPONENT_DEMOS[id];

  if (Demo) {
    return (
      <div className="min-w-0 [&_[data-slot=input-group]]:max-w-2xl">
        <Demo />
      </div>
    );
  }

  switch (id) {
    case "actions":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline">
            다시 생성
          </Button>
          <Button size="sm" variant="ghost">
            복사
          </Button>
          <Button size="sm" variant="ghost">
            삽입
          </Button>
        </div>
      );
    case "agent":
      return <AiInlineState title="Hana" meta="온라인 · 모델 라우팅 준비" tone="success" />;
    case "artifact":
      return (
        <AiArtifactSample title="문서 초안.md" body="요구사항, 결정사항, 후속 작업을 한 파일로 묶는다." />
      );
    case "attachments":
      return <AiPillRow values={["document.md", "portrait.png", "timeline.csv"]} />;
    case "audio-player":
      return <AiMeterSample label="voice-note.wav" value="00:18 / 01:04" />;
    case "branch":
      return <AiPillRow values={["초안", "대안 A", "대안 B"]} activeIndex={1} />;
    case "canvas":
      return <AiCanvasSample />;
    case "chain-of-thought":
      return <AiStepSample steps={["목표 확인", "충돌 후보", "다음 행동"]} />;
    case "checkpoint":
      return <AiInlineState title="Checkpoint" meta="autosave · 14:32" tone="neutral" />;
    case "code-block":
      return (
        <AiCodeSample lines={["const document = createDocument();", "await document.resolveConflict();"]} />
      );
    case "commit":
      return (
        <AiInlineState
          title="feat: add lore assistant"
          meta="3 files · 128 insertions"
          tone="success"
        />
      );
    case "confirmation":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base">lore.update 실행</span>
          <Button size="sm">승인</Button>
          <Button size="sm" variant="outline">
            거절
          </Button>
        </div>
      );
    case "connection":
      return <AiConnectionSample label="character → event → consequence" />;
    case "context":
      return <AiPillRow values={["캐릭터", "최근 선택", "관계 그래프"]} />;
    case "controls":
      return (
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="outline">
            +
          </Button>
          <Button size="icon-sm" variant="outline">
            -
          </Button>
          <Button size="sm" variant="outline">
            Fit
          </Button>
        </div>
      );
    case "conversation":
      return <AiConversationSample />;
    case "edge":
      return <AiConnectionSample label="lore.search → summarize" />;
    case "environment-variables":
      return (
        <AiKeyValueSample
          rows={[
            ["MODEL", "gpt-4.1"],
            ["REGION", "ap-northeast-2"],
          ]}
        />
      );
    case "file-tree":
      return <AiStepSample steps={["characters.ts", "events.ts", "relations.ts"]} />;
    case "image":
      return (
        <div className="h-20 rounded-lg border bg-muted" aria-label="Generated image preview" />
      );
    case "inline-citation":
      return <AiInlineText text="사건의 원인은 이전 선택에서 확정된다." badge="[1]" />;
    case "loader":
      return (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader size={16} />
          <span>다음 제안을 생성 중</span>
        </div>
      );
    case "message":
      return <AiMessageSample />;
    case "mic-selector":
      return <AiPillRow values={["내장 마이크", "Studio Mic"]} activeIndex={1} />;
    case "model-selector":
      return <AiPillRow values={["fast", "balanced", "reasoning"]} activeIndex={2} />;
    case "node":
      return (
        <Node handles={{ source: false, target: false }} className="max-w-md">
          <NodeHeader>
            <NodeTitle>lore.search</NodeTitle>
          </NodeHeader>
          <NodeContent>
            <div className="text-base text-muted-foreground">query: Aethon 관계 · 결과 3개</div>
          </NodeContent>
        </Node>
      );
    case "open-in-chat":
      return (
        <Button size="sm" variant="outline">
          채팅에서 열기
        </Button>
      );
    case "package-info":
      return (
        <AiKeyValueSample
          rows={[
            ["@repo/ui", "workspace"],
            ["@xyflow/react", "graph"],
          ]}
        />
      );
    case "panel":
      return (
        <AiArtifactSample title="Inspector" body="선택한 노드의 입력과 출력 상태를 표시한다." />
      );
    case "persona":
      return <AiInlineState title="Archivist" meta="세계관 정리 담당" tone="neutral" />;
    case "plan":
      return <AiStepSample steps={["자료 수집", "충돌 정리", "초안 반영"]} checked />;
    case "prompt-input":
      return (
        <PromptInput className="max-w-2xl" multiple onSubmit={() => {}}>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputBody>
            <PromptInputTextarea
              defaultValue="캐릭터 관계를 한 단락으로 정리해줘."
              placeholder="무엇을 정리할까?"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments label="파일 추가" />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit />
          </PromptInputFooter>
        </PromptInput>
      );
    case "queue":
      return <AiStepSample steps={["document.summarize", "lore.search", "timeline.update"]} />;
    case "reasoning":
      return (
        <Reasoning defaultOpen duration={8}>
          <ReasoningTrigger />
          <ReasoningContent>
            캐릭터 목표, 현재 위치, 최근 선택지를 함께 보고 다음 충돌 후보를 찾는다.
          </ReasoningContent>
        </Reasoning>
      );
    case "sandbox":
      return <AiCodeSample lines={["$ pnpm test lore", "✓ 18 passed"]} />;
    case "schema-display":
      return <AiCodeSample lines={['{ "name": "string",', '  "status": "draft" }']} />;
    case "shimmer":
      return (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      );
    case "snippet":
      return <AiCodeSample lines={["관계: 보호자 → 배신자 → 협력자"]} />;
    case "sources":
      return <AiStepSample steps={["인물 기록", "사건 로그", "캔버스 노트"]} />;
    case "speech-input":
      return <AiMeterSample label="음성 입력 대기" value="입력 감지 중" />;
    case "stack-trace":
      return (
        <AiCodeSample lines={["Error: missing relation", "at resolveLoreGraph"]} tone="danger" />
      );
    case "suggestion":
      return <AiPillRow values={["감정선 요약", "다음 사건", "관계 갱신"]} activeIndex={0} />;
    case "task":
      return <AiMeterSample label="작업 실행" value="2 / 5 완료" />;
    case "terminal":
      return <AiCodeSample lines={["$ product-builder ai run", "ready in 412ms"]} />;
    case "test-results":
      return <AiPillRow values={["18 passed", "0 failed", "2 skipped"]} activeIndex={0} />;
    case "tool":
      return (
        <AiInlineState title="tool:lore.search" meta="input 확인 · output 3개" tone="neutral" />
      );
    case "toolbar":
      return (
        <ToggleGroup value={["preview"]}>
          <ToggleGroupItem value="edit">Edit</ToggleGroupItem>
          <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
          <ToggleGroupItem value="diff">Diff</ToggleGroupItem>
        </ToggleGroup>
      );
    case "transcription":
      return <AiInlineText text="그때 문이 열리고, 모두가 같은 이름을 들었다." badge="00:18" />;
    case "voice-selector":
      return <AiPillRow values={["Calm", "Bright", "Narrator"]} activeIndex={2} />;
    case "web-preview":
      return <AiWebPreviewSample />;
    default:
      return <AiInlineState title={name} meta="preview" tone="neutral" />;
  }
}

function AiInlineState({
  title,
  meta,
  tone,
}: {
  title: string;
  meta: string;
  tone: "neutral" | "success";
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "size-2 rounded-full",
          tone === "success" ? "bg-emerald-500" : "bg-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <div className="font-medium text-base">{title}</div>
        <div className="truncate text-base text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}

function AiArtifactSample({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-lg space-y-2 border-l pl-4">
      <div className="font-medium text-base">{title}</div>
      <div className="text-base text-muted-foreground">{body}</div>
    </div>
  );
}

function AiPillRow({ values, activeIndex = -1 }: { values: string[]; activeIndex?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value, index) => (
        <Badge key={value} variant={index === activeIndex ? "default" : "secondary"}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

function AiMeterSample({ label, value }: { label: string; value: string }) {
  return (
    <div className="max-w-md space-y-2">
      <div className="flex items-center justify-between gap-3 text-base">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <Progress value={42} />
    </div>
  );
}

function AiCanvasSample() {
  return (
    <div className="grid max-w-lg grid-cols-[1fr_48px_1fr] items-center gap-2">
      <div className="rounded-lg border bg-background px-3 py-2 text-base">Character</div>
      <div className="h-px bg-border" />
      <div className="rounded-lg border bg-background px-3 py-2 text-base">Event</div>
    </div>
  );
}

function AiStepSample({ steps, checked = false }: { steps: string[]; checked?: boolean }) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div className="flex items-center gap-2 text-base" key={step}>
          <span className="flex size-5 items-center justify-center rounded-full border text-muted-foreground">
            {checked ? <Check className="size-3.5" /> : index + 1}
          </span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function AiCodeSample({
  lines,
  tone = "neutral",
}: {
  lines: string[];
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={cn(
        "max-w-xl rounded-lg border bg-muted/40 p-3 font-mono text-base",
        tone === "danger" && "border-destructive/40 text-destructive",
      )}
    >
      {lines.map((line) => (
        <div className="truncate" key={line}>
          {line}
        </div>
      ))}
    </div>
  );
}

function AiConnectionSample({ label }: { label: string }) {
  return (
    <div className="flex max-w-lg items-center gap-3 text-base">
      <span className="size-3 rounded-full border bg-background" />
      <span className="h-px flex-1 bg-border" />
      <span className="text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
      <span className="size-3 rounded-full border bg-background" />
    </div>
  );
}

function AiKeyValueSample({ rows }: { rows: [string, string][] }) {
  return (
    <div className="max-w-md space-y-2">
      {rows.map(([key, value]) => (
        <div className="grid grid-cols-[160px_1fr] gap-3 text-base" key={key}>
          <span className="font-mono text-muted-foreground">{key}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

function AiInlineText({ text, badge }: { text: string; badge: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-base">
      <span>{text}</span>
      <Badge variant="outline">{badge}</Badge>
    </div>
  );
}

function AiConversationSample() {
  return (
    <div className="max-w-xl space-y-3 text-base">
      <div className="ml-auto max-w-[80%] rounded-lg bg-secondary px-4 py-3">
        이 문서의 핵심 결정을 요약해줘.
      </div>
      <div className="max-w-[80%] text-foreground">
        핵심 결정은 서버 권위 데이터 경로를 유지하고, 임시 로컬 상태는 보조 캐시로 제한하는 것입니다.
      </div>
    </div>
  );
}

function AiMessageSample() {
  return (
    <div className="max-w-xl border-l pl-4 text-base">
      <div className="font-medium">assistant</div>
      <div className="text-muted-foreground">
        선택지는 보류하고, 먼저 인물의 현재 목표를 확정한다.
      </div>
    </div>
  );
}

function AiWebPreviewSample() {
  return (
    <div className="max-w-lg overflow-hidden rounded-lg border">
      <div className="flex gap-1 border-b bg-muted px-3 py-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="size-2 rounded-full bg-muted-foreground/40" />
      </div>
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

function SettingsComponentsPreview() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-base font-semibold tracking-wide text-muted-foreground uppercase">
          Settings structure
        </p>
        <h3 className="text-2xl font-semibold tracking-tight">설정 사이드바와 항목 패턴</h3>
        <p className="max-w-2xl text-base leading-5 text-muted-foreground">
          실제 `/settings/*` 페이지에서 쓰는 사이드바, 입력, 선택, 읽기 전용, 리스트, 위험 액션
          구조를 같은 컴포넌트로 관리한다.
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsSidebarNav
          groups={[
            {
              id: "personal",
              label: "Personal",
              items: [
                { id: "profile", label: "Profile", active: true },
                { id: "security", label: "Security" },
                { id: "notifications", label: "Notifications" },
              ],
            },
            {
              id: "organization",
              label: "Organization",
              items: [
                { id: "organization-general", label: "Organization" },
                { id: "members", label: "Members" },
              ],
            },
          ]}
          renderItem={(item, className) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              data-active={item.active ? "true" : undefined}
              className={cn(className, "justify-start border-0 bg-transparent shadow-none")}
            >
              {item.label}
            </Button>
          )}
        />

        <div className="flex flex-col gap-8">
          <SettingItem title="Name" description="Blur 시 변경 사항을 저장하는 단일 입력.">
            <Input defaultValue="Yujin" />
          </SettingItem>

          <SettingItem title="Language" description="프로필 언어처럼 하나의 값을 선택한다.">
            <Select defaultValue="ko">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </SettingItem>

          <SettingItem
            title="Color mode"
            description="토글 그룹으로 상호 배타적인 표시 방식을 고른다."
          >
            <ToggleGroup value={["system"]} spacing={2}>
              <ToggleGroupItem value="light">Light</ToggleGroupItem>
              <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
              <ToggleGroupItem value="system">System</ToggleGroupItem>
            </ToggleGroup>
          </SettingItem>

          <SettingItem
            title="Email notifications"
            description="즉시 반영되는 boolean 설정은 우측 control 슬롯을 쓴다."
            layout="inline"
            control={<Switch defaultChecked />}
          />

          <SettingItem title="Members" description="읽기 중심 리스트는 SetListRow를 조합한다.">
            <div className="space-y-1">
              <SetListRow
                leading={<HueAvatar name="Hana" hue={28} size="md" />}
                title="Hana"
                sub="Owner"
                trailing={<Pill tone="success">active</Pill>}
              />
              <SetListRow
                leading={<HueAvatar name="Kai" hue={190} size="md" />}
                title="Kai"
                sub="Editor"
                trailing={
                  <Button size="sm" variant="outline">
                    Manage
                  </Button>
                }
              />
            </div>
          </SettingItem>

          <SettingItem title="Delete project" tone="danger">
            <SetDangerZone
              title="Delete Ancient Harbor"
              description="삭제 전에 확인 문구를 요구하는 destructive action."
            >
              <Button type="button" variant="destructive">
                Delete
              </Button>
            </SetDangerZone>
          </SettingItem>
        </div>
      </section>
    </div>
  );
}

function PatternPreview({ section }: { section: DesignSystemSection }) {
  switch (section.id) {
    case "page-shell":
      return <PageShellPattern />;
    case "entity-page":
      return <EntityPagePattern />;
    case "detail-page":
      return <DetailPagePattern />;
    default:
      return <PageShellPattern />;
  }
}

function PageShellPattern() {
  return (
    <PatternSurface title="PageLayout Pattern">
      <div className="h-[32rem] overflow-hidden bg-background">
        <PageLayout
          crumbs={[{ label: "세계관" }, { label: "캐릭터" }]}
          onAdd={() => undefined}
          addLabel="새 캐릭터"
        >
          <EntitySubbar
            status="all"
            statusTabs={STATUS_TABS}
            count={DESIGN_ENTITY_ROWS.length}
            onSettings={() => undefined}
            onStatusChange={() => undefined}
            onViewModeChange={() => undefined}
            viewMode="list"
            viewTabs={["list", "board", "canvas"]}
          />
          <ActualEntityTableFrame addLabel="새 캐릭터 추가" />
        </PageLayout>
      </div>
    </PatternSurface>
  );
}

function EntityPagePattern() {
  const [grouping, setGrouping] = useState("status");
  const [ordering, setOrdering] = useState("priority");
  const [recent, setRecent] = useState("7d");
  const [showSubItems, setShowSubItems] = useState(true);
  const [visiblePropertyIds, setVisiblePropertyIds] = useState<DesignPropertyId[]>(
    DEFAULT_VISIBLE_PROPERTIES,
  );
  const rows = getConfiguredDesignRows({
    grouping,
    ordering,
    recent,
    showSubItems,
  });

  return (
    <PatternSurface title="EntityListView Composition">
      <div className="h-[32rem] overflow-hidden bg-background">
        <PageLayout
          crumbs={[{ label: "세계관" }, { label: "캐릭터" }]}
          onAdd={() => undefined}
          addLabel="새 캐릭터"
        >
          <EntitySubbar
            status="all"
            statusTabs={STATUS_TABS}
            count={DESIGN_ENTITY_ROWS.length}
            onSort={() => undefined}
            settingsSlot={
              <EntityPageSettingsPopover
                groupingValue={grouping}
                onGroupingChange={setGrouping}
                orderingValue={ordering}
                onOrderingChange={setOrdering}
                recentValue={recent}
                onRecentChange={setRecent}
                visiblePropertyIds={visiblePropertyIds}
                onPropertyToggle={(id, enabled) => {
                  const propertyId = id as DesignPropertyId;
                  setVisiblePropertyIds((current) =>
                    enabled
                      ? [...current, propertyId]
                      : current.filter((item) => item !== propertyId),
                  );
                }}
                showSubItems={showSubItems}
                onShowSubItemsChange={setShowSubItems}
              />
            }
            onStatusChange={() => undefined}
            onViewModeChange={() => undefined}
            viewMode="list"
            viewTabs={["list", "board", "canvas"]}
            allowViewModeOff
          />
          <ActualEntityTableFrame
            addLabel="새 캐릭터 추가"
            rows={rows}
            visiblePropertyIds={visiblePropertyIds}
            showSubItems={showSubItems}
          />
        </PageLayout>
      </div>
    </PatternSurface>
  );
}

function DetailPagePattern() {
  return (
    <PatternSurface title="DetailPageShell Composition">
      <div className="h-[32rem] overflow-hidden bg-background">
        <DetailPageShell
          breadcrumbs={[
            { label: "세계관", onClick: () => undefined },
            { label: "캐릭터", onClick: () => undefined },
          ]}
          currentLabel="Aethon"
          onBack={() => undefined}
          editor={
            <div className="relative flex h-full min-h-0 flex-1 flex-col">
              <Input
                type="text"
                value="Aethon"
                readOnly
                aria-label="상세 제목"
                className="h-auto rounded-none border-0 bg-transparent px-10 pt-8 pb-2 text-2xl font-semibold text-foreground shadow-none outline-none focus-visible:ring-0 md:text-2xl"
              />
              <div className="min-h-0 flex-1 overflow-auto px-10 py-6">
                <div className="max-w-2xl space-y-4 text-base leading-5 text-foreground/80">
                  <p>
                    오래된 도시의 기록을 따라 움직이는 주인공. 선택의 결과가 관계와 세계 상태에
                    누적되는 상세 페이지의 본문 영역이다.
                  </p>
                  <p className="text-muted-foreground">
                    실제 페이지에서는 이 영역에 문서 에디터가 들어가고, 오른쪽 rail에는 페이지
                    유형별 sidebar item만 달라진다.
                  </p>
                </div>
              </div>
            </div>
          }
          sidebar={<DetailPageSidebarPreview />}
          focusAside={<DetailPageFocusAside />}
        />
      </div>
    </PatternSurface>
  );
}

function DetailPageSidebarPreview() {
  return (
    <>
      <MetaSection title="인물" icon={<Users className="size-3.5 text-muted-foreground" />} count={2}>
        <SidebarItem primary="Nova" secondary="조력자 · 3 mentions" />
        <SidebarItem primary="Mira" secondary="갈등 관계 · 1 mention" />
      </MetaSection>
      <MetaSection title="연결" icon={<Link2 className="size-3.5 text-muted-foreground" />} count={3}>
        <SidebarItem primary="오래된 항구" secondary="장소" />
        <SidebarItem primary="북부 길드" secondary="세력" />
      </MetaSection>
      <MetaSection title="태그" icon={<Tag className="size-3.5 text-muted-foreground" />} count={2}>
        <div className="flex flex-wrap gap-1.5 px-2 py-1">
          <span className="rounded-full bg-muted px-2.5 py-1 text-base text-foreground/70">
            주인공
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-base text-foreground/70">
            arc
          </span>
        </div>
      </MetaSection>
      <MetaSection className="mt-auto">
        <SidebarItem primary="글자 수" secondary="1,284자" />
        <SidebarItem primary="수정" secondary="2시간 전" />
      </MetaSection>
    </>
  );
}

function DetailPageFocusAside() {
  return (
    <div className="pt-[72px] opacity-[0.15] transition-opacity duration-300 hover:opacity-60">
      <div className="space-y-3 text-sm text-foreground">
        <div>
          <div className="text-xs text-muted-foreground">글자 수</div>
          <div className="font-medium">1,284자</div>
        </div>
      </div>
    </div>
  );
}

function EntityPageSettingsPopover({
  groupingValue,
  onGroupingChange,
  orderingValue,
  onOrderingChange,
  recentValue,
  onRecentChange,
  visiblePropertyIds,
  onPropertyToggle,
  showSubItems,
  onShowSubItemsChange,
}: {
  groupingValue: string;
  onGroupingChange: (value: string) => void;
  orderingValue: string;
  onOrderingChange: (value: string) => void;
  recentValue: string;
  onRecentChange: (value: string) => void;
  visiblePropertyIds: DesignPropertyId[];
  onPropertyToggle: (id: string, enabled: boolean) => void;
  showSubItems: boolean;
  onShowSubItemsChange: (checked: boolean) => void;
}) {
  const { t } = useFeatureTranslation("page.designsystem");
  const labels = {
    trigger: t("list.settings.trigger"),
    title: t("list.settings.title"),
    description: t("list.settings.description"),
    grouping: t("list.settings.grouping"),
    ordering: t("list.settings.ordering"),
    recent: t("list.settings.recent"),
    showSubItems: t("list.settings.showSubItems"),
    displayProperties: t("list.settings.displayProperties"),
  };
  const groupingOptions = [
    { value: "none", label: t("list.settings.groupingOptions.none") },
    { value: "status", label: t("list.settings.groupingOptions.status") },
    { value: "assignees", label: t("list.settings.groupingOptions.assignees") },
  ];
  const orderingOptions = [
    { value: "priority", label: t("list.settings.orderingOptions.priority") },
    { value: "updated", label: t("list.settings.orderingOptions.updated") },
    { value: "due", label: t("list.settings.orderingOptions.due") },
    { value: "name", label: t("list.settings.orderingOptions.name") },
  ];
  const recentOptions = [
    { value: "1d", label: t("list.settings.recentOptions.1d") },
    { value: "7d", label: t("list.settings.recentOptions.7d") },
    { value: "30d", label: t("list.settings.recentOptions.30d") },
    { value: "all", label: t("list.settings.recentOptions.all") },
  ];
  const properties: ListViewSettingProperty[] = DESIGN_LIST_PROPERTY_IDS.map((id) => ({
    id,
    label: t(`list.settings.properties.${id}`),
    enabled: visiblePropertyIds.includes(id),
  }));

  return (
    <ListViewSettingPopover
      labels={labels}
      groupingValue={groupingValue}
      groupingOptions={groupingOptions}
      onGroupingChange={onGroupingChange}
      orderingValue={orderingValue}
      orderingOptions={orderingOptions}
      onOrderingChange={onOrderingChange}
      recentValue={recentValue}
      recentOptions={recentOptions}
      onRecentChange={onRecentChange}
      properties={properties}
      onPropertyToggle={onPropertyToggle}
      showSubItems={showSubItems}
      onShowSubItemsChange={onShowSubItemsChange}
    />
  );
}

function CodeReferences({ section }: { section: DesignSystemSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Code References</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {section.sourcePaths.map((path) => (
            <code key={path} className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
              {path}
            </code>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PatternSurface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function StateFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function FieldFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ToolbarSurface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function ActualEntityTableFrame({
  addLabel,
  rows = DESIGN_ENTITY_ROWS,
  visiblePropertyIds = DEFAULT_VISIBLE_PROPERTIES,
  showSubItems = true,
}: {
  addLabel: string;
  rows?: DesignEntityRow[];
  visiblePropertyIds?: DesignPropertyId[];
  showSubItems?: boolean;
}) {
  const columns = [
    DESIGN_ENTITY_COLUMN_BY_ID.name,
    ...visiblePropertyIds.map((propertyId) => DESIGN_ENTITY_COLUMN_BY_ID[propertyId]),
  ];
  const gridTemplate = [
    DESIGN_COLUMN_WIDTH.name,
    ...visiblePropertyIds.map((propertyId) => DESIGN_COLUMN_WIDTH[propertyId]),
  ].join(" ");

  return (
    <div className="flex h-72 min-h-0 flex-col overflow-hidden bg-background py-3">
      <EntityTable<DesignEntityRow>
        data={rows}
        columns={columns}
        gridTemplate={gridTemplate}
        onAddRow={() => undefined}
        addLabel={addLabel}
        getSubRows={(row) => (showSubItems ? row.subRows : undefined)}
      />
    </div>
  );
}

function getConfiguredDesignRows({
  grouping,
  ordering,
  recent,
  showSubItems,
}: {
  grouping: string;
  ordering: string;
  recent: string;
  showSubItems: boolean;
}): DesignEntityRow[] {
  const recentDays = getRecentDays(recent);
  const rows = DESIGN_ENTITY_ROWS.filter((row) => row.updatedDays <= recentDays).map((row) => ({
    ...row,
    subRows: showSubItems
      ? row.subRows?.filter((subRow) => subRow.updatedDays <= recentDays)
      : undefined,
  }));

  return rows.sort((left, right) => {
    const groupCompare = compareByGrouping(left, right, grouping);
    if (groupCompare !== 0) return groupCompare;
    return compareByOrdering(left, right, ordering);
  });
}

function getRecentDays(recent: string): number {
  if (recent === "1d") return 1;
  if (recent === "7d") return 7;
  if (recent === "30d") return 30;
  return Number.POSITIVE_INFINITY;
}

function compareByGrouping(left: DesignEntityRow, right: DesignEntityRow, grouping: string) {
  if (grouping === "status") return left.status.localeCompare(right.status);
  if (grouping === "assignees") {
    const leftName = left.assignees[0]?.name ?? "";
    const rightName = right.assignees[0]?.name ?? "";
    return leftName.localeCompare(rightName);
  }
  return 0;
}

function compareByOrdering(left: DesignEntityRow, right: DesignEntityRow, ordering: string) {
  if (ordering === "priority") return left.priorityRank - right.priorityRank;
  if (ordering === "updated") return left.updatedDays - right.updatedDays;
  if (ordering === "due") return left.dueRank - right.dueRank;
  return left.name.localeCompare(right.name);
}

function TokenSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className={cn("min-h-28 rounded-2xl p-4 shadow-xs", className)}>
      <div className="text-sm font-semibold">{name}</div>
      <div className="mt-8 text-xs opacity-75">.{name}</div>
    </div>
  );
}

function RhythmCard({
  title,
  detail,
  className,
}: {
  title: string;
  detail: string;
  className: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-2xl border bg-card", className)}>
      <div className="h-2 rounded-full bg-primary/20" />
      <div className="h-2 rounded-full bg-primary/30" />
      <div className="h-2 rounded-full bg-primary/40" />
      <div className="mt-2 text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function PopoverComponentPreview() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Trigger
      </div>
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
      </Popover>
    </div>
  );
}

function PopoverPanelPreview() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline" />}>Open content</PopoverTrigger>
        <PopoverContent className="relative mt-3 w-72">
          <PopoverHeader>
            <PopoverTitle>Popover content</PopoverTitle>
            <PopoverDescription>Header, description, then compact rows.</PopoverDescription>
          </PopoverHeader>
          <div className="mt-4 space-y-2">
            {["Option one", "Option two", "Option three"].map((item, index) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                {item}
                {index === 0 ? <Check className="size-3.5 text-primary" /> : null}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function GenericComponentPreview({ section }: { section: DesignSystemSection }) {
  return (
    <PreviewCard title={section.title}>
      <div className="rounded-2xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        실제 컴포넌트가 연결된 섹션만 노출한다.
      </div>
    </PreviewCard>
  );
}
