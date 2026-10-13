-- Sabotage: assisting-a-retired-team
-- Breaks: sql:PPL-05
-- Expect: nobody assists a retired team
-- A person assists a retired team, their own home team, or assists while switched off (OLD-006, V465).
drop trigger guard on core.person_team_assist;
