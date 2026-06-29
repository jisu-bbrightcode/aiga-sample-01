"use client";

import { atom, useAtom } from "jotai";

export type AuthView = "sign-in" | "sign-up";

interface AuthModalState {
  open: boolean;
  view: AuthView;
}

const authModalAtom = atom<AuthModalState>({ open: false, view: "sign-in" });

/** Global handle to open/close the auth modal from anywhere (header, gated actions). */
export function useAuthModal() {
  const [state, setState] = useAtom(authModalAtom);
  return {
    open: state.open,
    view: state.view,
    openAuthModal: (view: AuthView = "sign-in") => setState({ open: true, view }),
    setView: (view: AuthView) => setState((s) => ({ ...s, view })),
    setOpen: (open: boolean) => setState((s) => ({ ...s, open })),
    close: () => setState((s) => ({ ...s, open: false })),
  };
}
