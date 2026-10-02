-- Mutant m13-list-arabic-optional: a list entry saves without an Arabic name (side_type)
alter table partner.side_type alter column name_ar drop not null;
alter table partner.side_type drop constraint side_type_name_ar_check;
