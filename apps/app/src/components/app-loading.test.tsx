import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AppAuthLoadingState,
  AppLoadingState,
  AppQuietLoadingState,
  AppWorkspaceLoadingState,
  LoadingLottie,
  QuietLoadingIndicator,
} from "./app-loading";

vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: ({
    autoplay,
    className,
    loop,
    src,
  }: {
    autoplay?: boolean;
    className?: string;
    loop?: boolean;
    src?: string;
  }) => (
    <div
      data-autoplay={String(Boolean(autoplay))}
      data-class={className}
      data-loop={String(Boolean(loop))}
      data-src={src}
      data-testid="dotlottie"
    />
  ),
}));

describe("app loading components", () => {
  it("renders the shared liquid splats animation as the app loading indicator", () => {
    render(<LoadingLottie label="불러오는 중" size="sm" />);

    expect(screen.getByRole("status", { name: "불러오는 중" })).toHaveClass("size-12");
    expect(screen.getByTestId("dotlottie")).toHaveAttribute(
      "data-src",
      "/loading/liquid-splats.lottie",
    );
    expect(screen.getByTestId("dotlottie")).toHaveAttribute("data-loop", "true");
    expect(screen.getByTestId("dotlottie")).toHaveAttribute("data-autoplay", "true");
  });

  it("uses the same animation inside labeled page loading states", () => {
    render(<AppLoadingState label="문서 로딩 중..." />);

    expect(screen.getByRole("status", { name: "문서 로딩 중..." })).toBeInTheDocument();
    expect(screen.getByText("문서 로딩 중...")).toBeInTheDocument();
    expect(screen.getByTestId("dotlottie")).toHaveAttribute(
      "data-src",
      "/loading/liquid-splats.lottie",
    );
  });

  it("hides visible copy for fullscreen auth and workspace refresh fallbacks", () => {
    const { rerender } = render(<AppAuthLoadingState />);

    expect(screen.getByRole("status", { name: "인증 상태 확인 중..." })).toHaveClass("size-32");
    expect(screen.queryByText("인증 상태 확인 중...")).not.toBeInTheDocument();
    expect(screen.getByTestId("dotlottie")).toHaveAttribute(
      "data-src",
      "/loading/liquid-splats.lottie",
    );

    rerender(<AppWorkspaceLoadingState />);

    expect(screen.getByRole("status", { name: "워크스페이스 확인 중..." })).toHaveClass("size-32");
    expect(screen.queryByText("워크스페이스 확인 중...")).not.toBeInTheDocument();
  });

  it("keeps fullscreen loading copy accessible without rendering it under the animation", () => {
    render(<AppLoadingState label="앱 준비 중..." variant="fullscreen" />);

    expect(screen.getByRole("status", { name: "앱 준비 중..." })).toBeInTheDocument();
    expect(screen.queryByText("앱 준비 중...")).not.toBeInTheDocument();
  });

  it("renders quiet loading without the Lottie animation", () => {
    render(<AppQuietLoadingState label="프로젝트 불러오는 중..." />);

    expect(screen.getByRole("status", { name: "프로젝트 불러오는 중..." })).toBeInTheDocument();
    expect(screen.queryByTestId("dotlottie")).not.toBeInTheDocument();
  });

  it("renders a compact quiet loading indicator for partial loading", () => {
    render(<QuietLoadingIndicator label="저장 중" />);

    expect(screen.getByRole("status", { name: "저장 중" })).toHaveTextContent("저장 중");
    expect(screen.queryByTestId("dotlottie")).not.toBeInTheDocument();
  });
});
