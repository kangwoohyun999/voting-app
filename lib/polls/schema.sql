-- Applied to Neon by `npm run db:migrate` and to PGlite in tests. Idempotent.

CREATE TABLE IF NOT EXISTS polls (
  id           text PRIMARY KEY,
  question     text NOT NULL,
  owner_token  text NOT NULL UNIQUE,
  owner_email  text NOT NULL,
  language     text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'deleted')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS polls_owner_email_idx ON polls (owner_email);

CREATE TABLE IF NOT EXISTS options (
  id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poll_id   text NOT NULL REFERENCES polls (id),
  label     text NOT NULL,
  position  integer NOT NULL
);

CREATE INDEX IF NOT EXISTS options_poll_id_idx ON options (poll_id);

CREATE TABLE IF NOT EXISTS votes (
  poll_id    text NOT NULL REFERENCES polls (id),
  voter_id   text NOT NULL,
  option_id  integer NOT NULL REFERENCES options (id),
  PRIMARY KEY (poll_id, voter_id)
);
