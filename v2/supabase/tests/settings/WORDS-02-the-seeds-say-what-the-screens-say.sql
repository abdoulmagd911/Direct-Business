-- WORDS-02 — the seeds say what the screens say (V176; the oversight, 29 Sep): the screens call a department إدارة, so
-- the head of one is رئيس الإدارة, never رئيس القسم; and "later" is written لاحقًا, the tanween on the qaf.
-- Sabotage: supabase/tests/sabotage/the-old-seed-words.sql.
select test.eq((select name_ar from core.role where key = 'head'), 'رئيس الإدارة',
  'the head of a department is the head of an إدارة');
select test.eq((select name_ar from partner.activity_outcome where key = 'call_back_later'), 'معاودة الاتصال لاحقًا',
  'call back later is written لاحقًا');
