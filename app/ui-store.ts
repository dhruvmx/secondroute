"use client";
import { create } from "zustand";
import type { Role } from "@/lib/types";
export const useUI = create<{ role: Role; setRole: (role: Role) => void }>(
  (set) => ({ role: "coordinator", setRole: (role) => set({ role }) }),
);
