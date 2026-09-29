-- NORM-01 — folding (§3.5, A17): every Arabic letter form, both families of Arabic digits, harakat and tatweel, dots
-- and punctuation fold to one spelling; a name's key drops the form words but keeps "ال"; a phone typed with 00966,
-- 0966, +966 or a leading 0 is one key; client IDs lose leading zeros, VAT and CR keep them; a code keeps only letters
-- and digits; an email is lower case and needs its @. Every value is made up.
-- Sabotage: supabase/tests/sabotage/folding-forgets-the-hamza.sql.
select test.eq(norm.fold('أرض'), norm.fold('ارض'), 'أ folds to ا');
select test.eq(norm.fold('إدارة'), 'اداره', 'إ folds to ا');
select test.eq(norm.fold('آفاق'), 'افاق', 'آ folds to ا');
select test.eq(norm.fold('مستشفى'), 'مستشفي', 'ى folds to ي');
select test.eq(norm.fold('شركة'), 'شركه', 'ة folds to ه');
select test.eq(norm.fold('مؤسسة'), 'موسسه', 'ؤ folds to و and ة to ه');
select test.eq(norm.fold('کتاب'), 'كتاب', 'Persian ک folds to ك');
select test.eq(norm.fold('فارسی'), 'فارسي', 'Persian ی folds to ي');
select test.eq(norm.fold('مُعَلَّم'), 'معلم', 'harakat are removed');
select test.eq(norm.fold('تجـــارة'), 'تجاره', 'tatweel is removed');
select test.eq(norm.fold('٩٨٧٦٥ ٤٣٢١٠'), '98765 43210', 'Arabic-Indic digits fold to 0–9');
select test.eq(norm.fold('۹۸۷۶۵ ۴۳۲۱۰'), '98765 43210', 'Extended digits fold to 0–9');
select test.eq(norm.fold('  Made-Up   Travel, L.L.C.  '), 'made up travel llc', 'dots removed, punctuation is space');
select test.eq(norm.fold('ＡＢＣ１２３'), 'abc123', 'full-width letters and digits fold (NFKC)');
select test.eq(norm.fold('---'), null::text, 'nothing left is nothing');

select set_config('t.stop', '{شركة,مؤسسة,company,co,corp,corporation,ltd,limited,llc,inc,est}', true);
select test.eq(norm.name_key('شركة الرحلات المتخيلة', current_setting('t.stop')::text[]),
  norm.name_key('الرحلات المتخيله', current_setting('t.stop')::text[]), 'the form word شركة is dropped');
select test.eq(norm.name_key('Made Up Travel Co. LLC', current_setting('t.stop')::text[]), 'madeuptravel',
  'English form words are dropped and the words joined');
select test.ok(norm.name_key('الرحلات', current_setting('t.stop')::text[])
               <> norm.name_key('رحلات', current_setting('t.stop')::text[]), 'the article ال is kept');
select test.eq(norm.name_key('LLC', current_setting('t.stop')::text[]), null::text, 'only form words is no name');

select test.eq(norm.phone_key('+966 50 000 0456'), '500000456', '+966');
select test.eq(norm.phone_key('00966500000456'), '500000456', '00966');
select test.eq(norm.phone_key('0966500000456'), '500000456', '0966 — the gap in the old code');
select test.eq(norm.phone_key('050 000 0456'), '500000456', 'a leading 0');
select test.eq(norm.phone_key('٠٥٠٠٠٠٠٤٥٦'), '500000456', 'Arabic digits');
select test.eq(norm.phone_key('12345'), null::text, 'fewer than 7 digits is no phone');

select test.eq(norm.key('payments_client_id', 'C-000123'), '123', 'a client ID loses leading zeros');
select test.eq(norm.key('vat', '300 000 000 000 003'), '300000000000003', 'a VAT number keeps its digits');
select test.eq(norm.key('cr', '0101 000012'), '0101000012', 'a CR keeps leading zeros');
select test.eq(norm.key('discount_code', ' Made-Up_10 '), 'madeup10', 'a code keeps letters and digits');
select test.eq(norm.key('email', '  Someone@Example.TEST '), 'someone@example.test', 'an email is lower case');
select test.eq(norm.key('email', 'no-at-sign'), null::text, 'an email needs its @');
select test.eq(norm.key('name', 'Made Up Est.', current_setting('t.stop')::text[]), 'madeup', 'a name by its kind');
select test.eq(norm.version(), 1, 'the rules carry their version');
