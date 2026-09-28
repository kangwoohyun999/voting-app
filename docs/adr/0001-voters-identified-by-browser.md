# Voters are identified by browser, not by sign-in

A Voter is recognised only as one browser, and "one Vote per Poll" is enforced per browser. We chose this over sign-in accounts and per-IP limits so that anyone with a Poll Link can vote instantly, and so that people sharing a campus network are not blocked from voting.

## Consequences

- Double voting is easy on purpose: clearing site data, a private window, or a second device each count as a new Voter. Results are therefore indicative, not authoritative, and the app should not be used where a vote must be tamper-proof.
- Every Vote is recorded against a browser identity. Moving to sign-in later means existing Votes cannot be attributed to accounts, so it is a migration rather than a toggle.
- Owner recovery uses an Owner Email rather than accounts, keeping the app free of sign-in.
