# Amos React SDK

`@amos.com/react-amos-js` is the React SDK for embedding Amos payment methods (credit card, bank account, Google Pay) into your React app via secure iframes.

It is a thin wrapper around [`@amos.com/amos-js`](../amos-js) that adapts the framework-agnostic iframe controller to idiomatic React components and hooks.

## Installation

```bash
npm install @amos.com/react-amos-js
```

## What it gives you

- React components for the iframe payment method forms: `AmosCreditCardPaymentMethodForm`, `AmosBankAccountPaymentMethodForm`, `AmosGooglePayButton`.
- React-flavoured iframe message helpers that accept a React `ref`: `validateForm({ iframeRef })`, `confirmPaymentIntent({ iframeRef, token })`, `confirmSetupIntent({ iframeRef, token })`.
- Re-exports of the `@amos.com/amos-js` helpers and types that come up in client code: `createMessage`, `decodeJwt`, `getEmbedOrigin`, `formatGooglePayPaymentData`, `Appearance`, `Message`, `PaymentIntent`, `SetupIntent`, `EmbedToken`, etc.

> **Note:** A server-side SDK (for example `@amos.com/node`) must be used alongside `@amos.com/react-amos-js` for end-to-end payment processing. `@amos.com/react-amos-js` is the client-side half.

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
2. **Render your checkout UI** with one of the payment method components (e.g. `AmosCreditCardPaymentMethodForm`) along with the required props (`onConfirmationFailed`) and optional callbacks (`onPaymentIntentConfirmationSucceeded`, `onSetupIntentConfirmationSucceeded`). The iframe height is auto-managed by the SDK.
3. **User clicks "Pay now" button**: call `validateForm({ iframeRef })`, which returns `Promise<true>` if the embedded form is valid and `Promise<false>` otherwise.
4. **Create payment intent on your server**: use your server-side Amos client to call `POST /payment_intents`. You may also associate this payment intent with a new or existing customer via `POST /customers`. This must be server-side because it uses your private API key.
5. **Return the payment intent token to the browser**: your backend responds with the `EmbedToken` needed for confirmation.
6. **Confirm the payment intent from the client iframe**: call `confirmPaymentIntent({ iframeRef, token })` to continue the payment flow.
7. **Handle UX**: show the user a "processing" state when the "Pay now" button is clicked, and show a success or error message via `onPaymentIntentConfirmationSucceeded` and `onConfirmationFailed`.

### Google Pay

Google Pay (and soon, Apple Pay) is a form of express checkout. The Google Pay button is an alternative to the "Pay now" button in your payment forms. Users could make a payment with either flow.

The key differences between the express and non-express payment flows are:

- The express payment method components accept a prop called `onInitiatePaymentIntentRequest` which will be called when you should create the payment intent on your server.
- You do not call `validateForm` in an express flow.
- You do not call `confirmPaymentIntent` in an express flow (this is done after `onInitiatePaymentIntentRequest` returns a token).

## Understanding the flow for creating and confirming setup intents

Setup intents are used to save payment methods for future use (e.g. recurring payments, subscriptions) without charging the customer immediately. The flow is identical to a payment intent, except:

- On the server, call `POST /setup_intents` instead of `POST /payment_intents`.
- On the client, call `confirmSetupIntent({ iframeRef, token })` instead of `confirmPaymentIntent({ iframeRef, token })`.
- Use `onSetupIntentConfirmationSucceeded` instead of `onPaymentIntentConfirmationSucceeded`.

The same `AmosCreditCardPaymentMethodForm` / `AmosBankAccountPaymentMethodForm` components support both payment intents and setup intents.

## Understanding PCI DSS compliance requirements

The flows above are designed so your systems and any third-party servers you control do not handle card or bank account data in either raw or encrypted form.

Why this matters:

- The payment method UI is rendered inside Amos-hosted iframes, so sensitive input fields are not part of your DOM.
- Raw payment details are submitted from the iframe directly to Amos-controlled infrastructure.
- Your backend only creates payment intents (or setup intents) and returns a short-lived token used to continue the iframe flow.
- `confirmPaymentIntent` / `confirmSetupIntent` sends the token back to the iframe to complete confirmation; it does not pass full payment method payloads through your app server.
- In express flows (e.g. Google Pay), the iframe component handles payment data exchange and only asks your server to create a payment intent token.

In short, your app orchestrates the payment flow, while sensitive payment data stays within Amos-controlled components and APIs.

## Appearance

Every component accepts an optional `appearance` prop that controls the look of the iframe UI. It contains a `themeVariables` object whose keys are CSS custom-property names and whose values are strings, and an optional `labels` setting (`"above"`, `"floating"`, or `"placeholder"`) for field label placement. You can update this prop after page load to update the iframe appearance.

```tsx
<AmosCreditCardPaymentMethodForm
  renderToken="..."
  appearance={{
    themeVariables: {
      "--primary": "oklch(0.5 0.2 240)",
      "--radius": "0.25rem",
    },
  }}
  onConfirmationFailed={(msg) => setError(msg)}
/>
```

`themeVariables` uses a **replace** model: each update that includes `themeVariables` sets the full override set. Only the variables you list are overridden; unlisted variables revert to iframe defaults. Omit `themeVariables` to leave existing overrides unchanged.

### Available theme variables

| Variable                 | Purpose                                        | Default                     |
| ------------------------ | ---------------------------------------------- | --------------------------- |
| `--background`           | Page body and base surface color               | `oklch(1 0 0)`              |
| `--foreground`           | Default text color                             | `oklch(0.145 0 0)`          |
| `--primary`              | Button fill and input text-selection highlight | `oklch(0.205 0 0)`          |
| `--primary-foreground`   | Text on primary-colored surfaces               | `oklch(0.985 0 0)`          |
| `--secondary`            | Secondary button fill                          | `oklch(0.97 0 0)`           |
| `--secondary-foreground` | Text on secondary-colored surfaces             | `oklch(0.205 0 0)`          |
| `--muted-foreground`     | Placeholder text, helper labels, muted icons   | `oklch(0.556 0 0)`          |
| `--accent`               | Hover/focus highlight for interactive items    | `oklch(0.97 0 0)`           |
| `--accent-foreground`    | Text on accent-highlighted items               | `oklch(0.205 0 0)`          |
| `--destructive`          | Error/invalid state borders and icons          | `oklch(0.577 0.245 27.325)` |
| `--border`               | General border color                           | `oklch(0.922 0 0)`          |
| `--input`                | Input field border color                       | `oklch(0.922 0 0)`          |
| `--input-background`     | Input field background fill                    | `var(--background)`         |
| `--input-height`         | Height of text inputs and form controls        | `2.25rem`                   |
| `--ring`                 | Focus ring and outline color                   | `oklch(0.708 0 0)`          |
| `--radius`               | Base border-radius (derived into sm/md/lg/xl)  | `0.625rem`                  |

## Examples

### Rendering the credit card inputs within your custom form

```tsx
import { useRef, useState } from "react";
import {
  AmosCreditCardPaymentMethodForm,
  confirmPaymentIntent,
  validateForm,
} from "@amos.com/react-amos-js";
import type { CreatePaymentIntentInput } from "@amos.com/react-amos-js";

function CheckoutForm() {
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

      const paymentIntentCreateAttributes: CreatePaymentIntentInput = {
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
        onPaymentIntentConfirmationSucceeded={(paymentIntent) => {
          console.log("Payment succeeded:", paymentIntent.id);
        }}
        onSetupIntentConfirmationSucceeded={() => {}}
        onConfirmationFailed={(errorMessage) => {
          setError(errorMessage);
        }}
      />
      {error ? <p>{error}</p> : null}
      <button type="submit" disabled={isProcessing}>
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
        onPaymentIntentConfirmationSucceeded={(paymentIntent) => {
          console.log("Google Pay payment succeeded:", paymentIntent.id);
        }}
        onConfirmationFailed={(errorMessage) => {
          setError(errorMessage);
        }}
      />
      {error ? <p>{error}</p> : null}
    </>
  );
}
```

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
        onPaymentIntentConfirmationSucceeded={() => {}}
        onSetupIntentConfirmationSucceeded={(setupIntent) => {
          console.log("Payment method saved:", setupIntent.payment_method_id);
        }}
        onConfirmationFailed={(errorMessage) => {
          setError(errorMessage);
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
- `token` (typed as `Pick<EmbedToken, "token">` — the embed JWT string returned by your server)

**Returns:** `void`

### `confirmSetupIntent({ iframeRef, token })`

Confirms a setup intent in the embedded iframe flow. Use this when saving a payment method for future use.

**Parameters:**

- `iframeRef` (`React.RefObject<HTMLIFrameElement | null> | undefined`, required)
- `token` (same `Pick<EmbedToken, "token">` embed JWT string as for payment confirmation)

**Returns:** `void`

### `AmosCreditCardPaymentMethodForm`

Renders the secure credit card iframe form.

**Required props:**

- `renderToken` (`string`)
- `onConfirmationFailed` (`(errorMessage: string) => void`)

**Optional props:**

- `appearance` (`{ themeVariables?: Partial<Record<ThemeVariable, string>> }`) — appearance overrides for the iframe UI (see [Appearance](#appearance))
- `onPaymentIntentConfirmationSucceeded` (`(paymentIntent: PaymentIntent) => void`)
- `onSetupIntentConfirmationSucceeded` (`(setupIntent: SetupIntent) => void`)
- `additionalFields` (`{ cardholderName: boolean }`) — set `additionalFields={{ cardholderName: true }}` to render the cardholder name field in the iframe (`false` by default)

**Also accepts:** standard iframe props (`React.ComponentProps<"iframe">`), minus `src`, `title`, `name`, and `role` (which are controlled by the SDK).

### `AmosBankAccountPaymentMethodForm`

Renders the secure bank account iframe form.

**Required props:** same as `AmosCreditCardPaymentMethodForm` — `renderToken`, `onConfirmationFailed`.

**Optional props:** same as `AmosCreditCardPaymentMethodForm` — `appearance`, `onPaymentIntentConfirmationSucceeded`, `onSetupIntentConfirmationSucceeded`.

**Also accepts:** standard iframe props.

### `AmosGooglePayButton`

Renders the secure Google Pay iframe button (express checkout flow).

**Required props:**

- `renderToken` (`string`)
- `amount` (`string`)
- `merchantName` (`string`)
- `onInitiatePaymentIntentRequest` (callback receiving `{ paymentIntentCreateAttributes: CreatePaymentIntentInput; customerCreateAttributes: CreateCustomerInput }`, returns `Promise<EmbedToken["token"]>` — the embed JWT string for confirmation)
- `onPaymentIntentConfirmationSucceeded` (`(paymentIntent: PaymentIntent) => void`)
- `onConfirmationFailed` (`(errorMessage: string) => void`)

**Optional props:**

- `appearance` (`{ themeVariables?: Partial<Record<ThemeVariable, string>> }`)

**Also accepts:** standard iframe props, minus the ones controlled by the SDK (`src`, `title`, `name`, `role`, `allow`).

### `formatGooglePayPaymentData({ paymentData })`

Transforms Google Pay payment data into an Amos-compatible `paymentMethod` payload. Use this when integrating with the raw Google Pay API (e.g. `@google-pay/button-react`) instead of `AmosGooglePayButton` — `AmosGooglePayButton` handles payment data internally and does not require this helper.

**Parameters:**

- `paymentData` (`google.payments.api.PaymentData`, required)

**Returns:** `{ paymentMethod: { ... } }`

### `createMessage(message)` / `decodeJwt(token)` / `getEmbedOrigin(renderToken)`

Re-exports of the same advanced helpers exposed by `@amos.com/amos-js`. Most integrators do not need to call these directly.

### Exported types

`@amos.com/react-amos-js` re-exports the handful of OpenAPI-generated types it uses in its own component / callback signatures (and which you'll likely use in your call sites):

- `CreateCustomerInput`
- `CreatePaymentIntentInput`
- `CreateSetupIntentInput`
- `PaymentIntent`
- `SetupIntent`
- `EmbedToken`
- `EmbedTokenJwt`
- `RenderTokenJwt`
- `Message`, `Appearance`, `ThemeVariable`, `CreditCardAdditionalFields`

## Notes and potential gotchas

- **`ref` / `iframeRef`**: for card and bank forms, pass `ref={iframeRef}` to the form component. The same `iframeRef` must be used when calling `validateForm`, `confirmPaymentIntent`, or `confirmSetupIntent`. The component forwards the ref to the inner iframe.
- **Same components for payment vs setup intents**: `AmosCreditCardPaymentMethodForm` and `AmosBankAccountPaymentMethodForm` support both payment intents and setup intents. The flow differs only by which server call you make and which confirmation function you use (`confirmPaymentIntent` vs `confirmSetupIntent`). You may optionally provide `onPaymentIntentConfirmationSucceeded` and/or `onSetupIntentConfirmationSucceeded`; the appropriate one is invoked based on the flow.
- **Amount format**: for `AmosGooglePayButton`, `amount` is a string (e.g. `"5000"` for $50.00). For `CreatePaymentIntentInput` on the server, `amount` is a number in cents (e.g. `5000`).
- **Going framework-free**: if you need to use Amos outside of React (vanilla JS, another framework, etc.), use [`@amos.com/amos-js`](../amos-js) directly.

---

**Full product docs:** [docs.amos.com](https://docs.amos.com)
