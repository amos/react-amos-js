import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AmosExternalBankAccountForm,
  confirmExternalBankAccount,
  refreshExternalBankAccount,
} from "./index";

const amos = vi.hoisted(() => {
  const controllers: Array<{
    iframe: HTMLIFrameElement;
    update: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];
  const mountAmosExternalBankAccountForm = vi.fn(
    (container: HTMLElement, _options: Record<string, unknown>) => {
      const iframe = document.createElement("iframe");
      container.append(iframe);
      const controller = {
        iframe,
        update: vi.fn(),
        refresh: vi.fn(),
        destroy: vi.fn(() => iframe.remove()),
      };
      controllers.push(controller);
      return controller;
    },
  );
  return {
    controllers,
    mountAmosExternalBankAccountForm,
    confirmExternalBankAccountIntent: vi.fn(async () => ({
      status: "succeeded" as const,
    })),
    refreshExternalBankAccountIntent: vi.fn(),
  };
});

vi.mock("@amos.com/amos-js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  mountAmosExternalBankAccountForm: amos.mountAmosExternalBankAccountForm,
  confirmExternalBankAccountIntent: amos.confirmExternalBankAccountIntent,
  refreshExternalBankAccountIntent: amos.refreshExternalBankAccountIntent,
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  amos.controllers.length = 0;
  amos.mountAmosExternalBankAccountForm.mockClear();
  amos.confirmExternalBankAccountIntent.mockClear();
  amos.refreshExternalBankAccountIntent.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(ui: React.ReactNode): void {
  act(() => root.render(ui));
}

describe("AmosExternalBankAccountForm", () => {
  test("mounts the form with the intent and forwards the iframe", () => {
    const ref = createRef<HTMLIFrameElement>();
    const onStateChange = vi.fn();
    const onValidityChange = vi.fn();
    render(
      <AmosExternalBankAccountForm
        ref={ref}
        renderToken="rt_1"
        intentId="ebai_1"
        onStateChange={onStateChange}
        onValidityChange={onValidityChange}
        className="payout-frame"
        style={{ borderRadius: "8px", width: "50%" }}
      />,
    );

    expect(amos.mountAmosExternalBankAccountForm).toHaveBeenCalledTimes(1);
    const [container, options] =
      amos.mountAmosExternalBankAccountForm.mock.calls[0] ?? [];
    expect(host.contains(container ?? null)).toBe(true);
    expect(options).toMatchObject({
      renderToken: "rt_1",
      intentId: "ebai_1",
      onStateChange,
      onValidityChange,
    });

    const iframe = amos.controllers[0]?.iframe;
    expect(ref.current).toBe(iframe);
    expect(iframe?.className).toBe("payout-frame");
    expect(iframe?.style.borderRadius).toBe("8px");
    // amos-js owns the frame's pixel size.
    expect(iframe?.style.width).toBe("");
  });

  test("updates callbacks in place and remounts for a new intent", () => {
    render(
      <AmosExternalBankAccountForm renderToken="rt_1" intentId="ebai_1" />,
    );
    const first = amos.controllers[0];

    const onStateChange = vi.fn();
    render(
      <AmosExternalBankAccountForm
        renderToken="rt_1"
        intentId="ebai_1"
        onStateChange={onStateChange}
      />,
    );
    expect(amos.mountAmosExternalBankAccountForm).toHaveBeenCalledTimes(1);
    expect(first?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ onStateChange }),
    );

    render(
      <AmosExternalBankAccountForm
        renderToken="rt_1"
        intentId="ebai_2"
        onStateChange={onStateChange}
      />,
    );
    expect(first?.destroy).toHaveBeenCalledTimes(1);
    expect(amos.mountAmosExternalBankAccountForm).toHaveBeenCalledTimes(2);
    expect(
      amos.mountAmosExternalBankAccountForm.mock.calls[1]?.[1],
    ).toMatchObject({ intentId: "ebai_2" });
  });

  test("destroys the form and clears the ref on unmount", () => {
    const ref = createRef<HTMLIFrameElement>();
    render(
      <AmosExternalBankAccountForm
        ref={ref}
        renderToken="rt_1"
        intentId="ebai_1"
      />,
    );
    act(() => root.render(null));
    expect(amos.controllers[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(ref.current).toBeNull();
  });
});

describe("confirmExternalBankAccount", () => {
  test("confirms through the mounted iframe", async () => {
    const ref = createRef<HTMLIFrameElement>();
    render(
      <AmosExternalBankAccountForm
        ref={ref}
        renderToken="rt_1"
        intentId="ebai_1"
      />,
    );

    await expect(
      confirmExternalBankAccount({
        iframeRef: ref,
        token: "embed_1",
        metadata: { payout: "p_1" },
      }),
    ).resolves.toEqual({ status: "succeeded" });
    expect(amos.confirmExternalBankAccountIntent).toHaveBeenCalledWith({
      iframe: ref.current,
      token: "embed_1",
      metadata: { payout: "p_1" },
    });
  });

  test("passes no iframe when nothing is mounted", async () => {
    await confirmExternalBankAccount({ iframeRef: undefined, token: "t" });
    expect(amos.confirmExternalBankAccountIntent).toHaveBeenCalledWith({
      iframe: null,
      token: "t",
      metadata: undefined,
    });
  });
});

describe("refreshExternalBankAccount", () => {
  test("refreshes the mounted form's intent", () => {
    const ref = createRef<HTMLIFrameElement>();
    render(
      <AmosExternalBankAccountForm
        ref={ref}
        renderToken="rt_1"
        intentId="ebai_1"
      />,
    );
    refreshExternalBankAccount({ iframeRef: ref });
    expect(amos.refreshExternalBankAccountIntent).toHaveBeenCalledWith({
      iframe: ref.current,
    });
  });
});
