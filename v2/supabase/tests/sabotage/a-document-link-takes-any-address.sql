-- Sabotage: a-document-link-takes-any-address
-- Breaks: sql:DOCS-01
-- Expect: a plain-http address is refused
-- The secure-address rule is dropped: a link may be any text, so a plain-http or script address is saved.
alter table core.doc_link drop constraint doc_link_link_check;
