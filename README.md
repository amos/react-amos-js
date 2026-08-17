# Amos React SDK

`@amos.com/react-amos-js` is the React SDK for embedding Amos payment methods (credit card, bank account, Google Pay, Apple Pay) into your React app via secure iframes.

It is a thin wrapper around [`@amos.com/amos-js`](../amos-js) that adapts the framework-agnostic iframe controller to idiomatic React components and hooks.

## Installation

```bash
npm install @amos.com/react-amos-js @amos.com/node
```

`@amos.com/node` is a **peer dependency** (requires `>=0.1.37`). Install it in your app for OpenAPI schema types (for example `components["schemas"]["CreatePaymentIntentInput"]`) used in the examples below, and for your server-side Amos API client. React (`^17`, `^18`, or `^19`) is also a peer dependency.

## What it gives you

- React components for the iframe payment method forms: `AmosCreditCardPaymentMethodForm`, `AmosBankAccountPaymentMethodForm`, `AmosGooglePayButton`, `AmosApplePayButton`.
- React-flavoured iframe message helpers that accept a React `ref`: `validateForm({ iframeRef })`, `confirmPaymentIntent({ iframeRef, token })`, `confirmSetupIntent({ iframeRef, token })`, `resetForm({ iframeRef })`.
- Re-exports of the `@amos.com/amos-js` helpers and types that come up in client code: `createMessage`, `decodeJwt`, `getEmbedOrigin`, `formatGooglePayPaymentData`, `resetForm`, `ConfirmationResult`, `ConfirmationIncompleteReason`, `FormattedGooglePayPaymentData`, `Appearance`, `Message`, etc.

> **Note:** `@amos.com/react-amos-js` is the client-side half of the Amos integration. For end-to-end payment processing you also need `@amos.com/node` on your server (creating payment intents, handling webhooks, etc.). The same `@amos.com/node` package is listed as a peer dependency so you can import its OpenAPI types in client-side TypeScript code.

## Requirements

```
1. Render token (created on dashboard.amos.com, safe to expose to clients)
2. Amos API key (created on dashboard.amos.com, do not expose this to clients)
3. Amos account ID (provided once your application has been approved)
```

The render token configures the iframe's allowed origin(s), allowed payment methods, and the range of valid payment amounts. If the render token does not allow an origin, the iframe will not render. Similarly, components corresponding to different payment method types will not render if not allowed by the render token.

> **Note**: The render token also determines the environment (`production` or `sandbox`). Render tokens created on `dashboard.amos.com` have a `production` environment. Render tokens created on `dashboard-sandbox.amos.com` have a `sandbox` environment. Similarly, API keys can only access the environment that they were created in.

## Understanding the flow for creating and confirming payment intents

### Credit Card & Bank Account

The following flow is for credit card and bank account payment method types only.

1. **Set up prerequisites**: create a `renderToken` (safe for client), and keep `apiKey` and `accountId` server-side only.
2. **Render your checkout UI** with one of the payment method components (e.g. `AmosCreditCardPaymentMethodForm`) along with the required `onResult` prop. The iframe height is auto-managed by the SDK.
3. **User clicks "Pay now" button**: call `validateForm({ iframeRef })`, which returns `Promise<true>` if the embedded form is valid and `Promise<false>` otherwise.
4. **Create payment intent on your server**: use your server-side Amos client to call `POST /payment_intents`. You may also associate this payment intent with a new or existing customer via `POST /customers`. This must be server-side because it uses your private API key.
5. **Return the payment intent token to the browser**: your backend responds with the embed token (`components["schemas"]["EmbedToken"]`) needed for confirmation.
6. **Confirm the payment intent from the client**: call `confirmPaymentIntent({ iframeRef, token })` to continue the payment flow.
7. **Handle UX**: show the user a "processing" state when the "Pay now" button is clicked, and handle `onResult`. Do not treat `onResult` as settlement proof — verify payment success on your backend via webhooks. Recoverable field errors are shown in the iframe (`status: "incomplete"` with `reason`: `"field_errors"` or `"validation_failed"`).

### Google Pay & Apple Pay

Google Pay and Apple Pay are forms of express checkout. Their buttons are alternatives to the "Pay now" button in your payment forms. Users can make a payment with either flow.

The key differences between the express and non-express payment flows are:

- The express payment method components accept a prop called `onInitiatePaymentIntentRequest` which will be called when you should create the payment intent on your server.
- You do not call `validateForm` in an express flow.
- You do not call `confirmPaymentIntent` in an express flow (this is done after `onInitiatePaymentIntentRequest` returns a token).

## Understanding the flow for creating and confirming setup intents

Setup intents are used to save payment methods for future use (e.g. recurring payments, subscriptions) without charging the customer immediately. The flow is identical to a payment intent, except:

- On the server, call `POST /setup_intents` instead of `POST /payment_intents`.
- On the client, call `confirmSetupIntent({ iframeRef, token })` instead of `confirmPaymentIntent({ iframeRef, token })`.
- The same `onResult` callback is used for setup intents (`intent: "setup"`).

The same `AmosCreditCardPaymentMethodForm` / `AmosBankAccountPaymentMethodForm` components support both payment intents and setup intents — they are differentiated by which confirmation function you call.

## Understanding PCI DSS compliance requirements

The flows above are designed so your systems and any third-party servers you control do not handle card or bank account data in either raw or encrypted form.

Why this matters:

- The payment method UI is rendered inside Amos-hosted iframes, so sensitive input fields are not part of your DOM.
- Raw payment details are submitted from the iframe directly to Amos-controlled infrastructure.
- Your backend only creates payment intents (or setup intents) and returns a short-lived token used to continue the iframe flow.
- `confirmPaymentIntent` / `confirmSetupIntent` sends the token back to the iframe to complete confirmation; it does not pass full payment method payloads through your app server.
- In express flows (Google Pay / Apple Pay), the iframe component handles payment data exchange and only asks your server to create a payment intent token.

In short, your app orchestrates the payment flow, while sensitive payment data stays within Amos-controlled components and APIs.

## Appearance

Every component accepts an optional `appearance` prop that controls the look of the iframe UI. It contains a `themeVariables` object whose keys are CSS custom-property names and whose values are strings, and an optional `labels` setting for field label placement. You can update this prop after page load to update the iframe appearance.

```tsx
<AmosCreditCardPaymentMethodForm
  renderToken="..."
  appearance={{
    labels: "floating",
    themeVariables: {
      "--primary": "oklch(0.5 0.2 240)",
      "--radius": "0.25rem",
    },
  }}
  onResult={(result) => {
    if (result.status === "failed") setError(result.errorMessage);
    if (result.status === "incomplete") setError(null);
  }}
/>
```

`themeVariables` uses a **replace** model: each update that includes `themeVariables` sets the full override set. Only the variables you list are overridden; unlisted variables revert to iframe defaults. Omit `themeVariables` to leave existing overrides unchanged.

### Label placement

Set `labels` to control how field labels are rendered in card and bank account forms:

| Value | Behavior |
| ----- | -------- |
| `above` (default) | Label text above each input |
| `floating` | Label inside the control; moves up when focused or filled |
| `placeholder` | No visible label; placeholder and `aria-label` only |

Radio groups (e.g. account type) always use an above-style group label regardless of this setting.

### Available theme variables

| Variable                 | Purpose                                        | Default                     |
| ------------------------ | ---------------------------------------------- | --------------------------- |
| `--background`           | Page body and base surface color               | `oklch(1 0 0)`              |
| `--foreground`           | Default text color                             | `oklch(0.145 0 0)`          |
| `--primary`              | Button fill and input text-selection highlight | `oklch(0.205 0 0)`          |
| `--primary-foreground`   | Text on primary-colored surfaces               | `oklch(0.985 0 0)`          |
| `--secondary`            | Secondary button fill                          | `oklch(0.97 0 0)`           |
| `--secondary-foreground` | Text on secondary-colored surfaces             | `oklch(0.205 0 0)`          |
| `--muted`                      | Muted surface color                                              | `oklch(0.97 0 0)`           |
| `--muted-foreground`           | Placeholder text, helper labels, muted icons                     | `oklch(0.556 0 0)`          |
| `--accent`                     | Hover/focus highlight for interactive items                      | `oklch(0.97 0 0)`           |
| `--accent-foreground`          | Text on accent-highlighted items                                 | `oklch(0.205 0 0)`          |
| `--destructive`                | Error/invalid state borders, icons, and field error text         | `oklch(0.577 0.245 27.325)` |
| `--destructive-foreground`     | Text on destructive-colored surfaces                             | `oklch(0.45 0.24 27.325)`   |
| `--border`                     | General border color                                             | `oklch(0.922 0 0)`          |
| `--popover`                    | Dropdown / popover panel background                              | `oklch(1 0 0)`              |
| `--popover-foreground`         | Dropdown / popover panel text color                              | `oklch(0.145 0 0)`          |
| `--input`                      | Input field border color                                         | `oklch(0.922 0 0)`          |
| `--input-background`           | Input field background fill                                      | `var(--background)`         |
| `--input-height`               | Height of text inputs and form controls                          | `2.25rem`                   |
| `--input-font-size`            | Font size of text inputs and dropdown fields                     | `0.875rem`                  |
| `--input-font-weight`          | Font weight of typed input values                                | `400`                       |
| `--input-padding`              | Horizontal padding inside inputs                                 | `0.75rem`                   |
| `--input-border-width`         | Input field border width                                         | `1px`                       |
| `--input-shadow`               | Input field box shadow                                           | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `--floating-input-height`      | Height of inputs when labels are floating                        | `3.25rem`                   |
| `--floating-label-font-size`   | Font size of floating labels when focused or filled              | `0.75rem`                   |
| `--floating-label-font-weight` | Font weight of floating labels                                   | `500`                       |
| `--floating-label-color`       | Color of floating labels                                         | `var(--muted-foreground)`   |
| `--floating-label-offset`      | Top offset of the shrunk floating label                          | `0.625rem`                  |
| `--label-font-size`            | Font size of above-style field labels                            | `0.875rem`                  |
| `--label-font-weight`          | Font weight of above-style field labels                          | `500`                       |
| `--field-gap`                  | Vertical gap between stacked form fields                         | `1rem`                      |
| `--control-gap`                | Horizontal gap between side-by-side controls                     | `0.5rem`                    |
| `--error-font-size`            | Font size of field-level error messages                          | `0.875rem`                  |
| `--radio-size`                 | Size of radio buttons on the bank account form                   | `1rem`                      |
| `--ring`                       | Focus ring and outline color                                     | `oklch(0.708 0 0)`          |
| `--ring-width`                 | Focus ring width                                                 | `3px`                       |
| `--radius`                     | Base border-radius (derived into sm/md/lg/xl)                    | `0.625rem`                  |

## Examples

### Rendering the credit card inputs within your custom form

```tsx
import { useRef, useState } from "react";
import {
  AmosCreditCardPaymentMethodForm,
  confirmPaymentIntent,
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

      const paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"] = {
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
      confirmPaymentIntent({ iframeRef, token });
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
        onValidityChange={({ isValid }) => setIsValid(isValid)}
        onResult={(result) => {
          // Unlock UI. Verify settlement on your backend via webhooks.
          if (result.status === "succeeded") {
            console.log("Confirm returned:", result);
          } else if (result.status === "failed") {
            console.error("Confirm failed:", result.errorMessage);
          } else if (result.status === "incomplete") {
            console.log("Recoverable:", result.reason);
          }
        }}
      />
      {error ? <p>{error}</p> : null}
      <button type="submit" disabled={!isValid || isProcessing}>
        {isProcessing ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}
```

### Rendering Google Pay within your checkout flow

```tsx
import { useState } from "react";
import { AmosGooglePayButton } from "@amos.com/react-amos-js";

function CheckoutGooglePay() {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <AmosGooglePayButton
        renderToken="the-render-token-that-you-created-on-dashboard.amos.com"
        amount="5000" // $50.00 in cents, as a string
        merchantName="your-user-facing-merchant-name"
        onInitiatePaymentIntentRequest={async ({
          paymentIntentCreateAttributes,
          customerCreateAttributes,
        }) => {
          const response = await fetch("/api/payment-intents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer: customerCreateAttributes,
              paymentIntent: paymentIntentCreateAttributes,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to create payment intent.");
          }

          const { token } = await response.json();
          return token;
        }}
        onResult={(result) => {
          if (result.status === "succeeded") {
            console.log("Confirm returned:", result);
          } else if (result.status === "failed") {
            console.error("Confirm failed:", result.errorMessage);
          } else if (result.status === "incomplete") {
            console.log("Recoverable:", result.reason);
          }
        }}
      />
      {error ? <p>{error}</p> : null}
    </>
  );
}
```

`AmosApplePayButton` uses the same props and express-checkout callbacks. Drop it in the same place (or alongside Google Pay) with the same `amount`, `merchantName`, and `onInitiatePaymentIntentRequest` wiring. On Safari, the native payment sheet is used; on other browsers, Apple's QR handoff opens in a popup (`pay.apple.com`). While that popup is open, the SDK shows a waiting overlay on your page with a **Cancel payment** button.

### Saving a payment method with setup intent (credit card)

```tsx
import { useRef, useState } from "react";
import {
  AmosCreditCardPaymentMethodForm,
  confirmSetupIntent,
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
      confirmSetupIntent({ iframeRef, token });
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
        onResult={(result) => {
          if (result.status === "succeeded") {
            console.log("Confirm returned:", result);
          } else if (result.status === "failed") {
            console.error("Confirm failed:", result.errorMessage);
          } else if (result.status === "incomplete") {
            console.log("Recoverable:", result.reason);
          }
        }}
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

### `confirmPaymentIntent({ iframeRef, token })`

Confirms a payment intent in the embedded iframe flow.

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)
- `token` (typed as `Pick<components["schemas"]["EmbedToken"], "token">` — the embed JWT string returned by your server)

**Returns:** `void`

### `confirmSetupIntent({ iframeRef, token })`

Confirms a setup intent in the embedded iframe flow. Use this when saving a payment method for future use.

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)
- `token` (same `Pick<components["schemas"]["EmbedToken"], "token">` embed JWT string as for payment confirmation)

**Returns:** `void`

### `resetForm({ iframeRef })`

Clears all field values and API errors in the embedded card/bank iframe form. Call after `onResult` when the customer wants to try again (for example, after a successful payment when starting a new one).

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)

**Returns:** `void`

### `AmosCreditCardPaymentMethodForm`

Renders the secure credit card iframe form.

**Required props:**

- `renderToken` (`string`)
- `onResult` (`(result: ConfirmationResult) => void`) — required. Called when the interactive confirmation attempt finishes (`succeeded`, `failed`, or `incomplete` with `reason`). Not settlement proof; verify via webhooks.

**Optional props:**

- `appearance` (`{ themeVariables?: Partial<Record<ThemeVariable, string>>; labels?: "above" | "floating" | "placeholder" }`) — appearance overrides for the iframe UI (see [Appearance](#appearance))

- `additionalFields` (`{ cardholderName: boolean }`) — set `additionalFields={{ cardholderName: true }}` to render the cardholder name field in the iframe (`false` by default)
- `billingAddressRequirement` (`"country" | "full"`, defaults to `"country"`) — how much billing address the iframe collects. `country` collects country / region and, for CA / PR / GB / US, a postal code (labeled ZIP for the United States). `full` shows a full street address form with Smarty autocomplete.
- `onValidityChange` (`(event: { isValid: boolean }) => void`) — called when form validity changes. `isValid` is true when all required fields are present and valid. Does not include PCI data. Use this to enable or disable your checkout button.

**Also accepts:** standard iframe props (`React.ComponentProps<"iframe">`), minus `src`, `title`, `name`, and `role` (which are controlled by the SDK).

### `AmosBankAccountPaymentMethodForm`

Renders the secure bank account iframe form.

**Required props:** same as `AmosCreditCardPaymentMethodForm` — `renderToken`, `onResult`.

**Optional props:** same as `AmosCreditCardPaymentMethodForm` — `appearance`, `billingAddressRequirement`, `onValidityChange`.

**Also accepts:** standard iframe props.

### `AmosGooglePayButton`

Renders the secure Google Pay iframe button (express checkout flow).

**Required props:**

- `renderToken` (`string`)
- `amount` (`string`)
- `merchantName` (`string`)
- `onInitiatePaymentIntentRequest` (callback receiving `{ paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"]; customerCreateAttributes: components["schemas"]["CreateCustomerInput"] }`, returns `Promise<components["schemas"]["EmbedToken"]["token"]>` — the embed JWT string for confirmation)

- `onResult` (`(result: ConfirmationResult) => void`) — required. Called when the interactive confirmation attempt finishes (`succeeded`, `failed`, or `incomplete` with `reason`). Not settlement proof; verify via webhooks.

**Optional props:**

- `appearance` (`{ themeVariables?: Partial<Record<ThemeVariable, string>>; labels?: "above" | "floating" | "placeholder" }`)
- `buttonType` (`"book" | "buy" | "checkout" | "donate" | "order" | "pay" | "plain" | "subscribe" | "short" | "long"`, defaults to `"short"`)
- `buttonColor` (`"default" | "black" | "white"`)
- `buttonRadius` (`number`, 0–20)
- `buttonSizeMode` (`"static" | "fill"`)
- `buttonLocale` (`string`)
- `buttonBorderType` (`"no_border" | "default_border"`)
- `style` — forwarded to the Google Pay button **inside** the iframe (not the iframe element). Example: `style={{ height: "48px", width: "100%" }}` with `buttonSizeMode="fill"`.

**Also accepts:** standard iframe props, minus `src`, `title`, `name`, `role`, `allow`, and `style` (which is the inner button style).

### `AmosApplePayButton`

Renders the secure Apple Pay iframe button (express checkout flow). Same required props and callbacks as `AmosGooglePayButton`.

**Optional visual props** use Apple's `<apple-pay-button>` attribute names:

- `buttonstyle` (`"black" | "white" | "white-outline"`, defaults to `"black"`)
- `type` (`"plain" | "buy" | "set-up" | "donate" | "check-out" | "book" | "subscribe" | "reload" | "add-money" | "top-up" | "order" | "rent" | "support" | "contribute" | "tip"`, defaults to `"plain"`)
- `locale` (`string`, BCP 47, defaults to `"en-US"`)
- `style` — forwarded to the `<apple-pay-button>` inside the iframe. Apple sizes the button with CSS custom properties:

```tsx
<AmosApplePayButton
  buttonstyle="white-outline"
  type="buy"
  locale="en-GB"
  style={{
    "--apple-pay-button-height": "48px",
    "--apple-pay-button-width": "100%",
    width: "100%",
  }}
  // ...required props
/>
```

Only Amos domains need Apple merchant registration. The button and `ApplePaySession` run inside the Amos embed iframe. On Safari, the native payment sheet is used. On other browsers, Apple's QR handoff opens in a popup (`pay.apple.com`); while that popup is open, the SDK automatically shows a full-viewport waiting overlay on the host page with instructions and a **Cancel payment** button. You do not need to implement popup or overlay handling yourself.

### `formatGooglePayPaymentData({ paymentData })`

Transforms Google Pay payment data into an Amos-compatible `paymentMethod` payload. Use this when integrating with the raw Google Pay API (e.g. `@google-pay/button-react`) instead of `AmosGooglePayButton` — `AmosGooglePayButton` handles payment data internally and does not require this helper.

**Parameters:**

- `paymentData` (`google.payments.api.PaymentData`, required)

**Returns:** `FormattedGooglePayPaymentData` — the `paymentMethod` field is typed for embed confirm endpoints, so no extra type assertions are needed at call sites.

### `createMessage(message)` / `decodeJwt(token)` / `getEmbedOrigin(renderToken)`

Re-exports of the same advanced helpers exposed by `@amos.com/amos-js`. Most integrators do not need to call these directly.

### Exported types

`@amos.com/react-amos-js` re-exports everything from `@amos.com/amos-js`, including `ConfirmationResult`, `ConfirmationIncompleteReason`, `PaymentMethodFormValidityChangeEvent`, `FormattedGooglePayPaymentData`, `Message`, `Appearance`, `ThemeVariable`, and the per-form `*Options` / `*Controller` types. For OpenAPI schema types (e.g. `PaymentIntent`, `CreatePaymentIntentInput`), import `components` from `@amos.com/node`.

## Notes and potential gotchas

- **`ref` / `iframeRef`**: for card and bank forms, pass `ref={iframeRef}` to the form component. The same `iframeRef` must be used when calling `validateForm`, `confirmPaymentIntent`, `confirmSetupIntent`, or `resetForm`. The component forwards the ref to the inner iframe.
- **`onResult` is not settlement proof**: `onResult` tells you when to stop waiting (e.g. dismiss a spinner). Verify payment or setup success on your backend via webhooks. On `status: "incomplete"`, unlock your UI — the customer can fix fields in the iframe and retry. Use `result.reason` (`"field_errors"` or `"validation_failed"`) to distinguish recoverable states.
- **Same components for payment vs setup intents**: `AmosCreditCardPaymentMethodForm` and `AmosBankAccountPaymentMethodForm` support both payment intents and setup intents. The flow differs only by which server call you make and which confirmation function you use (`confirmPaymentIntent` vs `confirmSetupIntent`). Handle both payment and setup outcomes via `onResult`.
- **Amount format**: for `AmosGooglePayButton` and `AmosApplePayButton`, `amount` is a string (e.g. `"5000"` for $50.00). For `components["schemas"]["CreatePaymentIntentInput"]` on the server, `amount` is a number in cents (e.g. `5000`).
- **Apple Pay waiting overlay**: on browsers where Apple's QR handoff opens in a popup (non-Safari), `AmosApplePayButton` shows a fixed full-viewport overlay on the host page until payment completes, the popup closes, or the user clicks **Cancel payment**. Avoid stacking other fixed UI above it.
- **Going framework-free**: if you need to use Amos outside of React (vanilla JS, another framework, etc.), use [`@amos.com/amos-js`](../amos-js) directly.

---

**Full product docs:** [docs.amos.com](https://docs.amos.com)
