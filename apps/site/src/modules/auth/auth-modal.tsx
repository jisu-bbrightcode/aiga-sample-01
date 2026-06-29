"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { useAuthModal } from "./auth-modal-store";
import { SignInView } from "./sign-in-view";
import { SignUpView } from "./sign-up-view";

/** Single auth modal host, driven by the global auth-modal store. */
export function AuthModal() {
  const { open, view, setOpen } = useAuthModal();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{view === "sign-in" ? "로그인" : "회원가입"}</DialogTitle>
          <DialogDescription>
            {view === "sign-in"
              ? "계정에 로그인해 계속하세요."
              : "새 계정을 만들어 시작하세요."}
          </DialogDescription>
        </DialogHeader>
        {view === "sign-in" ? <SignInView /> : <SignUpView />}
      </DialogContent>
    </Dialog>
  );
}
