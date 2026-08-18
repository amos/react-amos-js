/// <reference types="googlepay" />

import {
  type Appearance,
  type ApplePayButtonElementProps,
  confirmPaymentIntent as amosConfirmPaymentIntent,
  confirmSetupIntent as amosConfirmSetupIntent,
  resetForm as amosResetForm,
  validateForm as amosValidateForm,
  type BillingAddressRequirement,
  type ConfirmationResult,
  type CreditCardAdditionalFields,
  type GooglePayButtonElementProps,
  mountAmosApplePayButton,
  mountAmosBankAccountPaymentMethodForm,
  mountAmosCreditCardPaymentMethodForm,
  mountAmosGooglePayButton,
  type WalletButtonStyle,
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

/**
 * Clear all field values and API errors in the embedded card/bank iframe
 * form. Call after `onResult` when the customer wants to try again.
 */
export function resetForm({ iframeRef }: { iframeRef: IframeRef }): void {
  amosResetForm({ iframe: resolveIframe(iframeRef) });
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

type WalletStyleProps = {
  /**
   * Stretch the wallet button to fill the iframe width.
   *
   * @default false
   */
  fullWidth?: boolean;
  /** Styles applied to the wallet button inside the Amos iframe. */
  buttonStyle?: WalletButtonStyle;
  /** Styles applied to the host-page `<iframe>` element. */
  iframeStyle?: ComponentProps<"iframe">["style"];
  /**
   * Styles applied to the wallet button inside the Amos iframe.
   *
   * @deprecated Use `buttonStyle` to distinguish it from `iframeStyle`.
   */
  style?: WalletButtonStyle;
};

function resolveGooglePayButtonLayout({
  buttonSizeMode,
  style,
  fullWidth,
}: {
  buttonSizeMode?: GooglePayButtonElementProps["buttonSizeMode"];
  style?: WalletButtonStyle;
  fullWidth: boolean;
}): Pick<GooglePayButtonElementProps, "buttonSizeMode" | "style"> {
  return {
    buttonSizeMode: buttonSizeMode ?? (fullWidth ? "fill" : undefined),
    style: fullWidth ? { width: "100%", ...style } : style,
  };
}

function resolveApplePayButtonLayout({
  style,
  fullWidth,
}: {
  style?: WalletButtonStyle;
  fullWidth: boolean;
}): Pick<ApplePayButtonElementProps, "style"> {
  if (!fullWidth) {
    return { style };
  }
  return {
    style: {
      "--apple-pay-button-width": "100%",
      width: "100%",
      ...style,
    },
  };
}

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
  onResult: (result: ConfirmationResult) => void;
  /**
   * Called when form validity changes. `isValid` is true when all
   * required fields are present and valid. Does not include PCI data.
   */
  onValidityChange?: (event: { isValid: boolean }) => void;
  additionalFields?: CreditCardAdditionalFields;
  billingAddressRequirement?: BillingAddressRequirement;
};

export function AmosCreditCardPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onResult,
  onValidityChange,
  additionalFields = { cardholderName: false },
  billingAddressRequirement = "country",
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
      billingAddressRequirement,
      onResult,
      onValidityChange,
    },
    remountDeps: [
      renderToken,
      additionalFields.cardholderName,
      billingAddressRequirement,
    ],
    iframePassthrough: { style, ...rest },
    updateDeps: [
      appearance,
      additionalFields,
      billingAddressRequirement,
      onResult,
      onValidityChange,
    ],
  });

  return <div ref={containerRef} />;
}

type AmosBankAccountPaymentMethodFormProps = IframePassthroughProps & {
  renderToken: string;
  appearance?: Appearance;
  onResult: (result: ConfirmationResult) => void;
  /**
   * Called when form validity changes. `isValid` is true when all
   * required fields are present and valid. Does not include PCI data.
   */
  onValidityChange?: (event: { isValid: boolean }) => void;
  billingAddressRequirement?: BillingAddressRequirement;
};

export function AmosBankAccountPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onResult,
  onValidityChange,
  billingAddressRequirement = "country",
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
      billingAddressRequirement,
      onResult,
      onValidityChange,
    },
    remountDeps: [renderToken, billingAddressRequirement],
    iframePassthrough: { style, ...rest },
    updateDeps: [
      appearance,
      billingAddressRequirement,
      onResult,
      onValidityChange,
    ],
  });

  return <div ref={containerRef} />;
}

type AmosGooglePayButtonProps = Omit<IframePassthroughProps, "style"> &
  Omit<GooglePayButtonElementProps, "style"> &
  WalletStyleProps & {
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
    onResult: (result: ConfirmationResult) => void;
  };

export function AmosGooglePayButton({
  ref,
  renderToken,
  amount,
  merchantName,
  appearance,
  onInitiatePaymentIntentRequest,
  onResult,
  buttonType,
  buttonColor,
  buttonRadius,
  buttonSizeMode,
  buttonLocale,
  buttonBorderType,
  fullWidth = false,
  buttonStyle,
  iframeStyle,
  style,
  ...rest
}: AmosGooglePayButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedStyle = buttonStyle ?? style;
  const layout = resolveGooglePayButtonLayout({
    buttonSizeMode,
    style: resolvedStyle,
    fullWidth,
  });

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
      onResult,
      buttonType,
      buttonColor,
      buttonRadius,
      buttonSizeMode: layout.buttonSizeMode,
      buttonLocale,
      buttonBorderType,
      style: layout.style,
    },
    remountDeps: [renderToken],
    iframePassthrough: { style: iframeStyle, ...rest },
    updateDeps: [
      amount,
      merchantName,
      appearance,
      onInitiatePaymentIntentRequest,
      onResult,
      buttonType,
      buttonColor,
      buttonRadius,
      layout.buttonSizeMode,
      buttonLocale,
      buttonBorderType,
      layout.style,
    ],
  });

  return <div ref={containerRef} />;
}

type AmosApplePayButtonProps = Omit<IframePassthroughProps, "style" | "type"> &
  Omit<ApplePayButtonElementProps, "style"> &
  WalletStyleProps & {
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
    onResult: (result: ConfirmationResult) => void;
  };

export function AmosApplePayButton({
  ref,
  renderToken,
  amount,
  merchantName,
  appearance,
  onInitiatePaymentIntentRequest,
  onResult,
  buttonstyle,
  type,
  locale,
  fullWidth = false,
  buttonStyle,
  iframeStyle,
  style,
  ...rest
}: AmosApplePayButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedStyle = buttonStyle ?? style;
  const layout = resolveApplePayButtonLayout({
    style: resolvedStyle,
    fullWidth,
  });

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosApplePayButton,
    options: {
      renderToken,
      amount,
      merchantName,
      appearance,
      onInitiatePaymentIntentRequest,
      onResult,
      buttonstyle,
      type,
      locale,
      style: layout.style,
    },
    remountDeps: [renderToken],
    iframePassthrough: { style: iframeStyle, ...rest },
    updateDeps: [
      amount,
      merchantName,
      appearance,
      onInitiatePaymentIntentRequest,
      onResult,
      buttonstyle,
      type,
      locale,
      layout.style,
    ],
  });

  return <div ref={containerRef} />;
}
