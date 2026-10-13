-- Sabotage: switching-off-strands-the-work
-- Breaks: sql:LEAVE-02
-- Expect: holds an open task is refused
-- Switching someone off leaves their open work with a person who can no longer sign in (V463, OLD-004).
drop trigger keep_work on core.person;
