/// <reference types="googlepay" />

import {
  type Appearance,
  type ApplePayButtonElementProps,
  confirmPayment as amosConfirmPayment,
  confirmSetup as amosConfirmSetup,
  focusField as amosFocusField,
  resetForm as amosResetForm,
  validateForm as amosValidateForm,
  type BillingAddressRequirement,
  type ConfirmPaymentResult,
  type ConfirmSetupResult,
  type CreditCardAdditionalFields,
  ensureSkeletonStyles,
  type GooglePayButtonElementProps,
  mountAmosApplePayButton,
  mountAmosBankAccountPaymentMethodForm,
  mountAmosCreditCardPaymentMethodForm,
  mountAmosGooglePayButton,
  type PaymentMethodFormDefaultValues,
  type PaymentMethodFormField,
  resolveWalletButtonSkeletonBorderRadius,
} from "@amos.com/amos-js";
import type { components } from "@amos.com/node";
import {
  type ComponentProps,
  type Ref,
  type RefObject,
  useEffect,
  useLayoutEffect,
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
export function confirmPayment({
  iframeRef,
  token,
  defaultValues,
}: {
  iframeRef: IframeRef;
  defaultValues?: PaymentMethodFormDefaultValues;
} & Pick<
  components["schemas"]["EmbedToken"],
  "token"
>): Promise<ConfirmPaymentResult> {
  return amosConfirmPayment({
    iframe: resolveIframe(iframeRef),
    token,
    defaultValues,
  });
}

/**
 * Confirm a setup intent in the embedded iframe flow. Use this when
 * saving a payment method for future use.
 *
 * Pass the embed JWT (`token`) returned by your server's
 * `POST /setup_intents` call.
 */
export function confirmSetup({
  iframeRef,
  token,
  defaultValues,
}: {
  iframeRef: IframeRef;
  defaultValues?: PaymentMethodFormDefaultValues;
} & Pick<
  components["schemas"]["EmbedToken"],
  "token"
>): Promise<ConfirmSetupResult> {
  return amosConfirmSetup({
    iframe: resolveIframe(iframeRef),
    token,
    defaultValues,
  });
}

/**
 * Clear all field values and API errors in the embedded card/bank iframe
 * form. Call after a failed confirm when the customer wants to try again.
 */
export function resetForm({ iframeRef }: { iframeRef: IframeRef }): void {
  amosResetForm({ iframe: resolveIframe(iframeRef) });
}

/**
 * Focus a named control inside the embedded card/bank iframe. No-op if
 * the field is not rendered, or while Plaid Embedded Institution Search
 * is showing. Call from a click or keydown handler.
 */
export function focusField({
  iframeRef,
  field,
}: {
  iframeRef: IframeRef;
  field: PaymentMethodFormField;
}): void {
  amosFocusField({ iframe: resolveIframe(iframeRef), field });
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
  Object.assign(iframe.style, style);
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
  useLayoutEffect(() => {
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

const SKELETON_ACCENT = "oklch(0.97 0 0)";

function WalletButtonSlot({
  height,
  borderRadius,
  containerRef,
}: {
  height: string;
  borderRadius: string;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  useLayoutEffect(() => {
    ensureSkeletonStyles();
  }, []);

  return (
    <div
      style={{
        boxSizing: "border-box",
        position: "relative",
        width: "100%",
        height,
        minHeight: height,
        overflow: "hidden",
      }}
    >
      <div
        className="amos-js-form-skeleton-input amos-js-wallet-skeleton"
        style={{
          position: "absolute",
          inset: 0,
          height,
          borderRadius,
          background: SKELETON_ACCENT,
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden
      />
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}

type AmosCreditCardPaymentMethodFormProps = IframePassthroughProps & {
  renderToken: string;
  appearance?: Appearance;
  /**
   * Called when form validity changes. `isValid` is true when all
   * required fields are present and valid. Does not include PCI data.
   */
  onValidityChange?: (event: { isValid: boolean }) => void;
  /**
   * Called when the detected card brand changes. `brand` is the matched
   * network, or `null` when the field is empty or the digits do not
   * match a known brand. Does not include PCI data.
   */
  onCardBrandChanged?: (event: {
    brand:
      | "visa"
      | "mastercard"
      | "amex"
      | "discover"
      | "diners"
      | "jcb"
      | null;
  }) => void;
  /**
   * Called when the customer presses Escape in the iframe. PCI-safe —
   * no field values. Use this to close a host modal that contains the
   * iframe. Not fired while an iframe dropdown or address suggestion
   * list is open, or while Plaid Embedded Institution Search is
   * showing.
   */
  onEscapeKeyPressed?: () => void;
  additionalFields?: CreditCardAdditionalFields;
  billingAddressRequirement?: BillingAddressRequirement;
  /**
   * Seed cardholder name and billing address. Provided keys overwrite
   * matching fields, including ones the customer already edited. Values
   * are sent on confirm even when those inputs are hidden.
   */
  defaultValues?: PaymentMethodFormDefaultValues;
};

export function AmosCreditCardPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onValidityChange,
  onCardBrandChanged,
  onEscapeKeyPressed,
  additionalFields = { cardholderName: false },
  billingAddressRequirement = "country",
  defaultValues,
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
      defaultValues,
      onValidityChange,
      onCardBrandChanged,
      onEscapeKeyPressed,
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
      defaultValues,
      onValidityChange,
      onCardBrandChanged,
      onEscapeKeyPressed,
    ],
  });

  return <div ref={containerRef} />;
}

type AmosBankAccountPaymentMethodFormProps = IframePassthroughProps & {
  renderToken: string;
  appearance?: Appearance;
  /**
   * Called when form validity changes. `isValid` is true when all
   * required fields are present and valid, or when Plaid Embedded Link
   * has returned credentials. Does not include PCI data.
   */
  onValidityChange?: (event: { isValid: boolean }) => void;
  /**
   * Called when the customer presses Escape in the iframe. PCI-safe —
   * no field values. Use this to close a host modal that contains the
   * iframe. Not fired while an iframe dropdown or address suggestion
   * list is open, or while Plaid Embedded Institution Search is
   * showing.
   */
  onEscapeKeyPressed?: () => void;
  billingAddressRequirement?: BillingAddressRequirement;
  /**
   * Seed account holder name and billing address. Provided keys
   * overwrite matching fields, including ones the customer already
   * edited.
   */
  defaultValues?: PaymentMethodFormDefaultValues;
  /**
   * When true, hide the routing/account iframe and mount Plaid Embedded
   * Institution Search in the parent. Ignored when `intent` is `"setup"`
   * (setup always shows Plaid) or when the render token disables
   * verification.
   *
   * @default false
   */
  requireAchVerification?: boolean;
  /**
   * `"setup"` saves a bank account for later charges and always shows
   * Plaid (unless the render token disables verification). `"payment"`
   * uses {@link AmosBankAccountPaymentMethodFormProps.requireAchVerification}.
   *
   * @default "payment"
   */
  intent?: "payment" | "setup";
};

export function AmosBankAccountPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onValidityChange,
  onEscapeKeyPressed,
  billingAddressRequirement = "country",
  defaultValues,
  requireAchVerification = false,
  intent = "payment",
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
      defaultValues,
      requireAchVerification,
      intent,
      onValidityChange,
      onEscapeKeyPressed,
    },
    remountDeps: [renderToken, billingAddressRequirement, intent],
    iframePassthrough: { style, ...rest },
    updateDeps: [
      appearance,
      billingAddressRequirement,
      defaultValues,
      requireAchVerification,
      intent,
      onValidityChange,
      onEscapeKeyPressed,
    ],
  });

  return <div ref={containerRef} />;
}

type AmosGooglePayButtonProps = {
  ref?: ForwardedIframeRef;
  renderToken: string;
  /**
   * Major-currency decimal string shown in the Google Pay sheet
   * (e.g. `"50.00"` for $50.00). Converted to cents in
   * `paymentIntentCreateAttributes.amount`.
   */
  amount: string;
  merchantName: string;
  /**
   * Painted button height. CSS length (e.g. `"48px"`).
   * @default "48px"
   */
  height?: string;
  /**
   * Native Google Pay button attributes and inner style. Omitted
   * fields keep Amos paint defaults (`buttonType: "plain"`,
   * `buttonSizeMode: "fill"`). The button fills the iframe — size the
   * mount slot, not the button.
   */
  buttonProps?: GooglePayButtonElementProps;
  /** Props applied to the host-page `<iframe>` element. */
  iframeProps?: IframePassthroughProps;
  /**
   * Called when the buyer authorizes in the Google Pay sheet. Create a
   * payment intent on your server, then `await confirmPayment(token)`.
   */
  onConfirm: ({
    paymentIntentCreateAttributes,
    customerCreateAttributes,
    confirmPayment,
  }: {
    paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
    customerCreateAttributes: components["schemas"]["CreateCustomerInput"];
    confirmPayment: (token: string) => Promise<ConfirmPaymentResult>;
  }) => Promise<ConfirmPaymentResult>;
};

/**
 * Renders the secure Google Pay iframe button. A button-shaped
 * skeleton is painted in the parent document on first render (including
 * SSR) so the slot height is reserved before the iframe loads.
 */
export function AmosGooglePayButton({
  ref,
  renderToken,
  amount,
  merchantName,
  height = "48px",
  buttonProps,
  iframeProps,
  onConfirm,
}: AmosGooglePayButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const borderRadius = resolveWalletButtonSkeletonBorderRadius({
    iframeStyle: iframeProps?.style as { borderRadius?: string | number },
    buttonProps,
  });

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosGooglePayButton,
    options: {
      renderToken,
      amount,
      merchantName,
      height,
      buttonProps,
      onConfirm,
    },
    remountDeps: [renderToken],
    iframePassthrough: iframeProps ?? {},
    updateDeps: [amount, merchantName, height, buttonProps, onConfirm],
  });

  return (
    <WalletButtonSlot
      height={height}
      borderRadius={borderRadius}
      containerRef={containerRef}
    />
  );
}

type AmosApplePayButtonProps = {
  ref?: ForwardedIframeRef;
  renderToken: string;
  /**
   * Major-currency decimal string shown in the Apple Pay sheet
   * (e.g. `"50.00"` for $50.00). Converted to cents in
   * `paymentIntentCreateAttributes.amount`.
   */
  amount: string;
  merchantName: string;
  /**
   * Painted button height. CSS length (e.g. `"48px"`). Apple ignores
   * CSS `height`; Amos maps this for you.
   * @default "48px"
   */
  height?: string;
  /**
   * Native `<apple-pay-button>` attributes and inner style. Omitted
   * fields keep Apple's defaults (`black` / `plain` / `en-US`). The
   * button fills the iframe — size the mount slot, not the button.
   */
  buttonProps?: ApplePayButtonElementProps;
  /** Props applied to the host-page `<iframe>` element. */
  iframeProps?: IframePassthroughProps;
  /**
   * Called when the buyer authorizes in the Apple Pay sheet. Create a
   * payment intent on your server, then `await confirmPayment(token)`.
   */
  onConfirm: ({
    paymentIntentCreateAttributes,
    customerCreateAttributes,
    confirmPayment,
  }: {
    paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
    customerCreateAttributes: components["schemas"]["CreateCustomerInput"];
    confirmPayment: (token: string) => Promise<ConfirmPaymentResult>;
  }) => Promise<ConfirmPaymentResult>;
};

/**
 * Renders the secure Apple Pay iframe button. A button-shaped
 * skeleton is painted in the parent document on first render (including
 * SSR) so the slot height is reserved before the iframe loads.
 */
export function AmosApplePayButton({
  ref,
  renderToken,
  amount,
  merchantName,
  height = "48px",
  buttonProps,
  iframeProps,
  onConfirm,
}: AmosApplePayButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const borderRadius = resolveWalletButtonSkeletonBorderRadius({
    iframeStyle: iframeProps?.style as { borderRadius?: string | number },
    buttonProps,
  });

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosApplePayButton,
    options: {
      renderToken,
      amount,
      merchantName,
      height,
      buttonProps,
      onConfirm,
    },
    remountDeps: [renderToken],
    iframePassthrough: iframeProps ?? {},
    updateDeps: [amount, merchantName, height, buttonProps, onConfirm],
  });

  return (
    <WalletButtonSlot
      height={height}
      borderRadius={borderRadius}
      containerRef={containerRef}
    />
  );
}
