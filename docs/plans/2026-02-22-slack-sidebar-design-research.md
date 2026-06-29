# Research: Slack Workspace Organization & Channel Sidebar Layout

**Date**: 2026-02-22
**Topic**: Slack Design Patterns for Sidebar and Workspace Navigation

## 1. Workspace Organization
Slack manages multiple workspaces through a dedicated vertical navigation element, which has evolved significantly in the 2023/2024 redesign.

### Patterns:
*   **Workspace Switcher**: A vertical bar on the far left containing workspace icons (rounded squares).
*   **Collapsed Switcher**: In the latest redesign, the switcher can be collapsed into a single menu icon to maximize focus.
*   **Multi-Workspace Awareness**: Badges on workspace icons indicate unread activity in other workspaces.

**Evidence**:
> "Our attempt to create focus by permanently collapsing down other workspaces into a menu was cumbersome for people who need to monitor other Slacks. We revived it as an option, while allowing it to collapse for people who want a more focused experience."
> — [A more focused, productive Slack](https://slack.design/articles/a-more-focused-productive-slack/)

## 2. Channel Hierarchy and Nesting
Slack avoids deep nesting in favor of a flat, user-customizable grouping system.

### Patterns:
*   **Custom Sections**: Users can create named sections (e.g., "Projects", "Social") to group channels and DMs.
*   **Collapsible Sections**: Each section has a chevron toggle to hide/show its contents.
*   **Dynamic Sorting**: Sections can be configured to show only unread channels or sort by recent activity.
*   **Flat Hierarchy**: Slack does not support folders-within-folders; it uses a single level of sections.

**Evidence**:
> "Organize your sidebar with custom sections... You can create custom sections to group channels, direct messages (DMs), and apps in your sidebar."
> — [Slack Help Center](https://slack.com/help/articles/201355156-Organize-your-sidebar-with-custom-sections)

## 3. Sidebar Navigation Components (2023 Redesign)
The redesign introduced a "Tab-based" navigation to separate different modes of work.

### Components:
*   **Primary Tabs**:
    *   **Home**: The main channel and DM list.
    *   **DMs**: A dedicated view for all direct conversations.
    *   **Activity**: A unified feed for mentions, reactions, and thread replies.
    *   **Later**: A curated space for saved items and reminders.
*   **Peeks**: Hovering over a tab icon (e.g., DMs) shows a preview overlay of recent activity without switching the main view.
*   **Bloops**: Real-time activity indicators on tab icons.
*   **Create Button**: A prominent "plus" button for starting new messages or channels from any view.

**Evidence**:
> "In the end our optimal tab set included DMs, Activity, and Later... Peeks became a simple way to get the best of both worlds: creating space for concentration while allowing a glance into more hectic areas of Slack."
> — [A more focused, productive Slack](https://slack.design/articles/a-more-focused-productive-slack/)

## 4. Indicators and Status
Visual cues are used to convey state without cluttering the UI.

### Indicators:
*   **Unread Indicator**: A simple white dot (or bold text) next to a channel/DM name.
*   **Mention Badge**: A red circle with a number for direct mentions.
*   **Availability Status**:
    *   **Active**: Solid green circle.
    *   **Away**: Hollow circle.
    *   **DND**: Red circle with a white horizontal line.
*   **Status Emoji**: Appears next to the user's name; full text is visible on hover.

**Evidence**:
> "Availability refers to the dot next your display name that indicates if you’re active in Slack... A status is a message that lets others know what you’re up to."
> — [Slack Help Center](https://slack.com/help/articles/201864558-Set-your-Slack-status-and-availability)

## 5. Visual Language
The "New Visual Language" (2023) focuses on "softness" and "depth".

### Visual Patterns:
*   **Rounded Corners**: Increased border-radius on avatars, buttons, and containers.
*   **Elevation**: Use of subtle shadows and layering to define different parts of the UI (e.g., the sidebar vs. the message pane).
*   **Reduced Lines**: Removal of unnecessary separators; headers only show separators on scroll.
*   **Theming**: A simplified system with 20 predetermined color palettes to ensure contrast and accessibility.

**Evidence**:
> "We softened the tone with more rounded buttons and avatars and less stark borders. We introduced elevation and depth to help delineate different parts of the UI."
> — [A new visual language for Slack](https://slack.design/articles/a-new-visual-language-for-slack/)
