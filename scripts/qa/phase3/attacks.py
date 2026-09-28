"""Adversarial tests for the task-manager structure v1.2.4 (aligned to Direct's live systems).
Each test runs in its own transaction and is rolled back, on top of a committed fixture set.
R-tests run as the real 'authenticated' role with the app's own row rules switched on."""
import psycopg2, json, sys, re
import os
DSN = os.environ.get("TM_DSN", "host=/tmp user=postgres dbname=tm12")
results = []; ADMIN = None

def conn():
    c = psycopg2.connect(DSN); c.autocommit = False
    if ADMIN: c.cursor().execute("select set_config('request.uid', %s, false)", (str(ADMIN),))
    return c
def q(cur, sql, args=None):
    cur.execute(sql, args or ())
    try: return cur.fetchall()
    except psycopg2.ProgrammingError: return None
def one(cur, sql, args=None):
    r = q(cur, sql, args); return r[0][0] if r else None
def expect_fail(cur, sql, args, must_contain):
    cur.execute("savepoint s")
    try: cur.execute(sql, args or ())
    except psycopg2.Error as e:
        cur.execute("rollback to savepoint s"); msg = str(e).split("\n")[0]
        return (must_contain.lower() in msg.lower(), msg)
    cur.execute("rollback to savepoint s"); return (False, "NOT BLOCKED")
def test(name):
    def deco(fn):
        c = conn(); cur = c.cursor()
        try: ok, detail = fn(cur)
        except Exception as e: ok, detail = False, "ERROR " + str(e).split("\n")[0]
        c.rollback(); c.close(); results.append((name, ok, detail)); return fn
    return deco
def as_user(cur, key):
    q(cur, "set local role authenticated"); q(cur, "select set_config('request.uid', %s, true)", (str(F[key]),))

# ---------------- fixtures (committed) ----------------
c = psycopg2.connect(DSN); cur = c.cursor(); F = {}
def ins(sql, args=()): cur.execute(sql + " returning id", args); return cur.fetchone()[0]
ADMIN = F['admin'] = ins("insert into app_users(email,full_name,role) values ('admin@x.test','Admin','admin')")
cur.execute("select set_config('request.uid', %s, false)", (str(ADMIN),))
dep = lambda code: one(cur, "select id from departments where code=%s", (code,))
F['dep_bus'], F['dep_par'], F['dep_qua'] = dep('business'), dep('partnership'), dep('quality')
F['dep_str'], F['dep_com'] = dep('strategy'), dep('commercial')
TASKS_PAGE = json.dumps({"tasks": "full", "reports": "own", "finance": "full", "clients": "full", "leads": "full"})   # employee defaults (D7)
MGR_PAGE = json.dumps({"tasks": "full", "reports": "full", "finance": "full", "clients": "full", "leads": "full"})
VIEW_PAGE = json.dumps({"tasks": "view", "reports": "view", "finance": "view", "clients": "view"})
def own_tasks(cur, *users):   # a person on Own for Tasks (a trainee, someone outside the core team)
    for u in users: q(cur, "update app_users set page_access = page_access || '{\"tasks\":\"own\"}' where id=%s", (F[u],))
for k, name, d, role, pa in [('u1','Raad','dep_bus','team_member',TASKS_PAGE), ('u2','Kareem','dep_bus','team_member',TASKS_PAGE),
                             ('u3','Mohammed','dep_par','team_member',TASKS_PAGE), ('u4','Othman','dep_bus','manager',MGR_PAGE),
                             ('u5','Quality','dep_qua','team_member',VIEW_PAGE),
                             ('u6','Viewer','dep_qua','team_member',VIEW_PAGE)]:
    F[k] = ins("insert into app_users(email,full_name,role,page_access) values (%s,%s,%s,%s)", (k+'@x.test', name, role, pa))
    F['m'+k[1]] = ins("insert into team_members(user_id,department_id,active) values (%s,%s,true)", (F[k], F[d]))
F['coA'] = ins("insert into businesses(name,is_client,account_manager) values ('Company A',true,'Raad')")
F['coB'] = ins("insert into businesses(name,is_client) values ('Company B',true)")
F['cpA_pre'] = ins("insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1001','prepaid','active')", (F['coA'],))
F['cpA_post'] = ins("insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1002','postpaid','active')", (F['coA'],))
F['cpA_ten'] = ins("insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1003','tender','active')", (F['coA'],))
F['cpB'] = ins("insert into client_profiles(business_id,direct_client_id,profile_type) values (%s,'C-2001','prepaid')", (F['coB'],))
cur.execute("insert into promo_codes(code,kind,value_pct,valid_to,partner_business_id) values ('COA10','percent',10,'2026-12-31',%s),('COA-STAFF','percent',5,'2026-06-30',%s)", (F['coA'], F['coA']))
F['ctB'] = ins("insert into contacts(business_id,name) values (%s,'Person at B')", (F['coB'],))
for g, b in [('GRP-A', F['coA']), ('GRP-B', F['coB'])]:
    cur.execute("insert into finance_client_links(client_group,business_id,is_client) values (%s,%s,true)", (g, b))
def inv(no, line, grp, d, rev, cost, rec, status='verified_paid', excl=None, deleted=False):
    return ins("""insert into finance_invoices(invoice_no,line_no,client_group,invoice_date,revenue_sar,cost_sar,profit_sar,amount_received_sar,
      amount_remaining_sar,integrity_status,exclusion_reason,deleted_at,source_batch,revenue_way,service_type)
      values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'direct-payments-2026-08-22','invoice','B2B')""",
      (no, line, grp, d, rev, cost, (rev - cost) if cost is not None else None, rec, rev - rec, status, excl, 'now()' if deleted else None))
inv('INV-A26', 1, 'GRP-A', '2026-03-10', 6000, 4000, 4000); inv('INV-A26', 2, 'GRP-A', '2026-03-10', 4000, 3000, 0)   # two lines, one invoice
inv('INV-A25', 1, 'GRP-A', '2025-03-12', 6000, 4500, 6000)
inv('INV-B26', 1, 'GRP-B', '2026-03-15', 5000, 0, 0)                     # cost not recorded yet
inv('INV-X26', 1, 'GRP-X', '2026-03-16', 900, 500, 900)                  # not matched to any company in Finance
inv('INV-E26', 1, 'GRP-A', '2026-03-17', 777, 700, 777, excl='Duplicate row')
inv('INV-D26', 1, 'GRP-A', '2026-03-18', 555, 500, 555, deleted=True)
inv('INV-U26', 1, 'GRP-A', '2026-03-19', 333, 300, 0, status='unpaid')
# E (2026-09-27): a row belongs to a company only through a TYPED client ID (client_profiles) — never by its name
cur.execute("update finance_invoices set payments_client_id = case client_group when 'GRP-A' then 'C-1001' when 'GRP-B' then 'C-2001' end")
F['cat'] = one(cur, "select id from report_categories where code='deals'")
def pid(kind, y, m=None, qq=None):
    return one(cur, "select id from periods where kind=%s and year=%s and month is not distinct from %s and (%s::int is null or quarter=%s)", (kind, y, m, qq, qq))
F['mar26'], F['mar25'], F['apr26'], F['feb26'] = pid('month',2026,3), pid('month',2025,3), pid('month',2026,4), pid('month',2026,2)
F['q1_26'], F['q4_25'], F['y26'] = pid('quarter',2026,None,1), pid('quarter',2025,None,4), pid('year',2026)
kd = lambda code, unit, method, agg='sum': ins("insert into kpi_definitions(code,name_en,unit,method,aggregation) values (%s,%s,%s,%s,%s)", (code, code, unit, method, agg))
F['kpi_done'] = kd('t_done','count','tasks_done'); F['kpi_ontime'] = kd('t_ontime','percent','tasks_on_time_pct','latest')
F['kpi_rev'] = kd('t_rev','SAR','finance_revenue'); F['kpi_man'] = kd('t_man','count','manual'); F['kpi_pct'] = kd('t_pct','percent','manual','latest')
F['kpi_ch'] = ins("insert into kpi_definitions(code,name_en,unit,method) values ('t_channels','Sales channels signed','count','manual')")
c.commit(); c.close()

def new_project(cur, company='coA', work='sales', owner='m1', dep='dep_bus'):
    return one(cur, "insert into projects(name,business_id,department_id,owner_id,work_type) values ('P',%s,%s,%s,%s) returning id",
               (F[company] if company else None, F[dep], F[owner], work))
def new_task(cur, project=None, company=None, owner='m1', work='sales', **kw):
    cols = ['title','project_id','business_id','owner_id','work_type'] + list(kw)
    vals = ['T', project, F[company] if company else None, F[owner], work] + list(kw.values())
    return one(cur, f"insert into tasks({','.join(cols)}) values ({','.join(['%s']*len(vals))}) returning id", vals)
def link(cur, inv_no, project, task=None, **kw):
    cols = ['invoice_no','project_id','task_id'] + list(kw); vals = [inv_no, project, task] + list(kw.values())
    q(cur, f"insert into work_finance_links({','.join(cols)}) values ({','.join(['%s']*len(vals))})", vals)

def achievement(cur, kpi, per, value=None, member='m1', final=True, proof=False):
    e = one(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title,kpi_id,value,created_by,status) values (%s,(select department_id from team_members where id=%s),%s,'achievement',%s,'A',%s,%s,%s,%s) returning id",
            (F[per], F[member], F[member], F['cat'], F[kpi], value, F[member], 'final' if final else 'draft'))
    if proof: q(cur, "insert into evidence_files(entry_id,storage_path,file_name,uploaded_by) values (%s,%s,'contract.pdf',%s)", (e, f'proofs/{e}.pdf', F[member]))
    return e
import uuid as _uuid
def doc_sql(company_key, doc_type, cp_key=None, valid_to=None, name='f.pdf'):
    """R4: a company file row the way the app writes it — its path names its company and its own id."""
    i = str(_uuid.uuid4()); b = F[company_key]
    return ("insert into company_documents(id,business_id,client_profile_id,doc_type,storage_path,file_name,valid_to) values (%s,%s,%s,%s,%s,%s,%s)",
            (i, b, F[cp_key] if cp_key else None, doc_type, f'clients/{b}/{i}/{name}', name, valid_to), f'clients/{b}/{i}/{name}', i)
def blocked_or_zero(cur, sql, args):
    """RLS: an UPDATE the person may not do touches 0 rows; an INSERT raises. Either way = no effect."""
    cur.execute("savepoint s")
    try: cur.execute(sql, args); n = cur.rowcount; cur.execute("rollback to savepoint s"); return n == 0, f"{n} rows changed"
    except __import__('psycopg2').Error as e: cur.execute("rollback to savepoint s"); return True, str(e).split("\n")[0][:50]

# ================= the five blueprint tests =================
@test("B1 One dummy company + task shows up in every tool (project, my tasks, board, finance, KPI, report)")
def _(cur):
    p = new_project(cur); t = new_task(cur, project=p)
    q(cur, "update tasks set status='done', done_at='2026-03-20 10:00+03' where id=%s", (t,))
    link(cur, 'INV-A26', p, t)
    q(cur, "insert into report_entries(period_id,department_id,section,category_id,text_en,source,source_id) values (%s,%s,'achievement',%s,'Deal closed','task',%s)", (F['mar26'], F['dep_bus'], F['cat'], t))
    q(cur, "insert into kpi_targets(kpi_id,scope,member_id,period_id,target_value) values (%s,'member',%s,%s,1)", (F['kpi_done'], F['m1'], F['mar26']))
    checks = {
      'task inherits company': one(cur, "select business_id=%s from tasks where id=%s", (F['coA'], t)),
      'my tasks': one(cur, "select count(*)=1 from tasks where owner_id=%s and deleted_at is null", (F['m1'],)),
      'board: done': one(cur, "select status='done' from tasks where id=%s", (t,)),
      'project money = Finance (2 lines, 10000/7000/3000)': one(cur, "select revenue_sar=10000 and cost_sar=7000 and profit_sar=3000 and invoices=1 from project_money where project_id=%s", (p,)),
      'KPI actual = 1': one(cur, "select actual=1 from kpi_actuals where kpi_id=%s and scope='member' and member_id=%s and period_id=%s", (F['kpi_done'], F['m1'], F['mar26'])),
      'scorecard 100%': one(cur, "select pct_of_target=100 from kpi_scorecard where kpi_id=%s and member_id=%s", (F['kpi_done'], F['m1'])),
      'report line → task': one(cur, "select count(*)=1 from report_entries where source='task' and source_id=%s", (t,)),
      'client card: next task': one(cur, "select count(*)=0 from company_open_work where task_id=%s", (t,)),
    }
    bad = [k for k, v in checks.items() if not v]
    return (not bad, "all 8 views agree" if not bad else f"failed: {bad}")

@test("B2 Rename the company once → new name everywhere (no copied names)")
def _(cur):
    p = new_project(cur); t = new_task(cur, project=p)
    q(cur, "update businesses set name='Company A Renamed' where id=%s", (F['coA'],))
    n = one(cur, "select b.name from tasks t join businesses b on b.id=t.business_id where t.id=%s", (t,))
    copies = one(cur, "select count(*) from information_schema.columns where table_schema='public' and column_name in ('company_name','business_name','client_name','client_group') and table_name in (select table_name from information_schema.tables where table_schema='public' and table_name ~ '^(projects|tasks|task_|report_|reports|work_finance|kpi_)')")
    return (n == 'Company A Renamed' and copies == 0, f"task shows '{n}', name copies stored: {copies}")

@test("B3 Delete a task → gone from lists and KPIs, trail kept in record_history, hard delete impossible")
def _(cur):
    t = new_task(cur, company='coA')
    q(cur, "update tasks set status='done', done_at='2026-03-20 10:00+03' where id=%s", (t,))
    before = one(cur, "select count(*) from tasks_done_by_period where task_id=%s", (t,))
    q(cur, "update tasks set deleted_at=now() where id=%s", (t,))
    after = one(cur, "select count(*) from tasks_done_by_period where task_id=%s", (t,))
    trail = one(cur, "select count(*) from record_history where table_name='tasks' and record_id=%s", (t,))
    act = one(cur, "select action from record_history where table_name='tasks' and record_id=%s order by id desc limit 1", (t,))
    ok, msg = expect_fail(cur, "delete from tasks where id=%s", (t,), "never deleted")
    return (before == 3 and after == 0 and trail >= 3 and act == 'delete' and ok, f"in views {before}→{after}, history rows={trail}, last action='{act}', hard delete: {msg}")

@test("B4 Type money into a report line → blocked (money only comes from Finance)")
def _(cur):
    k19 = one(cur, "select id from kpi_definitions where code='K19'")
    a, m1 = expect_fail(cur, "insert into report_entries(period_id,department_id,section,category_id,text_en,kpi_id,value) values (%s,%s,'achievement',%s,'x',%s,5000)", (F['mar26'], F['dep_bus'], F['cat'], k19), "report_no_typed_money")
    cols = one(cur, "select count(*) from information_schema.columns where table_schema='public' and column_name like '%%\\_sar' escape '\\' and table_name in ('projects','tasks','report_entries','reports','work_finance_links','kpi_manual_entries')")
    return (a and cols == 0, f"{m1} | money columns in new tables: {cols}")

@test("B5 Delete a company that has a project → blocked (companies are archived, not deleted)")
def _(cur):
    co = one(cur, "insert into businesses(name) values ('Company C') returning id")
    q(cur, "insert into projects(name,business_id,department_id,owner_id,work_type) values ('P',%s,%s,%s,'sales')", (co, F['dep_bus'], F['m1']))
    return expect_fail(cur, "delete from businesses where id=%s", (co,), "projects")

# ================= structure attacks (ported from v1) =================
@test("A01 Task company differs from its project's company → blocked")
def _(cur):
    p = new_project(cur)
    return expect_fail(cur, "insert into tasks(title,project_id,business_id,owner_id,work_type) values ('T',%s,%s,%s,'sales')", (p, F['coB'], F['m1']), "must match")
@test("A02 Client task with no company and no project → blocked")
def _(cur): return expect_fail(cur, "insert into tasks(title,owner_id,work_type) values ('T',%s,'sales')", (F['m1'],), "needs a company")
@test("A03 Internal task with no company → allowed")
def _(cur): return (new_task(cur, work='internal') is not None, "created")
@test("A04 Sub-subtask → blocked (one level only)")
def _(cur):
    t = new_task(cur, company='coA'); s = new_task(cur, company='coA', parent_task_id=t)
    return expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type,parent_task_id) values ('T',%s,%s,'sales',%s)", (F['coA'], F['m1'], s), "one level")
@test("A05 Subtask in a different project from its parent → blocked")
def _(cur):
    p1 = new_project(cur); p2 = new_project(cur); t = new_task(cur, project=p1)
    return expect_fail(cur, "insert into tasks(title,project_id,owner_id,work_type,parent_task_id) values ('T',%s,%s,'sales',%s)", (p2, F['m1'], t), "parent")
@test("A06 Finish with an open subtask → blocked; after → allowed, done_at/done_by auto; reopen clears both")
def _(cur):
    t = new_task(cur, company='coA'); s = new_task(cur, company='coA', parent_task_id=t)
    ok1, m1 = expect_fail(cur, "update tasks set status='done' where id=%s", (t,), "open subtasks")
    q(cur, "update tasks set status='done' where id=%s", (s,)); q(cur, "update tasks set status='done' where id=%s", (t,))
    auto = one(cur, "select done_at is not null from tasks where id=%s", (t,))
    q(cur, "update tasks set status='in_progress' where id=%s", (t,))
    cleared = one(cur, "select done_at is null and done_by is null from tasks where id=%s", (t,))
    return (ok1 and auto and cleared, f"{m1} | auto={auto} | cleared={cleared}")
@test("A07 Assign a task to someone inactive → blocked")
def _(cur):
    q(cur, "update team_members set active=false, left_on='2026-01-01' where id=%s", (F['m3'],))
    return expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type) values ('T',%s,%s,'sales')", (F['coA'], F['m3']), "not an active")
@test("A08 Deactivate someone who still owns open tasks → blocked")
def _(cur):
    new_task(cur, company='coA', owner='m2')
    return expect_fail(cur, "update team_members set active=false, left_on='2026-09-01' where id=%s", (F['m2'],), "reassign")
@test("A09 A task's team is the one CHOSEN (people & teams, 2026-09-27): kept if active; none given → the owner's home team; a retired team is refused")
def _(cur):
    t = one(cur, "insert into tasks(title,business_id,owner_id,work_type,department_id) values ('T',%s,%s,'sales',%s) returning id", (F['coA'], F['m3'], F['dep_bus']))
    kept = one(cur, "select department_id=%s from tasks where id=%s", (F['dep_bus'], t))
    t2 = one(cur, "insert into tasks(title,business_id,owner_id,work_type) values ('T',%s,%s,'sales') returning id", (F['coA'], F['m3']))
    home = one(cur, "select department_id=%s from tasks where id=%s", (F['dep_par'], t2))
    q(cur, "update departments set active=false where id=%s", (F['dep_str'],))
    r, m = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type,department_id) values ('T',%s,%s,'sales',%s)", (F['coA'], F['m3'], F['dep_str']), "active team")
    return (kept and home and r, f"chosen kept={kept} · none → home team={home} · retired refused={r}")
@test("A10 Link Company B's invoice to Company A's project → blocked")
def _(cur):
    p = new_project(cur); return expect_fail(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-B26',%s)", (p,), "different company")
@test("A11 Link one invoice to two projects → blocked (one home per invoice)")
def _(cur):
    p1 = new_project(cur); p2 = new_project(cur); link(cur, 'INV-A26', p1)
    return expect_fail(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-A26',%s)", (p2,), "unique")
@test("A12 Internal project carrying an invoice → blocked")
def _(cur):
    p = new_project(cur, company=None, work='internal')
    return expect_fail(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-A26',%s)", (p,), "internal projects")
@test("A13 Delete a project with invoices linked → blocked; without → its tasks go with it")
def _(cur):
    p = new_project(cur); new_task(cur, project=p); link(cur, 'INV-A26', p)
    ok, m = expect_fail(cur, "update projects set deleted_at=now() where id=%s", (p,), "invoices linked")
    p2 = new_project(cur); t2 = new_task(cur, project=p2); q(cur, "update projects set deleted_at=now() where id=%s", (p2,))
    gone = one(cur, "select deleted_at is not null from tasks where id=%s", (t2,))
    return (ok and gone, f"{m} | cascade={gone}")
@test("A14 Move a project with tasks to another company → blocked")
def _(cur):
    p = new_project(cur); new_task(cur, project=p)
    return expect_fail(cur, "update projects set business_id=%s where id=%s", (F['coB'], p), "another company")
@test("A15 Issue March → month locks; editing/adding/deleting its lines, editing or deleting the report → blocked")
def _(cur):
    e = one(cur, "insert into report_entries(period_id,department_id,section,category_id,text_en) values (%s,%s,'achievement',%s,'x') returning id", (F['mar26'], F['dep_bus'], F['cat']))
    r = one(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued','{\"revenue\":10000}',now(),%s) returning id", (F['mar26'], F['m4']))
    locked = one(cur, "select locked_at is not null from periods where id=%s", (F['mar26'],))
    a, m1 = expect_fail(cur, "update report_entries set text_en='changed' where id=%s", (e,), "locked")
    b, m2 = expect_fail(cur, "insert into report_entries(period_id,department_id,section,text_en) values (%s,%s,'challenge','late')", (F['mar26'], F['dep_bus']), "locked")
    d0, m0 = expect_fail(cur, "delete from report_entries where id=%s", (e,), "locked")
    cc, m3 = expect_fail(cur, "update reports set snapshot='{\"revenue\":1}' where id=%s", (r,), "frozen")
    d, m4 = expect_fail(cur, "delete from reports where id=%s", (r,), "cannot be deleted")
    return (locked and a and b and d0 and cc and d, f"locked={locked} | {m1} | {m0} | {m3} | {m4}")
@test("A16 Correction supersedes the issued report; two live reports for one month → blocked")
def _(cur):
    r = one(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued','{}',now(),%s) returning id", (F['apr26'], F['m4']))
    ok, m = expect_fail(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued','{}',now(),%s)", (F['apr26'], F['m4']), "reports_one_live")
    ok2, m2 = expect_fail(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by,supersedes_id) values ('monthly',%s,'issued','{}',now(),%s,%s)", (F['apr26'], F['m4'], r), "correction_needs_note")
    q(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by,supersedes_id,correction_note) values ('monthly',%s,'issued','{}',now(),%s,%s,'Fixed Client M figure')", (F['apr26'], F['m4'], r))
    st = one(cur, "select status from reports where id=%s", (r,))
    return (ok and ok2 and st == 'superseded', f"{m} | {m2} | old report now {st}")
@test("A17 Issued snapshot doesn't move when Finance re-imports a changed invoice")
def _(cur):
    p = new_project(cur); link(cur, 'INV-A26', p)
    live = one(cur, "select revenue_sar from project_money where project_id=%s", (p,))
    r = one(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued',%s,now(),%s) returning id", (F['mar26'], json.dumps({'revenue': float(live)}), F['m4']))
    q(cur, "update finance_invoices set total_incl_vat_sar=90000 where invoice_no='INV-A26' and line_no=1")   # a re-import changes the TOTAL; revenue follows it (trigger, D21)
    live2 = one(cur, "select revenue_sar from project_money where project_id=%s", (p,))
    frozen = one(cur, "select (snapshot->>'revenue')::numeric from reports where id=%s", (r,))
    return (frozen == 10000 and live2 == 94000, f"live {live}→{live2}, issued report stays {frozen}")
@test("A18 One calendar: Mar-26 vs Mar-25, Q1-26 vs Q4-25 and vs Q1-25, Jan → Dec")
def _(cur):
    a = one(cur, "select same_last_year_id=%s from period_compare where id=%s", (F['mar25'], F['mar26']))
    b = one(cur, "select previous_id=%s from period_compare where id=%s", (F['q4_25'], F['q1_26']))
    q125 = one(cur, "select id from periods where kind='quarter' and year=2025 and quarter=1")
    cc = one(cur, "select same_last_year_id=%s from period_compare where id=%s", (q125, F['q1_26']))
    jan = one(cur, "select previous_id is not null from period_compare p join periods x on x.id=p.id where x.kind='month' and x.year=2026 and x.month=1")
    return (a and b and cc and jan, f"{a},{b},{cc},{jan}")
@test("A19 Revenue KPI straight from Finance — no linking needed: company, month vs last year, quarter, department, person (account manager)")
def _(cur):
    g = lambda scope, per, **kw: one(cur, "select actual from kpi_actuals where kpi_id=%s and scope=%s and period_id=%s and member_id is not distinct from %s and department_id is not distinct from %s",
                                     (F['kpi_rev'], scope, per, kw.get('m'), kw.get('d')))
    m26, m25, qq = g('company', F['mar26']), g('company', F['mar25']), g('company', F['q1_26'])
    dep, mem = g('department', F['mar26'], d=F['dep_bus']), g('member', F['mar26'], m=F['m1'])
    ok = (m26 == 15900 and m25 == 6000 and qq == 15900 and dep == 10000 and mem == 10000)
    return (ok, f"company Mar-26={m26} (A 10000 + B 5000 + unmatched 900; excluded/deleted/unpaid out) · Mar-25={m25} · Q1={qq} · Business dept={dep} · Raad={mem}")
@test("A20 On-time %: 1 on time + 1 late = 50%")
def _(cur):
    t1 = new_task(cur, company='coA', due_date='2026-03-20'); t2 = new_task(cur, company='coA', due_date='2026-03-05')
    q(cur, "update tasks set status='done', done_at='2026-03-18 10:00+03' where id in (%s,%s)", (t1, t2))
    v = one(cur, "select actual from kpi_actuals where kpi_id=%s and scope='member' and member_id=%s and period_id=%s", (F['kpi_ontime'], F['m1'], F['mar26']))
    return (v == 50, f"on-time = {v}%")
@test("A21 Riyadh time: done 31 Mar 22:30 UTC counts in April")
def _(cur):
    t = new_task(cur, company='coA'); q(cur, "update tasks set status='done', done_at='2026-03-31 22:30+00' where id=%s", (t,))
    m = one(cur, "select x.month from tasks_done_by_period d join periods x on x.id=d.period_id where d.task_id=%s and x.kind='month'", (t,))
    return (m == 4, f"lands in month {m}")
@test("A22 'Finalized by' can't be typed — it's always whoever is signed in")
def _(cur):
    q(cur, "select set_config('request.uid', %s, true)", (str(F['u1']),))
    e = one(cur, "insert into report_entries(period_id,department_id,member_id,section,text_en,finalized_by,status) values (%s,%s,%s,'challenge','x',%s,'final') returning id",
            (F['mar26'], F['dep_bus'], F['m1'], F['m4']))
    who = one(cur, "select finalized_by=%s and finalized_at is not null from report_entries where id=%s", (F['m1'], e))
    return (who, f"typed the manager, recorded the person signed in (Raad)={who}")
@test("A23 Two targets for the same KPI/person/month, or a mismatched scope → blocked")
def _(cur):
    q(cur, "insert into kpi_targets(kpi_id,scope,member_id,period_id,target_value) values (%s,'member',%s,%s,5)", (F['kpi_done'], F['m1'], F['mar26']))
    a, m1 = expect_fail(cur, "insert into kpi_targets(kpi_id,scope,member_id,period_id,target_value) values (%s,'member',%s,%s,9)", (F['kpi_done'], F['m1'], F['mar26']), "kpi_targets_one")
    b, m2 = expect_fail(cur, "insert into kpi_targets(kpi_id,scope,member_id,department_id,period_id,target_value) values (%s,'member',%s,%s,%s,9)", (F['kpi_done'], F['m1'], F['dep_bus'], F['apr26']), "kpi_targets_check")
    return (a and b, f"{m1} | {m2}")
@test("A24 Report lines only per month; achievements need a category")
def _(cur):
    a, m1 = expect_fail(cur, "insert into report_entries(period_id,department_id,section,text_en) values (%s,%s,'challenge','x')", (F['q1_26'], F['dep_bus']), "per month")
    b, m2 = expect_fail(cur, "insert into report_entries(period_id,department_id,section,text_en) values (%s,%s,'achievement','x')", (F['apr26'], F['dep_bus']), "achievement_needs_category")
    return (a and b, f"{m1} | {m2}")
@test("A25 Blocker without a note, or 'send to report' without a category → blocked")
def _(cur):
    a, m1 = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type,is_blocker) values ('T',%s,%s,'sales',true)", (F['coA'], F['m1']), "blocker_needs_note")
    b, m2 = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type,include_in_report) values ('T',%s,%s,'sales',true)", (F['coA'], F['m1']), "report_task_needs_category")
    return (a and b, f"{m1} | {m2}")
@test("A26 Every status change logged; codes come from the app's own numbering (TSK-2026-nnn, PRJ-2026-nnn)")
def _(cur):
    t = new_task(cur, company='coA'); q(cur, "update tasks set status='in_progress' where id=%s", (t,)); q(cur, "update tasks set status='done' where id=%s", (t,))
    n = one(cur, "select count(*) from task_status_log where task_id=%s", (t,))
    t2 = new_task(cur, company='coA'); p = new_project(cur)
    c1, c2, pc = [one(cur, f"select code from {tb} where id=%s", (i,)) for tb, i in (('tasks', t), ('tasks', t2), ('projects', p))]
    fam = one(cur, "select count(*) from document_counters where family in ('TSK','PRJ')")
    ok = n == 3 and c1 != c2 and re.match(r'^TSK-\d{4}-\d{3}$', c1) and re.match(r'^PRJ-\d{4}-\d{3}$', pc) and fam == 2
    return (bool(ok), f"log rows={n}, codes {c1} → {c2}, {pc}, counters in document_counters={fam}")
@test("A27 Tasks and projects carry no money at all")
def _(cur):
    cols = one(cur, "select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name in ('tasks','projects') and (column_name like '%%sar%%' or column_name like '%%revenue%%' or column_name like '%%cost%%' or column_name like '%%value%%')")
    return (cols is None, f"money-like columns on tasks/projects: {cols}")
@test("A28 Backwards dates / negative file size → blocked")
def _(cur):
    a, m1 = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type,start_date,due_date) values ('T',%s,%s,'sales','2026-05-01','2026-04-01')", (F['coA'], F['m1']), "check")
    t = new_task(cur, company='coA')
    b, m2 = expect_fail(cur, "insert into task_files(task_id,storage_path,file_name,size_bytes,uploaded_by) values (%s,'task-files/a.pdf','a.pdf',-1,%s)", (t, F['m1']), "check")
    c3, m3 = expect_fail(cur, "insert into task_files(task_id,storage_path,file_name,uploaded_by) values (%s,'public/a.pdf','a.pdf',%s)", (t, F['m1']), "check")
    return (a and b and c3, f"{m1} | {m2} | public path blocked={c3}")
@test("A29 Blank title / blank comment → blocked")
def _(cur):
    a, m1 = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type) values ('   ',%s,%s,'sales')", (F['coA'], F['m1']), "check")
    t = new_task(cur, company='coA')
    b, m2 = expect_fail(cur, "insert into task_comments(task_id,author_id,body) values (%s,%s,' ')", (t, F['m1']), "check")
    return (a and b, f"{m1} | {m2}")
@test("A30 A task can't depend on itself; the same person can't be added twice")
def _(cur):
    t = new_task(cur, company='coA')
    a, m1 = expect_fail(cur, "insert into task_dependencies(task_id,blocked_by_task_id) values (%s,%s)", (t, t), "check")
    q(cur, "insert into task_people(task_id,member_id,role) values (%s,%s,'helper')", (t, F['m2']))
    b, m2 = expect_fail(cur, "insert into task_people(task_id,member_id,role) values (%s,%s,'reviewer')", (t, F['m2']), "task_person_once")
    return (a and b, f"{m1} | {m2}")
@test("A31 Move a task into another company's project → blocked")
def _(cur):
    pA = new_project(cur); pB = new_project(cur, company='coB'); t = new_task(cur, project=pA)
    return expect_fail(cur, "update tasks set project_id=%s where id=%s", (pB, t), "must match")
@test("A32 Reassign a task → its team stays: the team is the one the WORK is done for, not the person's (people & teams, 2026-09-27)")
def _(cur):
    t = new_task(cur, company='coA'); q(cur, "update tasks set owner_id=%s where id=%s", (F['m3'], t))
    d1 = one(cur, "select department_id=%s from tasks where id=%s", (F['dep_bus'], t))
    t2 = new_task(cur, company='coA'); q(cur, "update tasks set status='done' where id=%s", (t2,)); q(cur, "update tasks set owner_id=%s where id=%s", (F['m3'], t2))
    d2 = one(cur, "select department_id=%s from tasks where id=%s", (F['dep_bus'], t2))
    return (d1 and d2, f"open task keeps Business={d1}, done task keeps Business={d2}")
@test("A33 Reopen / re-date / delete a task counted in an issued month → blocked; title edit allowed")
def _(cur):
    t = new_task(cur, company='coA'); q(cur, "update tasks set status='done', done_at='2026-03-20 10:00+03' where id=%s", (t,))
    q(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued','{}',now(),%s)", (F['mar26'], F['m4']))
    a, m1 = expect_fail(cur, "update tasks set status='in_progress' where id=%s", (t,), "issued month")
    b, _ = expect_fail(cur, "update tasks set done_at='2026-04-02 10:00+03' where id=%s", (t,), "issued month")
    c3, _ = expect_fail(cur, "update tasks set deleted_at=now() where id=%s", (t,), "issued month")
    q(cur, "update tasks set title='typo fixed' where id=%s", (t,))
    return (a and b and c3, f"{m1} | re-date={b} | delete={c3}")

# ================= new in v1.1: alignment with the live systems =================
@test("N01 An invoice with 2 lines links once, and both lines count")
def _(cur):
    p = new_project(cur); link(cur, 'INV-A26', p)
    return (one(cur, "select revenue_sar=10000 and collected_sar=4000 and remaining_sar=6000 from project_money where project_id=%s", (p,)), "10000 revenue from 2 lines, 4000 collected, 6000 remaining")
@test("N02 Invoice Finance hasn't matched to a company → link blocked with a clear message")
def _(cur):
    p = new_project(cur); return expect_fail(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-X26',%s)", (p,), "not matched to a company")
@test("N03 Excluded, deleted or non-existent invoice → link blocked")
def _(cur):
    p = new_project(cur)
    a, m1 = expect_fail(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-E26',%s)", (p,), "excluded")
    b, m2 = expect_fail(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-D26',%s)", (p,), "not in finance")
    c3, m3 = expect_fail(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-NOPE',%s)", (p,), "not in finance")
    return (a and b and c3, f"{m1} | {m2}")
@test("N04 A KPI nobody measured shows NULL ('not measured'), never 0")
def _(cur):
    q(cur, "insert into kpi_targets(kpi_id,scope,member_id,period_id,target_value) values (%s,'member',%s,%s,3)", (F['kpi_done'], F['m2'], F['feb26']))
    a, pct = q(cur, "select actual, pct_of_target from kpi_scorecard where kpi_id=%s and member_id=%s and period_id=%s", (F['kpi_done'], F['m2'], F['feb26']))[0]
    return (a is None and pct is None, f"actual={a}, pct={pct}")
@test("N05 Shared-deal override: needs a note, and moves the credit to the named person")
def _(cur):
    p = new_project(cur)
    ok, m = expect_fail(cur, "insert into work_finance_links(invoice_no,project_id,credited_member_id) values ('INV-A26',%s,%s)", (p, F['m2']), "override_needs_note")
    link(cur, 'INV-A26', p, credited_member_id=F['m2'], note='Kareem closed it; Raad is AM')
    g = lambda m: one(cur, "select actual from kpi_actuals where kpi_id=%s and scope='member' and member_id=%s and period_id=%s", (F['kpi_rev'], F[m], F['mar26']))
    return (ok and g('m2') == 10000 and g('m1') is None, f"{m} | Kareem={g('m2')} Raad={g('m1')}")
@test("N06 A contract value (SAR) on a manual KPI is allowed with proof — only Finance-calculated KPIs refuse typed numbers")
def _(cur):
    k08 = one(cur, "select unit||'/'||method from kpi_definitions where code='K08'")
    q(cur, "update kpi_definitions set code='t_contract', unit='SAR' where id=%s", (F['kpi_man'],))
    e = achievement(cur, 'kpi_man', 'mar26', value=250000, proof=True)
    v = one(cur, "select actual from kpi_actuals where kpi_id=%s and scope='company' and period_id=%s", (F['kpi_man'], F['mar26']))
    return (k08 == 'SAR/manual' and v == 250000, f"K08 is {k08}; contract value counted = {v}")
@test("N07 Quarter roll-up: count KPIs add up, % KPIs take the latest month")
def _(cur):
    for kpi, per, v in [('kpi_man','feb26',2), ('kpi_man','mar26',3), ('kpi_pct','feb26',80), ('kpi_pct','mar26',60)]:
        achievement(cur, kpi, per, value=v)
    g = lambda k: one(cur, "select actual from kpi_actuals where kpi_id=%s and member_id=%s and period_id=%s", (F[k], F['m1'], F['q1_26']))
    return (g('kpi_man') == 5 and g('kpi_pct') == 60, f"count Q1={g('kpi_man')} (2+3), percent Q1={g('kpi_pct')} (latest)")
@test("N08 Report kind must match the period; issued report gets a number from the app's counter (MRP-2026-nnn)")
def _(cur):
    a, m = expect_fail(cur, "insert into reports(kind,period_id) values ('monthly',%s)", (F['q1_26'],), "needs a month")
    r = one(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('quarterly',%s,'issued','{}',now(),%s) returning doc_number", (F['q1_26'], F['m4']))
    return (a and bool(re.match(r'^QRP-\d{4}-\d{3}$', r or '')), f"{m} | issued as {r}")
@test("N09 Tag a contact from another company on a task → blocked")
def _(cur):
    return expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type,contact_id) values ('T',%s,%s,'sales',%s)", (F['coA'], F['m1'], F['ctB']), "different company")
@test("N10 Seeds match the live app: 14 objectives, 30 KPIs (K19 from Finance, 26-30 draft), 12 initiatives, 30 targets for 2026, 20 services")
def _(cur):
    app = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'js', '13-leads-list.js'), encoding='utf-8').read()
    keys = re.findall(r"\['([a-z]+)','[^']*','[^']*','[^']*'\]", app[app.index('var CORE='):app.index('var ALL=')])
    db = [r[0] for r in q(cur, "select code from service_types order by sort")]
    v = q(cur, """select (select count(*) from objectives where year=2026), (select count(*) from kpi_definitions where code like 'K%%'),
      (select count(*) from initiatives), (select count(*) from kpi_targets t join periods p on p.id=t.period_id where p.kind='year' and p.year=2026),
      (select method from kpi_definitions where code='K19'), (select count(*) from kpi_definitions where is_draft),
      (select target_value from kpi_targets t join kpi_definitions k on k.id=t.kpi_id where k.code='K19')""")[0]
    ok = v[:6] == (14, 30, 12, 30, 'finance_revenue', 5) and float(v[6]) == 6000000 and keys == db
    return (ok, f"objectives/KPIs/initiatives/targets={v[:4]}, K19={v[4]} target {v[6]}, drafts={v[5]}, services match app keys={keys == db} ({len(keys)})")
@test("N11 Every new table has row-level security switched on")
def _(cur):
    off = one(cur, "select string_agg(tablename, ',') from pg_tables where schemaname='public' and not rowsecurity and tablename not in ('app_users','promo_codes','document_counters','contacts','ksa_events','client_profiles','generated_documents','record_history')")
    return (off is None, f"tables without RLS: {off}")
@test("N12 Weekly rhythm: an in-progress task with no dated update in 7 days is flagged; a fresh update clears it")
def _(cur):
    t = new_task(cur, company='coA', status='in_progress')
    a = one(cur, "select count(*) from tasks_missing_weekly_update where task_id=%s", (t,))
    q(cur, "insert into task_comments(task_id,author_id,kind,body) values (%s,%s,'weekly_update','Sent revised offer')", (t, F['m1']))
    b = one(cur, "select count(*) from tasks_missing_weekly_update where task_id=%s", (t,))
    return (a == 1 and b == 0, f"flagged={a} → after update={b}")

@test("N13 Every new view runs with the reader's own permissions (security_invoker) — no view can leak money")
def _(cur):
    bad = one(cur, "select string_agg(c.relname, ',') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce('security_invoker=on' = any(c.reloptions), false)")
    total = one(cur, "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'")
    return (bad is None, f"{total} views, without invoker: {bad}")

# ================= v1.2: company card, the achievement chain, optional proofs, KPI danger =================
@test("C01 Company card in one place: 3 client IDs (prepaid/postpaid/tender), its discount codes, its files, what's missing")
def _(cur):
    sq, a1, _p, _i = doc_sql('coA', 'cr', valid_to='2026-01-31', name='cr.pdf'); q(cur, sq, a1)                 # R4: paths as the app writes them
    sq, a1, _p, _i = doc_sql('coA', 'agreement', cp_key='cpA_ten', name='tender-agreement.pdf'); q(cur, sq, a1)
    q(cur, "select set_config('app.today','2026-09-25',true)")
    r = q(cur, "select client_id_count, jsonb_array_length(client_ids), jsonb_array_length(discount_codes), documents, missing_documents, expired_documents from company_card where business_id=%s", (F['coA'],))[0]
    types = one(cur, "select string_agg(x->>'type', ',' order by x->>'type') from company_card, jsonb_array_elements(client_ids) x where business_id=%s", (F['coA'],))
    ok = r[0] == 3 and r[2] == 2 and r[3] == {'cr': 1, 'agreement': 1} and r[4] == ['vat'] and r[5] == 1 and types == 'postpaid,prepaid,tender'
    return (ok, f"client IDs={r[0]} ({types}), discount codes={r[2]}, files={r[3]}, missing={r[4]}, expired={r[5]}")
@test("C02 A file tied to another company's client ID, or saved outside the private folder → blocked; files are never hard-deleted")
def _(cur):
    sq, a1, _p, _i = doc_sql('coA', 'agreement', cp_key='cpB'); a, m1 = expect_fail(cur, sq, a1, "different company")
    b, m2 = expect_fail(cur, "insert into company_documents(business_id,doc_type,storage_path,file_name) values (%s,'vat','public/vat.pdf','x')", (F['coA'],), "stored at clients/")   # R4: refused by the path rule, before the check
    sq, a1, _p, d = doc_sql('coA', 'iban', name='iban.pdf'); q(cur, sq, a1)
    c3, m3 = expect_fail(cur, "delete from company_documents where id=%s", (d,), "never deleted")
    return (a and b and c3, f"{m1} | public path blocked={b} | {m3[:40]}")
@test("C03 Manager note on a task: a team member → blocked; the department head or a manager → allowed")
def _(cur):
    t = new_task(cur, company='coA', owner='m2')
    a, m = expect_fail(cur, "insert into task_comments(task_id,author_id,kind,body) values (%s,%s,'manager_note','Do it this way')", (t, F['m1']), "manager notes")
    q(cur, "insert into task_comments(task_id,author_id,kind,body) values (%s,%s,'manager_note','Manager: good')", (t, F['m4']))
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m1'], F['dep_bus']))
    q(cur, "insert into task_comments(task_id,author_id,kind,body) values (%s,%s,'manager_note','Head: go ahead')", (t, F['m1']))
    n = one(cur, "select count(*) from task_comments where task_id=%s and kind='manager_note'", (t,))
    return (a and n == 2, f"{m} | notes saved by manager + head = {n}")
@test("C04 Full chain — 'sales channels' target 5: task → done → achievement registers itself, final → counts with no proof (flagged) → owner adds a proof → flag clears")
def _(cur):
    q(cur, "insert into kpi_targets(kpi_id,scope,period_id,target_value) values (%s,'company',%s,5)", (F['kpi_ch'], F['y26']))
    t = new_task(cur, company='coA', include_in_report=True, report_category_id=F['cat'], kpi_id=F['kpi_ch'])
    q(cur, "update tasks set status='done', done_at='2026-03-20 10:00+03' where id=%s", (t,))
    e = one(cur, "select id from report_entries where source='task' and source_id=%s", (t,))
    st = one(cur, "select status||'/'||value||'/'||(finalized_by=%s)::text from report_entries where id=%s", (F['m1'], e))
    pct = one(cur, "select pct_of_target from kpi_scorecard where kpi_id=%s and period_id=%s", (F['kpi_ch'], F['y26']))
    before = q(cur, "select proofs, no_proof, counts_toward_kpi from achievement_trail where entry_id=%s", (e,))[0]
    q(cur, "insert into task_files(task_id,storage_path,file_name,uploaded_by) values (%s,'task-files/channel-agreement.pdf','agreement.pdf',%s)", (t, F['m1']))
    after = q(cur, "select task_code, kpi_code, proofs, no_proof from achievement_trail where entry_id=%s", (e,))[0]
    ok = st == 'final/1.00/true' and pct == 20 and before == (0, True, True) and after[2] == 1 and after[3] is False
    return (ok, f"auto entry={st} | KPI={pct}% with no proof (flagged={before[1]}) | trail {after[0]}→{after[1]}, proofs={after[2]}, flag={after[3]}")
@test("C05 The owner edits a final achievement → stays final and counted, 'finalized by' kept, change goes to history; draft → final stamps the finalizer")
def _(cur):
    e = achievement(cur, 'kpi_ch', 'apr26')
    q(cur, "select set_config('request.uid', %s, true)", (str(F['u1']),))
    q(cur, "update report_entries set title='Corrected wording' where id=%s", (e,))
    kept = one(cur, "select status='final' and finalized_by=%s from report_entries where id=%s", (F['m1'], e))
    hist = one(cur, "select count(*) from record_history where table_name='report_entries' and record_id=%s and action='edit'", (str(e),))
    d = achievement(cur, 'kpi_ch', 'apr26', final=False)
    q(cur, "select set_config('request.uid', %s, true)", (str(F['u1']),))
    q(cur, "update report_entries set status='final' where id=%s", (d,))
    st = one(cur, "select finalized_by=%s from report_entries where id=%s", (F['m1'], d))
    return (kept and hist >= 1 and st, f"still final={kept} | history rows={hist} | draft→final stamped Raad={st}")
@test("C06 Reopen a task: its achievement is withdrawn automatically; once the month is issued the reopen is blocked")
def _(cur):
    t = new_task(cur, company='coA', include_in_report=True, report_category_id=F['cat'], kpi_id=F['kpi_ch'])
    q(cur, "update tasks set status='done', done_at='2026-04-20 10:00+03' where id=%s", (t,))
    q(cur, "update tasks set status='in_progress' where id=%s", (t,))
    gone = one(cur, "select count(*)=0 from report_entries where source_id=%s", (t,))
    q(cur, "update tasks set status='done', done_at='2026-04-21 10:00+03' where id=%s", (t,))
    q(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued','{}',now(),%s)", (F['apr26'], F['m4']))
    a, m = expect_fail(cur, "update tasks set status='in_progress' where id=%s", (t,), "issued month")
    return (gone and a, f"withdrawn={gone} | after issue: {m[:70]}")
@test("C07 Quality / Strategy / Integrity have no control: a Quality member reads the whole trail but can't edit, finalize, delete or add proofs to anyone's achievement, or touch their task")
def _(cur):
    t = new_task(cur, company='coA', include_in_report=True, report_category_id=F['cat'], kpi_id=F['kpi_ch'])
    q(cur, "update tasks set status='done', done_at='2026-03-20 10:00+03' where id=%s", (t,))
    e = one(cur, "select id from report_entries where source_id=%s", (t,))
    as_user(cur, 'u5')
    reads = one(cur, "select count(*) from achievement_trail where entry_id=%s", (e,))
    r = [blocked_or_zero(cur, "update report_entries set status='draft' where id=%s", (e,)),
         blocked_or_zero(cur, "update report_entries set title='x' where id=%s", (e,)),
         blocked_or_zero(cur, "delete from report_entries where id=%s", (e,)),
         blocked_or_zero(cur, "insert into evidence_files(entry_id,storage_path,file_name,uploaded_by) values (%s,'proofs/q.pdf','q.pdf',%s)", (e, F['m5'])),
         blocked_or_zero(cur, "update tasks set status='in_progress' where id=%s", (t,)),
         blocked_or_zero(cur, "insert into task_files(task_id,storage_path,file_name,uploaded_by) values (%s,'task-files/q.pdf','q.pdf',%s)", (t, F['m5']))]
    return (reads == 1 and all(x[0] for x in r), f"reads trail={reads} | " + " · ".join(x[1] for x in r))
@test("C08 KPI danger light by pace — quarter target 10 on 14 Feb (half-way): 2 = behind, 4 = at risk, 5 = on track; after quarter end below = missed; 10 = achieved")
def _(cur):
    q(cur, "insert into kpi_targets(kpi_id,scope,period_id,target_value) values (%s,'company',%s,10)", (F['kpi_ch'], F['q1_26']))
    light = lambda: one(cur, "select light from kpi_pace where kpi_id=%s and period_id=%s", (F['kpi_ch'], F['q1_26']))
    q(cur, "select set_config('app.today','2026-02-14',true)")
    out = {'none': light()}
    for n in range(2): achievement(cur, 'kpi_ch', 'jan26' if 'jan26' in F else 'feb26')
    out['2'] = light()
    for n in range(2): achievement(cur, 'kpi_ch', 'feb26')
    out['4'] = light()
    achievement(cur, 'kpi_ch', 'feb26'); out['5'] = light()
    q(cur, "select set_config('app.today','2026-04-05',true)"); out['5 after end'] = light()
    for n in range(5): achievement(cur, 'kpi_ch', 'mar26')
    out['10'] = light()
    ok = out == {'none': 'not_measured', '2': 'behind', '4': 'at_risk', '5': 'on_track', '5 after end': 'missed', '10': 'achieved'}
    return (ok, str(out))
@test("C09 Plan → task → achievement: a task can deliver a 'next month plan' line; pointing it at anything else → blocked")
def _(cur):
    pl = one(cur, "insert into report_entries(period_id,department_id,section,text_en,kpi_id) values (%s,%s,'next_month_plan','Sign 2 new channels',%s) returning id", (F['mar26'], F['dep_bus'], F['kpi_ch']))
    ch = one(cur, "insert into report_entries(period_id,department_id,section,text_en) values (%s,%s,'challenge','Slow replies') returning id", (F['mar26'], F['dep_bus']))
    t = new_task(cur, company='coA', plan_entry_id=pl)
    a, m = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type,plan_entry_id) values ('T',%s,%s,'sales',%s)", (F['coA'], F['m1'], ch), "planned item")
    return (t is not None and a, f"plan link ok | {m}")
@test("C10 Open visibility: a person on Own sees every department's tasks while the switch is on, only their own when off; Full and View always see all")
def _(cur):
    other = new_task(cur, company='coA', owner='m3'); own_tasks(cur, 'u1')
    as_user(cur, 'u1'); on = one(cur, "select count(*) from tasks where id=%s", (other,))
    q(cur, "reset role"); q(cur, "update work_settings set value='false' where key='open_visibility'")
    as_user(cur, 'u1'); off = one(cur, "select count(*) from tasks where id=%s", (other,))
    q(cur, "reset role"); as_user(cur, 'u2'); full = one(cur, "select count(*) from tasks where id=%s", (other,))
    q(cur, "reset role"); as_user(cur, 'u6'); view = one(cur, "select count(*) from tasks where id=%s", (other,))
    return (on == 1 and off == 0 and full == 1 and view == 1, f"Own: switch on sees={on}, off sees={off} · Full sees={full} · View sees={view}")

@test("C11 Whoever manages the task can finalize someone's achievement for them; 'finalized by' records the real person")
def _(cur):
    e = achievement(cur, 'kpi_ch', 'apr26', final=False)
    as_user(cur, 'u4')
    q(cur, "update report_entries set status='final', finalized_by=%s where id=%s", (F['m2'], e))
    q(cur, "reset role"); who = one(cur, "select status='final' and finalized_by=%s from report_entries where id=%s", (F['m4'], e))
    return (who, f"manager finalized Raad's line, typed Kareem, recorded the manager={who}")
@test("C12 D7 helpers, not locks: a colleague on Full helps on Raad's task (recorded, Raad is told) but can't touch Raad's achievement; on Own they can't touch the task unless added as helper")
def _(cur):
    t = new_task(cur, company='coA', owner='m1')
    e = achievement(cur, 'kpi_ch', 'apr26')
    as_user(cur, 'u2')
    cur.execute("update tasks set title='Kareem helped' where id=%s", (t,)); helped = cur.rowcount
    cur.execute("insert into task_checklist(task_id,text) values (%s,'call the client')", (t,)); chk = cur.rowcount
    ach = blocked_or_zero(cur, "update report_entries set title='x' where id=%s", (e,))
    q(cur, "reset role"); as_user(cur, 'u1')
    told = q(cur, "select actor_name, table_name from changes_to_my_tasks() where task_id=%s and actor_name='Kareem'", (t,))
    q(cur, "reset role"); own_tasks(cur, 'u2'); as_user(cur, 'u2')
    own = blocked_or_zero(cur, "update tasks set title='again' where id=%s", (t,))
    q(cur, "reset role"); q(cur, "insert into task_people(task_id,member_id,role) values (%s,%s,'helper')", (t, F['m2'])); as_user(cur, 'u2')
    cur.execute("update tasks set title='Helper updated' where id=%s", (t,)); helper = cur.rowcount
    ok = helped == 1 and chk == 1 and ach[0] and len(told) == 2 and own[0] and helper == 1
    return (ok, f"Full helps: task {helped}, checklist {chk} | achievement: {ach[1]} | Raad told: {told} | Own: {own[1]} | as helper: {helper} row")
@test("C13 The owner removes a task file → it drops from the proofs (kept in history); a hard delete is refused")
def _(cur):
    t = new_task(cur, company='coA', include_in_report=True, report_category_id=F['cat'], kpi_id=F['kpi_ch'])
    f = one(cur, "insert into task_files(task_id,storage_path,file_name,uploaded_by) values (%s,'task-files/proof.pdf','proof.pdf',%s) returning id", (t, F['m1']))
    q(cur, "update tasks set status='done', done_at='2026-04-20 10:00+03' where id=%s", (t,))
    e = one(cur, "select id from report_entries where source_id=%s", (t,))
    b4 = one(cur, "select proofs from achievement_trail where entry_id=%s", (e,))
    as_user(cur, 'u1'); q(cur, "update task_files set deleted_at=now() where id=%s", (f,)); q(cur, "reset role")
    af = one(cur, "select proofs from achievement_trail where entry_id=%s", (e,))
    a, m = expect_fail(cur, "delete from task_files where id=%s", (f,), "never deleted")
    return (b4 == 1 and af == 0 and a, f"proofs {b4}→{af} | {m[:45]}")

# ================= v1.2.2: one Commercial head, assigning, company owner, discount codes =================
@test("D01 Manager creates a task for a company without naming anyone → goes to the company's account manager; 'assigned by' recorded")
def _(cur):
    q(cur, "select set_config('request.uid', %s, true)", (str(F['u4']),))
    t = one(cur, "insert into tasks(title,business_id,work_type) values ('Renew contract',%s,'sales') returning id", (F['coA'],))
    r = q(cur, "select owner_id=%s, assigned_by=%s, assigned_at is not null from tasks where id=%s", (F['m1'], F['m4'], t))[0]
    return (all(r), f"owner = Raad (Company A's account manager): {r[0]}, assigned by the manager: {r[1]}")
@test("D02 Task inside a project without naming anyone → goes to the project owner")
def _(cur):
    p = new_project(cur, owner='m2')
    t = one(cur, "insert into tasks(title,project_id,work_type) values ('Step',%s,'sales') returning id", (p,))
    return (one(cur, "select owner_id=%s from tasks where id=%s", (F['m2'], t)), "owner = project owner")
@test("D03 A team member can't assign or hand over a task to a colleague; the Commercial head can for any of the six departments")
def _(cur):
    q(cur, "select set_config('request.uid', %s, true)", (str(F['u1']),))
    a, m = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type) values ('T',%s,%s,'sales')", (F['coA'], F['m3']), "assign tasks to someone else")
    t = new_task(cur, company='coA', owner='m1')
    b, _ = expect_fail(cur, "update tasks set owner_id=%s where id=%s", (F['m2'], t), "assign tasks to someone else")
    com = one(cur, "select id from departments where code='commercial'")
    q(cur, "select set_config('request.uid', %s, true)", (str(ADMIN),))
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m2'], com))
    q(cur, "select set_config('request.uid', %s, true)", (str(F['u2']),))
    t2 = new_task(cur, company='coA', owner='m3')        # Kareem (Commercial head) assigns into Partnership
    r = q(cur, "select assigned_by=%s from tasks where id=%s", (F['m2'], t2))[0][0]
    return (a and b and r, f"{m} | handover blocked={b} | Commercial head assigned into Partnership, recorded={r}")
@test("D04 The Commercial head finalizes and edits achievements in any of the six departments (visibility switch off)")
def _(cur):
    q(cur, "update work_settings set value='false' where key='open_visibility'")
    com = one(cur, "select id from departments where code='commercial'")
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m2'], com))
    e = achievement(cur, 'kpi_ch', 'apr26', member='m3', final=False)
    other = new_task(cur, company='coA', owner='m3'); as_user(cur, 'u2')
    q(cur, "update report_entries set status='final' where id=%s", (e,))
    sees = one(cur, "select count(*) from tasks where id=%s", (other,))
    q(cur, "reset role"); ok = one(cur, "select status='final' and finalized_by=%s from report_entries where id=%s", (F['m2'], e))
    return (ok and sees == 1, f"finalized Partnership achievement={ok} | sees Partnership task={sees}")
@test("D05 Discount codes: per company, % or fixed SAR, date window, chosen services, purpose; an unknown service → blocked; Direct Payments' own values (reversed dates, 150 %) are NOT refused (D6, R1); expiry shown on the card")
def _(cur):
    q(cur, "insert into promo_codes(code,kind,value_pct,valid_from,valid_to,partner_business_id,services,purpose) values ('COA-HAJJ',%s,%s,'2026-05-01','2026-06-30',%s,%s,'Hajj season staff travel')", ('fixed', 150, F['coA'], ['umrah','flights']))
    a, m1 = expect_fail(cur, "insert into promo_codes(code,kind,value_pct,partner_business_id,services) values ('X1','percent',10,%s,%s)", (F['coA'], ['spaceflight']), "unknown service")
    # R1 CHANGE: these are Direct Payments' columns — the guard must let them through as they come
    q(cur, "insert into promo_codes(code,kind,value_pct,valid_from,valid_to) values ('X2','percent',10,'2026-06-01','2026-05-01')")
    q(cur, "insert into promo_codes(code,kind,value_pct) values ('X3','percent',150)")
    kept = one(cur, "select count(*) from promo_codes where code in ('X2','X3')")
    q(cur, "select set_config('app.today','2026-09-25',true)")
    st = one(cur, "select string_agg((x->>'code')||'='||(x->>'status'), ', ' order by x->>'code') from company_card, jsonb_array_elements(discount_codes) x where business_id=%s", (F['coA'],))
    return (a and kept == 2 and 'COA-HAJJ=expired' in st and 'COA10=active' in st, f"{m1} | Direct Payments' reversed dates / 150 %: kept {kept} of 2 | card: {st}")

# ================= row-level security, run as the real signed-in role =================
@test("R01 Team member on Own sees own tasks, not a colleague's in another department")
def _(cur):
    q(cur, "update work_settings set value='false' where key='open_visibility'")
    mine = new_task(cur, company='coA', owner='m1'); other = new_task(cur, company='coA', owner='m3'); own_tasks(cur, 'u1')
    as_user(cur, 'u1')
    seen = {r[0] for r in q(cur, "select id from tasks")}
    return (mine in seen and other not in seen, f"sees own={mine in seen}, sees other dept's={other in seen}")
@test("R02 Department head on Own sees the whole department, not other departments")
def _(cur):
    q(cur, "update work_settings set value='false' where key='open_visibility'")
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m1'], F['dep_bus']))
    same = new_task(cur, company='coA', owner='m2'); other = new_task(cur, company='coA', owner='m3'); own_tasks(cur, 'u1')
    as_user(cur, 'u1'); seen = {r[0] for r in q(cur, "select id from tasks")}
    return (same in seen and other not in seen, f"sees Kareem's={same in seen}, sees Partnership's={other in seen}")
@test("R03 Manager sees everything; a helper added to a task sees that task")
def _(cur):
    t = new_task(cur, company='coA', owner='m3'); q(cur, "insert into task_people(task_id,member_id,role) values (%s,%s,'helper')", (t, F['m2']))
    as_user(cur, 'u4'); mgr = one(cur, "select count(*) from tasks where id=%s", (t,))
    q(cur, "reset role"); as_user(cur, 'u2'); helper = one(cur, "select count(*) from tasks where id=%s", (t,))
    return (mgr == 1 and helper == 1, f"manager sees={mgr}, helper sees={helper}")
@test("R04 Money follows the Finance page: no Finance access → no invoice links, no project money")
def _(cur):
    q(cur, "update work_settings set value='false' where key='open_visibility'")
    p = new_project(cur); link(cur, 'INV-A26', p)
    q(cur, "update app_users set page_access = page_access - 'finance' where id=%s", (F['u1'],))
    as_user(cur, 'u1'); a = one(cur, "select count(*) from work_finance_links"); b = one(cur, "select count(*) from project_money")
    q(cur, "reset role"); q(cur, "update app_users set page_access = page_access || '{\"finance\":\"viewer\"}' where id=%s", (F['u1'],))
    as_user(cur, 'u1'); c3 = one(cur, "select revenue_sar from project_money where project_id=%s", (p,))
    return (a == 0 and b == 0 and c3 == 10000, f"without Finance: links={a} money rows={b} · with Finance viewer: revenue={c3}")
@test("R05 Team member can't set targets or issue a report; finalizes their own achievement with no proof and no one else's sign-off")
def _(cur):
    as_user(cur, 'u1')
    a, m1 = expect_fail(cur, "insert into kpi_targets(kpi_id,scope,member_id,period_id,target_value) values (%s,'member',%s,%s,5)", (F['kpi_done'], F['m1'], F['apr26']), "row-level security")
    b, m2 = expect_fail(cur, "insert into reports(kind,period_id) values ('monthly',%s)", (F['apr26'],), "row-level security")
    e = one(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title,kpi_id,status) values (%s,%s,%s,'achievement',%s,'Signed 1 channel',%s,'draft') returning id",
            (F['apr26'], F['dep_bus'], F['m1'], F['cat'], F['kpi_man']))
    q(cur, "update report_entries set status='final' where id=%s", (e,))
    q(cur, "reset role"); ok = one(cur, "select status='final' and finalized_by=%s from report_entries where id=%s", (F['m1'], e))
    n = one(cur, "select actual from kpi_actuals where kpi_id=%s and scope='member' and member_id=%s and period_id=%s", (F['kpi_man'], F['m1'], F['apr26']))
    return (a and b and ok and n == 1, f"target blocked={a} | report blocked={b} | own line final={ok}, counts={n}")
@test("R06 Team member can't create a task owned by a colleague; head of that department can")
def _(cur):
    as_user(cur, 'u1')
    a, m = expect_fail(cur, "insert into tasks(title,business_id,owner_id,work_type) values ('T',%s,%s,'sales')", (F['coA'], F['m2']), "assign tasks to someone else")
    q(cur, "reset role"); q(cur, "update departments set head_member_id=%s where id=%s", (F['m1'], F['dep_bus'])); as_user(cur, 'u1')
    t = new_task(cur, company='coA', owner='m2')
    return (a and t is not None, f"{m[:50]} | as head: created")
@test("R07 No 'tasks' page in Team & Access → sees no tasks, not even own")
def _(cur):
    new_task(cur, company='coA', owner='m1'); q(cur, "update app_users set page_access='{}' where id=%s", (F['u1'],))
    as_user(cur, 'u1'); n = one(cur, "select count(*) from tasks")
    return (n == 0, f"tasks visible={n}")
@test("R08 Deactivated login → nothing at all (app_role() is null)")
def _(cur):
    new_task(cur, company='coA', owner='m1'); q(cur, "update app_users set active=false where id=%s", (F['u1'],))
    as_user(cur, 'u1'); n = one(cur, "select count(*) from tasks") + one(cur, "select count(*) from kpi_definitions")
    return (n == 0, f"rows visible={n}")

# ================= v1.2.3: view-only role =================
@test("V01 View-only login sees everything its pages allow (tasks, achievements + proofs trail, KPI scorecard, money, company card) — for export")
def _(cur):
    p = new_project(cur); t = new_task(cur, project=p, include_in_report=True, report_category_id=F['cat'], kpi_id=F['kpi_ch'])
    link(cur, 'INV-A26', p)
    q(cur, "update tasks set status='done', done_at='2026-03-20 10:00+03' where id=%s", (t,))
    q(cur, "update work_settings set value='false' where key='open_visibility'")    # viewer rights don't depend on the switch
    as_user(cur, 'u6')
    got = {k: one(cur, sql) for k, sql in [('tasks', "select count(*) from tasks"), ('trail', "select count(*) from achievement_trail"),
           ('scorecard', "select count(*) from kpi_scorecard"), ('money', "select count(*) from project_money"), ('card', "select count(*) from company_card")]}
    return (all(v and v > 0 for v in got.values()), str(got))
@test("V02 View-only login changes nothing: no task, comment, checklist, status, report line, proof, invoice link, company file or target")
def _(cur):
    p = new_project(cur); t = new_task(cur, project=p)
    e = achievement(cur, 'kpi_ch', 'apr26')
    as_user(cur, 'u6')
    r = [blocked_or_zero(cur, "insert into tasks(title,business_id,owner_id,work_type) values ('T',%s,%s,'sales')", (F['coA'], F['m6'])),
         blocked_or_zero(cur, "update tasks set status='done' where id=%s", (t,)),
         blocked_or_zero(cur, "insert into task_comments(task_id,author_id,body) values (%s,%s,'hi')", (t, F['m6'])),
         blocked_or_zero(cur, "insert into task_checklist(task_id,text) values (%s,'x')", (t,)),
         blocked_or_zero(cur, "insert into report_entries(period_id,department_id,member_id,section,text_en) values (%s,%s,%s,'challenge','x')", (F['apr26'], F['dep_qua'], F['m6'])),
         blocked_or_zero(cur, "update report_entries set status='draft' where id=%s", (e,)),
         blocked_or_zero(cur, "insert into evidence_files(entry_id,storage_path,file_name,uploaded_by) values (%s,'proofs/v.pdf','v.pdf',%s)", (e, F['m6'])),
         blocked_or_zero(cur, "insert into work_finance_links(invoice_no,project_id) values ('INV-A25',%s)", (p,)),
         blocked_or_zero(cur, *doc_sql('coA', 'cr')[:2]),   # R4: a correct path, so it is the permission rule that refuses
         blocked_or_zero(cur, "insert into kpi_targets(kpi_id,scope,period_id,target_value) values (%s,'company',%s,5)", (F['kpi_ch'], F['apr26']))]
    return (all(x[0] for x in r), " · ".join(x[1][:28] for x in r))
@test("V03 Levels are per page: a person on View for Tasks but Full on Clients uploads a company file yet can't touch a task; an unknown level word is refused")
def _(cur):
    q(cur, "update app_users set page_access = page_access || '{\"clients\":\"full\"}' where id=%s", (F['u6'],))
    t = new_task(cur, company='coA')
    as_user(cur, 'u6')
    a = blocked_or_zero(cur, "update tasks set title='x' where id=%s", (t,))
    sq, a1, _p, _i = doc_sql('coA', 'cr', name='cr2.pdf'); cur.execute(sq, a1); up = cur.rowcount
    q(cur, "reset role")
    b, m = expect_fail(cur, "update app_users set page_access = page_access || '{\"tasks\":\"boss\"}' where id=%s", (F['u6'],), "Unknown level")
    return (a[0] and up == 1 and b, f"task: {a[1]} · company file uploaded={up == 1} · {m[:40]}")

# ================= v1.2.3 self-audit probes =================
@test("P01 A team member registers an achievement credited to a colleague (to inflate their KPI) → blocked; typing someone else as 'created by' is ignored")
def _(cur):
    as_user(cur, 'u1')
    a, m = expect_fail(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title,kpi_id) values (%s,%s,%s,'achievement',%s,'x',%s)",
                       (F['apr26'], F['dep_bus'], F['m2'], F['cat'], F['kpi_ch']), "someone else")
    e = one(cur, "insert into report_entries(period_id,department_id,member_id,section,text_en,created_by) values (%s,%s,%s,'challenge','x',%s) returning id", (F['apr26'], F['dep_bus'], F['m1'], F['m2']))
    q(cur, "reset role"); cb = one(cur, "select created_by=%s from report_entries where id=%s", (F['m1'], e))
    return (a and cb, f"{m[:60]} | typed Kareem as creator, recorded Raad={cb}")
@test("P02 The owner moves their own line onto a colleague → blocked; a manager can move it")
def _(cur):
    e = achievement(cur, 'kpi_ch', 'apr26')
    as_user(cur, 'u1')
    a, m = expect_fail(cur, "update report_entries set member_id=%s where id=%s", (F['m2'], e), "someone else")
    q(cur, "reset role"); as_user(cur, 'u4'); q(cur, "update report_entries set member_id=%s where id=%s", (F['m2'], e))
    q(cur, "reset role"); moved = one(cur, "select member_id=%s from report_entries where id=%s", (F['m2'], e))
    return (a and moved, f"{m[:60]} | manager moved it={moved}")
@test("P03 A proof or task file can't be re-pointed to another achievement/task or swapped for another file — only removed")
def _(cur):
    e1 = achievement(cur, 'kpi_ch', 'apr26', proof=True); e2 = achievement(cur, 'kpi_ch', 'apr26')
    t1 = new_task(cur, company='coA'); t2 = new_task(cur, company='coA')
    f = one(cur, "insert into task_files(task_id,storage_path,file_name,uploaded_by) values (%s,'task-files/a.pdf','a.pdf',%s) returning id", (t1, F['m1']))
    as_user(cur, 'u1')
    a, m1 = expect_fail(cur, "update evidence_files set entry_id=%s where entry_id=%s", (e2, e1), "only be removed")
    b, m2 = expect_fail(cur, "update task_files set task_id=%s where id=%s", (t2, f), "only be removed")
    c3, m3 = expect_fail(cur, "update task_files set storage_path='task-files/b.pdf' where id=%s", (f,), "only be removed")
    cur.execute("update evidence_files set deleted_at=now() where entry_id=%s", (e1,)); rm = cur.rowcount
    return (a and b and c3 and rm == 1, f"{m1[:45]} · task move blocked={b} · swap blocked={c3} · removal ok={rm == 1}")
@test("P04 Once the month is issued, its achievements' proofs can't be removed or added")
def _(cur):
    e = achievement(cur, 'kpi_ch', 'mar26', proof=True)
    q(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued','{}',now(),%s)", (F['mar26'], F['m4']))
    a, m1 = expect_fail(cur, "update evidence_files set deleted_at=now() where entry_id=%s", (e,), "issued")
    b, m2 = expect_fail(cur, "insert into evidence_files(entry_id,storage_path,file_name,uploaded_by) values (%s,'proofs/late.pdf','late.pdf',%s)", (e, F['m1']), "issued")
    return (a and b, f"{m1[:60]} | add blocked={b}")
@test("P05 A helper closing the owner's task registers the achievement to the owner, as a draft the owner finalizes (credit never decided by a helper)")
def _(cur):
    t = new_task(cur, company='coA', owner='m1', include_in_report=True, report_category_id=F['cat'], kpi_id=F['kpi_ch'])
    q(cur, "insert into task_people(task_id,member_id,role) values (%s,%s,'helper')", (t, F['m2']))
    as_user(cur, 'u2'); q(cur, "update tasks set status='done', done_at='2026-04-20 10:00+03' where id=%s", (t,))
    q(cur, "reset role"); r = q(cur, "select member_id=%s, status from report_entries where source_id=%s", (F['m1'], t))
    return (r == [(True, 'draft')], f"credited to owner, waits as draft: {r}")

@test("P06 D7 back door: a colleague on Full closes Raad's task → the achievement waits as a draft for Raad or his manager; a colleague can't reopen a task whose achievement is final")
def _(cur):
    t = new_task(cur, company='coA', owner='m1', include_in_report=True, report_category_id=F['cat'], kpi_id=F['kpi_ch'])
    as_user(cur, 'u2'); q(cur, "update tasks set status='done', done_at='2026-04-20 10:00+03' where id=%s", (t,))
    q(cur, "reset role"); st = one(cur, "select status from report_entries where source_id=%s", (t,))
    as_user(cur, 'u1'); q(cur, "update report_entries set status='final' where source_id=%s", (t,))
    q(cur, "reset role"); fin = one(cur, "select status||'/'||(finalized_by=%s)::text from report_entries where source_id=%s", (F['m1'], t))
    as_user(cur, 'u2')
    a, m = expect_fail(cur, "update tasks set status='in_progress' where id=%s", (t,), "final")
    q(cur, "reset role"); kept = one(cur, "select count(*) from report_entries where source_id=%s", (t,))
    return (st == 'draft' and fin == 'final/true' and a and kept == 1, f"closed by colleague → {st} | Raad finalized → {fin} | colleague reopen: {m[:55]} | kept={kept}")

@test("P07 A sign-in with no team-member record (e.g. a shared login), even on Full for Tasks and Reports, can't reassign a task or credit an achievement to anyone")
def _(cur):
    task = new_task(cur, company='coA', owner='m1')
    sh = one(cur, "insert into app_users(email,full_name,role,page_access) values ('shared@x.test','Shared','team_member',%s) returning id", (MGR_PAGE,))
    q(cur, "set local role authenticated"); q(cur, "select set_config('request.uid', %s, true)", (str(sh),))
    a, m1 = expect_fail(cur, "update tasks set owner_id=%s where id=%s", (F['m3'], task), "assign")
    b, m2 = expect_fail(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title,kpi_id) values (%s,%s,%s,'achievement',%s,'x',%s)",
                        (F['apr26'], F['dep_bus'], F['m1'], F['cat'], F['kpi_ch']), "credit")
    return (a and b, f"reassign: {m1[:60]} · credit: {m2[:60]}")


# ======================= RELEASE 1 — the corrections the live check found =======================
# (docs/PHASE3_SCHEMA_CHECK_2026-09-25.md). Each goes red on the design as written (29a) — run
# this file against 29a to see them fail: that is their sabotage.

@test("R1-01 Numbering: an employee NOT on the Generator creates a task and a project (TSK/PRJ codes); no Tasks page → refused; unknown family refused; the Generator's own numbering still refuses them")
def _(cur):
    as_user(cur, 'u1')
    t = one(cur, "insert into tasks(title,business_id,owner_id,work_type) values ('R1 task',%s,%s,'sales') returning code", (F['coA'], F['m1']))
    p = one(cur, "insert into projects(name,business_id,owner_id,work_type) values ('R1 project',%s,%s,'sales') returning code", (F['coA'], F['m1']))
    a, m1 = expect_fail(cur, "select next_work_number('INV')", None, "unknown work number family")
    b, m2 = expect_fail(cur, "select next_document_number('PRP')", None, "Generator")
    q(cur, "reset role"); q(cur, "update app_users set page_access = page_access - 'tasks' where id=%s", (F['u1'],))
    as_user(cur, 'u1')
    c, m3 = expect_fail(cur, "select next_work_number('TSK')", None, "works on the Tasks page")
    ok = bool(t and t.startswith('TSK-')) and bool(p and p.startswith('PRJ-')) and a and b and c
    return (ok, f"task {t} · project {p} · INV: {m1[:40]} · Generator: {m2[:45]} · no Tasks page: {m3[:50]}")

@test("R1-02 Not signed in (anon) cannot call changes_to_my_tasks or next_work_number")
def _(cur):
    q(cur, "set local role anon"); q(cur, "select set_config('request.uid', '', true)")
    a, m1 = expect_fail(cur, "select * from changes_to_my_tasks(7)", None, "permission denied")
    b, m2 = expect_fail(cur, "select next_work_number('TSK')", None, "permission denied")
    return (a and b, f"changes_to_my_tasks: {m1[:50]} · next_work_number: {m2[:50]}")

@test("R1-03 History is for admins and managers (owner, 27 Sep — superseding 'history follows the Tasks page'): a colleague on Own, one without the Tasks page, the owner and a View login read none of a task's history; the manager reads it; the owner is still told of a colleague's change through changes_to_my_tasks")
def _(cur):
    t = new_task(cur, company='coA', owner='m1')
    as_user(cur, 'u4'); q(cur, "update tasks set title='R1 renamed' where id=%s", (t,)); q(cur, "reset role")
    q(cur, "update work_settings set value='false' where key='open_visibility'")
    own_tasks(cur, 'u3')
    count = lambda: one(cur, "select count(*) from record_history where table_name='tasks' and record_id=%s", (t,))
    as_user(cur, 'u3'); other = count(); q(cur, "reset role")
    q(cur, "update app_users set page_access = page_access - 'tasks' where id=%s", (F['u2'],))
    as_user(cur, 'u2'); nopage = count(); q(cur, "reset role")
    as_user(cur, 'u1'); owner = count(); told = one(cur, "select count(*) from changes_to_my_tasks(7) where task_id=%s and action='edit'", (t,)); q(cur, "reset role")
    as_user(cur, 'u6'); viewer = count(); q(cur, "reset role")
    as_user(cur, 'u4'); mgr = count(); q(cur, "reset role")
    return (other == 0 and nopage == 0 and owner == 0 and viewer == 0 and mgr >= 2 and told == 1,
            f"colleague on Own={other} · no Tasks page={nopage} · owner={owner} · View={viewer} · manager={mgr} · owner told={told}")

@test("R1-04 Undo knows tasks: the owner undoes their own edit (title comes back); a colleague cannot undo someone else's; a NON-owner on Own cannot undo (needs Full) — the owner on Own may (D7 ruling, U-03)")
def _(cur):
    t = new_task(cur, company='coA', owner='m1')
    q(cur, "update tasks set title='Original' where id=%s", (t,))
    as_user(cur, 'u1'); q(cur, "update tasks set title='Changed by Raad' where id=%s", (t,)); q(cur, "reset role")
    h = one(cur, "select max(id) from record_history where table_name='tasks' and record_id=%s and actor=%s", (t, F['u1']))
    as_user(cur, 'u2'); other = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    own_tasks(cur, 'u3')
    as_user(cur, 'u3'); on_own = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    as_user(cur, 'u1'); mine = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    title = one(cur, "select title from tasks where id=%s", (t,))
    ok = mine == 'ok' and title == 'Original' and 'own changes' in (other or '') and 'full control of the Tasks' in (on_own or '')
    return (ok, f"owner: {mine} → '{title}' · colleague: {(other or '')[:45]} · non-owner on Own: {(on_own or '')[:45]}")

@test("R1-05 Company owner through the live resolver: account manager written as an e-mail prefix or an Arabic name resolves; a name two accounts share resolves to nobody")
def _(cur):
    q(cur, "update app_users set name_ar='رعد' where id=%s", (F['u1'],))
    b1 = one(cur, "insert into businesses(name,is_client,account_manager) values ('R1 prefix',true,'u1') returning id")
    b2 = one(cur, "insert into businesses(name,is_client,account_manager) values ('R1 arabic',true,'رعد') returning id")
    q(cur, "insert into app_users(email,full_name,role) values ('twin1@x.test','Twin Name','team_member'),('twin2@x.test','Twin Name','team_member')")
    b3 = one(cur, "insert into businesses(name,is_client,account_manager) values ('R1 twin',true,'Twin Name') returning id")
    r = [one(cur, "select company_owner_member(%s)=%s", (b1, F['m1'])), one(cur, "select company_owner_member(%s)=%s", (b2, F['m1'])),
         one(cur, "select company_owner_member(%s) is null", (b3,))]
    return (r == [True, True, True], f"prefix={r[0]} arabic={r[1]} ambiguous→nobody={r[2]}")

# (release 2, 2026-09-26: "nobody gets Reports by default" was release 1's hold-back, lifted by design — R2-01 checks the Reports level now)
@test("R1-06 Starting grids: a new manager keeps the Generator and gets Tasks; a new employee gets Tasks")
def _(cur):
    m = one(cur, "insert into app_users(email,full_name,role) values ('newmgr@x.test','New Manager','manager') returning page_access")
    e = one(cur, "insert into app_users(email,full_name,role) values ('newemp@x.test','New Employee','team_member') returning page_access")
    ok = m.get('documents') == 'full' and m.get('tasks') == 'full' and e.get('tasks') == 'full'
    return (ok, f"manager documents={m.get('documents')} tasks={m.get('tasks')} reports={m.get('reports')} · employee tasks={e.get('tasks')} reports={e.get('reports')}")


@test("R1-07 An import from Direct Payments is never refused: every Direct Payments column, any value (unknown kind, no value, 0 %, 150 %, reversed dates), inserted and re-imported (upsert by code) with no signed-in person AND as a signed-in admin; a company merge re-points codes; only a change to OUR `services` column is checked")
def _(cur):
    rows = [('IMP-1','percent',10,'2025-01-01','2025-12-31'), ('IMP-2','fixed',250,'2024-06-01','2024-07-01'), ('IMP-3','percent',None,None,None),
            ('IMP-4','bogo',5,'2026-01-01','2026-12-31'), ('IMP-5','percent',0,'2026-01-01','2026-12-31'), ('IMP-6','percent',150,'2026-06-01','2026-05-01')]
    ins = """insert into promo_codes(code,slug,kind,value_pct,valid_from,valid_to,total_sales_sar,total_discount_sar,active,expired,created_by,notes)
             values (%s,lower(%s),%s,%s,%s,%s,1000,100,true,false,'Import person','import replay')
             on conflict (code) do update set kind=excluded.kind, value_pct=excluded.value_pct, valid_from=excluded.valid_from, valid_to=excluded.valid_to,
               total_sales_sar=excluded.total_sales_sar, total_discount_sar=excluded.total_discount_sar, active=excluded.active, expired=excluded.expired, notes=excluded.notes"""
    q(cur, "select set_config('request.uid', '', true)")                     # the import: nobody signed in
    for r in rows: q(cur, ins, (r[0], r[0]) + r[1:])
    for r in rows: q(cur, ins, (r[0], r[0]) + r[1:])                          # the same file imported again
    q(cur, "update promo_codes set services = array['flights'] where code='IMP-1'")   # our column, set once by the app
    for r in rows: q(cur, ins, (r[0], r[0]) + r[1:])                          # re-import after the app set services: untouched
    after_anon = one(cur, "select count(*) from promo_codes where code like 'IMP-%%'")
    q(cur, "select set_config('request.uid', %s, true)", (str(F['admin']),))  # the same import, run as a signed-in admin
    for r in rows: q(cur, ins, (r[0], r[0]) + r[1:])
    q(cur, "update promo_codes set partner_business_id=%s where code in ('IMP-1','IMP-2')", (F['coA'],))
    q(cur, "update promo_codes set partner_business_id=%s where partner_business_id=%s", (F['coB'], F['coA']))   # what fn_merge_businesses does
    moved = one(cur, "select count(*) from promo_codes where code in ('IMP-1','IMP-2') and partner_business_id=%s", (F['coB'],))
    svc_ok = one(cur, "select services from promo_codes where code='IMP-1'")
    bad, m = expect_fail(cur, "update promo_codes set services = array['spaceflight'] where code='IMP-2'", None, "unknown service")
    return (after_anon == 6 and moved == 2 and svc_ok == ['flights'] and bad,
            f"imported 6 (3 passes, no one signed in) → {after_anon} rows · as admin: ok · merge re-pointed {moved} · services kept {svc_ok} · our column checked: {m[:45]}")


# ======================= D7 Undo — owner's ruling 2026-09-25 (scripts/sql/d7-owner-can-undo.sql) =======================
@test("U-01 Tasks: a colleague changes Raad's task; Raad (an ordinary employee, the OWNER) undoes it; a third colleague cannot; the undo is recorded")
def _(cur):
    t = new_task(cur, company='coA', owner='m1')
    q(cur, "update tasks set title='Original' where id=%s", (t,))
    as_user(cur, 'u2'); q(cur, "update tasks set title='Changed by Kareem' where id=%s", (t,)); q(cur, "reset role")
    h = one(cur, "select max(id) from record_history where table_name='tasks' and record_id=%s and actor=%s", (t, F['u2']))
    as_user(cur, 'u3'); third = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    as_user(cur, 'u1'); owner = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    title = one(cur, "select title from tasks where id=%s", (t,)); by = one(cur, "select undone_by=%s from record_history where id=%s", (F['u1'], h))
    return (owner == 'ok' and title == 'Original' and by and 'own changes' in (third or ''), f"owner: {owner} → '{title}' (recorded={by}) · third colleague: {(third or '')[:60]}")

@test("U-02 Companies: a colleague changes a company Raad OWNS (owner_id); Raad undoes it; a third colleague cannot; a contact follows its company")
def _(cur):
    b = one(cur, "insert into businesses(name,is_client,owner_id) values ('Owned Co',true,%s) returning id", (F['u1'],))
    c = one(cur, "insert into contacts(business_id,name) values (%s,'Person') returning id", (b,))
    as_user(cur, 'u2'); q(cur, "update businesses set name='Renamed by Kareem' where id=%s", (b,)); q(cur, "update contacts set name='Changed person' where id=%s", (c,)); q(cur, "reset role")
    hb = one(cur, "select max(id) from record_history where table_name='businesses' and record_id=%s and actor=%s", (b, F['u2']))
    hc = one(cur, "select max(id) from record_history where table_name='contacts' and record_id=%s and actor=%s", (c, F['u2']))
    as_user(cur, 'u3'); third = one(cur, "select undo_change(%s)", (hb,)); q(cur, "reset role")
    as_user(cur, 'u1'); ob = one(cur, "select undo_change(%s)", (hb,)); oc = one(cur, "select undo_change(%s)", (hc,)); q(cur, "reset role")
    name = one(cur, "select name from businesses where id=%s", (b,)); pn = one(cur, "select name from contacts where id=%s", (c,))
    return (ob == 'ok' and oc == 'ok' and name == 'Owned Co' and pn == 'Person' and 'own changes' in (third or ''), f"owner: company {ob} → '{name}', contact {oc} → '{pn}' · third: {(third or '')[:50]}")

@test("U-03 The owner on Own work (not Full) can still undo a change to their own task; not the owner on Own cannot; money stays admin/manager")
def _(cur):
    t = new_task(cur, company='coA', owner='m1')
    as_user(cur, 'u2'); q(cur, "update tasks set title='Kareem again' where id=%s", (t,)); q(cur, "reset role")
    h = one(cur, "select max(id) from record_history where table_name='tasks' and record_id=%s and actor=%s", (t, F['u2']))
    own_tasks(cur, 'u1', 'u3')
    as_user(cur, 'u3'); third = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    as_user(cur, 'u1'); owner = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    return (owner == 'ok' and 'full control' in (third or ''), f"owner on Own: {owner} · third on Own: {(third or '')[:60]}")

# ======================= Team & Access → the team list (scripts/sql/team-list-editing.sql) =======================
def new_login(cur, email, active=True):
    return one(cur, "insert into app_users(email,full_name,role,active) values (%s,%s,'team_member',%s) returning id", (email, email.split('@')[0], active))

@test("T-01 An employee cannot add anyone, move anyone or set a head; a manager can, and each change is in the history with the manager's name")
def _(cur):
    newbie = new_login(cur, 'newbie@x.test')
    as_user(cur, 'u1')
    a, m = expect_fail(cur, "insert into team_members(user_id,department_id) values (%s,%s)", (newbie, F['dep_bus']), "row-level security")
    q(cur, "update team_members set department_id=%s where id=%s", (F['dep_par'], F['m2'])); moved_by_emp = one(cur, "select department_id=%s from team_members where id=%s", (F['dep_par'], F['m2']))
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m1'], F['dep_bus'])); head_by_emp = one(cur, "select head_member_id=%s from departments where id=%s", (F['m1'], F['dep_bus']))
    q(cur, "reset role"); as_user(cur, 'u4')
    nm = one(cur, "insert into team_members(user_id,department_id) values (%s,%s) returning id", (newbie, F['dep_bus']))
    q(cur, "update team_members set department_id=%s where id=%s", (F['dep_par'], F['m2']))
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m1'], F['dep_bus'])); q(cur, "reset role")
    moved = one(cur, "select department_id=%s from team_members where id=%s", (F['dep_par'], F['m2'])); head = one(cur, "select head_member_id=%s from departments where id=%s", (F['m1'], F['dep_bus']))
    hist = one(cur, "select count(*) from record_history where actor=%s and ((table_name='team_members' and record_id in (%s,%s)) or (table_name='departments' and record_id=%s))", (F['u4'], nm, F['m2'], F['dep_bus']))
    return (a and not moved_by_emp and not head_by_emp and nm and moved and head and hist == 3,
            f"employee: add refused ({m[:40]}), move took={moved_by_emp}, head took={head_by_emp} · manager: added, moved={moved}, head={head}, history rows as the manager={hist}")

@test("T-02 Teams (owner's order 2026-09-27): a manager renames a team; nobody switches off a team that still has open work or people, nor deletes one — not even an admin; an employee changes nothing; only an admin removes a team-list row")
def _(cur):
    as_user(cur, 'u4')
    q(cur, "update departments set name_en='Renamed' where id=%s", (F['dep_bus'],))
    renamed = one(cur, "select name_en from departments where id=%s", (F['dep_bus'],))
    b, m2 = expect_fail(cur, "update departments set active=false where id=%s", (F['dep_bus'],), "use retire")
    q(cur, "delete from team_members where id=%s", (F['m6'],)); still = one(cur, "select count(*) from team_members where id=%s", (F['m6'],))
    q(cur, "reset role"); as_user(cur, 'admin')
    c, m3 = blocked_or_zero(cur, "delete from departments where id=%s", (F['dep_str'],))   # no delete rule: RLS removes nothing
    c = c and one(cur, "select count(*) from departments where id=%s", (F['dep_str'],)) == 1
    q(cur, "reset role"); as_user(cur, 'u1')
    e, _m = blocked_or_zero(cur, "update departments set name_en='Employee rename' where id=%s", (F['dep_par'],))
    q(cur, "reset role")
    return (renamed == 'Renamed' and b and still == 1 and c and e, f"manager renamed → {renamed} · retire with people refused={b} · manager delete left row={still} · admin delete refused={c} · employee rename blocked={e}")
@test("T-03 Guards: the head must be active; a head cannot be made inactive until replaced; inactive stamps the leaving date and active clears it; an entry never moves to another login; an inactive login is not added")
def _(cur):
    as_user(cur, 'u4')
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m3'], F['dep_par']))
    a, m1 = expect_fail(cur, "update team_members set active=false where id=%s", (F['m3'],), "choose a new head first")
    q(cur, "update departments set head_member_id=%s where id=%s", (F['m4'], F['dep_par']))
    q(cur, "update team_members set active=false where id=%s", (F['m3'],)); left = one(cur, "select left_on=current_date from team_members where id=%s", (F['m3'],))
    b, m2 = expect_fail(cur, "update departments set head_member_id=%s where id=%s", (F['m3'], F['dep_par']), "active person")
    q(cur, "update team_members set active=true where id=%s", (F['m3'],)); cleared = one(cur, "select left_on is null from team_members where id=%s", (F['m3'],))
    c, m3 = expect_fail(cur, "update team_members set user_id=%s where id=%s", (F['u5'], F['m3']), "stays with its login")
    q(cur, "reset role"); gone = new_login(cur, 'gone@x.test', active=False); as_user(cur, 'u4')
    d, m4 = expect_fail(cur, "insert into team_members(user_id,department_id) values (%s,%s)", (gone, F['dep_bus']), "active login")
    return (a and left and b and cleared and c and d, f"{m1[:45]} · left_on stamped={left} · {m2[:40]} · cleared={cleared} · {m3[:30]} · {m4[:35]}")

@test("T-04 Someone on View (Quality) and a signed-out caller change nothing on the team list")
def _(cur):
    as_user(cur, 'u6')
    q(cur, "update team_members set active=false where id=%s", (F['m5'],)); q(cur, "update departments set head_member_id=%s where id=%s", (F['m6'], F['dep_qua']))
    q(cur, "reset role")
    act = one(cur, "select active from team_members where id=%s", (F['m5'],)); hd = one(cur, "select head_member_id is null from departments where id=%s", (F['dep_qua'],))
    q(cur, "set local role anon"); q(cur, "select set_config('request.uid', '', true)")
    a, m = expect_fail(cur, "update team_members set active=false where id=%s returning id", (F['m5'],), "")
    q(cur, "reset role"); act2 = one(cur, "select active from team_members where id=%s", (F['m5'],))
    return (act and hd and act2, f"view: still active={act}, head unchanged={hd} · anon: still active={act2} ({m[:40]})")

# ======================= Release 2 — achievements + proofs (scripts/sql/phase3-r2-achievements.sql) =======================
def my_entry(cur, who='u1', member='m1', key=None):
    as_user(cur, who)
    e = one(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title,import_key) values (%s,(select department_id from team_members where id=%s),%s,'achievement',%s,'Mine',%s) returning id",
            (F['mar26'], F[member], F[member], F['cat'], key))
    q(cur, "reset role"); return e

@test("R2-01 A new login gets the Reports page at the design's level: employee Own work, manager Full control")
def _(cur):
    e = one(cur, "insert into app_users(email,full_name,role) values ('new.emp@x.test','New Emp','team_member') returning page_access->>'reports'")
    m = one(cur, "insert into app_users(email,full_name,role) values ('new.mgr@x.test','New Mgr','manager') returning page_access->>'reports'")
    t = one(cur, "select page_access->>'tasks' from app_users where email='new.emp@x.test'")
    return (e == 'own' and m == 'full' and t == 'full', f"employee reports={e} (tasks still {t}) · manager reports={m}")

@test("R2-02 Moving a browser's achievements in is safe to press twice: the same record id adds nothing the second time")
def _(cur):
    my_entry(cur, key='local-a_1')
    as_user(cur, 'u1')
    q(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title,import_key) values (%s,(select department_id from team_members where id=%s),%s,'achievement',%s,'Again',%s) on conflict (import_key) where import_key is not null do nothing", (F['mar26'], F['m1'], F['m1'], F['cat'], 'local-a_1'))
    q(cur, "reset role")
    n = one(cur, "select count(*) from report_entries where import_key='local-a_1'")
    return (n == 1, f"rows with that record id after two presses = {n}")

@test("R2-03 Proofs: the achievement's own person adds a proof file; a colleague on Own cannot add to it; a stray path is refused")
def _(cur):
    e = my_entry(cur)
    as_user(cur, 'u1'); q(cur, "insert into storage.objects(bucket_id,name) values ('proofs',%s)", (f'proofs/{e}/contract.pdf',)); q(cur, "reset role")
    own_ok = one(cur, "select count(*) from storage.objects where name=%s", (f'proofs/{e}/contract.pdf',))
    own_tasks(cur, 'u2'); q(cur, "update app_users set page_access = page_access || '{\"reports\":\"own\"}' where id=%s", (F['u2'],))
    as_user(cur, 'u2')
    a, m1 = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('proofs',%s)", (f'proofs/{e}/sneaky.pdf',), "row-level security")
    b, m2 = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('proofs','elsewhere/x.pdf')", None, "row-level security")
    c, m3 = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('proofs','proofs/not-a-uuid/x.pdf')", None, "row-level security")
    q(cur, "reset role")
    return (own_ok == 1 and a and b and c, f"own added={own_ok} · colleague: {m1[:40]} · stray path refused={b} · bad id refused={c}")

@test("R2-04 Proofs: someone on View reads them but adds none; a signed-out caller reads nothing; nobody overwrites or deletes a stored proof")
def _(cur):
    e = my_entry(cur)
    as_user(cur, 'u1'); q(cur, "insert into storage.objects(bucket_id,name) values ('proofs',%s)", (f'proofs/{e}/p.pdf',)); q(cur, "reset role")
    as_user(cur, 'u6')
    seen = one(cur, "select count(*) from storage.objects where bucket_id='proofs'")
    a, m = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('proofs',%s)", (f'proofs/{e}/v.pdf',), "row-level security")
    q(cur, "reset role"); as_user(cur, 'u1')
    q(cur, "update storage.objects set name=%s where bucket_id='proofs'", (f'proofs/{e}/swapped.pdf',))
    q(cur, "delete from storage.objects where bucket_id='proofs'")
    q(cur, "reset role")
    kept = one(cur, "select count(*) from storage.objects where name=%s", (f'proofs/{e}/p.pdf',))
    q(cur, "savepoint an"); q(cur, "set local role anon"); q(cur, "select set_config('request.uid', '', true)")
    try: anon_seen = one(cur, "select count(*) from storage.objects where bucket_id='proofs'")
    except psycopg2.Error: anon_seen = 0
    q(cur, "rollback to savepoint an"); q(cur, "reset role")
    return (seen == 1 and a and kept == 1 and anon_seen == 0, f"view sees={seen}, add refused={a} · owner's overwrite/delete left it in place={kept == 1} · anon sees={anon_seen}")

# ======================= Release 3 — KPIs + danger light (scripts/sql/phase3-r3-kpis.sql) =======================
@test("R3-01 Targets (D2): a manager with Full control on Reports sets one; a manager set to View on Reports and an employee change nothing")
def _(cur):
    per = F['q1_26']
    as_user(cur, 'u4'); q(cur, "insert into kpi_targets(kpi_id,scope,period_id,target_value) values (%s,'company',%s,12)", (F['kpi_ch'], per)); q(cur, "reset role")
    set_ok = one(cur, "select target_value from kpi_targets where kpi_id=%s and scope='company' and period_id=%s", (F['kpi_ch'], per))
    q(cur, "update app_users set page_access = page_access || '{\"reports\":\"view\"}' where id=%s", (F['u4'],))
    as_user(cur, 'u4')
    q(cur, "update kpi_targets set target_value=99 where kpi_id=%s and period_id=%s", (F['kpi_ch'], per))
    a, m = expect_fail(cur, "insert into kpi_targets(kpi_id,scope,period_id,target_value) values (%s,'company',%s,5)", (F['kpi_ch'], F['feb26']), "row-level security")
    q(cur, "update kpi_definitions set name_en='renamed by view' where id=%s", (F['kpi_ch'],))
    q(cur, "reset role"); as_user(cur, 'u1')
    q(cur, "update kpi_targets set target_value=77 where kpi_id=%s and period_id=%s", (F['kpi_ch'], per))
    b, m2 = expect_fail(cur, "insert into kpi_targets(kpi_id,scope,period_id,target_value) values (%s,'company',%s,5)", (F['kpi_ch'], F['feb26']), "row-level security")
    q(cur, "reset role")
    after = one(cur, "select target_value from kpi_targets where kpi_id=%s and scope='company' and period_id=%s", (F['kpi_ch'], per))
    name = one(cur, "select name_en from kpi_definitions where id=%s", (F['kpi_ch'],))
    return (set_ok == 12 and after == 12 and a and b and name != 'renamed by view', f"full manager set={set_ok} · view manager: update left {after}, insert refused={a}, rename kept={name != 'renamed by view'} · employee insert refused={b}")

@test("R3-02 Objectives and initiatives (D2): a manager with Full control on Reports adds and edits them; the same manager on View on Reports changes nothing")
def _(cur):
    as_user(cur, 'u4')
    o = one(cur, "insert into objectives(year,n,title_en) values (2031,1,'Full manager objective') returning id")
    i = one(cur, "insert into initiatives(year,n,title_en,objective_id) values (2031,1,'Full manager initiative',%s) returning id", (o,))
    q(cur, "update objectives set title_en='Edited by full' where id=%s", (o,)); q(cur, "update initiatives set title_en='Edited by full' where id=%s", (i,))
    q(cur, "reset role")
    full_ok = one(cur, "select (select title_en from objectives where id=%s)='Edited by full' and (select title_en from initiatives where id=%s)='Edited by full'", (o, i))
    q(cur, "update app_users set page_access = page_access || '{\"reports\":\"view\"}' where id=%s", (F['u4'],))
    as_user(cur, 'u4')
    a, m1 = expect_fail(cur, "insert into objectives(year,n,title_en) values (2031,2,'View manager objective')", None, "row-level security")
    b, m2 = expect_fail(cur, "insert into initiatives(year,n,title_en,objective_id) values (2031,2,'View manager initiative',%s)", (o,), "row-level security")
    q(cur, "update objectives set title_en='Edited by view' where id=%s", (o,)); q(cur, "update initiatives set title_en='Edited by view' where id=%s", (i,))
    q(cur, "reset role")
    kept = one(cur, "select (select title_en from objectives where id=%s)='Edited by full' and (select title_en from initiatives where id=%s)='Edited by full'", (o, i))
    return (full_ok and a and b and kept, f"full manager added+edited={full_ok} · view manager: objective insert refused={a}, initiative insert refused={b}, edits left untouched={kept}")

@test("R2-05 A proof FILE for an achievement in an issued month is refused at the store itself — not only its evidence row")
def _(cur):
    e = my_entry(cur)
    as_user(cur, 'u1'); q(cur, "insert into storage.objects(bucket_id,name) values ('proofs',%s)", (f'proofs/{e}/before-issue.pdf',)); q(cur, "reset role")
    before = one(cur, "select count(*) from storage.objects where name=%s", (f'proofs/{e}/before-issue.pdf',))
    q(cur, "update periods set locked_at=now() where id=%s", (F['mar26'],))
    as_user(cur, 'u1')
    a, m = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('proofs',%s)", (f'proofs/{e}/after-issue.pdf',), "row-level security")
    q(cur, "reset role"); as_user(cur, 'u4')   # a manager with Full control is refused too — the month is closed for everyone
    b, m2 = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('proofs',%s)", (f'proofs/{e}/manager-after.pdf',), "row-level security")
    q(cur, "reset role")
    return (before == 1 and a and b, f"before the month was issued: stored={before} · after: owner refused={a} ({m[:40]}), full manager refused={b}")


# ================= release 4 — the company card (2026-09-26) =================
def store(cur, path):   # a file put in the private store at this path, as whoever is acting
    q(cur, "insert into storage.objects(bucket_id,name) values ('company-docs',%s)", (path,))
def seen_file(cur, path): return one(cur, "select count(*) from storage.objects where bucket_id='company-docs' and name=%s", (path,))

@test("R4-01 Client IDs (E): any number per company — a 4th and 5th tender are fine; still one OPEN prepaid and one OPEN postpaid; unique across companies, spaces and all; only an admin or a manager adds one")
def _(cur):
    as_user(cur, 'u1')
    t, m0 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1009','tender','active')", (F['coA'],), "row-level security")
    q(cur, "reset role"); as_user(cur, 'u4')
    q(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1004','tender','active')", (F['coA'],))
    q(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,' C-1005 ','tender','active')", (F['coA'],))
    n = one(cur, "select count(*) from client_profiles where business_id=%s and closed_at is null", (F['coA'],))
    a, m1 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1006','prepaid','active')", (F['coA'],), "one_open_prepaid_postpaid")
    b, m2 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1001','tender','active')", (F['coB'],), "unique")
    c, m3 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'  C-1001 ','tender','active')", (F['coB'],), "unique")
    d, m4 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'   ','tender','active')", (F['coB'],), "needs the number")
    stored = one(cur, "select direct_client_id from client_profiles where direct_client_id like '%%C-1005%%'")
    q(cur, "reset role")
    return (t and n == 5 and a and b and c and d and stored == 'C-1005', f"team member refused={t} · manager added a 4th and 5th tender → {n} open · second open prepaid refused={a} · same ID on another company refused={b} · with spaces refused={c} · blank refused={d} · stored as {stored!r}")

@test("R4-02 View on Clients changes nothing on the company card: no client ID, no file row, no stored file, no discount link")
def _(cur):
    code = one(cur, "insert into promo_codes(code,kind,value_pct) values ('B2C-V','percent',5) returning id")
    sq, a1, path, _i = doc_sql('coA', 'cr')
    as_user(cur, 'u6')
    r = [blocked_or_zero(cur, "insert into client_profiles(business_id,direct_client_id,profile_type) values (%s,'V-1','tender')", (F['coB'],)),
         blocked_or_zero(cur, sq, a1),
         blocked_or_zero(cur, "insert into storage.objects(bucket_id,name) values ('company-docs',%s)", (path,)),
         blocked_or_zero(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s)", (F['coA'], code))]
    q(cur, "reset role")
    return (all(x[0] for x in r), " · ".join(x[1][:30] for x in r))

@test("R4-03 IBAN letters and agreements: a team member may file one but can read neither the row nor the file; a manager reads both; a CR is read at the Clients level (View too)")
def _(cur):
    sq, a1, iban_path, iban = doc_sql('coA', 'iban', name='iban.pdf')
    sq2, a2, cr_path, cr = doc_sql('coA', 'cr', name='cr.pdf')
    as_user(cur, 'u1'); q(cur, sq, a1); store(cur, iban_path); q(cur, sq2, a2); store(cur, cr_path)
    u1_row, u1_file = one(cur, "select count(*) from company_documents where id=%s", (iban,)), seen_file(cur, iban_path)
    u1_cr = seen_file(cur, cr_path)
    agr = doc_sql('coA', 'agreement', name='agr.pdf'); q(cur, agr[0], agr[1]); store(cur, agr[2])
    u1_agr = seen_file(cur, agr[2]) + one(cur, "select count(*) from company_documents where id=%s", (agr[3],))
    presence = one(cur, "select company_documents_presence(%s)", (F['coA'],))
    q(cur, "reset role"); as_user(cur, 'u4')
    m_row, m_file, m_agr = one(cur, "select count(*) from company_documents where id=%s", (iban,)), seen_file(cur, iban_path), seen_file(cur, agr[2])
    q(cur, "reset role"); as_user(cur, 'u6')
    v_cr, v_iban = seen_file(cur, cr_path), seen_file(cur, iban_path)
    q(cur, "reset role")
    ok = (u1_row, u1_file, u1_agr, u1_cr, m_row, m_file, m_agr, v_cr, v_iban) == (0, 0, 0, 1, 1, 1, 1, 1, 0) and presence.get('iban') == 1 and presence.get('agreement') == 1
    return (ok, f"team member: IBAN row={u1_row} file={u1_file}, agreement={u1_agr}, CR file={u1_cr}, sees 'on file' counts={presence} · manager: IBAN row={m_row} file={m_file} agreement={m_agr} · View: CR={v_cr} IBAN={v_iban}")

@test("R4-04 The store takes a client file only at its own row's path, once, from whoever wrote the row — never overwritten, never deleted, never elsewhere")
def _(cur):
    sq, a1, path, i = doc_sql('coA', 'cr')
    as_user(cur, 'u1'); q(cur, sq, a1)
    a, m1 = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('company-docs',%s)", (f"clients/{F['coA']}/{_uuid.uuid4()}/stray.pdf",), "row-level security")
    q(cur, "reset role"); as_user(cur, 'u2')
    b, m2 = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('company-docs',%s)", (path,), "row-level security")
    q(cur, "reset role"); as_user(cur, 'u1'); store(cur, path)
    c, m3 = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('company-docs',%s)", (path,), "duplicate")
    up = blocked_or_zero(cur, "update storage.objects set name=%s where bucket_id='company-docs' and name=%s", (path + '.x', path))
    de = blocked_or_zero(cur, "delete from storage.objects where bucket_id='company-docs' and name=%s", (path,))
    q(cur, "reset role"); as_user(cur, 'u4')   # even a manager with Full control on Clients
    up2 = blocked_or_zero(cur, "update storage.objects set name=%s where bucket_id='company-docs' and name=%s", (path + '.y', path))
    q(cur, "reset role"); still = one(cur, "select count(*) from storage.objects where name=%s", (path,))
    return (a and b and c and up[0] and de[0] and up2[0] and still == 1, f"stray path refused={a} · colleague on someone's row refused={b} · second copy refused={c} · overwrite/rename {up[1]} · delete {de[1]} · manager rename {up2[1]} · file still there={still}")

@test("R4-05 A removed file stays removed: not un-removed (even by an admin), not re-pointed, not deleted, not undone; a live file is never moved or retyped")
def _(cur):
    sq, a1, path, i = doc_sql('coA', 'cr')
    as_user(cur, 'u1'); q(cur, sq, a1); q(cur, "update company_documents set deleted_at=now() where id=%s", (i,))
    q(cur, "reset role")
    by = one(cur, "select deleted_by=%s and deleted_at is not null from company_documents where id=%s", (F['u1'], i))
    a, m1 = expect_fail(cur, "update company_documents set deleted_at=null where id=%s", (i,), "stays removed")          # as admin
    b, m2 = expect_fail(cur, "update company_documents set storage_path=%s where id=%s", (path + '2', i), "stays removed")
    c, m3 = expect_fail(cur, "delete from company_documents where id=%s", (i,), "never deleted")
    h = one(cur, "select id from record_history where table_name='company_documents' and record_id=%s and action='delete'", (i,))
    as_user(cur, 'u4'); u = one(cur, "select undo_change(%s)", (h,)); q(cur, "reset role")
    still = one(cur, "select deleted_at is not null from company_documents where id=%s", (i,))
    sq2, a2, p2, j = doc_sql('coA', 'vat')
    as_user(cur, 'u1'); q(cur, sq2, a2)
    d, m4 = expect_fail(cur, "update company_documents set business_id=%s where id=%s", (F['coB'], j), "never re-pointed")
    e, m5 = expect_fail(cur, "update company_documents set doc_type='cr' where id=%s", (j,), "never re-pointed")
    q(cur, "reset role")
    return (by and a and b and c and still and u != 'ok' and d and e,
            f"removed by the remover={by} · un-remove refused={a} · re-point after removal refused={b} · delete refused={c} · undo: {u!r} · still removed={still} · live file moved to another company refused={d} · its type changed refused={e}")

@test("R4-06 Discount codes are LINKED, never written: one company per code, a removed link stays removed, never re-pointed; the codes and their guard untouched")
def _(cur):
    code = one(cur, "insert into promo_codes(code,kind,value_pct,valid_to) values ('B2C-1','percent',10,'2026-12-31') returning id")
    before = one(cur, "select md5(string_agg(to_jsonb(p)::text, '|' order by code)) from promo_codes p")
    guard = one(cur, "select md5(prosrc) from pg_proc where proname='promo_codes_guard'")
    as_user(cur, 'u4'); l = one(cur, "insert into company_discount_codes(business_id,promo_code_id,note) values (%s,%s,'staff travel') returning id", (F['coA'], code))
    q(cur, "reset role"); as_user(cur, 'u4')
    a, m1 = expect_fail(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s)", (F['coB'], code), "duplicate")
    b, m2 = expect_fail(cur, "update company_discount_codes set business_id=%s where id=%s", (F['coB'], l), "never re-pointed")
    q(cur, "reset role"); q(cur, "select set_config('app.today','2026-09-25',true)")
    card = one(cur, "select string_agg(x->>'code', ',' order by x->>'code') from company_card, jsonb_array_elements(discount_codes) x where business_id=%s", (F['coA'],))
    as_user(cur, 'u4'); q(cur, "update company_discount_codes set removed_at=now() where id=%s", (l,))
    c, m3 = expect_fail(cur, "update company_discount_codes set removed_at=null where id=%s", (l,), "stays removed")
    q(cur, "reset role"); as_user(cur, 'u1'); dz = blocked_or_zero(cur, "delete from company_discount_codes where id=%s", (l,))   # a team member: nothing deleted
    q(cur, "reset role"); d, m4 = expect_fail(cur, "delete from company_discount_codes where id=%s", (l,), "never deleted"); d = d and dz[0]   # an admin: refused outright
    q(cur, "reset role"); as_user(cur, 'u4')
    l2 = one(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s) returning id", (F['coB'], code))   # free again → another company may take it
    q(cur, "reset role")
    after = one(cur, "select md5(string_agg(to_jsonb(p)::text, '|' order by code)) from promo_codes p")
    guard2 = one(cur, "select md5(prosrc) from pg_proc where proname='promo_codes_guard'")
    return (a and b and c and d and l2 and 'B2C-1' in (card or '') and before == after and guard == guard2,
            f"second company refused={a} · re-point refused={b} · on the card: {card} · un-remove refused={c} · delete refused={d} · after removal another company linked it={bool(l2)} · promo_codes rows unchanged={before == after} · guard unchanged={guard == guard2}")

@test("R4-07 Every company-card change is in record history with who did it: client ID, file, file removal, discount link")
def _(cur):
    code = one(cur, "insert into promo_codes(code,kind,value_pct) values ('B2C-H','percent',5) returning id")
    sq, a1, path, i = doc_sql('coB', 'cr')
    as_user(cur, 'u4')
    q(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'H-1','tender','active')", (F['coB'],))
    q(cur, sq, a1); q(cur, "update company_documents set deleted_at=now() where id=%s", (i,))
    q(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s)", (F['coB'], code))
    q(cur, "reset role")
    rows = q(cur, "select table_name, action from record_history where actor=%s and table_name in ('client_profiles','company_documents','company_discount_codes') order by id", (F['u4'],))
    got = [f"{t}:{a}" for t, a in rows]
    want = ['client_profiles:create', 'company_documents:create', 'company_documents:delete', 'company_discount_codes:create']
    return (all(w in got for w in want), ", ".join(got))

@test("R4-08 Direct's own company assets keep their rule (any signed-in reads, the Generator writes) — and that rule no longer reaches client files")
def _(cur):
    q(cur, "update app_users set page_access = page_access || '{\"documents\":\"full\",\"clients\":\"view\"}' where id=%s", (F['u3'],))
    store(cur, 'assets/logo.png')   # as admin, a Direct asset
    as_user(cur, 'u6'); asset = seen_file(cur, 'assets/logo.png'); q(cur, "reset role")
    sq, a1, path, i = doc_sql('coA', 'iban'); q(cur, sq, a1); store(cur, path)
    as_user(cur, 'u3')   # Full on the Generator, only View on Clients
    gen_asset = blocked_or_zero(cur, "insert into storage.objects(bucket_id,name) values ('company-docs','assets/stamp.png')", None)
    a, m = expect_fail(cur, "insert into storage.objects(bucket_id,name) values ('company-docs',%s)", (f"clients/{F['coA']}/{_uuid.uuid4()}/x.pdf",), "row-level security")
    reads = seen_file(cur, path)
    q(cur, "reset role")
    return (asset == 1 and not gen_asset[0] and a and reads == 0, f"View user reads Direct's asset={asset} · Generator user writes a Direct asset={not gen_asset[0]} · Generator rule cannot write a client file={a} · nor read the IBAN letter={reads == 0}")

# ================= people & teams (owner's order 2026-09-27; scripts/sql/people-and-teams.sql) =================
def teams_ids(cur):
    return {c: one(cur, "select id from departments where code=%s", (c,)) for c in ('business','business_solutions','partnership','tenders','quality','complaints','strategy','integrity','commercial')}
@test("PT-01 The teams as agreed on the home page, in its order: Business Development, Business Solutions, Partnerships, Tenders, Quality, Complaints, Strategy, Integrity — all under Commercial")
def _(cur):
    names = one(cur, "select string_agg(name_en, ', ' order by sort) from departments where parent_id is not null and active")
    ar = one(cur, "select string_agg(name_ar, '،' order by sort) from departments where code in ('business','business_solutions','tenders')")
    want = 'Business Development, Business Solutions, Partnerships, Tenders, Quality, Complaints, Strategy, Integrity'
    return (names == want and ar == 'تطوير الأعمال،حلول الأعمال،المناقصات', f"{names} | {ar}")
@test("PT-02 Adding a team: a manager may (code and order filled in, under Commercial); both names needed; a second active team with the same name is refused; an employee cannot")
def _(cur):
    as_user(cur, 'u4')
    i = one(cur, "insert into departments(name_en,name_ar) values ('Key Accounts','الحسابات الرئيسية') returning id")
    row = one(cur, "select code||'|'||(parent_id=(select id from departments where code='commercial'))::text||'|'||(sort>8)::text from departments where id=%s", (i,))
    a, m1 = expect_fail(cur, "insert into departments(name_en,name_ar) values ('Solo',' ')", None, "english and in arabic")
    b, m2 = expect_fail(cur, "insert into departments(name_en,name_ar) values ('key accounts','حسابات')", None, "already has that name")
    q(cur, "reset role"); as_user(cur, 'u1')
    c, m3 = expect_fail(cur, "insert into departments(name_en,name_ar) values ('Mine','لي')", None, "row-level security")
    q(cur, "reset role")
    return (row == 'key_accounts|true|true' and a and b and c, f"added: {row} · one name refused={a} · duplicate refused={b} · employee refused={c}")
@test("PT-03 Retire a team: refused straight off while it has open work or people; Retire moves its OPEN tasks, open projects and its people to the chosen team, ends assists, keeps closed work where it was; the department itself cannot be retired; an employee cannot retire")
def _(cur):
    T = teams_ids(cur)
    open_t = new_task(cur, company='coA', owner='m1'); done_t = new_task(cur, company='coA', owner='m1')
    q(cur, "update tasks set status='done' where id=%s", (done_t,))
    q(cur, "insert into team_member_assists(member_id,team_id) values (%s,%s)", (F['m3'], T['business']))
    as_user(cur, 'u1'); e, m0 = expect_fail(cur, "select team_retire(%s,%s)", (T['business'], T['tenders']), "only an admin or a manager"); q(cur, "reset role")
    as_user(cur, 'u4')
    a, m1 = expect_fail(cur, "update departments set active=false where id=%s", (T['business'],), "use retire")
    b, m2 = expect_fail(cur, "select team_retire(%s,%s)", (T['business'], T['business']), "another active team")
    c, m3 = expect_fail(cur, "select team_retire(%s,%s)", (T['commercial'], T['tenders']), "not a team")
    r = one(cur, "select team_retire(%s,%s)::text", (T['business'], T['tenders']))
    q(cur, "reset role")
    moved = one(cur, "select department_id=%s from tasks where id=%s", (T['tenders'], open_t))
    kept = one(cur, "select department_id=%s from tasks where id=%s", (T['business'], done_t))
    people = one(cur, "select count(*) from team_members where department_id=%s", (T['business'],))
    assists = one(cur, "select count(*) from team_member_assists where team_id=%s", (T['business'],))
    off = one(cur, "select not active from departments where id=%s", (T['business'],))
    return (e and a and b and c and moved and kept and people == 0 and assists == 0 and off,
            f"employee refused={e} · straight off refused={a} · same team refused={b} · department refused={c} · {r} · open moved={moved} · done kept={kept} · people left={people} · assists left={assists} · retired={off}")
@test("PT-04 Saving a person goes through person_save only: an employee is refused (and cannot write app_users or the team list directly — a user only signs in and out); a manager renames a colleague (first names needed in both languages, full name composed, recorded in history); a manager MAY change an admin too, logged as the manager (owner, 27 Sep: log it, don't block it); an admin can")
def _(cur):
    as_user(cur, 'u1')
    a, m1 = expect_fail(cur, "select person_save(%s, '{\"first_name_en\":\"X\"}'::jsonb)", (F['u2'],), "only an admin or a manager")
    own, _m = blocked_or_zero(cur, "update app_users set full_name='Me Myself', role='admin' where id=%s", (F['u1'],))
    tl, _m2 = blocked_or_zero(cur, "update team_members set department_id=%s where id=%s", (F['dep_par'], F['m1']))
    q(cur, "reset role"); as_user(cur, 'u4')
    b, m2 = expect_fail(cur, "select person_save(%s, '{\"first_name_en\":\"Kareem\",\"first_name_ar\":\" \"}'::jsonb)", (F['u2'],), "in english and in arabic")
    q(cur, "select person_save(%s, '{\"first_name_en\":\"Kareem\",\"last_name_en\":\"Saleh\",\"first_name_ar\":\"كريم\",\"last_name_ar\":\"صالح\"}'::jsonb)", (F['u2'],))
    q(cur, "reset role"); names = one(cur, "select full_name||' / '||name_ar from app_users where id=%s", (F['u2'],)); as_user(cur, 'u4')
    hist = one(cur, "select count(*) from record_history where table_name='app_users' and record_id=%s and actor=%s", (F['u2'], F['u4']))
    q(cur, "select person_save(%s, '{\"first_name_en\":\"Boss\",\"first_name_ar\":\"المدير\"}'::jsonb)", (F['admin'],))
    q(cur, "reset role")
    c = one(cur, "select full_name from app_users where id=%s", (F['admin'],)) == 'Boss'
    by_mgr = one(cur, "select count(*) from record_history where table_name='app_users' and record_id=%s and actor=%s and after_row->>'full_name'='Boss'", (F['admin'], F['u4']))
    as_user(cur, 'admin')
    q(cur, "select person_save(%s, '{\"first_name_en\":\"Chief\",\"first_name_ar\":\"الرئيس\"}'::jsonb)", (F['admin'],))
    q(cur, "reset role"); adm = one(cur, "select full_name from app_users where id=%s", (F['admin'],))
    return (a and own and tl and b and names == 'Kareem Saleh / كريم صالح' and hist == 1 and c and by_mgr == 1 and adm == 'Chief',
            f"employee refused={a} · own login row untouched={own} · team list untouched={tl} · Arabic first name needed={b} · {names} · history={hist} · manager renamed an admin={c}, logged as the manager={by_mgr} · admin renamed admin → {adm}")
@test("PT-05 Home team, assisted teams, reports-to: assists must be active teams and never the home team; moving the home team onto an assisted team ends that assist; reports-to is an active person, never oneself; a retired team is not a home team")
def _(cur):
    T = teams_ids(cur)
    as_user(cur, 'u4')
    q(cur, "select person_save(%s, jsonb_build_object('home_team', %s::text, 'assists', jsonb_build_array(%s::text, %s::text), 'reports_to', %s::text))", (F['u1'], T['business'], T['tenders'], T['quality'], str(F['m4'])))
    n1 = one(cur, "select count(*) from team_member_assists where member_id=%s", (F['m1'],))
    rep = one(cur, "select reports_to=%s from team_members where id=%s", (F['m4'], F['m1']))
    a, m1 = expect_fail(cur, "select person_save(%s, jsonb_build_object('assists', jsonb_build_array(%s::text)))", (F['u1'], T['business']), "already their home team")
    q(cur, "select person_save(%s, jsonb_build_object('home_team', %s::text))", (F['u1'], T['tenders']))
    n2 = one(cur, "select count(*) from team_member_assists where member_id=%s and team_id=%s", (F['m1'], T['tenders']))
    b, m2 = expect_fail(cur, "select person_save(%s, jsonb_build_object('reports_to', %s::text))", (F['u1'], str(F['m1'])), "reports to themselves")
    q(cur, "reset role"); q(cur, "update departments set active=false where id=%s", (T['integrity'],)); as_user(cur, 'u4')
    c, m3 = expect_fail(cur, "select person_save(%s, jsonb_build_object('home_team', %s::text))", (F['u1'], T['integrity']), "active team")
    d, m4 = expect_fail(cur, "select person_save(%s, jsonb_build_object('assists', jsonb_build_array(%s::text)))", (F['u1'], T['integrity']), "assist an active team")
    q(cur, "reset role")
    return (n1 == 2 and rep and a and n2 == 0 and b and c and d, f"assists set={n1} · reports-to={rep} · home as assist refused={a} · assist ended on becoming home={n2 == 0} · self reports-to refused={b} · retired home refused={c} · retired assist refused={d}")
@test("PT-06 A task's / an achievement's team: an employee may choose a team they assist or any active team; a retired team is refused for both; none given → home team")
def _(cur):
    T = teams_ids(cur)
    q(cur, "insert into team_member_assists(member_id,team_id) values (%s,%s)", (F['m1'], T['tenders']))
    as_user(cur, 'u1')
    t = one(cur, "insert into tasks(title,business_id,owner_id,work_type,department_id) values ('T',%s,%s,'sales',%s) returning id", (F['coA'], F['m1'], T['tenders']))
    ok = one(cur, "select department_id=%s from tasks where id=%s", (T['tenders'], t))
    q(cur, "reset role"); q(cur, "update departments set active=false where id=%s", (T['complaints'],)); as_user(cur, 'u1')
    a, m1 = expect_fail(cur, "update tasks set department_id=%s where id=%s", (T['complaints'], t), "active team")
    b, m2 = expect_fail(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title) values (%s,%s,%s,'achievement',%s,'A')", (F['mar26'], T['complaints'], F['m1'], F['cat']), "active team")
    e = one(cur, "insert into report_entries(period_id,department_id,member_id,section,category_id,title) values (%s,%s,%s,'achievement',%s,'A') returning id", (F['mar26'], T['tenders'], F['m1'], F['cat']))
    q(cur, "reset role")
    return (ok and a and b and e is not None, f"assisted team kept={ok} · task to retired team refused={a} · achievement to retired team refused={b} · achievement for assisted team saved={e is not None}")
@test("PT-07 Nobody deletes a team (no delete rule for anyone; the trigger refuses even the database owner); history records team changes, assists and people moves")
def _(cur):
    T = teams_ids(cur)
    a, m1 = expect_fail(cur, "delete from departments where id=%s", (T['strategy'],), "never deleted")
    as_user(cur, 'u4')
    q(cur, "update departments set name_ar='الاستراتيجية والتخطيط' where id=%s", (T['strategy'],))
    q(cur, "select person_save(%s, jsonb_build_object('assists', jsonb_build_array(%s::text)))", (F['u3'], T['strategy']))
    q(cur, "reset role")
    h = one(cur, "select string_agg(distinct table_name||':'||action, ',' order by table_name||':'||action) from record_history where actor=%s and table_name in ('departments','team_member_assists')", (F['u4'],))
    return (a and h == 'departments:edit,team_member_assists:create', f"owner delete refused={a} · history: {h}")

@test("PT-08 The team roster: every active signed-in person reads the whole team (names in both languages) through team_directory; nobody writes through it; a signed-out caller reads nothing")
def _(cur):
    as_user(cur, 'u1'); n = one(cur, "select count(*) from team_directory"); names = one(cur, "select count(*) from team_directory where full_name is not null")
    w, _m = blocked_or_zero(cur, "update team_directory set full_name='x' where id=%s", (F['u2'],))
    q(cur, "reset role"); total = one(cur, "select count(*) from app_users")
    cur.execute("savepoint an")
    try:
        q(cur, "select set_config('request.uid', '', true)"); q(cur, "set local role anon"); anon = one(cur, "select count(*) from team_directory")
    except Exception as e: anon = 'refused'
    cur.execute("rollback to savepoint an"); q(cur, "reset role")
    return (n == total and names == total and w and anon in (0, 'refused'), f"employee sees {n} of {total} · names {names} · write through view blocked={w} · signed-out → {anon}")

@test("PT-09 Every guard (trigger function) of the task manager and of people & teams runs with the definer's rights — a guard must see rows the person cannot (r1's rule; people-and-teams.sql once replaced tasks_guard without it)")
def _(cur):
    bad = one(cur, """select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                      where n.nspname='public' and p.prorettype='trigger'::regtype and not p.prosecdef
                        and p.proname in ('tasks_guard','projects_guard','departments_guard','team_member_assists_guard','team_members_home_guard',
                                          'report_entries_team_guard','report_entries_guard','members_guard','team_list_guard','tasks_register_achievement')""")
    return (bad is None, f"guards without definer rights: {bad}")

# ================= tasks → achievements, ready for real use (scripts/sql/tasks-to-achievements.sql) =================
def done_task(cur, include=False, **kw):
    t = new_task(cur, company='coA', owner='m1', **kw)
    q(cur, "update tasks set status='done', include_in_report=%s, report_category_id=%s where id=%s", (include, F['cat'] if include else None, t))
    return t
def entry_of(cur, t):
    return one(cur, "select id from report_entries where source='task' and source_id=%s", (t,))
@test("TA-01 'Count it' ticked on a task that is ALREADY done registers its achievement then; unticked, the achievement is withdrawn")
def _(cur):
    t = done_task(cur, include=False); none_yet = entry_of(cur, t) is None
    q(cur, "update tasks set include_in_report=true, report_category_id=%s where id=%s", (F['cat'], t)); made = entry_of(cur, t) is not None
    q(cur, "update tasks set include_in_report=false where id=%s", (t,)); gone = entry_of(cur, t) is None
    return (none_yet and made and gone, f"before tick: none={none_yet} · ticked after done → registered={made} · unticked → withdrawn={gone}")
@test("TA-02 A later change of the task's title / kind / team reaches its achievement while the month is open; once the month is issued the task can still be edited and the issued line stays as it was")
def _(cur):
    t = done_task(cur, include=True)
    q(cur, "update tasks set title='Renamed deal' where id=%s", (t,)); follows = one(cur, "select title from report_entries where source_id=%s", (t,)) == 'Renamed deal'
    per = one(cur, "select period_id from report_entries where source_id=%s", (t,))
    q(cur, "update periods set locked_at=now() where id=%s", (per,))
    q(cur, "update tasks set title='After issue' where id=%s", (t,))
    task_ok = one(cur, "select title from tasks where id=%s", (t,)) == 'After issue'
    kept = one(cur, "select title from report_entries where source_id=%s", (t,)) == 'Renamed deal'
    return (follows and task_ok and kept, f"follows while open={follows} · task edited after issue={task_ok} · issued line unchanged={kept}")
@test("TA-03 Reopening (or unticking) a task whose achievement has proof files is refused in plain words — it stays counted; no raw foreign-key error")
def _(cur):
    t = done_task(cur, include=True); e = entry_of(cur, t)
    q(cur, "insert into evidence_files(entry_id,storage_path,file_name,uploaded_by) values (%s,%s,'p.pdf',%s)", (e, f'proofs/{e}/1-p.pdf', F['m1']))
    a, m1 = expect_fail(cur, "update tasks set status='in_progress' where id=%s", (t,), "proof files attached")
    b, m2 = expect_fail(cur, "update tasks set include_in_report=false where id=%s", (t,), "proof files attached")
    still = entry_of(cur, t) is not None
    return (a and b and still, f"reopen refused={a} ({m1[:60]}) · untick refused={b} · still counted={still}")
@test("TA-04 A task finished on a date no reporting month covers is refused in words — it no longer finishes with its achievement silently missing")
def _(cur):
    t = new_task(cur, company='coA', owner='m1')
    a, m = expect_fail(cur, "update tasks set status='done', done_at='2031-01-15', include_in_report=true, report_category_id=%s where id=%s", (F['cat'], t), "no reporting month covers")
    return (a, m[:90])

# ---------------- change log + QA account (owner decisions 1-3 of 27 Sep; scripts/sql/change-log-and-qa-account.sql) ----------------
@test("CL-01 Every record table is logged: a table keyed by text (task statuses) and one never logged before (promo codes) save and log under the record's own key; the logs themselves and the secret share-link token are not logged")
def _(cur):
    code = one(cur, "select code from task_statuses order by sort limit 1")
    q(cur, "update task_statuses set name_en = name_en || ' (x)' where code=%s", (code,))
    k = one(cur, "select record_key||'|'||coalesce(record_id::text,'-') from record_history where table_name='task_statuses' order by id desc limit 1")
    pc = one(cur, "select id from promo_codes where code='COA10'")
    q(cur, "update promo_codes set value_pct=12 where id=%s", (pc,))
    pk = one(cur, "select record_id=%s and record_key=%s from record_history where table_name='promo_codes' order by id desc limit 1", (pc, str(pc)))
    nolog = one(cur, "select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where p.proname='record_history_write' and t.tgrelid::regclass::text in ('record_history','task_status_log','share_links','app_state','document_counters')")
    return (k == code + '|-' and pk and nolog == 0, f"text-keyed save logged as {k} · promo code logged under its id={pk} · logs/secret tables with the trigger={nolog}")

@test("CL-02 The log is for admins and managers only: an employee reads no line of it (table or field-by-field view), a manager and an admin do; the employee is still told on Today of the manager's change to their task and can undo it (D7)")
def _(cur):
    t = new_task(cur, company='coA', owner='m1'); before = one(cur, "select title from tasks where id=%s", (t,))
    as_user(cur, 'u4'); q(cur, "update tasks set title='Changed by the manager' where id=%s", (t,))
    mgr = one(cur, "select count(*) from record_history where table_name='tasks' and record_key=%s and actor=%s", (str(t), F['u4']))
    mgr_f = one(cur, "select count(*) from record_changes where table_name='tasks' and record_key=%s and field='title'", (str(t),))
    q(cur, "reset role"); as_user(cur, 'u1')
    emp = one(cur, "select count(*) from record_history"); emp_f = one(cur, "select count(*) from record_changes")
    told = one(cur, "select count(*) from changes_to_my_tasks(7) where task_id=%s and action='edit'", (t,))
    h = one(cur, "select history_id from changes_to_my_tasks(7) where task_id=%s and action='edit' order by history_id desc limit 1", (t,))
    undo = one(cur, "select undo_change(%s)", (h,)) if h else None
    q(cur, "reset role"); as_user(cur, 'admin')
    adm = one(cur, "select count(*) from record_history where table_name='tasks' and record_key=%s", (str(t),)); q(cur, "reset role")
    back = one(cur, "select title from tasks where id=%s", (t,)) == before
    return (mgr == 1 and mgr_f >= 1 and emp == 0 and emp_f == 0 and told >= 1 and undo == 'ok' and back and adm >= 2,
            f"manager reads it={mgr} (fields {mgr_f}) · employee reads {emp} lines / {emp_f} fields · employee told={told} · undo={undo} · title back={back} · admin reads {adm}")

@test("CL-03 The change log reads field by field — who, when, field, before, after; a change inside a company's raw record reads as that field (raw.stage), not the whole record")
def _(cur):
    q(cur, "alter table businesses add column if not exists raw jsonb")
    q(cur, "update businesses set raw = '{\"stage\":\"New\",\"notes\":\"a\"}' where id=%s", (F['coA'],))
    as_user(cur, 'u4')
    q(cur, "update businesses set name='Company A2', raw = raw || '{\"stage\":\"Contacted\"}' where id=%s", (F['coA'],))
    rows = q(cur, "select field, before_value#>>'{}', after_value#>>'{}', actor_name from record_changes where table_name='businesses' and record_key=%s and actor=%s order by field", (str(F['coA']), F['u4']))
    q(cur, "reset role")
    got = {r[0]: (r[1], r[2], r[3]) for r in rows}
    ok = got.get('name') == ('Company A', 'Company A2', 'Othman') and got.get('raw.stage') == ('New', 'Contacted', 'Othman') and 'raw' not in got and 'raw.notes' not in got
    return (ok, f"fields: {sorted(got)} · name {got.get('name')} · raw.stage {got.get('raw.stage')}")

@test("CL-04 Who: a signed-in person is themselves; a change from a database session (an import, seed or bulk edit run from outside the app) is the QA account (business@); a service call with no person behind it is 'system'")
def _(cur):
    qa = one(cur, "insert into app_users(email,full_name,role) values ('business@directksa.com','QA Account','admin') returning id")
    q(cur, "select set_config('request.uid', '', true)")   # a database session: nobody signed in (conn() signs the test in as the admin)
    q(cur, "update promo_codes set notes='bulk' where code='COA10'")
    a1 = one(cur, "select actor=%s and actor_name='QA Account' from record_history where table_name='promo_codes' order by id desc limit 1", (qa,))
    q(cur, "select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)")
    q(cur, "update promo_codes set notes='service' where code='COA10'")
    a2 = one(cur, "select actor is null and actor_name='system' from record_history where table_name='promo_codes' order by id desc limit 1")
    q(cur, "select set_config('request.jwt.claims', '', true)"); q(cur, "select set_config('request.uid', %s, true)", (str(F['admin']),))
    t = new_task(cur, company='coA', owner='m1')
    as_user(cur, 'u1'); q(cur, "update tasks set title='Mine' where id=%s", (t,)); q(cur, "reset role")
    a3 = one(cur, "select actor=%s from record_history where table_name='tasks' and record_key=%s order by id desc limit 1", (F['u1'], str(t)))
    return (a1 and a2 and a3, f"database session → QA={a1} · service call → system={a2} · signed-in person → themselves={a3}")

w = max(len(n) for n, _, _ in results)
# ================= E — the money rules (scripts/sql/e-money-rules.sql; owner-approved spec of 2026-09-27) =================
def mar26(cur):
    """the same Mar-26 total read three ways: the one view, finance_lines (Finance/Reports' KPI source), and the KPI itself"""
    v = one(cur, "select coalesce(sum(revenue_sar),0) from money_that_counts where invoice_date between '2026-03-01' and '2026-03-31'")
    fl = one(cur, "select coalesce(sum(revenue_sar),0) from finance_lines where invoice_date between '2026-03-01' and '2026-03-31'")
    k = one(cur, "select actual from kpi_actuals where kpi_id=%s and scope='company' and period_id=%s and member_id is null and department_id is null", (F['kpi_rev'], F['mar26']))
    return (float(v), float(fl), float(k or 0))
def rule(cur, kind, value, reason='test'):
    return one(cur, "insert into money_exclusion_rules(kind,value,reason) values (%s,%s,%s) returning id", (kind, value, reason))

@test("E-01 Exclusion rules: only an admin or a manager adds or switches one; everyone with Finance reads them; a reason is required; the type and value never change; a removed rule stays removed and is never deleted; every add and change is in the log with who")
def _(cur):
    as_user(cur, 'u1'); t, m1 = expect_fail(cur, "insert into money_exclusion_rules(kind,value,reason) values ('client_id','C-2001','x')", None, "row-level security")
    q(cur, "reset role"); as_user(cur, 'u4')
    r = rule(cur, 'client_id', ' C-2001 ', 'test client')
    a, m2 = expect_fail(cur, "insert into money_exclusion_rules(kind,value,reason) values ('client_id','C-3001','  ')", None, "money_rule_reason_given")
    b, m3 = expect_fail(cur, "insert into money_exclusion_rules(kind,value,reason) values ('client_id','c 2001','again')", None, "money_exclusion_rules_one_live")
    c, m4 = expect_fail(cur, "update money_exclusion_rules set value='C-9' where id=%s", (r,), "never change")
    q(cur, "update money_exclusion_rules set active=false where id=%s", (r,))
    q(cur, "update money_exclusion_rules set removed_at=now() where id=%s", (r,))
    d, m5 = expect_fail(cur, "update money_exclusion_rules set removed_at=null, active=true where id=%s", (r,), "stays removed")
    e = blocked_or_zero(cur, "delete from money_exclusion_rules where id=%s", (r,))[0]   # a manager: nothing deleted
    q(cur, "reset role"); e2, m6 = expect_fail(cur, "delete from money_exclusion_rules where id=%s", (r,), "never deleted"); e = e and e2   # an admin: refused outright
    as_user(cur, 'u6'); seen = one(cur, "select count(*) from money_exclusion_rules"); q(cur, "reset role")
    stored = one(cur, "select value||'|'||(created_by=%s)::text||'|'||(removed_by=%s)::text from money_exclusion_rules where id=%s", (F['u4'], F['u4'], r))
    log = [x[0] for x in q(cur, "select action from record_history where table_name='money_exclusion_rules' and record_id=%s and actor=%s order by id", (r, F['u4']))]
    return (t and a and b and c and d and e and seen == 1 and stored == 'C-2001|true|true' and log[:1] == ['create'] and len(log) == 3,
            f"team member refused={t} · no reason refused={a} · same rule twice (other spelling) refused={b} · value change refused={c} · un-remove refused={d} · delete refused={e} · a View person reads {seen} · stored {stored} · log {log}")

@test("E-02 Every rule kind leaves its rows out of every total at once, and switching it off brings them back — no re-import; the one view, finance_lines and the revenue KPI agree before, during and after")
def _(cur):
    base = mar26(cur)
    q(cur, "update finance_invoices set customer_tax_no='300123456700003', discount_code='SUMMER10', transaction_ref='TX-77' where invoice_no='INV-X26'")
    q(cur, "update businesses set cr_vat='CR 1010101010 / VAT 311111111100003' where id=%s", (F['coB'],))
    as_user(cur, 'u4'); out = {}
    for kind, value, gone in [('client_id', 'C-2001', 5000), ('name', 'grp x', 900), ('tax_no', '300123456700003', 900),
                              ('tax_no', '311111111100003', 5000), ('discount_code', 'summer10', 900), ('transaction', 'TX-77', 900),
                              ('transaction', 'INV-B26', 5000)]:
        r = rule(cur, kind, value); during = mar26(cur)
        q(cur, "update money_exclusion_rules set active=false where id=%s", (r,)); after = mar26(cur)
        q(cur, "update money_exclusion_rules set removed_at=now() where id=%s", (r,))
        out[kind + ':' + value] = (during, after, during == tuple(x - gone for x in base) and after == base)
    q(cur, "reset role")
    ok = base == (15900.0, 15900.0, 15900.0) and all(v[2] for v in out.values())
    return (ok, f"before {base} · " + " · ".join(f"{k} → {v[0][0]:.0f}/{v[0][1]:.0f}/{v[0][2]:.0f}, off → {v[1][0]:.0f}" for k, v in out.items()))

@test("E-03 A name rule is only for rows with NO client ID: a row carrying a client ID is not caught by its name")
def _(cur):
    as_user(cur, 'u4'); rule(cur, 'name', 'GRP-B'); v = mar26(cur); q(cur, "reset role")
    return (v == (15900.0, 15900.0, 15900.0), f"name rule on a row that has a client ID → totals {v} (unchanged)")

@test("E-04 Merges are only what is typed: a row joins a company through its client ID or a typed discount code; an untyped client ID stands alone as 'not merged'; an untyped code stays under 'Unassigned codes' and still counts, never twice")
def _(cur):
    code = one(cur, "insert into promo_codes(code,kind,value_pct) values ('CORP-5','percent',5) returning id")
    q(cur, "update finance_invoices set discount_code='CORP-5' where invoice_no='INV-X26'")
    before = q(cur, "select company_key, merge_state, counts from money_rows where invoice_no='INV-X26'")[0]
    total0 = mar26(cur)
    as_user(cur, 'u4'); q(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s)", (F['coB'], code)); q(cur, "reset role")
    after = q(cur, "select company_key, merge_state from money_rows where invoice_no='INV-X26'")[0]
    total1 = mar26(cur)
    q(cur, "update finance_invoices set payments_client_id='C-7777' where invoice_no='INV-X26'")
    alone = q(cur, "select company_key, merge_state, company_name from money_rows where invoice_no='INV-X26'")[0]
    a_rows = one(cur, "select count(*) from money_rows where business_id=%s", (F['coA'],))
    return (before[0] == 'codes:unassigned' and before[2] and after == ('biz:' + str(F['coB']), 'merged') and total0 == total1
            and alone[0] == 'cid:c7777' and alone[1] == 'not_merged' and a_rows == 5,
            f"untyped code → {before[0]} (counts={before[2]}) · typed into Company B → {after} · total unchanged {total0 == total1} · an untyped client ID → {alone[0]} / {alone[1]} · Company A's rows through its typed IDs = {a_rows}")

@test("E-05 Exclusion beats merge: a client ID typed into a company AND caught by a rule is left out, and the view names the rule")
def _(cur):
    as_user(cur, 'u4'); rule(cur, 'client_id', 'C-1001', 'test account'); q(cur, "reset role")
    r = q(cur, "select business_id=%s, excluded, counts, rule_kind, rule_reason from money_rows where invoice_no='INV-A26' and revenue_sar=6000", (F['coA'],))[0]
    return (r == (True, True, False, 'client_id', 'test account') and mar26(cur) == (5900.0, 5900.0, 5900.0), f"still the company's row={r[0]} · excluded={r[1]} · counts={r[2]} · rule={r[3]} '{r[4]}' · totals {mar26(cur)}")

@test("E-06 Everyone with Finance sees the same company and rule for a row (the rules never depend on which companies the viewer may read); a person without Finance gets nothing from the resolver")
def _(cur):
    as_user(cur, 'u4'); rule(cur, 'tax_no', '311111111100003'); q(cur, "reset role")
    q(cur, "update businesses set cr_vat='VAT 311111111100003' where id=%s", (F['coB'],))
    snap = lambda: q(cur, "select invoice_no, line_no_dummy, company_key, rule_kind from (select invoice_no, 0 line_no_dummy, company_key, rule_kind from money_rows) x order by 1,3")
    as_user(cur, 'u4'); m = snap(); q(cur, "reset role")
    as_user(cur, 'u6'); v = snap(); q(cur, "reset role")
    q(cur, "update app_users set page_access = page_access || '{\"finance\":\"none\"}' where id=%s", (F['u5'],))
    as_user(cur, 'u5'); n = one(cur, "select count(*) from money_row_rules()"); q(cur, "reset role")
    return (m == v and len(m) > 0 and n == 0, f"manager and View person see identical rows/companies/rules={m == v} ({len(m)} rows) · no Finance → resolver answers {n} rows")

@test("E-07 A customer name typed into a company is a merge for rows with NO client ID (the old invoices): they join it, a row carrying a client ID does not; one company per name however spelled; only admins and managers type one; totals do not move")
def _(cur):
    base = mar26(cur)
    as_user(cur, 'u1'); a, m1 = expect_fail(cur, "insert into company_name_aliases(business_id,name) values (%s,'GRP-X')", (F['coB'],), "row-level security")
    q(cur, "reset role"); as_user(cur, 'u4')
    q(cur, "insert into company_name_aliases(business_id,name) values (%s,' grp x ')", (F['coB'],))
    b, m2 = expect_fail(cur, "insert into company_name_aliases(business_id,name) values (%s,'GRP-X')", (F['coA'],), "company_name_aliases_one_company")
    q(cur, "insert into company_name_aliases(business_id,name) values (%s,'GRP-B')", (F['coA'],))   # GRP-B rows carry client ID C-2001 → stay with Company B
    q(cur, "reset role")
    x = q(cur, "select business_id=%s, merge_state from money_rows where invoice_no='INV-X26'", (F['coB'],))[0]
    bb = one(cur, "select bool_and(business_id=%s) from money_rows where invoice_no='INV-B26'", (F['coB'],))
    return (a and b and x == (True, 'merged') and bb and mar26(cur) == base,
            f"team member refused={a} · same name (other spelling) for a second company refused={b} · the no-ID row joins Company B={x} · a row with a client ID stays with its ID's company={bb} · totals unchanged={mar26(cur) == base}")

@test("E-08 Merging two duplicate company records carries their typed codes and customer names to the kept one (removed there, added here — never re-pointed), and undoing the merge puts them back; name folding ignores Arabic diacritics and the tatweel")
def _(cur):
    code = one(cur, "insert into promo_codes(code,kind,value_pct) values ('MRG-1','percent',5) returning id")
    as_user(cur, 'u4')
    q(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s)", (F['coB'], code))
    q(cur, "insert into company_name_aliases(business_id,name) values (%s,'Old Spelling Co')", (F['coB'],))
    mid = one(cur, "insert into business_merges(kept_id,dropped_id,moved,reason,actor) values (%s,%s,'{}'::jsonb,'dup','t') returning id", (F['coA'], F['coB']))
    q(cur, "reset role")
    after = (one(cur, "select business_id=%s from company_discount_codes where promo_code_id=%s and removed_at is null", (F['coA'], code)),
             one(cur, "select business_id=%s from company_name_aliases where name='Old Spelling Co' and removed_at is null", (F['coA'],)),
             one(cur, "select jsonb_array_length(moved->'company_discount_codes') + jsonb_array_length(moved->'company_name_aliases') from business_merges where id=%s", (mid,)))
    as_user(cur, 'u4'); q(cur, "update business_merges set undone_at=now() where id=%s", (mid,)); q(cur, "reset role")
    back = (one(cur, "select business_id=%s from company_discount_codes where promo_code_id=%s and removed_at is null", (F['coB'], code)),
            one(cur, "select business_id=%s from company_name_aliases where name='Old Spelling Co' and removed_at is null", (F['coB'],)))
    fold = one(cur, "select money_norm('شـركةُ الاختبار') = money_norm('شركه الإختبار')")
    return (after == (True, True, 2) and back == (True, True) and fold, f"after merge (code, name on the kept company; 2 recorded)={after} · after undo back on the dropped one={back} · tatweel+harakat+ة/ه+أ/ا fold={fold}")

# ================= D1 — the money model and the invoice import (scripts/sql/d1-money-model.sql; DECISIONS D21) =================
def fi(cur, no, total, **kw):
    cols = {'invoice_no': no, 'line_no': 1, 'client_group': 'D1 Test Co', 'invoice_date': '2026-03-10', 'total_incl_vat_sar': total,
            'integrity_status': 'verified_paid', 'revenue_way': 'invoice'}
    cols.update(kw)
    ks = list(cols)
    return one(cur, "insert into finance_invoices(" + ",".join(ks) + ") values (" + ",".join(["%s"] * len(ks)) + ") returning id", tuple(cols[k] for k in ks))
def row(cur, i, cols):
    return one(cur, "select " + cols + " from money_rows where id=%s", (i,))

@test("D1-01 Revenue is the invoice total; only a wallet TOP-UP part comes out; a top-up-only invoice and a billing link are stored with zero revenue and never count; a hand-entered revenue with no total is kept")
def _(cur):
    a = fi(cur, 'D1-SALE', 1000)
    b = fi(cur, 'D1-MIX', 1890, wallet_portion_sar=2)              # a sale with a +2 Wallet Balance line
    c = fi(cur, 'D1-TOPUP', 50000, row_kind='wallet_topup', wallet_portion_sar=50000)
    d = fi(cur, 'D1-BILL', 193815, row_kind='billing_link')
    e = one(cur, "insert into finance_invoices(invoice_no,line_no,client_group,invoice_date,revenue_sar,integrity_status) values ('D1-HAND',1,'D1 Test Co','2026-03-11',700,'verified_paid') returning id")
    got = [row(cur, x, "revenue_sar::float||'|'||counts::text") for x in (a, b, c, d, e)]
    want = ['1000|true', '1888|true', '0|false', '0|false', '700|true']
    return (got == want, f"sale / sale with a top-up line / top-up only / billing link / hand revenue with no total → {got} (want {want})")

@test("D1-02 A missing cost is EMPTY, never 0: profit is empty and the row says cost missing; a commission has no cost by nature (profit = revenue, not missing); a known cost gives profit and a loss is flagged; a zero cost is a real zero")
def _(cur):
    a = fi(cur, 'D1-NOCOST', 5000)
    b = fi(cur, 'D1-COMM', 800, revenue_way='commission')
    c = fi(cur, 'D1-COST', 5000, cost_sar=4200)
    d = fi(cur, 'D1-LOSS', 1000, cost_sar=1100)
    e = fi(cur, 'D1-ZERO', 300, cost_sar=0)
    got = [row(cur, x, "coalesce(cost_sar::text,'∅')||'|'||coalesce(profit_sar::float::text,'∅')||'|'||cost_missing::text||'|'||loss::text") for x in (a, b, c, d, e)]
    want = ['∅|∅|true|false', '∅|800|false|false', '4200|800|false|false', '1100|-100|false|true', '0|300|false|false']
    fl = one(cur, "select cost_missing::text from finance_lines where id=%s", (a,))
    return (got == want and fl == 'true', f"no cost / commission / cost / loss / zero → {got} · finance_lines says cost missing={fl}")

@test("D1-03 The import commit FILLS and never wipes: a field the new file does not carry keeps its value; the newest Payments status wins and an older file cannot roll it back; a hand-entered row is never touched by an import")
def _(cur):
    as_user(cur, 'u4')
    r = one(cur, """select fn_commit_finance_import(p_insert := %s::jsonb)""", (json.dumps([{'invoice_no': 'D1-F', 'client_group': 'Fill Co', 'invoice_date': '2026-03-12',
        'total_incl_vat_sar': 2000, 'integrity_status': 'pending', 'payments_status': 'Pending Payment', 'payments_status_at': '2026-03-12T10:00:00Z',
        'branch': 'Riyadh', 'customer_email': 'ap@fill.example'}]),))
    i = one(cur, "select id from finance_invoices where invoice_no='D1-F'")
    # a later file: paid, carries no branch and no email → both kept
    one(cur, "select fn_commit_finance_import(p_update := %s::jsonb)", (json.dumps([{'id': str(i), 'integrity_status': 'verified_paid', 'payments_status': 'Fully Paid',
        'payments_status_at': '2026-03-20T10:00:00Z', 'paid_at': '2026-03-20'}]),))
    after = one(cur, "select integrity_status||'|'||payments_status||'|'||coalesce(branch,'∅')||'|'||coalesce(customer_email,'∅')||'|'||paid_at from finance_invoices where id=%s", (i,))
    # an OLDER file arrives afterwards, still saying Pending → the newer Paid stays
    one(cur, "select fn_commit_finance_import(p_update := %s::jsonb)", (json.dumps([{'id': str(i), 'integrity_status': 'pending', 'payments_status': 'Pending Payment',
        'payments_status_at': '2026-03-12T10:00:00Z'}]),))
    older = one(cur, "select integrity_status||'|'||payments_status from finance_invoices where id=%s", (i,))
    q(cur, "reset role")
    m = fi(cur, 'D1-MANUAL', 900, source='manual')
    as_user(cur, 'u4')
    one(cur, "select fn_commit_finance_import(p_update := %s::jsonb)", (json.dumps([{'id': str(m), 'total_incl_vat_sar': 1}]),))
    q(cur, "reset role")
    man = one(cur, "select total_incl_vat_sar::float from finance_invoices where id=%s", (m,))
    return (after == 'verified_paid|Fully Paid|Riyadh|ap@fill.example|2026-03-20' and older == 'verified_paid|Fully Paid' and man == 900,
            f"after the later file: {after} · after an OLDER file: {older} · a manual row after an import update: total={man}")

@test("D1-04 An invoice's item lines are replaced per invoice on each import (never duplicated), and the pass-through amount on them follows the item-name list a person keeps — live, and never into cost or profit")
def _(cur):
    i = fi(cur, 'D1-LINES', 507800)
    lines = [{'invoice_no': 'D1-LINES', 'line_no': n, 'kind': 'item', 'name': nm, 'item_total_sar': v} for n, (nm, v) in enumerate(
        [('Flight Booking - Flight Booking', 237542), ('Flight Booking - Service Fees', 29999.99), ('Hotel Booking - 3rd Party Fee', 140895),
         ('Hotel Booking - Service Fee', 29999.99), ('Activity Booking - Provider Fee', 60806), ('Activity Booking - Service Fee', 8557.02)], 1)]
    as_user(cur, 'u4')
    one(cur, "select fn_commit_finance_import(p_item_lines := %s::jsonb)", (json.dumps(lines),))
    one(cur, "select fn_commit_finance_import(p_item_lines := %s::jsonb)", (json.dumps(lines),))   # the same file again
    n = one(cur, "select count(*) from finance_invoice_lines where invoice_no='D1-LINES'")
    before = row(cur, i, "coalesce(pass_through_sar::float::text,'∅')||'|'||coalesce(unclassed_sar::float::text,'∅')")
    for nm, cl in [('Flight Booking', 'pass_through'), ('3rd Party Fee', 'pass_through'), ('Provider Fee', 'pass_through'), ('Service Fee', 'fee'), ('Service Fees', 'fee')]:
        q(cur, "insert into money_item_classes(name,class) values (%s,%s)", (nm, cl))
    after = row(cur, i, "pass_through_sar::float||'|'||fee_sar::float||'|'||coalesce(unclassed_sar::text,'∅')||'|'||coalesce(cost_sar::text,'∅')||'|'||coalesce(profit_sar::text,'∅')")
    q(cur, "reset role")
    return (n == 6 and before == '∅|507800' and after == '439243|68557|∅|∅|∅',
            f"lines after importing the same file twice={n} · before the list (pass-through|unclassed)={before} · after (pass-through|fee|unclassed|cost|profit)={after}")

@test("D1-07 The same invoice (and the same item line) sent twice in one import lands ONCE, with the newer Payments status — never a refused import")
def _(cur):
    as_user(cur, 'u4')
    base = {'client_group': 'Twice Co', 'invoice_date': '2026-04-02', 'total_incl_vat_sar': 700}
    ins = [dict(base, invoice_no='D1-TWICE', integrity_status='verified_paid', payments_status='Fully Paid', payments_status_at='2026-04-05T09:00:00Z'),
           dict(base, invoice_no='D1-TWICE', integrity_status='pending', payments_status='Pending Payment', payments_status_at='2026-04-02T09:00:00Z')]
    ln = [{'invoice_no': 'D1-TWICE', 'line_no': 1, 'kind': 'item', 'name': 'Flight Booking - Flight Booking', 'item_total_sar': 600},
          {'invoice_no': 'D1-TWICE', 'line_no': 1, 'kind': 'item', 'name': 'Flight Booking - Flight Booking', 'item_total_sar': 600}]
    r = one(cur, "select fn_commit_finance_import(p_insert := %s::jsonb, p_item_lines := %s::jsonb)", (json.dumps(ins), json.dumps(ln)))
    n = one(cur, "select count(*)||'|'||max(payments_status) from finance_invoices where invoice_no='D1-TWICE'")
    nl = one(cur, "select count(*) from finance_invoice_lines where invoice_no='D1-TWICE'")
    q(cur, "reset role")
    return (n == '1|Fully Paid' and nl == 1, f"rows|status={n} · lines={nl} · result={r}")

@test("D23-01 No approved expense: the pass-through on the invoice's lines is a flagged ESTIMATE beside the cost (never in it); an approved expense replaces it; a commission never gets one; KPIs see both apart")
def _(cur):
    as_user(cur, 'u4')
    one(cur, "select fn_commit_finance_import(p_insert := %s::jsonb, p_item_lines := %s::jsonb)", (json.dumps([
        {'invoice_no': 'D23-A', 'client_group': 'Est Co', 'invoice_date': '2026-08-02', 'total_incl_vat_sar': 1000, 'integrity_status': 'verified_paid', 'payments_status': 'Fully Paid', 'payments_status_at': '2026-08-02T09:00:00Z'},
        {'invoice_no': 'D23-C', 'client_group': 'Est Co', 'invoice_date': '2026-08-03', 'total_incl_vat_sar': 500, 'revenue_way': 'commission', 'integrity_status': 'verified_paid', 'payments_status': 'Fully Paid', 'payments_status_at': '2026-08-03T09:00:00Z'}]),
        json.dumps([{'invoice_no': 'D23-A', 'line_no': 1, 'kind': 'item', 'name': 'Hotel Booking - D23 Hotel Cost', 'item_total_sar': 820},
                    {'invoice_no': 'D23-A', 'line_no': 2, 'kind': 'item', 'name': 'Hotel Booking - D23 Fee', 'item_total_sar': 180},
                    {'invoice_no': 'D23-C', 'line_no': 1, 'kind': 'item', 'name': 'Hotel Booking - D23 Hotel Cost', 'item_total_sar': 500}])))
    before = one(cur, "select coalesce(est_cost_sar::text,'∅')||'|'||cost_estimated from money_rows where invoice_no='D23-A'")
    one(cur, "insert into money_item_classes(name,class) values ('D23 Hotel Cost','pass_through') returning id")
    est = one(cur, "select est_cost_sar::float||'|'||cost_estimated||'|'||coalesce(cost_sar::text,'∅')||'|'||coalesce(profit_sar::text,'∅')||'|'||cost_missing from money_rows where invoice_no='D23-A'")
    com = one(cur, "select coalesce(est_cost_sar::text,'∅')||'|'||cost_estimated from money_rows where invoice_no='D23-C'")
    kpi = one(cur, "select est_cost_sar::float||'|'||cost_estimated from finance_lines where invoice_no='D23-A'")
    q(cur, "reset role")
    q(cur, "update finance_invoices set cost_sar=900 where invoice_no='D23-A'")
    as_user(cur, 'u4')
    after = one(cur, "select coalesce(est_cost_sar::text,'∅')||'|'||cost_estimated||'|'||cost_sar::float from money_rows where invoice_no='D23-A'")
    q(cur, "reset role")
    ok = before == '∅|false' and est == '820|true|∅|∅|true' and com == '∅|false' and kpi == '820|true' and after == '∅|false|900'
    return (ok, f"unclassed={before} · classed pass-through={est} · commission={com} · KPI source={kpi} · approved expense arrives={after}")

@test("D24-01 Income by service: a line goes to its item's service over its product's; a 'not income' service never counts; the lists follow Full on Finance (no role); a name never changes; nothing is deleted")
def _(cur):
    as_user(cur, 'u1')   # a team member with Full on Finance
    fl = one(cur, "insert into money_services(name, sort_order) values ('D24 Flights', 10) returning id")
    tr = one(cur, "insert into money_services(name, sort_order) values ('D24 Transport', 30) returning id")
    ni = one(cur, "insert into money_services(name, sort_order, counts_as_income) values ('D24 Not income', 900, false) returning id")
    one(cur, "insert into money_product_services(product, service_id) values ('D24 Journey', %s) returning id", (fl,))
    one(cur, "insert into money_product_services(product, service_id) values ('D24 Wallet', %s) returning id", (ni,))
    one(cur, "insert into money_item_services(item, service_id) values ('D24 Chauffeur', %s) returning id", (tr,))
    one(cur, "select fn_commit_finance_import(p_insert := %s::jsonb, p_item_lines := %s::jsonb)", (json.dumps([
        {'invoice_no': 'D24-A', 'client_group': 'Svc Co', 'invoice_date': '2026-08-02', 'total_incl_vat_sar': 1000, 'integrity_status': 'verified_paid', 'payments_status': 'Fully Paid', 'payments_status_at': '2026-08-02T09:00:00Z'}]),
        json.dumps([{'invoice_no': 'D24-A', 'line_no': 1, 'kind': 'item', 'product': 'D24 Journey', 'name': 'D24 Chauffeur - 3rd Party Fee', 'item_total_sar': 600},
                    {'invoice_no': 'D24-A', 'line_no': 2, 'kind': 'item', 'product': 'D24 Journey', 'name': 'D24 Ticket - Service Fee', 'item_total_sar': 300},
                    {'invoice_no': 'D24-A', 'line_no': 3, 'kind': 'item', 'product': 'D24 Wallet', 'name': 'Wallet Balance', 'item_total_sar': 100}])))
    got = one(cur, "select string_agg(service_name||'='||revenue_sar::float, ',' order by service_name) from money_service_rows where id=(select id from finance_invoices where invoice_no='D24-A')")
    rn, _ = expect_fail(cur, "update money_services set name='D24 Air' where id=%s", (fl,), "never changes")
    q(cur, "update money_item_services set removed_at=now() where item='D24 Chauffeur'")
    after = one(cur, "select string_agg(service_name||'='||revenue_sar::float, ',' order by service_name) from money_service_rows where id=(select id from finance_invoices where invoice_no='D24-A')")
    dl = blocked_or_zero(cur, "delete from money_services where id=%s", (tr,))[0]
    q(cur, "reset role")
    as_user(cur, 'u5')   # View on Finance
    vw, _ = expect_fail(cur, "insert into money_services(name) values ('D24 View try')", None, "row-level security")
    seen = one(cur, "select count(*) from money_services where name like 'D24%%'")
    q(cur, "reset role")
    ok = got == 'D24 Flights=300,D24 Transport=600' and after == 'D24 Flights=900' and rn and dl and vw and seen == 3
    return (ok, f"split={got} · item override removed → {after} · rename refused={rn} · delete refused={dl} · View cannot add={vw} · View reads {seen}")

@test("D25-01 'Individual (not a company)': Full on Finance marks a name (no role); View cannot; one entry per name however spelled; a name never changes; nothing is deleted; the change is logged")
def _(cur):
    as_user(cur, 'u1')
    x = one(cur, "insert into money_individuals(name) values ('D25 Person Name') returning id")
    dup, _ = expect_fail(cur, "insert into money_individuals(name) values ('d25 person-name')", None, "money_individuals_one_live")
    rn, _ = expect_fail(cur, "update money_individuals set name='Other' where id=%s", (x,), "never changes")
    dl = blocked_or_zero(cur, "delete from money_individuals where id=%s", (x,))[0]
    q(cur, "reset role")
    logged = one(cur, "select count(*) from record_history where table_name='money_individuals' and record_id=%s", (str(x),))
    as_user(cur, 'u5')
    vw, _ = expect_fail(cur, "insert into money_individuals(name) values ('D25 View try')", None, "row-level security")
    seen = one(cur, "select count(*) from money_individuals where name like 'D25%%'")
    q(cur, "reset role")
    ok = dup and rn and dl and vw and seen == 1 and logged >= 1
    return (ok, f"same name other spelling refused={dup} · rename refused={rn} · delete refused={dl} · View cannot add={vw} · View reads {seen} · logged={logged}")

@test("D26-01 A merged pair keeps the re-billed transaction's own date: the import writes it, a later file only fills it when empty, and the money view shows it beside the invoice's date")
def _(cur):
    as_user(cur, 'u4')
    one(cur, "select fn_commit_finance_import(p_insert := %s::jsonb)", (json.dumps([{'invoice_no': 'D26-PAIR', 'zatca_dpin': 'DPIN-D26', 'client_group': 'D26 Co', 'invoice_date': '2026-09-22',
        'total_incl_vat_sar': 500, 'amount_received_sar': 500, 'amount_remaining_sar': 0, 'integrity_status': 'verified_paid', 'payments_status': 'Fully Paid',
        'payments_status_at': '2026-09-22T09:00:00Z', 'paid_at': '2026-09-22', 'transaction_ref': 'TX-D26', 'transaction_date': '2026-04-10'}]),))
    i = one(cur, "select id from finance_invoices where invoice_no='D26-PAIR'")
    one(cur, "select fn_commit_finance_import(p_update := %s::jsonb)", (json.dumps([{'id': str(i), 'transaction_date': '2026-05-01', 'payments_status_at': '2026-09-23T09:00:00Z'}]),))
    kept = one(cur, "select transaction_date::text from finance_invoices where id=%s", (i,))
    q(cur, "reset role")
    q(cur, "update finance_invoices set transaction_date=null where id=%s", (i,))
    as_user(cur, 'u4')
    one(cur, "select fn_commit_finance_import(p_update := %s::jsonb)", (json.dumps([{'id': str(i), 'transaction_date': '2026-04-10'}]),))
    filled = one(cur, "select transaction_date::text||'|'||invoice_date::text from money_rows where id=%s", (i,))
    q(cur, "reset role")
    ok = kept == '2026-04-10' and filled == '2026-04-10|2026-09-22'
    return (ok, f"a later file did not overwrite it: {kept} · an empty one is filled, the view shows both: {filled}")

@test("D1-08 An OLDER file arriving after a newer one only fills what is empty: the paid amounts and the paid date (which sets the month) are not put back to the unpaid copy's")
def _(cur):
    as_user(cur, 'u4')
    one(cur, "select fn_commit_finance_import(p_insert := %s::jsonb)", (json.dumps([{'invoice_no': 'D1-OLD', 'client_group': 'Old Co', 'invoice_date': '2026-05-20',
        'total_incl_vat_sar': 700, 'amount_received_sar': 700, 'amount_remaining_sar': 0, 'integrity_status': 'verified_paid', 'payments_status': 'Fully Paid',
        'payments_status_at': '2026-05-20T09:00:00Z', 'paid_at': '2026-05-20'}]),))
    i = one(cur, "select id from finance_invoices where invoice_no='D1-OLD'")
    one(cur, "select fn_commit_finance_import(p_update := %s::jsonb)", (json.dumps([{'id': str(i), 'invoice_date': '2026-05-14', 'amount_received_sar': 0,
        'amount_remaining_sar': 700, 'integrity_status': 'pending', 'payments_status': 'Pending Payment', 'payments_status_at': '2026-05-14T09:00:00Z', 'branch': 'Jeddah'}]),))
    got = one(cur, "select integrity_status||'|'||amount_received_sar::float||'|'||amount_remaining_sar::float||'|'||invoice_date||'|'||month||'|'||coalesce(branch,'∅') from finance_invoices where id=%s", (i,))
    q(cur, "reset role")
    return (got == 'verified_paid|700|0|2026-05-20|May|Jeddah', f"after the older file: {got} (branch was empty, so the older file may fill it)")

@test("D1-05 The item-name list: only an admin or a manager adds to it; one entry per name however spelled; a name never changes; a removed entry stays removed; nothing is deleted; everyone with Finance reads it")
def _(cur):
    as_user(cur, 'u1'); t, _ = expect_fail(cur, "insert into money_item_classes(name,class) values ('3rd Party Fee','pass_through')", None, "row-level security"); q(cur, "reset role")
    as_user(cur, 'u4')
    x = one(cur, "insert into money_item_classes(name,class) values (' 3rd Party Fee ','pass_through') returning id")
    a, _ = expect_fail(cur, "insert into money_item_classes(name,class) values ('3RD-party fee','fee')", None, "money_item_classes_one_live")
    b, _ = expect_fail(cur, "update money_item_classes set name='Other' where id=%s", (x,), "never changes")
    q(cur, "update money_item_classes set removed_at=now() where id=%s", (x,))
    c, _ = expect_fail(cur, "update money_item_classes set removed_at=null where id=%s", (x,), "stays removed")
    d = blocked_or_zero(cur, "delete from money_item_classes where id=%s", (x,))[0]
    q(cur, "reset role")
    as_user(cur, 'u6'); seen = one(cur, "select count(*) from money_item_classes"); q(cur, "reset role")
    return (t and a and b and c and d and seen == 1, f"team member refused={t} · same name other spelling refused={a} · rename refused={b} · un-remove refused={c} · delete refused={d} · a View person reads {seen}")

@test("D1-06 'Fully Paid (Audit Required)' counts and is flagged; only a paid SALE counts — pending, void, cancelled and draft never do, whatever their total")
def _(cur):
    a = fi(cur, 'D1-AUDIT', 400, audit_required=True, payments_status='Fully Paid (Audit Required)')
    rest = [fi(cur, 'D1-' + st[:4].upper(), 999, integrity_status='pending', payments_status=st) for st in ('Pending Payment', 'Void', 'Cancelled', 'Draft')]
    got = row(cur, a, "counts::text||'|'||audit_required::text")
    others = [row(cur, x, "counts::text") for x in rest]
    return (got == 'true|true' and others == ['false'] * 4, f"audit-required → {got} · pending/void/cancelled/draft → {others}")


# ================= cost import (D27, second builder, 28 Sep 2026): the raw Payments cost exports =================
def cl(ref, n, typ, status, amount, created, **kw):
    """one Transaction Expense Export line, as js/121 sends it (line_key = ref|type|created)"""
    d = {'ref': ref, 'line_key': ref + '|' + typ.lower() + '|' + created, 'expense_type': typ, 'status': status,
         'status_raw': status, 'amount_sar': amount, 'created_on': created}
    d.update(kw); return d
def ci(cur, lines=(), facts=(), seen='2026-09-27T10:00:00+03:00', wfrom=None, wto=None):
    return json.loads(json.dumps(one(cur, "select fn_cost_import(p_lines := %s::jsonb, p_facts := %s::jsonb, p_seen_at := %s, p_window_from := %s, p_window_to := %s, p_batch := 'qa')",
        (json.dumps(list(lines)), json.dumps(list(facts)), seen, wfrom, wto))))
def cost(cur, no):
    return one(cur, "select coalesce(cost_sar::float::text,'∅')||'|'||coalesce(profit_sar::float::text,'∅') from finance_invoices where invoice_no=%s and deleted_at is null", (no,))
T1, T2, T3 = '2026-07-01T10:00:00+03:00', '2026-07-01T11:00:00+03:00', '2026-07-02T09:00:00+03:00'

@test("COST-01 Only APPROVED expense lines are cost — Pending (blank amount), Under Review, Cancelled and Rejected never; the profit follows")
def _(cur):
    fi(cur, 'CI-1', 1000)
    as_user(cur, 'u4')
    r = ci(cur, [cl('CI-1', 1, 'Hotel Cost', 'approved', 400.255, T1), cl('CI-1', 2, 'Airline Fees', 'approved', 100, T2),
                 cl('CI-1', 3, 'Hotel Cost', 'pending', None, T3), cl('CI-1', 4, 'Visa', 'under_review', 30, T3),
                 cl('CI-1', 5, 'Insurance', 'cancelled', 20, T3), cl('CI-1', 6, 'Submission', 'rejected', 10, T3)])
    got = cost(cur, 'CI-1'); q(cur, "reset role")
    return (got == '500.26|499.74' and r['lines_new'] == 6 and r['cost_set'] == 1, f"cost|profit={got} · result={r}")

@test("COST-02 A reference with no money row is HELD: nothing stored, no invoice row made, and it is counted")
def _(cur):
    as_user(cur, 'u4')
    r = ci(cur, [cl('CI-NONE', 1, 'Hotel Cost', 'approved', 999, T1)])
    n_inv = one(cur, "select count(*) from finance_invoices where invoice_no='CI-NONE'")
    n_lines = one(cur, "select count(*) from finance_expense_lines where ref='CI-NONE'"); q(cur, "reset role")
    return (r['refs_held'] == 1 and n_inv == 0 and n_lines == 0, f"held={r['refs_held']} · invoice rows={n_inv} · lines stored={n_lines}")

@test("COST-03 The same file twice changes nothing — no line, no cost, no change-log entry")
def _(cur):
    fi(cur, 'CI-3', 800)
    L = [cl('CI-3', 1, 'Hotel Cost', 'approved', 300, T1, merchant='rate_hawk'), cl('CI-3', 2, 'Hotel Cost', 'pending', None, T2)]
    as_user(cur, 'u4'); ci(cur, L)
    h1 = one(cur, "select count(*) from record_history where table_name in ('finance_expense_lines','finance_invoices','finance_payments_facts')")
    r = ci(cur, L)
    h2 = one(cur, "select count(*) from record_history where table_name in ('finance_expense_lines','finance_invoices','finance_payments_facts')")
    got = cost(cur, 'CI-3'); q(cur, "reset role")
    return (r['lines_new'] == 0 and r['lines_changed'] == 0 and r['cost_same'] == 1 and h1 == h2 and got == '300|500',
            f"second run={r} · change-log rows before/after={h1}/{h2} · cost|profit={got}")

@test("COST-04 A NEWER file wins: a line now Cancelled (no decision date) drops out; when every approved line is gone, the cost this import wrote is taken back (empty, not 0)")
def _(cur):
    fi(cur, 'CI-4', 1000)
    as_user(cur, 'u4')
    ci(cur, [cl('CI-4', 1, 'Hotel Cost', 'approved', 300, T1, decided_on=T3), cl('CI-4', 2, 'Visa', 'approved', 200, T2, decided_on=T3)], seen='2026-08-01T10:00:00+03:00')
    a = cost(cur, 'CI-4')
    ci(cur, [cl('CI-4', 1, 'Hotel Cost', 'cancelled', 300, T1), cl('CI-4', 2, 'Visa', 'approved', 200, T2, decided_on=T3)], seen='2026-09-01T10:00:00+03:00')
    b = cost(cur, 'CI-4')
    r = ci(cur, [cl('CI-4', 1, 'Hotel Cost', 'cancelled', 300, T1), cl('CI-4', 2, 'Visa', 'cancelled', 200, T2)], seen='2026-09-02T10:00:00+03:00')
    c = cost(cur, 'CI-4'); miss = one(cur, "select cost_missing from money_rows where invoice_no='CI-4'"); q(cur, "reset role")
    return (a == '500|500' and b == '200|800' and c == '∅|∅' and miss is True and r['cost_cleared'] == 1, f"{a} → {b} → {c} (cost_missing={miss}) · {r}")

@test("COST-05 An OLDER file arriving after a newer one only fills what is empty: an approved line is not put back to Pending, a blank merchant is filled")
def _(cur):
    fi(cur, 'CI-5', 1000)
    as_user(cur, 'u4')
    ci(cur, [cl('CI-5', 1, 'Hotel Cost', 'approved', 450, T1, decided_on=T3)], seen='2026-09-20T10:00:00+03:00')
    r = ci(cur, [cl('CI-5', 1, 'Hotel Cost', 'pending', None, T1, merchant='rate_hawk')], seen='2026-08-20T10:00:00+03:00')
    st = one(cur, "select status||'|'||amount_sar::float||'|'||coalesce(merchant,'∅') from finance_expense_lines where ref='CI-5'")
    got = cost(cur, 'CI-5'); q(cur, "reset role")
    return (st == 'approved|450|rate_hawk' and got == '450|550', f"line={st} · cost|profit={got} · {r}")

@test("COST-06 Lines are replaced per reference only INSIDE the dates a newer file covers: a partial file drops the line it no longer lists inside its dates, and never touches lines outside them")
def _(cur):
    fi(cur, 'CI-6', 5000)
    early, inside, gone = '2026-06-01T10:00:00+03:00', '2026-06-20T10:00:00+03:00', '2026-06-21T10:00:00+03:00'
    as_user(cur, 'u4')
    ci(cur, [cl('CI-6', 1, 'Hotel Cost', 'approved', 1000, early), cl('CI-6', 2, 'Visa', 'approved', 300, inside), cl('CI-6', 3, 'Visa', 'approved', 70, gone)],
       seen='2026-07-01T10:00:00+03:00')
    r = ci(cur, [cl('CI-6', 2, 'Visa', 'approved', 300, inside)], seen='2026-07-02T10:00:00+03:00',
           wfrom='2026-06-19T00:00:00+03:00', wto='2026-06-22T23:59:59+03:00')
    keys = one(cur, "select string_agg(split_part(line_key,'|',2)||'@'||to_char(created_on at time zone 'Asia/Riyadh','MM-DD'),',' order by created_on) from finance_expense_lines where ref='CI-6'")
    got = cost(cur, 'CI-6'); q(cur, "reset role")
    return (r['lines_dropped'] == 1 and keys == 'hotel cost@06-01,visa@06-20' and got == '1300|3700', f"lines left={keys} · cost|profit={got} · {r}")

@test("COST-07 Never touched: a hand-entered row (D3), a commission (no cost by nature), a reference with several money rows (left for a person); a cost someone else wrote is not taken back")
def _(cur):
    one(cur, "insert into finance_invoices(invoice_no,line_no,client_group,invoice_date,revenue_sar,integrity_status,source) values ('CI-HAND',1,'D1 Test Co','2026-03-11',700,'verified_paid','manual') returning id")
    fi(cur, 'CI-COM', 900, revenue_way='commission'); fi(cur, 'CI-2R', 500); fi(cur, 'CI-2R', 600, line_no=2)
    fi(cur, 'CI-OTHER', 900); q(cur, "update finance_invoices set cost_sar=640 where invoice_no='CI-OTHER'")
    as_user(cur, 'u4')
    r = ci(cur, [cl(x, 1, 'Hotel Cost', 'approved', 100, T1) for x in ('CI-HAND', 'CI-COM', 'CI-2R')] + [cl('CI-OTHER', 1, 'Hotel Cost', 'cancelled', 100, T1)])
    got = [cost(cur, x) for x in ('CI-HAND', 'CI-COM', 'CI-OTHER')]
    two = one(cur, "select string_agg(coalesce(cost_sar::text,'∅'),',' order by line_no) from finance_invoices where invoice_no='CI-2R'"); q(cur, "reset role")
    return (r['manual'] == 1 and r['commission'] == 1 and r['several_rows'] == 1 and got == ['∅|∅', '∅|900', '640|260'] and two == '∅,∅',
            f"hand|commission|someone else's={got} · several rows={two} · {r}")

@test("COST-08 Only Full control of Finance imports cost; a View person is refused and cannot write the new tables; anon reads nothing")
def _(cur):
    fi(cur, 'CI-8', 1000)
    as_user(cur, 'u6'); a, am = expect_fail(cur, "select fn_cost_import(p_lines := %s::jsonb)", (json.dumps([cl('CI-8', 1, 'Hotel Cost', 'approved', 1, T1)]),), "Full control of Finance")
    b, _ = expect_fail(cur, "insert into finance_expense_lines(ref,line_key,status) values ('CI-8','x','approved')", None, "row-level security")
    seen = one(cur, "select count(*) from finance_expense_lines"); q(cur, "reset role")
    q(cur, "set local role anon"); c, _ = expect_fail(cur, "select count(*) from finance_payments_facts", None, "permission denied"); q(cur, "reset role")
    return (a and b and c and seen == 0, f"view person refused={a} ({am[:60]}) · direct insert refused={b} · anon refused={c}")

@test("COST-09 Any order: a money row that arrives after its lines (imported again after it was removed) takes its cost from them at once — and the profit with it")
def _(cur):
    i = fi(cur, 'CI-9', 1000)
    as_user(cur, 'u4'); ci(cur, [cl('CI-9', 1, 'Hotel Cost', 'approved', 350, T1)]); q(cur, "reset role")
    q(cur, "delete from finance_invoices where id=%s", (i,))   # gone (a soft-deleted row keeps its number, so it is never re-imported)
    as_user(cur, 'u4')
    one(cur, "select fn_commit_finance_import(p_insert := %s::jsonb)", (json.dumps([{'invoice_no': 'CI-9', 'client_group': 'D1 Test Co', 'invoice_date': '2026-03-10',
        'total_incl_vat_sar': 1000, 'integrity_status': 'verified_paid', 'payments_status': 'Fully Paid'}]),))
    got = cost(cur, 'CI-9'); q(cur, "reset role")
    return (got == '350|650', f"re-imported row cost|profit={got}")

@test("COST-10 The Expense Invoice Export's Overdue is the newer file's (a blank clears it); the Revenue Report keeps only the submitted expenses; references without a money row are held")
def _(cur):
    fi(cur, 'CI-10', 1000)
    as_user(cur, 'u4')
    ci(cur, facts=[{'ref': 'CI-10', 'kind': 'ei', 'overdue': '1 Overdue', 'expense_assignments': '1 Pending', 'invoice_status': 'Fully Paid'}], seen='2026-09-01T10:00:00+03:00')
    a = one(cur, "select coalesce(overdue,'∅')||'|'||expense_assignments from finance_payments_facts where ref='CI-10'")
    ci(cur, facts=[{'ref': 'CI-10', 'kind': 'ei', 'overdue': None, 'expense_assignments': '1 Approved', 'invoice_status': 'Fully Paid'}], seen='2026-09-02T10:00:00+03:00')
    b = one(cur, "select coalesce(overdue,'∅')||'|'||expense_assignments from finance_payments_facts where ref='CI-10'")
    r = ci(cur, facts=[{'ref': 'CI-10', 'kind': 'rr', 'rr_total_expense_sar': 812.5}, {'ref': 'CI-CONSUMER', 'kind': 'rr', 'rr_total_expense_sar': 5}])
    c = one(cur, "select rr_total_expense_sar::float from finance_payments_facts where ref='CI-10'")
    stray = one(cur, "select count(*) from finance_payments_facts where ref='CI-CONSUMER'")
    cst = cost(cur, 'CI-10'); q(cur, "reset role")
    return (a == '1 Overdue|1 Pending' and b == '∅|1 Approved' and c == 812.5 and stray == 0 and r['refs_held'] == 1 and cst == '∅|∅',
            f"{a} → {b} · revenue-report expenses={c} · consumer ref stored={stray} · cost stays empty={cst}")

_cc = conn(); _has_fallback = one(_cc.cursor(), "select count(*) from information_schema.columns where table_name='money_rows' and column_name='est_cost_source'"); _cc.close()
if _has_fallback:   # cost-fallback.sql builds on D23 (#57); until both are applied this test has nothing to test
    @test("COST-11 The cost fallback, in order: approved lines, then the Revenue Report's submitted expenses, then the D23 pass-through — the last two only as a flagged estimate beside the cost")
    def _(cur):
        fi(cur, 'CI-11', 1000); fi(cur, 'CI-11C', 900, revenue_way='commission')
        one(cur, "insert into finance_invoice_lines(invoice_no,line_no,kind,name,item_total_sar) values ('CI-11',1,'item','Hotel Booking - CI Pass Cost',700) returning id")
        one(cur, "insert into money_item_classes(name,class) values ('CI Pass Cost','pass_through') returning id")
        est = lambda: one(cur, "select coalesce(est_cost_sar::float::text,'∅')||'|'||cost_estimated||'|'||coalesce(est_cost_source,'∅')||'|'||coalesce(cost_sar::float::text,'∅') from money_rows where invoice_no='CI-11'")
        as_user(cur, 'u4')
        a = est()
        ci(cur, facts=[{'ref': 'CI-11', 'kind': 'rr', 'rr_total_expense_sar': 820}, {'ref': 'CI-11C', 'kind': 'rr', 'rr_total_expense_sar': 50}]); b = est()
        ci(cur, facts=[{'ref': 'CI-11', 'kind': 'rr', 'rr_total_expense_sar': 0}], seen='2026-09-28T10:00:00+03:00'); zero = est()
        ci(cur, [cl('CI-11', 1, 'Hotel Cost', 'approved', 760, T1)], seen='2026-09-28T11:00:00+03:00'); d = est()
        com = one(cur, "select coalesce(est_cost_sar::text,'∅') from money_rows where invoice_no='CI-11C'")
        kpi = one(cur, "select coalesce(est_cost_source,'∅')||'|'||cost_sar::float from finance_lines where invoice_no='CI-11'"); q(cur, "reset role")
        ok = (a == '700|true|pass_through|∅' and b == '820|true|submitted_expenses|∅' and zero == '700|true|pass_through|∅'
              and d == '∅|false|∅|760' and com == '∅' and kpi == '∅|760')
        return (ok, f"pass-through only={a} · + revenue report={b} · report says 0={zero} · approved lines arrive={d} · commission={com} · KPI source={kpi}")


# ================= client list + promo codes (D28, second builder, 28 Sep 2026): the Payments lists =================
_cc = conn(); _has_lists = one(_cc.cursor(), "select count(*) from pg_proc where proname='fn_payments_clients_import'"); _cc.close()
if _has_lists:   # scripts/sql/clients-promo-import.sql
    def pc(cur, rows, seen='2026-09-27T10:00:00+03:00'):
        return json.loads(json.dumps(one(cur, "select fn_payments_clients_import(%s::jsonb, %s, 'qa')", (json.dumps(list(rows)), seen))))
    def pr(cur, rows, seen='2026-09-27T10:00:00+03:00'):
        return json.loads(json.dumps(one(cur, "select fn_promo_codes_import(%s::jsonb, %s, 'qa')", (json.dumps(list(rows)), seen))))
    def cid(cur, no):
        return one(cur, "select coalesce(payments_client_id,'∅') from finance_invoices where invoice_no=%s and deleted_at is null", (no,))

    @test("CP-01 The client list is stored as Payments' register, field by field — and writes NOTHING onto invoice rows (matching is live, never a stamp)")
    def _(cur):
        fi(cur, 'CP-1A', 100, customer_email='buyer@client-one.test'); fi(cur, 'CP-1C', 100, customer_email='buyer@client-one.test', payments_client_id='C-OTHER')
        as_user(cur, 'u4')
        h1 = one(cur, "select count(*) from record_history where table_name='finance_invoices'")
        r = pc(cur, [{'client_id': '9101', 'legal_name': 'Client One Co', 'contact_email': 'BUYER@client-one.test', 'credit_term_days': 30, 'payment_mode': 'Postpaid',
                      'has_vat_number': 'Yes', 'pricing_setting': 'Standard', 'block_on_overdue': 'No', 'payments_updated_at': '2026-09-20T10:00:00+03:00'},
                     {'client_id': '9102', 'legal_name': 'Staff test', 'contact_email': 'someone@directksa.com'}])
        got = [cid(cur, n) for n in ('CP-1A', 'CP-1C')]
        h2 = one(cur, "select count(*) from record_history where table_name='finance_invoices'")
        st = one(cur, "select legal_name||'|'||contact_email||'|'||credit_term_days||'|'||payment_mode||'|'||has_vat_number||'|'||pricing_setting||'|'||block_on_overdue||'|'||to_char(payments_updated_at at time zone 'Asia/Riyadh','YYYY-MM-DD HH24:MI') from payments_clients where client_id='9101'"); q(cur, "reset role")
        ok = (got == ['∅', 'C-OTHER'] and h1 == h2 and r['clients_new'] == 2 and set(r) == {'clients_in_file', 'clients_new', 'clients_changed', 'clients_same'}
              and st == 'Client One Co|buyer@client-one.test|30|Postpaid|Yes|Standard|No|2026-09-20 10:00')
        return (ok, f"invoice client IDs after the import → {got} · invoice change-log rows {h1}/{h2} · stored={st} · result={r}")

    @test("CP-02 The same client list twice changes nothing — no client row, no change-log entry")
    def _(cur):
        rows = [{'client_id': '9201', 'legal_name': 'Two Co', 'contact_email': 'two@client.test', 'credit_limit_sar': 50000}]
        as_user(cur, 'u4'); pc(cur, rows)
        h1 = one(cur, "select count(*) from record_history where table_name in ('payments_clients','finance_invoices')")
        r = pc(cur, rows)
        h2 = one(cur, "select count(*) from record_history where table_name in ('payments_clients','finance_invoices')"); q(cur, "reset role")
        return (r['clients_new'] == 0 and r['clients_changed'] == 0 and r['clients_same'] == 1 and h1 == h2,
                f"second run={r} · change-log rows before/after={h1}/{h2}")

    @test("CP-03 Any order for the client list: a newer file wins, an older one only fills blanks, a blank never wipes")
    def _(cur):
        as_user(cur, 'u4')
        pc(cur, [{'client_id': '9301', 'legal_name': 'Name Aug', 'credit_term_days': 30}], seen='2026-08-01T10:00:00+03:00')
        pc(cur, [{'client_id': '9301', 'legal_name': 'Name Jul', 'contact_phone': '0500000001', 'credit_term_days': 15}], seen='2026-07-01T10:00:00+03:00')
        a = one(cur, "select legal_name||'|'||contact_phone||'|'||credit_term_days from payments_clients where client_id='9301'")
        pc(cur, [{'client_id': '9301', 'legal_name': '', 'credit_term_days': 45}], seen='2026-09-01T10:00:00+03:00')
        b = one(cur, "select legal_name||'|'||contact_phone||'|'||credit_term_days from payments_clients where client_id='9301'"); q(cur, "reset role")
        return (a == 'Name Aug|0500000001|30' and b == 'Name Aug|0500000001|45', f"older file after newer → {a} · newer with a blank name → {b}")

    @test("CP-04 An invoice imported AFTER the client list is not stamped either — no trigger writes a client ID onto a money row")
    def _(cur):
        as_user(cur, 'u4')
        pc(cur, [{'client_id': '9401', 'legal_name': 'Test client', 'contact_email': 'test@client-four.test'}])
        q(cur, "reset role")
        fi(cur, 'CP-4A', 300, customer_email='test@client-four.test')
        q(cur, "update finance_invoices set customer_email='test@client-four.test' where invoice_no='CP-4A'")
        trg = one(cur, "select count(*) from pg_trigger where tgrelid='public.finance_invoices'::regclass and tgname like '%%client%%'")
        got = cid(cur, 'CP-4A')
        return (got == '∅' and trg == 0, f"client ID after insert and email change → {got} · client triggers on finance_invoices={trg}")

    @test("CP-05 Only Full control of Finance imports the lists — View is refused by the database, anon cannot even call it")
    def _(cur):
        as_user(cur, 'u6')
        a, m1 = expect_fail(cur, "select fn_payments_clients_import('[{\"client_id\":\"9501\"}]'::jsonb, now(), 'qa')", None, "Full control of Finance")
        b, m2 = expect_fail(cur, "select fn_promo_codes_import('[{\"code\":\"CP5\",\"kind\":\"percent\"}]'::jsonb, now(), 'qa')", None, "Full control of Finance")
        q(cur, "reset role"); q(cur, "set local role anon")
        c, m3 = expect_fail(cur, "select fn_payments_clients_import('[]'::jsonb, now(), 'qa')", None, "permission denied")
        q(cur, "reset role")
        n = one(cur, "select count(*) from payments_clients where client_id='9501'") + one(cur, "select count(*) from promo_codes where code='CP5'")
        return (a and b and c and n == 0, f"view: {m1} · {m2} · anon: {m3} · rows written={n}")

    @test("CP-06 Promo codes: a known code (any case) takes Payments' figures; a new one is created; one whose type cannot be read is left out and counted; the Client Name is only a suggestion; twice = no change")
    def _(cur):
        co = one(cur, "insert into businesses(name,is_client) values ('Promo Partner',true) returning id")
        pid = one(cur, "insert into promo_codes(code,kind,value_pct,total_sales_sar,total_discount_sar,active,partner_business_id,notes) values ('CPSIX','percent',5,0,0,true,%s,'kept note') returning id", (co,))
        links = one(cur, "select count(*) from company_discount_codes")
        rows = [{'code': ' cpsix ', 'promo_type': 'Corporate', 'discount_type': 'Percentage', 'discount': 12, 'kind': 'percent', 'status': 'Active', 'active': True,
                 'client_name': 'Some Client', 'valid_from': '2026-01-01', 'valid_to': '2026-12-31', 'total_sales_sar': 15000.5, 'total_discount_sar': 1800},
                {'code': 'CPNEW', 'discount_type': 'Fixed', 'discount': 100, 'kind': 'fixed', 'status': 'Expired', 'active': False, 'expired': True, 'total_sales_sar': 900},
                {'code': 'CPODD', 'discount_type': 'Mystery', 'discount': 3}]
        as_user(cur, 'u4'); r1 = pr(cur, rows)
        a = one(cur, "select code||'|'||kind||'|'||value_pct::float||'|'||total_sales_sar::float||'|'||total_discount_sar::float||'|'||valid_to||'|'||payments_client_name||'|'||coalesce(partner_business_id::text,'∅')||'|'||notes from promo_codes where id=%s", (pid,))
        b = one(cur, "select kind||'|'||value_pct::float||'|'||active||'|'||expired||'|'||total_discount_sar::float from promo_codes where code='CPNEW'")
        odd = one(cur, "select count(*) from promo_codes where code='CPODD'")
        h1 = one(cur, "select count(*) from record_history where table_name='promo_codes'")
        r2 = pr(cur, rows); h2 = one(cur, "select count(*) from record_history where table_name='promo_codes'"); q(cur, "reset role")
        links2 = one(cur, "select count(*) from company_discount_codes")
        ok = (a == 'CPSIX|percent|12|15000.5|1800|2026-12-31|Some Client|' + str(co) + '|kept note' and b == 'fixed|100|false|true|0' and odd == 0
              and r1['codes_new'] == 1 and r1['codes_changed'] == 1 and r1['codes_no_type'] == 1 and r2['codes_changed'] == 0 and r2['codes_new'] == 0
              and h1 == h2 and links == links2)
        return (ok, f"known={a} · new={b} · unreadable type stored={odd} · first={r1} · second={r2} · change-log {h1}/{h2} · company links {links}/{links2}")

    @test("CP-07 Promo codes in any order: an older file only fills blanks; a blank total never wipes the stored one")
    def _(cur):
        as_user(cur, 'u4')
        pr(cur, [{'code': 'CPSEVEN', 'kind': 'percent', 'discount': 10, 'total_sales_sar': 5000, 'status': 'Active', 'active': True}], seen='2026-09-01T10:00:00+03:00')
        pr(cur, [{'code': 'CPSEVEN', 'kind': 'percent', 'discount': 8, 'total_sales_sar': 3000, 'valid_to': '2026-10-31'}], seen='2026-08-01T10:00:00+03:00')
        a = one(cur, "select value_pct::float||'|'||total_sales_sar::float||'|'||valid_to from promo_codes where code='CPSEVEN'")
        pr(cur, [{'code': 'CPSEVEN', 'kind': 'percent', 'discount': 10, 'total_sales_sar': None, 'status': 'Active', 'active': True}], seen='2026-09-20T10:00:00+03:00')
        b = one(cur, "select total_sales_sar::float||'|'||valid_to from promo_codes where code='CPSEVEN'"); q(cur, "reset role")
        return (a == '10|5000|2026-10-31' and b == '5000|2026-10-31', f"older after newer → {a} · newer with a blank total → {b}")

for n, ok, d in results: print(("PASS " if ok else "FAIL ") + n + "\n      " + d)
fails = [n for n, ok, _ in results if not ok]
print(f"\n{len(results)-len(fails)}/{len(results)} passed"); sys.exit(1 if fails else 0)
