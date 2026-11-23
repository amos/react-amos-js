---
"@amos.com/react-amos-js": patch
---

- Every component now passes on only the props whose identity changed since the last render. Before, changing any one prop (a new inline callback, for example) re-sent all of them, so the iframe re-applied `appearance` and overwrote fields the customer had edited with `defaultValues` on each host re-render. Nothing is sent when no prop changed, and nothing extra is sent right after mounting.
- `AmosCreditCardPaymentMethodForm`: the default `additionalFields` is one constant instead of a new object per render.
- Component props are now derived from the `@amos.com/amos-js` option types instead of being declared again, so the two cannot drift. No prop was removed or renamed. `onCardBrandChanged` is typed with `PaymentMethodFormCardBrandChangeEvent`, and the wallet buttons' `onConfirm` with the SDK's own signature; both are the same shapes as before.
- README: the appearance reference (fonts, rules, label placement, theme variables) now links to the `@amos.com/amos-js` README instead of repeating it.

Behaviour note (every SDK version)

- The Amos iframe no longer links a `fonts[].cssSrc` stylesheet. It fetches it and uses only its `@font-face` rules; `@import` and all other rules are ignored. The stylesheet's host must send `Access-Control-Allow-Origin` (Google Fonts does), otherwise the form keeps its fallback font. This is a change in the iframe, so it applies to every SDK version, not only this release.

Dependencies

- Uses `@amos.com/amos-js` 0.14.1, and takes the two skeleton helpers it needs from `@amos.com/amos-js/internal` instead of the deprecated root exports.
