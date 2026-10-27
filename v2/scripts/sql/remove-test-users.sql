-- Removes the six TEST users, their five TEST teams, their notes and tasks in one step (V656). Run once, before go-live,
-- on the owner's word, in the database's SQL editor or through the migration role. Soft and logged, like every removal;
-- touches only rows with the fixed TEST ids; safe to run twice. The ids it takes, by kind (core.test_id):
--   person 1..6, team 1..5, note 1..6, task 1..10   (7e570000-0000-4000-8000-<kind 01..04><n, ten digits>)
select core.test_users_remove();
