import type React from "react";
import { SignUp01 } from "../blocks/sign-up-01";
import { SignUp02 } from "../blocks/sign-up-02";
import { SignUp03 } from "../blocks/sign-up-03";
import { SignUp04 } from "../blocks/sign-up-04";
import { SignUp05 } from "../blocks/sign-up-05";
import { type AuthUiVariant, authConfig } from "../config";

const variantMap: Partial<Record<AuthUiVariant, React.ComponentType>> = {
  1: SignUp01,
  2: SignUp02,
  3: SignUp03,
  4: SignUp04,
  5: SignUp05,
};

export function SignUpForm() {
  const Component = variantMap[authConfig.uiVariant] ?? SignUp01;
  return <Component />;
}
