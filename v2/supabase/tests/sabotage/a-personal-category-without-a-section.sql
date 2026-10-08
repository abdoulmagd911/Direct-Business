-- Sabotage: a-personal-category-without-a-section
-- Breaks: sql:PCR-01
-- Expect: a personal category without its appraisal section is refused
-- A category is made personal without naming the appraisal section it feeds (V625).
alter table perf.achievement_category drop constraint achievement_category_personal_has_section;
