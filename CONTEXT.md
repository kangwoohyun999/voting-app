# Voting App

Lets people create polls and cast anonymous votes on them, then see how everyone else voted.

## Language

### Polls

**Poll**:
A single question put to voters, together with the fixed set of Options they choose between. The question and Options never change after creation. The app hosts many Polls.
_Avoid_: Survey, election, question, topic

**Option**:
One of the possible answers on a Poll. A Poll may have any number of Options, including none or duplicates; a Poll with no Options cannot receive Votes.
_Avoid_: Choice, answer, candidate, item

**Open / Closed**:
A Poll is Open from creation and accepts Votes. It becomes Closed when the Poll Owner closes it or its Closing Time passes: no Votes can be cast or changed, and its Results are visible to everyone. The Poll Owner can reopen a Closed Poll, which restores the usual Open rules, including hiding Results from Voters who have not voted.
_Avoid_: Active/inactive, ended, finished, archived

**Closing Time**:
An optional moment, set only when the Poll is created and never changed, at which the Poll becomes Closed. Shown in Korean time. Reopening a Poll whose Closing Time has passed removes its Closing Time.
_Avoid_: Deadline, end date, expiry

**Deleted Poll**:
A Poll its Poll Owner has removed. It no longer accepts Votes or shows Results; its Poll Link says it was deleted by its owner.
_Avoid_: Archived, removed, hidden

### People

**Voter**:
An anonymous participant, recognised only as one browser. No sign-in or personal identity.
_Avoid_: User, account, participant

**Operator**:
Anyone who knows the Operator Password, the single shared secret that allows creating Polls. Only an Operator can create a Poll; everyone else can only vote.
_Avoid_: Admin, staff, moderator

**Poll Owner**:
The Operator who created a Poll. Proves ownership by holding the Poll's Owner Link. Can vote on their own Poll like any Voter, and can always see its Results whether or not they have voted.
_Avoid_: Admin, creator, author, host

**Owner Email**:
The email address a Poll Owner must give when creating a Poll. Used only to resend the same Owner Link if it is lost; never shown to Voters, and only as a masked hint to the Poll Owner.
_Avoid_: Contact email, account email

### Links

**Poll Link**:
The shareable address of a Poll. The only way to find a Poll; there is no public listing.
_Avoid_: URL, invite, share code

**Owner Link**:
A secret address, given only to the Poll Owner, that grants the right to manage the Poll.
_Avoid_: Admin link, edit link, management URL

### Voting

**Vote**:
A Voter's selection of exactly one Option on one Poll. A Voter has at most one Vote per Poll, and may switch it to another Option while the Poll is Open.
_Avoid_: Ballot, response, submission

**Results**:
The Vote count and share of the total for each Option on a Poll. Results never name a winner. A Voter sees an Open Poll's Results only after casting their Vote on it; the Poll Owner always sees them.
_Avoid_: Tally, stats, score, winner
