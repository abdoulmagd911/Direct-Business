-- Owner 13 Nov (A-tasks): one open question per person per record (comment_one_open_question) counted removed
-- comments too. Removing an unanswered question left its row open (question_open stays true, the row only gets
-- deleted_at), so that person could never be asked again on that record — every new ask was refused "You already
-- have an open question with …", although no question showed anywhere. A removed question no longer holds the place:
-- the index now covers live comments only (every reader of open questions already skips removed ones: work.comments,
-- work.open_asks). Undoing the removal while a newer question to the same person is open is refused by the same index
-- — there is never more than one open question per person per record.
-- Forward-only: the index is replaced under its own name.
drop index core.comment_one_open_question;
create unique index comment_one_open_question on core.comment (entity_table, entity_id, asked_to)
  where question_open and deleted_at is null;
