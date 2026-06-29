/**
 * StandardDetailLayout — character-full.html 기준 상세 페이지 내부 레이아웃
 *
 * Structure (inside AppShellWrapper main area):
 *   flex-col
 *     toolbar (44px, optional)
 *     flex-1 content area
 *       paper card area (flex-1, centered, max-width 720px, memo-card-wrap)
 *       meta sidebar (260px, optional)
 *
 * Values extracted from character-full.html:
 *   - toolbar: height 44px, padding 0 16px, gap 4px
 *   - paper area: padding 8px, align center, paper max-width 720px
 *   - paper card: bg #FFF, border 1px solid rgba(0,0,0,0.06), border-radius 12px 12px 14px 12px, padding 24px
 *   - memo-card-wrap::before: translate(2px,3px) shadow card
 *   - meta sidebar: width 260px, padding 16px, gap 24px between sections
 */

import { cn } from "~/lib/utils";

interface StandardDetailLayoutProps {
  /** Optional toolbar row (back button, title, actions) */
  toolbar?: React.ReactNode;
  /** Paper card content (entity header, editor, etc.) */
  children: React.ReactNode;
  /** Meta sidebar content (properties, relations, graph, etc.) */
  metaSidebar?: React.ReactNode;
  className?: string;
}

export function StandardDetailLayout({
  toolbar,
  children,
  metaSidebar,
  className,
}: StandardDetailLayoutProps) {
  return (
    <div
      className={cn("flex flex-1 flex-col", className)}
      style={{ backgroundColor: "rgb(250, 250, 250)" }}
    >
      {/* Toolbar — 44px height */}
      {toolbar && (
        <div
          className="flex shrink-0 items-center"
          style={{ height: "44px", padding: "0 16px", gap: "4px" }}
        >
          {toolbar}
        </div>
      )}

      {/* Content area: paper + meta */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Paper card area — centered, scrollable */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px",
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* memo-card-wrap — stacked paper effect */}
          <div
            className="memo-card-wrap"
            style={{
              flex: 1,
              maxWidth: "720px",
              width: "100%",
              marginLeft: "4px",
              position: "relative",
            }}
          >
            {/* Shadow card (::before equivalent) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgb(255, 255, 255)",
                border: "1px solid rgba(0, 0, 0, 0.06)",
                borderRadius: "12px",
                transform: "translate(2px, 3px)",
                zIndex: 0,
              }}
            />
            {/* Paper card */}
            <div
              style={{
                backgroundColor: "rgb(255, 255, 255)",
                border: "1px solid rgba(0, 0, 0, 0.06)",
                borderRadius: "12px 12px 14px 12px",
                padding: "24px",
                position: "relative",
                zIndex: 1,
                height: "100%",
              }}
            >
              {children}
            </div>
          </div>
        </div>

        {/* Meta sidebar — 260px */}
        {metaSidebar && (
          <div
            style={{
              width: "260px",
              flexShrink: 0,
              padding: "16px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {metaSidebar}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shared detail sub-components ───────────────────────── */

/** Toolbar icon button — 28x28, rounded-md */
export function ToolbarIconButton({
  children,
  title,
  muted = false,
}: {
  children: React.ReactNode;
  title?: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      className="flex items-center justify-center"
      style={{
        width: "28px",
        height: "28px",
        borderRadius: "6px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: muted ? "rgb(163, 163, 163)" : "rgb(23, 23, 23)",
      }}
    >
      {children}
    </button>
  );
}

/** Meta section title — uppercase, 13px, 600, muted */
export function MetaSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "13px",
        fontWeight: 600,
        color: "rgb(163, 163, 163)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

/** Property row — key: value in 100px + 1fr grid */
export function DetailPropRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: "8px",
        padding: "4px 0",
        fontSize: "13px",
        alignItems: "center",
      }}
    >
      <span style={{ color: "rgb(163, 163, 163)" }}>{label}</span>
      <span style={{ color: "rgb(82, 82, 82)" }}>{value}</span>
    </div>
  );
}

/** Relation row — avatar/dot + name + type */
export function DetailRelationRow({
  avatar,
  dot,
  name,
  type,
}: {
  avatar?: string;
  dot?: boolean;
  name: string;
  type: string;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "4px 0", fontSize: "13px" }}
    >
      <span className="flex items-center" style={{ gap: "6px" }}>
        {avatar && (
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "9999px",
              backgroundColor: "rgb(235, 235, 235)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "8px",
              fontWeight: 600,
              color: "rgb(82, 82, 82)",
              flexShrink: 0,
            }}
          >
            {avatar}
          </span>
        )}
        {dot && (
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: "rgb(163, 163, 163)",
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ color: "rgb(82, 82, 82)" }}>{name}</span>
      </span>
      <span style={{ fontSize: "13px", color: "rgb(163, 163, 163)" }}>{type}</span>
    </div>
  );
}

/** Meta item — dot + text */
export function DetailMetaItem({
  children,
  dotColor,
  shortcut,
}: {
  children: React.ReactNode;
  dotColor?: string;
  shortcut?: string;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "2px 0", fontSize: "13px", color: "rgb(82, 82, 82)" }}
    >
      <span className="flex items-center" style={{ gap: "6px" }}>
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: dotColor || "rgb(163, 163, 163)",
            flexShrink: 0,
          }}
        />
        {children}
      </span>
      {shortcut && (
        <span
          style={{
            fontSize: "12px",
            color: "rgb(163, 163, 163)",
            backgroundColor: "rgb(245, 245, 245)",
            padding: "1px 5px",
            borderRadius: "3px",
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  );
}

/** Activity item */
export function DetailActivityItem({ time, text }: { time: string; text: string }) {
  return (
    <div style={{ fontSize: "13px" }}>
      <span style={{ color: "rgb(163, 163, 163)" }}>{time}</span> &middot;{" "}
      <span style={{ color: "rgb(82, 82, 82)" }}>{text}</span>
    </div>
  );
}

/** Graph mini placeholder */
export function DetailGraphMini() {
  return (
    <div
      style={{
        backgroundColor: "rgb(245, 245, 245)",
        borderRadius: "6px",
        height: "100px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "rgb(166, 139, 75)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "rgb(139, 92, 246)",
          top: "20%",
          left: "25%",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "rgb(139, 92, 246)",
          top: "25%",
          right: "22%",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "rgb(22, 163, 74)",
          bottom: "25%",
          left: "30%",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "rgb(245, 158, 11)",
          bottom: "22%",
          right: "25%",
        }}
      />
      <svg style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.15 }}>
        <line x1="50%" y1="50%" x2="25%" y2="20%" stroke="rgb(163, 163, 163)" strokeWidth="1" />
        <line x1="50%" y1="50%" x2="78%" y2="25%" stroke="rgb(163, 163, 163)" strokeWidth="1" />
        <line x1="50%" y1="50%" x2="30%" y2="75%" stroke="rgb(163, 163, 163)" strokeWidth="1" />
        <line x1="50%" y1="50%" x2="75%" y2="78%" stroke="rgb(163, 163, 163)" strokeWidth="1" />
      </svg>
    </div>
  );
}

/** Editor toolbar buttons — B I H2 — " */
export function DetailEditorToolbar() {
  return (
    <div className="flex" style={{ gap: "2px", marginBottom: "8px", padding: "4px 0" }}>
      {[
        { label: "B", style: { fontWeight: 700 } },
        { label: "I", style: { fontStyle: "italic" as const } },
        { label: "H2", style: {} },
        { label: "\u2014", style: {} },
        { label: "\u201C", style: {} },
      ].map((btn) => (
        <button
          key={btn.label}
          type="button"
          style={{
            all: "unset",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "13px",
            color: "rgb(163, 163, 163)",
            cursor: "pointer",
            fontFamily: "inherit",
            ...btn.style,
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

/** Mention inline text */
export function DetailMention({
  children,
  type = "character",
}: {
  children: React.ReactNode;
  type?: "character" | "location" | "faction" | "item";
}) {
  const colors: Record<string, string> = {
    character: "rgb(166, 139, 75)",
    location: "rgb(22, 163, 74)",
    faction: "rgb(245, 158, 11)",
    item: "rgb(90, 122, 143)",
  };
  return (
    <span style={{ fontWeight: 500, color: colors[type] || colors.character, cursor: "pointer" }}>
      {children}
    </span>
  );
}

/** Add item link — "+" text button */
export function DetailAddButton({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "4px 0" }}>
      <span style={{ color: "rgb(163, 163, 163)", fontSize: "13px", cursor: "default" }}>
        {children}
      </span>
    </div>
  );
}

/* Icons */

export function ArrowLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

export function MoreHorizontalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}
