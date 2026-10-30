---
"@amos.com/react-amos-js": minor
---

`AmosExternalBankAccountForm` requires `getEmbedToken(intentId)`, which mints
the embed token the iframe reads the intent and mints its Plaid Link token
with. Changing it updates the form in place instead of remounting it.
