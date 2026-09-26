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
@test("A09 Department is stamped from the owner (can't be typed wrong)")
def _(cur):
    t = one(cur, "insert into tasks(title,business_id,owner_id,work_type,department_id) values ('T',%s,%s,'sales',%s) returning id", (F['coA'], F['m3'], F['dep_bus']))
    return (one(cur, "select department_id=%s from tasks where id=%s", (F['dep_par'], t)), "stamped Partnership though Business was sent")
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
    q(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by,supersedes_id,correction_note) values ('monthly',%s,'issued','{}',now(),%s,%s,'Fixed MDD figure')", (F['apr26'], F['m4'], r))
    st = one(cur, "select status from reports where id=%s", (r,))
    return (ok and ok2 and st == 'superseded', f"{m} | {m2} | old report now {st}")
@test("A17 Issued snapshot doesn't move when Finance re-imports a changed invoice")
def _(cur):
    p = new_project(cur); link(cur, 'INV-A26', p)
    live = one(cur, "select revenue_sar from project_money where project_id=%s", (p,))
    r = one(cur, "insert into reports(kind,period_id,status,snapshot,issued_at,issued_by) values ('monthly',%s,'issued',%s,now(),%s) returning id", (F['mar26'], json.dumps({'revenue': float(live)}), F['m4']))
    q(cur, "update finance_invoices set revenue_sar=90000 where invoice_no='INV-A26' and line_no=1")
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
@test("A32 Reassign an open task → department follows; a finished task keeps its department")
def _(cur):
    t = new_task(cur, company='coA'); q(cur, "update tasks set owner_id=%s where id=%s", (F['m3'], t))
    d1 = one(cur, "select department_id=%s from tasks where id=%s", (F['dep_par'], t))
    t2 = new_task(cur, company='coA'); q(cur, "update tasks set status='done' where id=%s", (t2,)); q(cur, "update tasks set owner_id=%s where id=%s", (F['m3'], t2))
    d2 = one(cur, "select department_id=%s from tasks where id=%s", (F['dep_bus'], t2))
    return (d1 and d2, f"open→Partnership={d1}, done stays Business={d2}")
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

@test("R1-03 History follows the Tasks page: with visibility OFF a colleague on Own (not on the task) reads none of its history; no Tasks page → none; the owner and a View login read it")
def _(cur):
    t = new_task(cur, company='coA', owner='m1')
    as_user(cur, 'u1'); q(cur, "update tasks set title='R1 renamed' where id=%s", (t,)); q(cur, "reset role")
    q(cur, "update work_settings set value='false' where key='open_visibility'")
    own_tasks(cur, 'u3')
    count = lambda: one(cur, "select count(*) from record_history where table_name='tasks' and record_id=%s", (t,))
    as_user(cur, 'u3'); other = count(); q(cur, "reset role")
    q(cur, "update app_users set page_access = page_access - 'tasks' where id=%s", (F['u2'],))
    as_user(cur, 'u2'); nopage = count(); q(cur, "reset role")
    as_user(cur, 'u1'); owner = count(); q(cur, "reset role")
    as_user(cur, 'u6'); viewer = count(); q(cur, "reset role")
    return (other == 0 and nopage == 0 and owner >= 2 and viewer >= 2, f"colleague on Own={other} · no Tasks page={nopage} · owner={owner} · View={viewer}")

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

@test("T-02 A manager cannot rename or switch off a department (admin only); an admin can; only an admin removes a team-list row")
def _(cur):
    as_user(cur, 'u4')
    a, m = expect_fail(cur, "update departments set name_en='Renamed' where id=%s", (F['dep_bus'],), "only an admin")
    b, m2 = expect_fail(cur, "update departments set active=false where id=%s", (F['dep_qua'],), "only an admin")
    q(cur, "delete from team_members where id=%s", (F['m6'],)); still = one(cur, "select count(*) from team_members where id=%s", (F['m6'],))
    q(cur, "reset role"); as_user(cur, 'admin')
    q(cur, "update departments set name_en='Renamed' where id=%s", (F['dep_bus'],)); q(cur, "reset role")
    renamed = one(cur, "select name_en from departments where id=%s", (F['dep_bus'],))
    return (a and b and still == 1 and renamed == 'Renamed', f"manager rename: {m[:50]} · switch off refused={b} · manager delete left row={still} · admin renamed → {renamed}")

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

@test("R4-01 Client IDs: at most 3 OPEN per company; unique across companies, spaces and all; closing one makes room")
def _(cur):
    as_user(cur, 'u1')
    a, m1 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1004','tender','active')", (F['coA'],), "at most 3 open")
    b, m2 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'C-1001','tender','active')", (F['coB'],), "unique")
    c, m3 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'  C-1001 ','tender','active')", (F['coB'],), "unique")
    d, m4 = expect_fail(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'   ','tender','active')", (F['coB'],), "needs the number")
    q(cur, "update client_profiles set closed_at=now() where id=%s", (F['cpA_ten'],))
    q(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,' C-1005 ','tender','active')", (F['coA'],))
    stored = one(cur, "select direct_client_id from client_profiles where direct_client_id like '%%C-1005%%'")
    e, m5 = expect_fail(cur, "update client_profiles set closed_at=null where id=%s", (F['cpA_ten'],), "at most 3 open")
    q(cur, "reset role")
    return (a and b and c and d and stored == 'C-1005' and e, f"4th open refused={a} · same ID on another company refused={b} · with spaces refused={c} · blank refused={d} · after closing one: added, stored as {stored!r} · reopening the closed one (4 open) refused={e}")

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
    as_user(cur, 'u1'); l = one(cur, "insert into company_discount_codes(business_id,promo_code_id,note) values (%s,%s,'staff travel') returning id", (F['coA'], code))
    q(cur, "reset role"); as_user(cur, 'u2')
    a, m1 = expect_fail(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s)", (F['coB'], code), "duplicate")
    b, m2 = expect_fail(cur, "update company_discount_codes set business_id=%s where id=%s", (F['coB'], l), "never re-pointed")
    q(cur, "reset role"); q(cur, "select set_config('app.today','2026-09-25',true)")
    card = one(cur, "select string_agg(x->>'code', ',' order by x->>'code') from company_card, jsonb_array_elements(discount_codes) x where business_id=%s", (F['coA'],))
    as_user(cur, 'u1'); q(cur, "update company_discount_codes set removed_at=now() where id=%s", (l,))
    c, m3 = expect_fail(cur, "update company_discount_codes set removed_at=null where id=%s", (l,), "stays removed")
    dz = blocked_or_zero(cur, "delete from company_discount_codes where id=%s", (l,))   # a team member: nothing deleted
    q(cur, "reset role"); d, m4 = expect_fail(cur, "delete from company_discount_codes where id=%s", (l,), "never deleted"); d = d and dz[0]   # an admin: refused outright
    as_user(cur, 'u1')
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
    as_user(cur, 'u1')
    q(cur, "insert into client_profiles(business_id,direct_client_id,profile_type,status) values (%s,'H-1','tender','active')", (F['coB'],))
    q(cur, sq, a1); q(cur, "update company_documents set deleted_at=now() where id=%s", (i,))
    q(cur, "insert into company_discount_codes(business_id,promo_code_id) values (%s,%s)", (F['coB'], code))
    q(cur, "reset role")
    rows = q(cur, "select table_name, action from record_history where actor=%s and table_name in ('client_profiles','company_documents','company_discount_codes') order by id", (F['u1'],))
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

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(("PASS " if ok else "FAIL ") + n + "\n      " + d)
fails = [n for n, ok, _ in results if not ok]
print(f"\n{len(results)-len(fails)}/{len(results)} passed"); sys.exit(1 if fails else 0)
