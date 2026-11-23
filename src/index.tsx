/// <reference types="googlepay" />

import {
  type AmosApplePayButtonOptions,
  type AmosBankAccountPaymentMethodFormOptions,
  type AmosCreditCardPaymentMethodFormOptions,
  type AmosExternalBankAccountFormOptions,
  type AmosGooglePayButtonOptions,
  type AmosOnboardingOptions,
  confirmPayment as amosConfirmPayment,
  confirmSetup as amosConfirmSetup,
  focusField as amosFocusField,
  resetForm as amosResetForm,
  validateForm as amosValidateForm,
  type ConfirmPaymentResult,
  type ConfirmSetupResult,
  type CreditCardAdditionalFields,
  confirmExternalBankAccountIntent,
  type ExternalBankAccountConfirmResult,
  mountAmosApplePayButton,
  mountAmosBankAccountPaymentMethodForm,
  mountAmosCreditCardPaymentMethodForm,
  mountAmosExternalBankAccountForm,
  mountAmosGooglePayButton,
  mountAmosOnboarding,
  type PaymentMethodFormDefaultValues,
  type PaymentMethodFormField,
  refreshExternalBankAccountIntent,
  refreshOnboarding as refreshOnboardingIframe,
} from "@amos.com/amos-js";
import {
  ensureSkeletonStyles,
  resolveWalletButtonSkeletonBorderRadius,
} from "@amos.com/amos-js/internal";
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
 *
 * Resolves `{ status: "succeeded", paymentIntent }` after authorization,
 * `{ status: "failed", paymentIntent? }` on decline, or
 * `{ status: "failed", error: "timeout" }` if the iframe does not post
 * `CONFIRMATION_RESULT` within 15 seconds (`CONFIRM_TIMEOUT_MS`). Use
 * `isConfirmTimeout(result)` — a timeout is not a decline; the charge
 * may still settle. Embed `/confirm` aborts at 10s and posts the same
 * timeout result.
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
 *
 * Resolves `{ status: "succeeded", setupIntent }` after verification,
 * `{ status: "failed", setupIntent? }` on decline, or
 * `{ status: "failed", error: "timeout" }` if the iframe does not
 * respond within 15 seconds. Same `isConfirmTimeout` rule as
 * {@link confirmPayment}.
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
  "src" | "title" | "name" | "role" | "allow" | "sandbox" | "width" | "height"
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
  if (style) {
    const chrome = { ...style };
    // amos-js owns the pixel box. A percentage width here makes WebKit
    // treat the frame as indefinite and can pause its layout.
    delete chrome.width;
    delete chrome.height;
    Object.assign(iframe.style, chrome);
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

/**
 * Callbacks the mount helpers wrap to reveal the iframe. The components do
 * not take them as props.
 */
type RevealCallbacks = "onHeightChange" | "onAppearanceReady" | "onIframeReady";

/**
 * Mount an Amos iframe into `containerRef` and keep it in step with
 * `options`.
 *
 * The iframe is mounted again only when `remountDeps` change. On every other
 * render, the options whose identity changed since the last render are
 * passed to `controller.update()`, and nothing is sent when none did. So a
 * new callback does not also re-send `appearance` or `defaultValues`.
 */
function useAmosEmbed<TOptions extends Record<string, unknown>>({
  containerRef,
  iframeRef,
  mount,
  options,
  remountDeps,
  iframePassthrough,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  iframeRef: ForwardedIframeRef;
  mount: (container: HTMLElement, options: TOptions) => AmosEmbedController;
  options: TOptions;
  remountDeps: Array<unknown>;
  iframePassthrough: IframePassthroughProps;
}): void {
  const controllerRef = useRef<AmosEmbedController | null>(null);
  /** The options the mounted controller already has. */
  const appliedOptionsRef = useRef(options);

  // biome-ignore lint/correctness/useExhaustiveDependencies: remount only when remountDeps change
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const controller = mount(container, options);
    controllerRef.current = controller;
    appliedOptionsRef.current = options;
    setForwardedRef(iframeRef, controller.iframe);
    applyIframePassthrough(controller.iframe, iframePassthrough);

    return () => {
      controller.destroy();
      controllerRef.current = null;
      setForwardedRef(iframeRef, null);
    };
  }, [...remountDeps]);

  useEffect(() => {
    const applied = appliedOptionsRef.current;
    appliedOptionsRef.current = options;

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(options)) {
      if (!Object.is(value, applied[key])) {
        patch[key] = value;
      }
    }
    if (Object.keys(patch).length > 0) {
      controllerRef.current?.update(patch);
    }

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

/**
 * `onValidityChange` as the components declare it: `isValid` only. For the
 * bank form it is also true once Plaid Embedded Link has returned
 * credentials. Does not include PCI data.
 */
type ValidityChangeProp = {
  onValidityChange?: (event: { isValid: boolean }) => void;
};

type AmosCreditCardPaymentMethodFormProps = IframePassthroughProps &
  Omit<
    AmosCreditCardPaymentMethodFormOptions,
    RevealCallbacks | "onValidityChange"
  > &
  ValidityChangeProp;

/** A new object each render would look like a changed option. */
const DEFAULT_ADDITIONAL_FIELDS: CreditCardAdditionalFields = {
  cardholderName: false,
};

export function AmosCreditCardPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onValidityChange,
  onCardBrandChanged,
  onPostalCodeChange,
  onEscapeKeyPressed,
  additionalFields = DEFAULT_ADDITIONAL_FIELDS,
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
      onPostalCodeChange,
      onEscapeKeyPressed,
    },
    remountDeps: [
      renderToken,
      additionalFields.cardholderName,
      billingAddressRequirement,
    ],
    iframePassthrough: { style, ...rest },
  });

  return <div ref={containerRef} />;
}

type AmosBankAccountPaymentMethodFormProps = IframePassthroughProps &
  Omit<
    AmosBankAccountPaymentMethodFormOptions,
    RevealCallbacks | "onValidityChange" | "plaidVerificationId"
  > &
  ValidityChangeProp;

/**
 * The secure bank account form. Changing `requireAchVerification` hides or
 * shows Plaid Embedded Link; it does not remount the form.
 */
export function AmosBankAccountPaymentMethodForm({
  ref,
  renderToken,
  appearance,
  onValidityChange,
  onPostalCodeChange,
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
      onPostalCodeChange,
      onEscapeKeyPressed,
    },
    // `requireAchVerification` is an update, not a remount: amos-js hides
    // Embedded Link instead of destroying it when the flag flips.
    remountDeps: [renderToken, billingAddressRequirement, intent],
    iframePassthrough: { style, ...rest },
  });

  return <div ref={containerRef} />;
}

type AmosExternalBankAccountFormProps = IframePassthroughProps &
  AmosExternalBankAccountFormOptions;

/**
 * Link a bank account to pay out to. The form shows the intent's status
 * and collects the account holder; Plaid Link opens on your page below
 * it for a first link, or as an overlay to enter a micro-deposit code.
 * Submit with {@link confirmExternalBankAccount}.
 *
 * Changing `renderToken` or `intentId` mounts the form again. `onStateChange`
 * reports each screen (`connect`, `code`, `verifying`, `finish`,
 * `deposits_sent`, `done`, `failed`, `closed`, `unavailable`); poll with
 * {@link refreshExternalBankAccount} while it is `verifying`.
 */
export function AmosExternalBankAccountForm({
  ref,
  renderToken,
  intentId,
  appearance,
  getEmbedToken,
  onStateChange,
  onValidityChange,
  onEscapeKeyPressed,
  style,
  ...rest
}: AmosExternalBankAccountFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosExternalBankAccountForm,
    options: {
      renderToken,
      intentId,
      appearance,
      getEmbedToken,
      onStateChange,
      onValidityChange,
      onEscapeKeyPressed,
    },
    remountDeps: [renderToken, intentId],
    iframePassthrough: { style, ...rest },
  });

  return <div ref={containerRef} />;
}

/**
 * Submit {@link AmosExternalBankAccountForm}. `token` is the intent's
 * embed token: mint it on your server with
 * `POST /external_bank_account_intents/:id/embed_token` right before
 * calling this, because it expires within seconds.
 *
 * Resolves with `succeeded`, `requires_verification` (micro-deposits
 * were sent), or `failed` with a `reason`, and does not throw. A
 * `retryable` failure can be submitted again with a fresh token; after
 * a `timeout` the SDK replays the same request, so a bank is never
 * linked twice.
 */
export function confirmExternalBankAccount({
  iframeRef,
  token,
  metadata,
}: {
  iframeRef: IframeRef;
  token: string;
  metadata?: Record<string, string>;
}): Promise<ExternalBankAccountConfirmResult> {
  return confirmExternalBankAccountIntent({
    iframe: resolveIframe(iframeRef),
    token,
    metadata,
  });
}

/**
 * Read the intent behind {@link AmosExternalBankAccountForm} again and
 * show its current screen, e.g. on an interval while it is `verifying`.
 */
export function refreshExternalBankAccount({
  iframeRef,
}: {
  iframeRef: IframeRef;
}): void {
  refreshExternalBankAccountIntent({ iframe: resolveIframe(iframeRef) });
}

type AmosOnboardingProps = IframePassthroughProps & AmosOnboardingOptions;

/**
 * The whole legal entity application in one iframe. A new applicant gives
 * the legal name and the kind of organization to start; then come six
 * sections in any order (Legal Entity, Merchant, Principals, Bank Account,
 * Supporting Documentation, Survey), and review and submit. When an
 * underwriter asks for more, the same form shows what is needed and lets
 * the applicant resubmit.
 *
 * Every field goes from the iframe straight to Amos, including the survey,
 * except a new application's start screen (name and entity type, no tax
 * ID), which `createApplication` sends from your server.
 *
 * Changing `renderToken` or `applicationId` mounts the form again, so keep
 * `applicationId` unchanged when `onApplicationCreated` reports the new id.
 * Changing `appearance` restyles the mounted form.
 */
export function AmosOnboarding({
  ref,
  renderToken,
  applicationId,
  getEmbedToken,
  createApplication,
  onApplicationCreated,
  appearance,
  onStateChange,
  onSubmitted,
  style,
  ...rest
}: AmosOnboardingProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useAmosEmbed({
    containerRef,
    iframeRef: ref as ForwardedIframeRef,
    mount: mountAmosOnboarding,
    options: {
      renderToken,
      applicationId,
      getEmbedToken,
      createApplication,
      onApplicationCreated,
      appearance,
      onStateChange,
      onSubmitted,
    },
    remountDeps: [renderToken, applicationId],
    iframePassthrough: { style, ...rest },
  });

  return <div ref={containerRef} />;
}

/**
 * Read the application behind {@link AmosOnboarding} again and show where
 * it stands, e.g. after your server gets a `legal_entity_application.*`
 * webhook or when the applicant comes back to the tab.
 */
export function refreshOnboarding({
  iframeRef,
}: {
  iframeRef: IframeRef;
}): void {
  refreshOnboardingIframe({ iframe: resolveIframe(iframeRef) });
}

/** What the wallet buttons take in place of the mount helpers' iframe options. */
type WalletButtonOwnProps = {
  ref?: ForwardedIframeRef;
  /** Props applied to the host-page `<iframe>` element. */
  iframeProps?: IframePassthroughProps;
};

type AmosGooglePayButtonProps = Omit<
  AmosGooglePayButtonOptions,
  RevealCallbacks | "iframeClassName" | "iframeStyle"
> &
  WalletButtonOwnProps;

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
  phoneRequired,
  shippingAddressRequired,
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
      phoneRequired,
      shippingAddressRequired,
      onConfirm,
    },
    remountDeps: [renderToken],
    iframePassthrough: iframeProps ?? {},
  });

  return (
    <WalletButtonSlot
      height={height}
      borderRadius={borderRadius}
      containerRef={containerRef}
    />
  );
}

type AmosApplePayButtonProps = Omit<
  AmosApplePayButtonOptions,
  RevealCallbacks | "iframeClassName" | "iframeStyle"
> &
  WalletButtonOwnProps;

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
  phoneRequired,
  shippingAddressRequired,
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
      phoneRequired,
      shippingAddressRequired,
      onConfirm,
    },
    remountDeps: [renderToken],
    iframePassthrough: iframeProps ?? {},
  });

  return (
    <WalletButtonSlot
      height={height}
      borderRadius={borderRadius}
      containerRef={containerRef}
    />
  );
}
