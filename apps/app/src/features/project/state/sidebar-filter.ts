/**
 * DashboardLayout (HubSidebar) and UserHome page so clicking 즐겨찾기/최근/아카이브/휴지통
 * in the sidebar changes the visible project set.
 */

import { atom } from "jotai";

export type SidebarFilter = "all" | "starred" | "recent" | "archived" | "trash";

export const sidebarFilterAtom = atom<SidebarFilter>("all");
