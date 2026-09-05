# Amos React SDK

`@amos.com/react-amos-js` is the React SDK for embedding Amos payment methods (credit card, bank account, Google Pay, Apple Pay) into your React app via secure iframes.

It is a thin wrapper around [`@amos.com/amos-js`](../amos-js) that adapts the framework-agnostic iframe controller to idiomatic React components and hooks.

## Installation

```bash
npm install @amos.com/react-amos-js @amos.com/node
```

`@amos.com/node` is a **peer dependency** (requires `>=0.1.57`). Install it in your app for OpenAPI schema types (for example `components["schemas"]["CreatePaymentIntentInput"]`) used in the examples below, and for your server-side Amos API client. React (`^17`, `^18`, or `^19`) is also a peer dependency.

## What it gives you

- React components for the iframe payment method forms: `AmosCreditCardPaymentMethodForm`, `AmosBankAccountPaymentMethodForm`, `AmosGooglePayButton`, `AmosApplePayButton`.
- React-flavoured iframe message helpers that accept a React `ref`: `validateForm({ iframeRef })`, `confirmPayment({ iframeRef, token })`, `confirmSetup({ iframeRef, token })`, `resetForm({ iframeRef })`, `focusField({ iframeRef, field })`.
- Re-exports of the `@amos.com/amos-js` helpers and types that come up in client code: `createMessage`, `decodeJwt`, `getEmbedOrigin`, `formatGooglePayPaymentData`, `resetForm`, `focusField`, `ConfirmPaymentResult`, `ConfirmSetupResult`, `FormattedGooglePayPaymentData`, `WalletCustomerCreateAttributes`, `WalletPostalAddress`, `WalletContactRequirements`, `Appearance`, `FontSource`, `AppearanceRuleSelector`, `Message`, `PaymentMethodFormDefaultValues`, `PaymentMethodFormField`, etc.

> **Note:** `@amos.com/react-amos-js` is the client-side half of the Amos integration. For end-to-end payment processing you also need `@amos.com/node` on your server (creating payment intents, handling webhooks, etc.). The same `@amos.com/node` package is listed as a peer dependency so you can import its OpenAPI types in client-side TypeScript code.

## Requirements

```
1. Render token (created on dashboard.amos.com, safe to expose to clients)
2. Amos API key (created on dashboard.amos.com, do not expose this to clients)
3. Amos account ID (provided once your application has been approved)
```

The render token configures the iframe's allowed origin(s), allowed payment methods, accepted billing countries or US states, and the range of valid payment amounts. These settings come from the render template and are embedded in the token JWT (`RenderTokenJwt`); billing geography is controlled by `billing_address_options` (`allowed_countries` for international templates, `allowed_states` for US-only). If the render token does not allow an origin, the iframe will not render. Similarly, components corresponding to different payment method types will not render if not allowed by the render token, and billing addresses outside the configured countries or states will be rejected.

> **Note**: The render token also determines the environment (`production` or `sandbox`). Render tokens created on `dashboard.amos.com` have a `production` environment. Render tokens created on `dashboard-sandbox.amos.com` have a `sandbox` environment. Similarly, API keys can only access the environment that they were created in.

## Understanding the flow for creating and confirming payment intents

### Credit Card & Bank Account

The following flow is for credit card and bank account payment method types only.

1. **Set up prerequisites**: create a `renderToken` (safe for client), and keep `apiKey` and `accountId` server-side only.
2. **Render your checkout UI** with one of the payment method components (e.g. `AmosCreditCardPaymentMethodForm`) **inside a host `<form>`**. Card and bank forms show a field-shaped skeleton immediately (sized from `appearance`, `additionalFields`, and `billingAddressRequirement`); Google Pay and Apple Pay paint a button-shaped skeleton in the parent document on first render so the 48px slot is reserved before the iframe loads. Enter in the iframe submits that enclosing form (PCI-safe; no field values). No-op without a host form, or while Plaid Embedded Institution Search is showing.
3. **User clicks "Pay now" or presses Enter in the iframe**: call `validateForm({ iframeRef })`, which returns `Promise<true>` if the embedded form is valid and `Promise<false>` otherwise.
4. **Create payment intent on your server**: use your server-side Amos client to call `POST /payment_intents`. You may also associate this payment intent with a new or existing customer via `POST /customers`. This must be server-side because it uses your private API key.
5. **Return the payment intent token to the browser**: your backend responds with the embed token (`components["schemas"]["EmbedToken"]`) needed for confirmation.
6. **Confirm the payment intent from the client**: `await confirmPayment({ iframeRef, token })`. It resolves `{ status: "succeeded", paymentIntent }`, `{ status: "failed", paymentIntent? }` on decline, or `{ status: "failed", error: "timeout" }` if the iframe does not respond within 15 seconds (`isConfirmTimeout(result)`).
7. **Handle UX**: show the user a "processing" state while awaiting `confirmPayment`. Do not treat `{ status: "succeeded" }` as settlement proof — verify payment success on your backend via webhooks. Recoverable field errors stay in the iframe; a processor decline still resolves `{ status: "failed" }` (with `paymentIntent` when the confirm API returned a body — inspect `paymentIntent.state`). A timeout is **not** a decline — the charge may still settle; do not retry as a new payment.

### Google Pay & Apple Pay

Google Pay and Apple Pay are forms of express checkout. Their buttons are alternatives to the "Pay now" button in your payment forms. Users can make a payment with either flow.

The key differences between the express and non-express payment flows are:

- The express payment method components accept `onConfirm`. Create a payment intent, then `await confirmPayment(token)`.
- You do not call `validateForm` in an express flow.
- You call `confirmPayment` inside `onConfirm` (the SDK does not auto-confirm).

## Understanding the flow for creating and confirming setup intents

Setup intents are used to save payment methods for future use (e.g. recurring payments, subscriptions) without charging the customer immediately. The flow is identical to a payment intent, except:

- On the server, call `POST /setup_intents` instead of `POST /payment_intents`.
- On the client, `await confirmSetup({ iframeRef, token })` instead of `confirmPayment({ iframeRef, token })`.
- Both resolve with a status and the matching intent object when the confirm API returned a body (`ConfirmPaymentResult` / `ConfirmSetupResult`).

The same `AmosCreditCardPaymentMethodForm` / `AmosBankAccountPaymentMethodForm` components support both payment intents and setup intents — they are differentiated by which confirmation function you call. For bank setup, pass `intent="setup"` so Plaid is always shown (unless the render token disables verification).

## Understanding PCI DSS compliance requirements

The flows above are designed so your systems and any third-party servers you control do not handle card or bank account data in either raw or encrypted form.

Why this matters:

- The payment method UI is rendered inside Amos-hosted iframes, so sensitive input fields are not part of your DOM.
- Raw payment details are submitted from the iframe directly to Amos-controlled infrastructure.
- Your backend only creates payment intents (or setup intents) and returns a short-lived token used to continue the iframe flow.
- `confirmPayment` / `confirmSetup` send the token back to the iframe to complete confirmation; they do not pass full payment method payloads through your app server.
- In express flows (Google Pay / Apple Pay), the iframe handles payment data exchange and calls `onConfirm` so your server can create a payment intent token, then you `await confirmPayment(token)`.

In short, your app orchestrates the payment flow, while sensitive payment data stays within Amos-controlled components and APIs.

## Appearance

Card and bank components accept an optional `appearance` prop that controls the look of the iframe UI. It contains a `themeVariables` object whose keys are CSS custom-property names and whose values are strings, an optional `labels` setting for field label placement, and optional `fonts` to load webfonts inside the iframe. You can update this prop after page load to update the iframe appearance. Wallet buttons do not take `appearance`.

```tsx
<AmosCreditCardPaymentMethodForm
  renderToken="..."
  appearance={{
    labels: "floating",
    fonts: [
      { cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" },
    ],
    themeVariables: {
      "--primary": "oklch(0.5 0.2 240)",
      "--radius": "0.25rem",
      "--font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
    },
  }}
/>
```

`themeVariables` uses a **replace** model: each update that includes `themeVariables` sets the full override set. Only the variables you list are overridden; unlisted variables revert to iframe defaults. Omit `themeVariables` to leave existing overrides unchanged.

`fonts` uses the same replace model: omit `fonts` to keep the previous set; pass a new array to replace it (`[]` clears the webfont). The iframe does not wait for webfonts before revealing — custom faces use `font-display: swap`.

### Fonts

When you omit `fonts` and `--font-family`, the SDK sends Google Fonts Inter on the first `UPDATE_APPEARANCE` (same stylesheet the embed used to load globally) and sets `--font-family` to `Inter, ui-sans-serif, system-ui, sans-serif`. That is what lets js.amos.com drop its own Inter `<link>` once every client is on this SDK.

Pass Stripe-style font sources on `appearance.fonts` to replace that default. Pair them with `--font-family` so the iframe uses the loaded face (see the example above). A custom `@font-face` source looks like `{ family: "MyFont", src: 'url(https://cdn.example.com/my.woff2)', display: "swap" }`.

Pass `fonts: []` to skip the webfont. If you also omit `--font-family` on that payload, the SDK uses `ui-sans-serif, system-ui, sans-serif` instead of Inter.

- **`cssSrc`** — an `https:` stylesheet URL that declares `@font-face` (Google Fonts CSS, a self-hosted CSS file). The iframe injects `<link rel="stylesheet">`; it does not fetch and inline the CSS.
- **Custom source** — `family` plus a CSS `src` list of `url("https://…")` / `url(https://…)` and optional `format(…)`. Optional `display` (default `"swap"`), `style`, `weight`, and `unicodeRange`.

### Rules

Per-part CSS, keyed by Stripe-style class names. The iframe maps these onto its own slots; you cannot target the iframe DOM from the host page. Pair `fontFamily` with `appearance.fonts` so the face is loaded.

```tsx
appearance={{
  fonts: [
    { cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" },
    { cssSrc: "https://fonts.googleapis.com/css2?family=Source+Serif+4&display=swap" },
  ],
  themeVariables: {
    "--font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  rules: {
    ".Label": { fontFamily: "Source Serif 4, ui-serif, serif" },
    ".Input": { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
    ".Input--invalid": { boxShadow: "0 0 0 2px oklch(0.55 0.245 27.325)" },
  },
}}
```

`rules` uses the same **replace** model as `themeVariables` and `fonts`: omit `rules` to keep the previous set; pass a new object to replace it (`{}` clears). Unknown class names and properties are ignored.

Rules override `themeVariables` for the properties they set (Stripe). `--input-height` / `--floating-input-height` are a **minimum**; `.Input` `padding`, `fontSize`, and `lineHeight` can grow the field. Rule values may reference allowlisted tokens as `var(--primary)` (no fallback argument).

The host skeleton (shown until `UPDATED_APPEARANCE`, or 1.5s after `IFRAME_READY` if appearance never acks) copies `themeVariables` and resting **`.Input` / `.Label`** declarations (the same allowlisted properties as iframe rules). It does not inject webfonts: it uses `--font-family` / `fontFamily` when that face is already on the host page, and falls back to `ui-sans-serif, system-ui, sans-serif`. Hover, invalid, placeholder, dropdown, and radio rules have no skeleton equivalent. Floating labels sit inside the control, so `.Label` / `.Label--floating` do not change skeleton height.

| Selector | Targets |
| --- | --- |
| `.Input` | Text fields, country select, state trigger |
| `.Input:hover`, `.Input:focus`, `.Input:disabled` | Those controls in the given state |
| `.Input--invalid` | Invalid text fields / selects |
| `.Input::placeholder` | Input placeholders |
| `.Label` | All labels (above, floating, radio option text, group titles) |
| `.Label--floating` | Extra styles on floating labels (overrides `.Label`) |
| `.Error` | Field-level error text |
| `.Dropdown` | State list panel |
| `.DropdownItem` | State list rows |
| `.DropdownItem--highlight` | Highlighted state row |
| `.RadioIcon` | Bank radio circle |
| `.RadioIcon--checked` | Checked radio circle |
| `.RadioIconInner` | Radio filled dot |

Allowed declaration keys (camelCase): `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `textTransform`, `color`, `backgroundColor`, `border`, `borderColor`, `borderWidth`, `borderStyle`, `borderRadius`, `boxShadow`, `outline`, `padding`, `margin`, `opacity`. Values cannot include `url()`, `@font-face`, `<`, `>`, `\`, or `var()` except `var(--token)` for an allowlisted theme variable (`--primary`, `--input-height`, …).

### Label placement

Set `labels` to control how field labels are rendered in card and bank account forms:

| Value             | Behavior                                                  |
| ----------------- | --------------------------------------------------------- |
| `above` (default) | Label text above each input                               |
| `floating`        | Label inside the control; moves up when focused or filled |
| `placeholder`     | No visible label; placeholder and `aria-label` only       |

Radio groups (e.g. account type) always use an above-style group label regardless of this setting.

### Available theme variables

| Variable                           | Purpose                                                  | Default                         |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------- |
| `--background`                     | Page body and base surface color                         | `oklch(1 0 0)`                  |
| `--foreground`                     | Default text color                                       | `oklch(0.145 0 0)`              |
| `--primary`                        | Button fill and input text-selection highlight           | `oklch(0.205 0 0)`              |
| `--primary-foreground`             | Text on primary-colored surfaces                         | `oklch(0.985 0 0)`              |
| `--secondary`                      | Secondary button fill                                    | `oklch(0.97 0 0)`               |
| `--secondary-foreground`           | Text on secondary-colored surfaces                       | `oklch(0.205 0 0)`              |
| `--muted`                          | Muted surface color                                      | `oklch(0.97 0 0)`               |
| `--muted-foreground`               | Placeholder text, helper labels, muted icons             | `oklch(0.556 0 0)`              |
| `--accent`                         | Hover/focus highlight for interactive items              | `oklch(0.97 0 0)`               |
| `--accent-foreground`              | Text on accent-highlighted items                         | `oklch(0.205 0 0)`              |
| `--destructive`                    | Error/invalid state borders, icons, and field error text | `oklch(0.577 0.245 27.325)`     |
| `--destructive-foreground`         | Text on destructive-colored surfaces                     | `oklch(0.45 0.24 27.325)`       |
| `--border`                         | General border color                                     | `oklch(0.922 0 0)`              |
| `--popover`                        | Dropdown / popover panel background                      | `oklch(1 0 0)`                  |
| `--popover-foreground`             | Dropdown / popover panel text color                      | `oklch(0.145 0 0)`              |
| `--input`                          | Input field border color                                 | `oklch(0.922 0 0)`              |
| `--input-background`               | Input field background fill                              | `var(--background)`             |
| `--input-height`                   | Height of text inputs and form controls                  | `2.25rem`                       |
| `--input-font-size`                | Font size of text inputs and dropdown fields             | `0.875rem`                      |
| `--input-font-weight`              | Font weight of typed input values                        | `400`                           |
| `--input-padding`                  | Horizontal padding inside inputs                         | `0.75rem`                       |
| `--input-border-width`             | Input field border width                                 | `1px`                           |
| `--input-shadow`                   | Input field box shadow                                   | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `--floating-input-height`          | Height of inputs when labels are floating                | `3.25rem`                       |
| `--floating-label-font-size`       | Font size of floating labels when focused or filled      | `0.75rem`                       |
| `--floating-label-empty-font-size` | Font size of floating labels when empty (unfocused)      | `var(--input-font-size)`        |
| `--floating-label-font-weight`     | Font weight of floating labels                           | `500`                           |
| `--floating-label-color`           | Color of floating labels when empty (unfocused)          | `var(--muted-foreground)`       |
| `--floating-label-floated-color`   | Color of floating labels when focused or filled          | `var(--floating-label-color)`   |
| `--floating-label-offset`          | Top offset of the shrunk floating label                  | `0.625rem`                      |
| `--label-font-size`                | Font size of above-style field labels                    | `0.875rem`                      |
| `--label-font-weight`              | Font weight of above-style field labels                  | `500`                           |
| `--field-gap`                      | Vertical gap between stacked form fields                 | `1rem`                          |
| `--control-gap`                    | Horizontal gap between side-by-side controls             | `0.5rem`                        |
| `--error-font-size`                | Font size of field-level error messages                  | `0.875rem`                      |
| `--radio-size`                     | Size of radio buttons on the bank account form           | `1rem`                          |
| `--ring`                           | Focus ring and outline color (inputs)                    | `oklch(0.708 0 0)`              |
| `--ring-width`                     | Focus ring width                                         | `3px`                           |
| `--radius`                         | Base border-radius (derived into sm/md/lg/xl)            | `0.625rem`                      |
| `--font-family`                    | Font stack for the iframe UI                             | `Inter, ui-sans-serif, system-ui, sans-serif` |

## Examples

### Rendering the credit card inputs within your custom form

Wrap the component in a host `<form>`. Enter in the iframe submits it (same as Stripe Elements). The parent cannot listen for that key itself because the iframe is cross-origin. If you render the iframe inside a modal, pass `onEscapeKeyPressed` to close it — Escape inside the iframe is likewise invisible to the parent.

```tsx
import { useRef, useState } from "react";
import {
  AmosCreditCardPaymentMethodForm,
  confirmPayment,
  validateForm,
} from "@amos.com/react-amos-js";
import type { components } from "@amos.com/node";

function CheckoutForm() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isValid, setIsValid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsProcessing(true);
    setError(null);

    try {
      const isValid = await validateForm({ iframeRef });

      if (!isValid) {
        setError("Please complete the card form before continuing.");
        return;
      }

      const paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"] =
        {
          amount: 5000, // $50.00 in cents
          capture_method: "automatic",
        };

      const response = await fetch("/api/payment-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { email: "customer@example.com" },
          paymentIntent: paymentIntentCreateAttributes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment intent.");
      }

      const { token } = await response.json();
      const result = await confirmPayment({ iframeRef, token });
      if (result.status !== "succeeded") {
        setError("Payment failed. Please try again.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <AmosCreditCardPaymentMethodForm
        ref={iframeRef}
        renderToken="the-render-token-that-you-created-on-dashboard.amos.com"
        additionalFields={{ cardholderName: true }}
        defaultValues={{
          name: "Jane Doe",
          billingAddress: {
            line1: "354 Oyster Point Blvd",
            city: "South San Francisco",
            state: "CA",
            postalCode: "94080",
            country: "US",
          },
        }}
        onValidityChange={({ isValid }) => setIsValid(isValid)}
      />
      {error ? <p>{error}</p> : null}
      <button type="submit" disabled={!isValid || isProcessing}>
        {isProcessing ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}
```

### Rendering Google Pay and Apple Pay within your checkout flow

```tsx
import { useState } from "react";
import {
  AmosApplePayButton,
  AmosGooglePayButton,
  type ConfirmPaymentResult,
  type WalletCustomerCreateAttributes,
} from "@amos.com/react-amos-js";
import type { components } from "@amos.com/node";

async function createPaymentIntentToken({
  paymentIntentCreateAttributes,
  customerCreateAttributes,
}: {
  paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
  customerCreateAttributes: WalletCustomerCreateAttributes;
}): Promise<string> {
  const response = await fetch("/api/payment-intents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Map WalletCustomerCreateAttributes on your server — it is not
      // CreateCustomerInput.
      customer: customerCreateAttributes,
      paymentIntent: paymentIntentCreateAttributes,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to create payment intent.");
  }
  const { token } = (await response.json()) as { token: string };
  return token;
}

function CheckoutWallets({ renderToken }: { renderToken: string }) {
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm({
    paymentIntentCreateAttributes,
    customerCreateAttributes,
    confirmPayment,
  }: {
    paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
    customerCreateAttributes: WalletCustomerCreateAttributes;
    confirmPayment: (token: string) => Promise<ConfirmPaymentResult>;
  }): Promise<ConfirmPaymentResult> {
    try {
      const token = await createPaymentIntentToken({
        paymentIntentCreateAttributes,
        customerCreateAttributes,
      });
      const result = await confirmPayment(token);
      if (result.status === "failed") {
        setError("Payment failed. Please try again.");
      }
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
      return { status: "failed" };
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <AmosGooglePayButton
            renderToken={renderToken}
            amount="50.00"
            merchantName="Example Store"
            onConfirm={handleConfirm}
          />
        </div>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <AmosApplePayButton
            renderToken={renderToken}
            amount="50.00"
            merchantName="Example Store"
            onConfirm={handleConfirm}
          />
        </div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
```

Do not call `validateForm` from the host in an express flow — create a payment intent inside `onConfirm`, then `await confirmPayment(token)`. Size the mount slot; omitted `buttonProps` keep paint defaults and fill the iframe. Name, email, and billing address are always collected. Pass `phoneRequired: true` if you still need a phone (Apple Pay previously always collected one). Pass `shippingAddressRequired: true` to collect a shipping postal address.

`customerCreateAttributes` is `WalletCustomerCreateAttributes`, not `CreateCustomerInput`. Nested `billingAddress` / `shippingAddress` use Amos billing field names (`address_line1`, `state`, `postal_code`). `phone` and `shippingAddress` are omitted unless you opted in.

On Safari, Apple Pay uses the native payment sheet. On other browsers, Apple's QR handoff opens in a popup (`pay.apple.com`); while that popup is open, the SDK shows a waiting overlay with **Cancel payment**. After the buyer authorizes, Cancel is removed and the overlay shows **Completing your payment…** until `onConfirm` settles.

Optional visuals:

```tsx
<AmosGooglePayButton
  renderToken={renderToken}
  amount="50.00"
  merchantName="Example Store"
  height="48px"
  buttonProps={{ buttonType: "donate", buttonBorderType: "no_border" }}
  iframeProps={{ style: { borderRadius: "8px" } }}
  onConfirm={handleConfirm}
/>

<AmosApplePayButton
  renderToken={renderToken}
  amount="50.00"
  merchantName="Example Store"
  height="48px"
  buttonProps={{ type: "donate" }}
  iframeProps={{ style: { borderRadius: "8px" } }}
  onConfirm={handleConfirm}
/>
```

### Saving a payment method with setup intent (credit card)

```tsx
import { useRef, useState } from "react";
import {
  AmosCreditCardPaymentMethodForm,
  confirmSetup,
  validateForm,
} from "@amos.com/react-amos-js";

function SavePaymentMethodForm() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsProcessing(true);
    setError(null);

    try {
      const isValid = await validateForm({ iframeRef });

      if (!isValid) {
        setError("Please complete the card form before continuing.");
        return;
      }

      const response = await fetch("/api/setup-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { email: "customer@example.com" },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create setup intent.");
      }

      const { token } = await response.json();
      const result = await confirmSetup({ iframeRef, token });
      if (result.status !== "succeeded") {
        setError("Failed to save the payment method.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <AmosCreditCardPaymentMethodForm
        ref={iframeRef}
        renderToken="the-render-token-that-you-created-on-dashboard.amos.com"
      />
      {error ? <p>{error}</p> : null}
      <button type="submit" disabled={isProcessing}>
        {isProcessing ? "Processing..." : "Save payment method"}
      </button>
    </form>
  );
}
```

## API reference

### `validateForm({ iframeRef })`

Validates the embedded card/bank iframe form before payment confirmation.

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)

**Returns:** `Promise<boolean>` (resolves to `false` after 5 seconds if the iframe does not respond).

### `confirmPayment({ iframeRef, token, defaultValues? })`

Confirms a payment intent in the embedded iframe flow. Resolves `{ status: "succeeded", paymentIntent }`, `{ status: "failed", paymentIntent? }` on decline, or `{ status: "failed", error: "timeout" }` if the iframe does not respond within 15 seconds (`CONFIRM_TIMEOUT_MS`). Optional `defaultValues` are applied immediately before building the payment method (including hidden name and extra billing fields) and do not replace the last `defaultValues` prop used by `resetForm`.

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)
- `token` (typed as `Pick<components["schemas"]["EmbedToken"], "token">` — the embed JWT string returned by your server)
- `defaultValues` (`PaymentMethodFormDefaultValues`, optional)

**Returns:** `Promise<ConfirmPaymentResult>` — use `isConfirmTimeout(result)` to treat a timeout as uncertain (do not retry). Embed aborts hung `/confirm` at 10s and posts the same timeout result; the SDK wait is strictly above that.

### `confirmSetup({ iframeRef, token, defaultValues? })`

Confirms a setup intent in the embedded iframe flow. Use this when saving a payment method for future use. Optional `defaultValues` behave the same as on `confirmPayment`. Same 15-second timeout window and `isConfirmTimeout` rule as `confirmPayment`.

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)
- `token` (same `Pick<components["schemas"]["EmbedToken"], "token">` embed JWT string as for payment confirmation)
- `defaultValues` (`PaymentMethodFormDefaultValues`, optional)

**Returns:** `Promise<ConfirmSetupResult>`

### `resetForm({ iframeRef })`

Clears all field values and API errors in the embedded card/bank iframe form, then restores the last `defaultValues` prop. Call after a failed confirm when the customer wants to try again (for example, after a successful payment when starting a new one).

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)

**Returns:** `void`

### `focusField({ iframeRef, field })`

Focus a named control inside the card or bank iframe. No-op if the field is not rendered, or while Plaid Embedded Institution Search is showing. Call from a click or keydown handler; some browsers ignore focus without a user gesture.

`field` is one of: `cardNumber`, `expiration`, `cvc`, `cardholderName`, `accountHolderName`, `accountNumber`, `confirmAccountNumber`, `routingNumber`, `accountType`, `accountHolderType`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country`.

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)
- `field` (`PaymentMethodFormField`, required)

**Returns:** `void`

### `AmosCreditCardPaymentMethodForm`

Renders the secure credit card iframe form. A field-shaped skeleton is shown immediately (sized from `appearance`, including resting `.Input` / `.Label` rules) and replaced by the iframe once appearance is applied.

**Required props:**

- `renderToken` (`string`)

**Optional props:**

- `appearance` (`{ themeVariables?: Partial<Record<ThemeVariable, string>>; labels?: "above" | "floating" | "placeholder"; fonts?: FontSource[]; rules?: Partial<Record<AppearanceRuleSelector, AppearanceRuleDeclarations>> }`) — appearance overrides for the iframe UI (see [Appearance](#appearance))

- `additionalFields` (`{ cardholderName: boolean }`) — set `additionalFields={{ cardholderName: true }}` to render the cardholder name field in the iframe (`false` by default)
- `billingAddressRequirement` (`"country" | "full"`, defaults to `"country"`) — how much billing address the iframe collects. `country` collects country / region and, for CA / PR / GB / US, a postal code (labeled ZIP for the United States). `full` shows a full street address form with Smarty autocomplete.
- `defaultValues` (`{ name?: string; billingAddress?: { line1?, line2?, city?, state?, postalCode?, country? } }`) — seed cardholder / account-holder name and billing address. Provided keys overwrite matching fields, including ones the customer already edited. Values are also sent on confirm even when those inputs are hidden (cardholder name off, or `country` billing mode). Never send PAN, CVC, account number, or routing number.
- `onValidityChange` (`(event: { isValid: boolean }) => void`) — called when form validity changes. `isValid` is true when all required fields are present and valid. Does not include PCI data. Use this to enable or disable your checkout button.
- `onCardBrandChanged` (`(event: { brand: CardBrand | null }) => void`) — called when the detected card brand changes. `brand` is `"visa"`, `"mastercard"`, `"amex"`, `"discover"`, `"diners"`, or `"jcb"`, or `null` when the field is empty or the number does not match a known brand. Does not include PCI data.
- `onEscapeKeyPressed` (`() => void`) — called when the customer presses Escape in the iframe. PCI-safe — no field values. Use this to close a host modal that contains the iframe. Not fired while an iframe dropdown or address suggestion list is open (that Escape dismisses the overlay first), or while Plaid Embedded Institution Search is showing. The parent cannot attach a keydown listener for this itself because the iframe is cross-origin.

Enter in a card or bank iframe field submits the enclosing host `<form>` via `requestSubmit()` (same as Stripe Elements). Handle that form's `onSubmit` — the parent page cannot see keys typed in the cross-origin iframe. No-op if the component is not inside a `<form>`, or while Plaid Embedded Institution Search is showing.

**Also accepts:** standard iframe props (`React.ComponentProps<"iframe">`), minus `src`, `title`, `name`, and `role` (which are controlled by the SDK).

### `AmosBankAccountPaymentMethodForm`

Renders the secure bank account iframe form. A field-shaped skeleton is shown immediately (sized from `appearance`, including resting `.Input` / `.Label` rules) and replaced by the iframe once appearance is applied.

When `requireAchVerification` is true (or `intent` is `"setup"`), and the render token allows verification, the SDK hides the routing/account iframe and mounts [Plaid Embedded Institution Search](https://plaid.com/docs/link/embedded-institution-search/) in the parent. A **350px pulse skeleton** covers that slot until Plaid's `onLoad` (1.5s fallback). Do not overlay a host loader. Hosts do not proxy Pay API (`GET /merchants`, `POST /plaid_link_tokens`); embed does that with `PAY_API_KEY`. Do not put Plaid secrets in the browser.

**Required props:** same as `AmosCreditCardPaymentMethodForm` — `renderToken`.

**Optional props:** same as `AmosCreditCardPaymentMethodForm` — `appearance`, `billingAddressRequirement`, `defaultValues`, `onValidityChange` (`isValid` is also true after Plaid returns credentials), `onEscapeKeyPressed` — plus:

- `requireAchVerification` (`boolean`, defaults to `false`) — when true, show Plaid Embedded Link instead of routing/account fields. Ignored for `intent="setup"` (always Plaid) and when the render token has bank `verification: false`. Hosts that still have an ACH threshold should compute this themselves and pass a new value when the charge changes. Changing this prop hides or shows Link; it does not remount the bank form or destroy the Embedded handler.
- `intent` (`"payment" | "setup"`, defaults to `"payment"`) — `"setup"` always shows Plaid unless the render token disables verification. Use this when saving a bank account for later charges.

```tsx
<AmosBankAccountPaymentMethodForm
  renderToken={renderToken}
  requireAchVerification
/>
```

Setup (always Plaid, unless the render token disables verification):

```tsx
<AmosBankAccountPaymentMethodForm
  renderToken={renderToken}
  intent="setup"
/>
```

`validateForm` / `confirmPayment` / `confirmSetup` stay iframe-based. When Plaid succeeded, confirm sends `payment_method.plaid` (`public_token`, `account_id`) and does not require typed account numbers.

**CSP:** the parent page must allow Plaid’s script and frames, for example `script-src https://cdn.plaid.com` and `frame-src https://cdn.plaid.com https://*.plaid.com`. Amos never loads `PLAID_SECRET` / `PLAID_CLIENT_ID` in the SDK or embed iframe.

**Also accepts:** standard iframe props.

### `AmosGooglePayButton`

Renders the secure Google Pay iframe button (express checkout flow). A button-shaped skeleton is shown immediately and replaced by the iframe once appearance is applied.

**Required props:**

- `renderToken` (`string`)
- `amount` (`string`) — major-currency decimal string shown in the wallet sheet (e.g. `"50.00"` for $50.00). The iframe converts this to cents in `paymentIntentCreateAttributes.amount`.
- `merchantName` (`string`)
- `onConfirm` (callback receiving `{ paymentIntentCreateAttributes, customerCreateAttributes, confirmPayment }`. Create a payment intent, then `return confirmPayment(token)` — `Promise<ConfirmPaymentResult>`). `customerCreateAttributes` is `WalletCustomerCreateAttributes`, not `CreateCustomerInput` — map it on your server. Nested `billingAddress` / `shippingAddress` use Amos billing field names (`address_line1`, `state`, `postal_code`). `phone` and `shippingAddress` are omitted unless you passed `phoneRequired` / `shippingAddressRequired`.

**Optional props:**

- `height` (`string`, defaults to `"48px"`) — painted button height. CSS length (e.g. `"48px"`).
- `buttonProps` — native Google Pay button options. Omitted fields keep `"plain"` / `"fill"`. The button fills the iframe; size the mount slot, not the button. Compact: `buttonProps={{ buttonSizeMode: "static", style: { width: "240px" } }}`.
- `phoneRequired` (`boolean`, defaults to `false`) — collect a phone number in the Google Pay sheet.
- `shippingAddressRequired` (`boolean`, defaults to `false`) — collect a shipping postal address. Name, email, and billing address are always required.
- `iframeProps` — applied to the host-page `<iframe>` (e.g. `className`, `style`, `id`). Use CSS lengths with units in `style` (`{ borderRadius: "8px" }`). Amos does not ship Tailwind — `className` only works if the host page defines those classes.

```tsx
<AmosGooglePayButton
  buttonProps={{ buttonType: "donate", buttonBorderType: "no_border" }}
  iframeProps={{ style: { borderRadius: "8px" } }}
  // ...required props
/>
```

### `AmosApplePayButton`

Renders the secure Apple Pay iframe button (express checkout flow). Same required props and callbacks as `AmosGooglePayButton`. A button-shaped skeleton is shown immediately and replaced by the iframe once appearance is applied.

**Optional props:**

- `height` (`string`, defaults to `"48px"`) — painted button height. CSS length (e.g. `"48px"`). Apple ignores CSS `height`; Amos maps this for you.
- `buttonProps` — native `<apple-pay-button>` attributes. Omitted fields keep Apple's `black` / `plain` / `en-US`. The button fills the iframe; size the mount slot, not the button. `style.width` also updates `--apple-pay-button-width` unless you set that custom property yourself.
- `phoneRequired` (`boolean`, defaults to `false`) — collect a phone number in the Apple Pay sheet. Pass `true` to keep the previous Apple Pay behavior of always collecting a phone.
- `shippingAddressRequired` (`boolean`, defaults to `false`) — collect a shipping postal address. Name, email, and billing address are always required.
- `iframeProps` — host-page `<iframe>` chrome (same as Google Pay).

```tsx
<AmosApplePayButton
  buttonProps={{
    buttonstyle: "white-outline",
    type: "buy",
    locale: "en-GB",
  }}
  iframeProps={{ style: { borderRadius: "8px" } }}
  // ...required props
/>
```

Only Amos domains need Apple merchant registration. The button and `ApplePaySession` run inside the Amos embed iframe. On Safari, the native payment sheet is used. On other browsers, Apple's QR handoff opens in a popup (`pay.apple.com`); while that popup is open, the SDK automatically shows a full-viewport waiting overlay on the host page with instructions and a **Cancel payment** button. After the buyer authorizes, the overlay switches to **Completing your payment…** and hides Cancel so the donor cannot double-pay. You do not need to implement popup or overlay handling yourself.

### `formatGooglePayPaymentData({ paymentData })`

Transforms Google Pay payment data into an Amos-compatible `paymentMethod` payload. Use this when integrating with the raw Google Pay API (e.g. `@google-pay/button-react`) instead of `AmosGooglePayButton` — `AmosGooglePayButton` handles payment data internally and does not require this helper. Street and name come from CARD `billingAddress`; email from the top-level field; phone from shipping when present, otherwise billing.

**Parameters:**

- `paymentData` (`google.payments.api.PaymentData`, required)

**Returns:** `FormattedGooglePayPaymentData` — the `paymentMethod` field is typed for embed confirm endpoints, so no extra type assertions are needed at call sites.

### `createMessage(message)` / `decodeJwt(token)` / `getEmbedOrigin(renderToken)`

Re-exports of the same advanced helpers exposed by `@amos.com/amos-js`. Most integrators do not need to call these directly.

### `getCreditCardFormSrc(renderToken, additionalFields?, billingAddressRequirement?)` / `getBankAccountFormSrc(renderToken, billingAddressRequirement?, intent?)` / `getGooglePayButtonSrc(renderToken)` / `getApplePayButtonSrc(renderToken)`

Re-exports from `@amos.com/amos-js`. Build the iframe `src` URL for each form type. The React components call these for you.

Each URL includes the embed's canonical search params (`token`, `additionalFields`, `billingAddressRequirement`, `intent`) so the embed router does not 307 to fill in defaults. After the iframe `load` event, if `IFRAME_READY` never arrives (stale HTML, missing JS chunk), the SDK rewrites `src` once with `amosReload` so the next document is a real navigation. Appearance is applied after handshake via `UPDATE_APPEARANCE` (the iframe stays hidden until then, or for 1.5s after `IFRAME_READY` if appearance never acks).

### `updateDefaultValues({ iframe, defaultValues })`

Re-export from `@amos.com/amos-js`. Push name and billing-address defaults into a mounted form. Passing a new `defaultValues` prop on the React component does the same.

### `appearanceWithDefaults(appearance, { initial })`

Re-export from `@amos.com/amos-js`. Fills omitted Inter `fonts` / `--font-family` (or a system stack when `fonts` is `[]`). The React components call this for you via the mount helpers. Only call it yourself if you are wiring `UPDATE_APPEARANCE` by hand: pass `initial: true` only for the first update after `IFRAME_READY`, and pass the merchant's last `appearance` (so a previous `fonts: []` is not overwritten).

### Exported types

`@amos.com/react-amos-js` re-exports everything from `@amos.com/amos-js`, including `ConfirmPaymentResult`, `ConfirmSetupResult`, `PaymentMethodFormValidityChangeEvent`, `CardBrand`, `PaymentMethodFormCardBrandChangeEvent`, `FormattedGooglePayPaymentData`, `WalletCustomerCreateAttributes`, `WalletPostalAddress`, `WalletContactRequirements`, `Message`, `Appearance`, `ThemeVariable`, `FontSource`, `CssFontSource`, `CustomFontSource`, `AppearanceRuleSelector`, `AppearanceRuleDeclarations`, `PaymentMethodFormDefaultValues`, `PaymentMethodFormField`, and the per-form `*Options` / `*Controller` types. For OpenAPI schema types (e.g. `PaymentIntent`, `CreatePaymentIntentInput`), import `components` from `@amos.com/node`.

## Notes and potential gotchas

- **`ref` / `iframeRef`**: for card and bank forms, pass `ref={iframeRef}` to the form component. The same `iframeRef` must be used when calling `validateForm`, `confirmPayment`, `confirmSetup`, `resetForm`, or `focusField`. The component forwards the ref to the inner iframe.
- **`confirmPayment` / `confirmSetup` are not settlement proof**: `{ status: "succeeded" }` means authorization succeeded (capture may still finish asynchronously). Verify payment or setup success on your backend via webhooks. Recoverable field errors stay in the iframe; a processor decline still resolves `{ status: "failed" }`. Declined confirms include the intent so you can read `state` without a follow-up GET. If the iframe never answers, the Promise resolves `{ status: "failed", error: "timeout" }` after 15 seconds (`CONFIRM_TIMEOUT_MS`, `isConfirmTimeout`) — that is uncertain, not a decline; do not retry as a new payment.
- **Same components for payment vs setup intents**: `AmosCreditCardPaymentMethodForm` and `AmosBankAccountPaymentMethodForm` support both payment intents and setup intents. The flow differs only by which server call you make and which confirmation function you use (`confirmPayment` vs `confirmSetup`).
- **Amount format**: for `AmosGooglePayButton` and `AmosApplePayButton`, `amount` is a major-currency decimal string (e.g. `"50.00"` for $50.00). For `components["schemas"]["CreatePaymentIntentInput"]` on the server (card/bank create, and the object the wallet iframe sends to `onConfirm`), `amount` is a number in cents (e.g. `5000`).
- **Embed host / CSP**: iframes load from `https://js.amos.com` (production) and `https://js-sandbox.amos.com` (sandbox) via `getEmbedOrigin`. Parent pages that pin CSP must allow `frame-src https://js.amos.com https://js-sandbox.amos.com` (and `Permissions-Policy payment=` for those origins) **before** upgrading this package. Older SDK versions still load `embed.amos.com` / `embed-sandbox.amos.com`.
- **Iframe handshake**: iframe URLs include canonical search params so the embed does not 307. If the document loads but never posts `IFRAME_READY`, the SDK rewrites `src` once with `amosReload`. Appearance is applied after handshake; the iframe stays hidden until `UPDATED_APPEARANCE`, or for 1.5s after `IFRAME_READY` if appearance never acks.
- **Plaid Embedded Link (ACH verification)**: load `cdn.plaid.com` from the **parent** document (see CSP on `AmosBankAccountPaymentMethodForm`). Merchants do not proxy Pay API; the bank iframe mints link tokens. Pass `requireAchVerification` when the host wants Plaid, or `intent="setup"` to always show it, unless the render token disables verification. Toggling that prop hides or shows the existing Embedded handler — it does not reload Institution Search. Confirm still goes through the bank iframe so Amos can attach `plaid` to the payment method. While Link loads, the SDK shows a 350px pulse skeleton until `onLoad` (1.5s fallback) — do not overlay a host loader.
- **Apple Pay waiting overlay**: on browsers where Apple's QR handoff opens in a popup (non-Safari), `AmosApplePayButton` shows a fixed full-viewport overlay on the host page. **Cancel payment** is available until the buyer authorizes; after that the overlay shows **Completing your payment…** with no Cancel, then hides when `onConfirm` settles. Avoid stacking other fixed UI above it.
- **Going framework-free**: if you need to use Amos outside of React (vanilla JS, another framework, etc.), use [`@amos.com/amos-js`](../amos-js) directly.

---

**Full product docs:** [docs.amos.com](https://docs.amos.com)
