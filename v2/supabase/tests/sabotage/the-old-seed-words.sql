-- Sabotage: the-old-seed-words
-- Breaks: sql:WORDS-02
-- Expect: the head of a department is the head of an إدارة
-- The seeds keep their first Arabic: the head of a قسم, and لاحقاً with the tanween on the alif.
update core.role set name_ar = 'رئيس القسم' where key = 'head';
update partner.activity_outcome set name_ar = 'معاودة الاتصال لاحقاً' where key = 'call_back_later';
