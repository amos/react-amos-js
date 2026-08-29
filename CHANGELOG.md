# @amos.com/react-amos-js

## 0.11.10

### Patch Changes

- Follow `@amos.com/amos-js` `0.11.12`: payment iframes load from `https://js.amos.com` / `https://js-sandbox.amos.com`. Add those origins to CSP `frame-src` and `Permissions-Policy payment=` before upgrading.

## 0.11.9

### Patch Changes

- Keep Apple Pay waiting until confirm

## 0.11.8

### Patch Changes

- Add `onEscapeKeyPressed` to card and bank form components so hosts that render the iframe in a modal can close it when Escape is pressed inside the iframe.
- Propagate escape key press

## 0.11.7

### Patch Changes

- Propagate form submit

## 0.11.6

### Patch Changes

- Bump @amos.com/node

## 0.11.5

### Patch Changes

- Populate and focus form fields

## 0.11.4

### Patch Changes

- Restore intent responses

## 0.11.3

### Patch Changes

- Use embedded Plaid

## 0.11.2

### Patch Changes

- Remove deprecated code

## 0.11.1

### Patch Changes

- Handle sync authorization

## 0.10.6

### Patch Changes

- Improve postMessage flow

## 0.10.5

### Patch Changes

- Update @amos.com/amos-js

## 0.10.2

### Patch Changes

- Handle render token verification settings

## 0.10.1

### Patch Changes

- Require amount for bank account form

## 0.10.0

### Minor Changes

- Add onCardBrandChanged to AmosCreditCardPaymentMethodForm for host-side card brand updates.

## 0.9.17

### Patch Changes

- Support Plaid

## 0.9.16

### Patch Changes

- Add Google Pay/Apple Pay skeleton

## 0.9.15

### Patch Changes

- Improve comments

## 0.9.14

### Patch Changes

- Breaking API changes

## 0.9.13

### Patch Changes

- Add appearance variables

## 0.9.12

### Patch Changes

- Styling improvements

## 0.9.11

### Patch Changes

- Add form skeleton

## 0.9.10

### Patch Changes

- Add onValidityChange

## 0.9.9

### Patch Changes

- Forward props to Apple Pay and Google Pay

## 0.9.8

### Patch Changes

- Add appearance variables

## 0.9.7

### Patch Changes

- Add appearance variables

## 0.9.6

### Patch Changes

- Add resetForm API
- Update @amos.com/amos-js to 0.9.6. Move @amos.com/node to peer dependency. Add `resetForm` React wrapper.

## 0.9.5

### Patch Changes

- Fix SVG

## 0.9.4

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.9.3

### Patch Changes

- Refactor confirm flow

## 0.9.2

### Patch Changes

- Update @amos.com/amos-js for `incomplete.reason` and listener hardening.

## 0.9.1

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.9.0

### Minor Changes

- Replace confirmation success/failure props with a single `onResult` callback (see `@amos.com/amos-js`).

## 0.7.2

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.7.1

### Patch Changes

- Show Apple Pay overlay

## 0.7.0

### Minor Changes

- Drop Apple Pay iframe expand/collapse docs and `hasNativeApplePaySession` re-export. QR handoff opens in a popup from the embed.

## 0.6.1

### Patch Changes

- Update @amos.com/amos-js for Apple Pay native `ApplePaySession` detection (`UPDATE_NATIVE_APPLE_PAY_SESSION` / `hasNativeApplePaySession`). Expand/collapse for Chrome QR handoff still handled automatically by `AmosApplePayButton`.

## 0.6.0

### Minor Changes

- Re-export @amos.com/amos-js Apple Pay EXPAND_IFRAME / COLLAPSE_IFRAME message types so embed can request a full-viewport iframe overlay while keeping the session on Amos domains.

## 0.5.0

### Minor Changes

- Add AmosApplePayButton for Apple Pay express checkout

## 0.4.1

### Patch Changes

- Restrict `billingAddressRequirement` to `"country" | "full"` (removed `"postalCode"` and `"postalCodeAndCountry"`). Default is now `"country"`. Postal / ZIP is collected only for Canada, Puerto Rico, the United Kingdom, and the United States (labeled ZIP for US).

## 0.4.0

### Minor Changes

- Support billingAddressRequirement option

## 0.3.22

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.21

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.20

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.19

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.18

### Patch Changes

- Update README

## 0.3.17

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.16

### Patch Changes

- Update README and package-lock.json

## 0.3.15

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js and clean up types

## 0.3.14

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.13

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.12

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.11

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.10

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.9

### Patch Changes

- Bump @amos.com/node and @amos.com/amos-js dependencies.

## 0.3.8

### Patch Changes

- Bump @amos.com/node and @amos.com/amos-js dependencies.

## 0.3.7

### Patch Changes

- Bump @amos.com/node and @amos.com/amos-js dependencies.

## 0.3.6

### Patch Changes

- Bump @amos.com/node and @amos.com/amos-js dependencies.

## 0.3.5

### Patch Changes

- Bump @amos.com/node and @amos.com/amos-js dependencies.

## 0.3.4

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.3

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.2

### Patch Changes

- Update @amos.com/node and @amos.com/amos-js

## 0.3.1

### Patch Changes

- Update README

## 0.3.0

### Minor Changes

- Support label placement configuration

## 0.2.0

### Minor Changes

- a55cdf0: Add css variables for appearance API

## 0.1.2

### Patch Changes

- Update README

## 0.1.1

### Patch Changes

- Update README
