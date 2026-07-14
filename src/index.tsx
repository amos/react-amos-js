/// <reference types="googlepay" />

import {
  type Appearance,
  confirmPaymentIntent as amosConfirmPaymentIntent,
  confirmSetupIntent as amosConfirmSetupIntent,
  validateForm as amosValidateForm,
  type CreditCardAdditionalFields,
  mountAmosBankAccountPaymentMethodForm,
  mountAmosCreditCardPaymentMethodForm,
  mountAmosGooglePayButton,
} from "@amos.com/amos-js";
import type { components } from "@amos.com/node";
import {
  type ComponentProps,
  type Ref,
  type RefObject,
  useEffect,
  useRef,
} from "react";

export * from "@amos.com/amos-js";

type IframeRef = RefObject<HTMLIFrameElement | null> | undefined;

function resolveIframe(iframeRef: IframeRef): HTMLIFrameElement | null {
  if (!iframeRef) {
    return null;
  }
  return iframeRef.current ?? null;
}

/**
 * Validate the embedded card/bank iframe form before payment
 * confirmation.
 *
 * Resolves to `true` if the form is valid, `false` if it is not, or
 * `false` if the iframe does not respond within 5 seconds.
 */
export function validateForm({
  iframeRef,
}: {
  iframeRef: IframeRef;
}): Promise<boolean> {
  return amosValidateForm({ iframe: resolveIframe(iframeRef) });
}

/**
 * Confirm a payment intent in the embedded iframe flow.
 *
 * Pass the embed JWT (`token`) returned by your server's
 * `POST /payment_intents` call.
 */
export function confirmPaymentIntent({
  iframeRef,
  token,
}: {
  iframeRef: IframeRef;
} & Pick<components["schemas"]["EmbedToken"], "token">): void {
  amosConfirmPaymentIntent({ iframe: resolveIframe(iframeRef), token });
}

/**
 * Confirm a setup intent in the embedded iframe flow. Use this when
 * saving a payment method for future use.
 *
 * Pass the embed JWT (`token`) returned by your server's
 * `POST /setup_intents` call.
 */
export function confirmSetupIntent({
  iframeRef,
  token,
}: {
  iframeRef: IframeRef;
} & Pick<components["schemas"]["EmbedToken"], "token">): void {
  amosConfirmSetupIntent({ iframe: resolveIframe(iframeRef), token });
}

type ForwardedIframeRef = Ref<HTMLIFrameElement> | undefined;

function setForwardedRef(
  ref: ForwardedIframeRef,
  node: HTMLIFrameElement | null,
): void {
  if (typeof ref === "function") {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}

type IframePassthroughProps = Omit<
  ComponentProps<"iframe">,
  "src" | "title" | "name" | "role" | "allow"
>;

function applyIframePassthrough(
  iframe: HTMLIFrameElement,
  { style, className, id, ...rest }: IframePassthroughProps,
): void {
  if (className != null) {
    iframe.className = className;
  }
  if (id != null) {
    iframe.id = id;
  }
  if (style != null) {
    Object.assign(iframe.style, style);
  }
  for (const [key, value] of Object.entries(rest)) {
    if (value == null) {
      continue;
    }
    if (key in iframe) {
      Reflect.set(iframe, key, value);
    } else {
      iframe.setAttribute(key, String(value));
    }
  }
}

type AmosEmbedController = {
  iframe: HTMLIFrameElement;
  update: (patch: Record<string, unknown>) => void;
  destroy: () => void;
};

function useAmosEmbed<TOptions extends Record<string, unknown>>({
  containerRef,
  iframeRef,
  mount,
  options,
  remountDeps,
  iframePassthrough,
  updateDeps,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  iframeRef: ForwardedIframeRef;
  mount: (container: HTMLElement, options: TOptions) => AmosEmbedController;
  options: TOptions;
  remountDeps: Array<unknown>;
  iframePassthrough: IframePassthroughProps;
  updateDeps: Array<unknown>;
}): void {
  const controllerRef = useRef<AmosEmbedController | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: remount only when remountDeps change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const controller = mount(container, options);
    controllerRef.current = controller;
    setForwardedRef(iframeRef, controller.iframe);
    applyIframePassthrough(controller.iframe, iframePassthrough);

    return () => {
      controller.destroy();
      controllerRef.current = null;
      setForwardedRef(iframeRef, null);
    };
  }, [...remountDeps]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync listener options when updateDeps change
  useEffect(() => {
    controllerRef.current?.update(options);
  }, [...updateDeps]);

  useEffect(() => {
    const iframe = controllerRef.current?.iframe;
    if (iframe) {
      applyIframePassthrough(iframe, iframePassthrough);
    }
  });
}

type AmosCreditCardPaymentMethodFormProps = IframePassthroughProps & {
  renderToken: string;
  appearance?: Appearance;
  onPaymentIntentConfirmationSucceeded?: (
    paymentIntent: components["schemas"]["PaymentIntent"],
  ) => void;
  onSetupIntentConfirmationSucceeded?: (
    setupIntent: components["schemas"]["SetupIntent"],
  ) => void;
  onConfirmationFailed: (errorMessage: string) => void;
  additionalFields?: CreditCardAdditionalFields;
};

export function AmosCreditCardPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onPaymentIntentConfirmationSucceeded,
  onSetupIntentConfirmationSucceeded,
  onConfirmationFailed,
  additionalFields = { cardholderName: false },
  style,
  ...rest
}: AmosCreditCardPaymentMethodFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosCreditCardPaymentMethodForm,
    options: {
      renderToken,
      appearance,
      additionalFields,
      onPaymentIntentConfirmationSucceeded,
      onSetupIntentConfirmationSucceeded,
      onConfirmationFailed,
    },
    remountDeps: [renderToken, additionalFields.cardholderName],
    iframePassthrough: { style, ...rest },
    updateDeps: [
      appearance,
      additionalFields,
      onPaymentIntentConfirmationSucceeded,
      onSetupIntentConfirmationSucceeded,
      onConfirmationFailed,
    ],
  });

  return <div ref={containerRef} />;
}

type AmosBankAccountPaymentMethodFormProps = IframePassthroughProps & {
  renderToken: string;
  appearance?: Appearance;
  onPaymentIntentConfirmationSucceeded?: (
    paymentIntent: components["schemas"]["PaymentIntent"],
  ) => void;
  onSetupIntentConfirmationSucceeded?: (
    setupIntent: components["schemas"]["SetupIntent"],
  ) => void;
  onConfirmationFailed: (errorMessage: string) => void;
};

export function AmosBankAccountPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onPaymentIntentConfirmationSucceeded,
  onSetupIntentConfirmationSucceeded,
  onConfirmationFailed,
  style,
  ...rest
}: AmosBankAccountPaymentMethodFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosBankAccountPaymentMethodForm,
    options: {
      renderToken,
      appearance,
      onPaymentIntentConfirmationSucceeded,
      onSetupIntentConfirmationSucceeded,
      onConfirmationFailed,
    },
    remountDeps: [renderToken],
    iframePassthrough: { style, ...rest },
    updateDeps: [
      appearance,
      onPaymentIntentConfirmationSucceeded,
      onSetupIntentConfirmationSucceeded,
      onConfirmationFailed,
    ],
  });

  return <div ref={containerRef} />;
}

type AmosGooglePayButtonProps = IframePassthroughProps & {
  renderToken: string;
  amount: string;
  merchantName: string;
  appearance?: Appearance;
  onInitiatePaymentIntentRequest: ({
    paymentIntentCreateAttributes,
    customerCreateAttributes,
  }: {
    paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
    customerCreateAttributes: components["schemas"]["CreateCustomerInput"];
  }) => Promise<components["schemas"]["EmbedToken"]["token"]>;
  onPaymentIntentConfirmationSucceeded: (
    paymentIntent: components["schemas"]["PaymentIntent"],
  ) => void;
  onConfirmationFailed: (errorMessage: string) => void;
};

export function AmosGooglePayButton({
  ref,
  renderToken,
  amount,
  merchantName,
  appearance,
  onInitiatePaymentIntentRequest,
  onPaymentIntentConfirmationSucceeded,
  onConfirmationFailed,
  style,
  ...rest
}: AmosGooglePayButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosGooglePayButton,
    options: {
      renderToken,
      amount,
      merchantName,
      appearance,
      onInitiatePaymentIntentRequest,
      onPaymentIntentConfirmationSucceeded,
      onConfirmationFailed,
    },
    remountDeps: [renderToken],
    iframePassthrough: { style, ...rest },
    updateDeps: [
      amount,
      merchantName,
      appearance,
      onInitiatePaymentIntentRequest,
      onPaymentIntentConfirmationSucceeded,
      onConfirmationFailed,
    ],
  });

  return <div ref={containerRef} />;
}
