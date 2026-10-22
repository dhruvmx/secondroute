"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/types";
export const useUI = create<{ role: Role; setRole: (role: Role) => void }>(
  (set) => ({ role: "coordinator", setRole: (role) => set({ role }) }),
);

export type SidebarMode = "open" | "closed" | "hover";
export const useSidebar = create<{
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
}>()(
  persist((set) => ({ mode: "open", setMode: (mode) => set({ mode }) }), {
    name: "secondroute.sidebar.v1",
    skipHydration: true,
    merge: (saved, current) => {
      const mode = (saved as { mode?: unknown } | undefined)?.mode;
      return {
        ...current,
        mode: mode === "closed" || mode === "hover" ? mode : "open",
      };
    },
  }),
);
