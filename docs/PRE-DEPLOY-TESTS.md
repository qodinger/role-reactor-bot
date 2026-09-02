# Pre-Deploy Test Checklist

Run these tests on the dev bot before merging to production. Complete economy items first — they cover the schema migration risk (old docs without `sparks` field). If those pass, everything else is safe.

## Economy (Cores/Sparks Dual-Balance)

- [ ] **Balance load** — existing user balances load correctly (`sparks` defaults to `0` on old docs without the field)
- [ ] **`/balance`** — shows both Cores and Sparks for a user
- [ ] **`/core gift`** — send Sparks to another user, verify 10% tax burns (sender debited full amount, receiver gets 90%)
- [ ] **`/core gift` edge case** — try gifting more than balance (should reject with insufficient funds)
- [ ] **`/vote`** — verify +5 Sparks reward credits correctly after voting
- [ ] **Admin balance controller** — `/admin user balance` shows Sparks field in the response

## Streaming (Twitch)

- [ ] **Online→offline cycle** — go live on Twitch, verify bot detects and posts to Discord; end stream, verify bot posts offline
- [ ] **Stream commands** — test add/remove/list stream commands if they exist

## Tickets

- [ ] **Panel CRUD** — create a ticket panel, verify button works, create a ticket, close it
- [ ] **Disabled panel** — disable a panel, verify button rejects ticket creation

## Referral

- [ ] **Referral link** — generate a referral link, verify bonus credits on sign-up

## Top.gg

- [ ] **Vote webhook** — vote on top.gg, verify Sparks credited (not Cores)

## Known Follow-Ups (not blockers)

- `/balance send` has a TOCTOU race condition (two concurrent sends could overdraft) — harden with MongoDB transaction or conditional `$inc`
- `PaymentAdminController.js:50` fallback field name `totalCoresGranted` should be `totalSparksGranted`
