import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AmosOnboarding, refreshOnboarding } from "./index";

const amos = vi.hoisted(() => {
  const controllers: Array<{
    iframe: HTMLIFrameElement;
    update: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];
  const mountAmosOnboarding = vi.fn(
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
  return { controllers, mountAmosOnboarding, refreshOnboarding: vi.fn() };
});

vi.mock("@amos.com/amos-js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  mountAmosOnboarding: amos.mountAmosOnboarding,
  refreshOnboarding: amos.refreshOnboarding,
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  amos.controllers.length = 0;
  amos.mountAmosOnboarding.mockClear();
  amos.refreshOnboarding.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const getEmbedToken = async () => "embed.jwt";

describe("AmosOnboarding", () => {
  test("mounts once with the application and forwards the iframe ref", () => {
    const ref = createRef<HTMLIFrameElement>();
    act(() =>
      root.render(
        <AmosOnboarding
          ref={ref}
          renderToken="render.jwt"
          applicationId="lea_1"
          getEmbedToken={getEmbedToken}
        />,
      ),
    );

    expect(amos.mountAmosOnboarding).toHaveBeenCalledTimes(1);
    expect(amos.mountAmosOnboarding.mock.calls[0]?.[1]).toMatchObject({
      renderToken: "render.jwt",
      applicationId: "lea_1",
    });
    expect(ref.current).toBe(amos.controllers[0]?.iframe);
  });

  test("updates callbacks in place and remounts for another application", () => {
    const render = (applicationId: string | null, onStateChange = vi.fn()) =>
      act(() =>
        root.render(
          <AmosOnboarding
            renderToken="render.jwt"
            applicationId={applicationId}
            getEmbedToken={getEmbedToken}
            onStateChange={onStateChange}
          />,
        ),
      );

    render(null);
    render(null, vi.fn());
    expect(amos.mountAmosOnboarding).toHaveBeenCalledTimes(1);
    expect(amos.controllers[0]?.update).toHaveBeenCalled();

    render("lea_2");
    expect(amos.mountAmosOnboarding).toHaveBeenCalledTimes(2);
    expect(amos.controllers[0]?.destroy).toHaveBeenCalled();
  });

  test("refreshOnboarding re-reads through the mounted iframe", () => {
    const ref = createRef<HTMLIFrameElement>();
    act(() =>
      root.render(
        <AmosOnboarding
          ref={ref}
          renderToken="render.jwt"
          applicationId="lea_1"
          getEmbedToken={getEmbedToken}
        />,
      ),
    );

    refreshOnboarding({ iframeRef: ref });
    expect(amos.refreshOnboarding).toHaveBeenCalledWith({
      iframe: ref.current,
    });
  });
});
