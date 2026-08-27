# Splitmate two-minute judge demo

## Goal

Prove that Splitmate observes real group state, reasons over natural language, prepares structured actions, keeps humans in control, and verifies settlement on Base.

## Before recording

- Use a fresh real group with Fawaz, Ahmed, and Musa.
- Save the payer and recipient Base wallet addresses.
- Put a small amount of native USDC and enough ETH for gas in the payer wallet.
- Use a tiny settlement amount such as `0.10 USDC`.
- Open the payer’s mobile wallet and keep the WalletConnect scanner ready.
- Close unrelated tabs and browser extensions that produce console overlays.
- Rehearse once and confirm the Base network is responsive.

## Shot list and narration

### 0:00 to 0:12, problem and promise

Show the homepage and say:

> Splitmate is a shared-money Agent. Groups tell it what happened naturally, it prepares the financial actions, and humans approve every change and payment.

Open the working demo.

### 0:12 to 0:35, natural language to structured action

Send:

> Ahmed paid $60 for transport split with Fawaz and Musa.

Point out that Ahmed is included with the two named people. Show the structured review card and select **Confirm change**.

Say:

> This is an action, not a chat answer. The expense is not saved until I confirm it.

### 0:35 to 0:52, clarification and memory

Send:

> Musa paid for lunch.

When the Agent asks for the missing amount, answer:

> 30

Say:

> The Agent remembers the unfinished expense and asks only for the missing fact.

### 0:52 to 1:07, correction and reasoning

Before confirming, send:

> No, it was $35.

Confirm the corrected draft. Then select **Explain my balance** or send:

> Who owes whom?

Show the evidence trail and calculated routes.

### 1:07 to 1:28, safety gates

Open Final Settlement. Show that payments remain locked if an involved person lacks a valid wallet. Add the missing address and show **Ready to settle**.

Say:

> Splitmate will not begin one payment while another person in the settlement is missing a wallet.

### 1:28 to 1:48, payer handoff

Open one payment and select **Use [payer]’s phone**. Choose WalletConnect and scan the QR code with the payer’s phone.

Say:

> The connected address must match the saved payer. The organizer cannot approve on somebody else’s behalf.

### 1:48 to 2:00, onchain proof

Approve the tiny USDC transfer. Show the waiting state, confirmation, and BaseScan link.

Say:

> Splitmate updates the balance only after Base confirms the receipt. Agent prepares. Humans approve. The chain verifies.

## Mainnet receipt publication

After the rehearsal transaction confirms:

1. Copy the transaction hash from Splitmate or BaseScan.
2. Confirm it is the intended native USDC transfer on Base mainnet.
3. Add it to Vercel as `VITE_DEMO_TX_HASH`.
4. Redeploy Splitmate.
5. Open `/proof` and verify that **Verified Base mainnet receipt** links to the correct transaction.

Never use an unrelated transaction or label a simulated response as a real receipt.

## X post structure

Use one concise post with:

- the problem in one sentence
- the Agent loop in one sentence
- the two-minute video
- live demo link
- GitHub link
- Orion Agents tag and any required hackathon hashtag
