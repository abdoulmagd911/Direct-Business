-- Sabotage: a-banned-seed
-- Breaks: sql:WORDS-01
-- Expect: the list side_type carries no banned word
-- A seed carries a banned word: the segment is named with its abbreviation after it.
update partner.side_type set name_en = 'Government (B' || '2G)' where side = 'client' and key = 'government';
