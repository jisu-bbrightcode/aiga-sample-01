/**
 * FileUpload component tests (PB-FILE-UI-001 / BBR-554).
 *
 * Exercises the reusable `@repo/ui` uploader through a controllable fake
 * transport, covering every acceptance criterion: client + server validation
 * errors, progress/cancel/retry/complete state, auth-modal gating, and target
 * resource + policy prop injection.
 *
 * Imported via the `~` alias (→ packages/ui/src) so the test runs against the
 * worktree source.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompletedUpload, UploadTransportArgs } from "~/components/file-upload";
import { FileUpload } from "~/components/file-upload";

/** A transport whose every call is captured and resolved/rejected on demand. */
function createControllableTransport() {
  const calls: UploadTransportArgs[] = [];
  const settlers: Array<{
    resolve: (r: CompletedUpload) => void;
    reject: (e: unknown) => void;
    args: UploadTransportArgs;
  }> = [];
  const transport = (args: UploadTransportArgs) =>
    new Promise<CompletedUpload>((resolve, reject) => {
      calls.push(args);
      settlers.push({ resolve, reject, args });
    });
  return { transport, calls, settlers, last: () => settlers[settlers.length - 1] };
}

function makeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

const ok: CompletedUpload = {
  fileAssetId: "asset-1",
  url: "https://blob.example/asset-1.png",
  contentType: "image/png",
  size: 1234,
};

beforeAll(() => {
  // jsdom has no object-URL support; the hook makes previews for images.
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:preview"),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FileUpload", () => {
  it("shows a CLIENT validation error and never uploads an invalid file (AC §1)", async () => {
    const { transport, calls } = createControllableTransport();
    render(
      <FileUpload
        transport={transport}
        policy={{ accept: "image/png", maxSize: 1024, maxFiles: 1 }}
      />,
    );

    const tooBig = makeFile("huge.png", "image/png", 5 * 1024 * 1024);
    await userEvent.upload(fileInput(), tooBig);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/너무 큽니다/);
    // Invalid files are never handed to the transport.
    expect(calls).toHaveLength(0);
    // No retry on a client-invalid file.
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  it("renders a SERVER validation error and allows retry (AC §1, §3)", async () => {
    const { transport, last, calls } = createControllableTransport();
    render(<FileUpload transport={transport} policy={{ accept: "image/png" }} />);

    await userEvent.upload(fileInput(), makeFile("a.png", "image/png", 1000));
    await waitFor(() => expect(calls).toHaveLength(1));

    // Transport maps the server 422 to user-safe copy and rejects with it.
    last().reject(new Error("지원하지 않는 파일 형식입니다."));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("지원하지 않는 파일 형식입니다.");

    // Retry re-invokes the transport.
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    last().resolve(ok);
    expect(await screen.findByText("업로드 완료")).toBeInTheDocument();
  });

  it("reports progress and reaches the completed state (AC §3)", async () => {
    const { transport, last, calls } = createControllableTransport();
    render(<FileUpload transport={transport} policy={{ accept: "image/png" }} />);

    await userEvent.upload(fileInput(), makeFile("a.png", "image/png", 1000));
    await waitFor(() => expect(calls).toHaveLength(1));

    last().args.onProgress(42);
    expect(await screen.findByText("42%")).toBeInTheDocument();

    last().resolve(ok);
    expect(await screen.findByText("업로드 완료")).toBeInTheDocument();
  });

  it("cancels an in-flight upload via the AbortSignal (AC §3)", async () => {
    const { transport, last, calls } = createControllableTransport();
    render(<FileUpload transport={transport} policy={{ accept: "image/png" }} />);

    await userEvent.upload(fileInput(), makeFile("a.png", "image/png", 1000));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(last().args.signal.aborted).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "업로드 취소" }));
    expect(last().args.signal.aborted).toBe(true);
    expect(await screen.findByText("취소됨")).toBeInTheDocument();
    // A canceled upload can be retried.
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("opens the auth modal instead of uploading when signed out (AC §2)", async () => {
    const { transport, calls } = createControllableTransport();
    const onRequireAuth = vi.fn();
    render(
      <FileUpload
        transport={transport}
        isAuthenticated={false}
        onRequireAuth={onRequireAuth}
        policy={{ accept: "image/png" }}
      />,
    );

    // The protected action (selecting a file) must gate, not redirect.
    await userEvent.upload(fileInput(), makeFile("a.png", "image/png", 1000));
    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);

    // Clicking the picker button while signed out also gates.
    await userEvent.click(screen.getByRole("button", { name: "파일 선택" }));
    expect(onRequireAuth).toHaveBeenCalledTimes(2);
  });

  it("forwards the injected target resource + policy to the transport (AC §4)", async () => {
    const { transport, last, calls } = createControllableTransport();
    render(
      <FileUpload
        transport={transport}
        target={{ targetType: "hospital", targetId: "h-99" }}
        policy={{ accept: "image/png", maxFiles: 1 }}
      />,
    );

    await userEvent.upload(fileInput(), makeFile("a.png", "image/png", 1000));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(last().args.target).toEqual({ targetType: "hospital", targetId: "h-99" });
  });

  it("keeps a stable status region across states (AC §3)", async () => {
    const { transport, last } = createControllableTransport();
    render(<FileUpload transport={transport} policy={{ accept: "image/png" }} />);

    await userEvent.upload(fileInput(), makeFile("a.png", "image/png", 1000));
    const row = await screen.findByTestId("file-upload-item");
    // The row is present while uploading and keeps its fixed-height footprint.
    expect(row).toHaveClass("min-h-16");
    expect(row.getAttribute("data-status")).toBe("uploading");

    last().resolve(ok);
    await waitFor(() => expect(row.getAttribute("data-status")).toBe("success"));
    // Same row element, same footprint after completing — no layout swap.
    expect(row).toHaveClass("min-h-16");
    // The dropzone never disappears between states.
    expect(screen.getByTestId("file-upload-dropzone")).toBeInTheDocument();
  });
});
