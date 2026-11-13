"""Meridian Rewards campaign decision cockpit: refresh script.

Reads portfolio.json, profile.json, transcript.json (JSON lines) from this folder,
runs the quality checks, and writes:
  cockpit/public/data.js              aggregates only, no member IDs
  Meridian_Cockpit_Workbook.xlsx      data dictionary, metrics, matrix, scenarios

Run:  python build.py
"""
import json, statistics, datetime
from collections import defaultdict, Counter
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

HERE = Path(__file__).parent
load = lambda f: [json.loads(l) for l in open(HERE / f, encoding="utf-8") if l.strip()]
P, M, T = load("portfolio.json"), load("profile.json"), load("transcript.json")

offers = {p["id"]: p for p in P}
members = {m["id"]: m for m in M}
WAVES = sorted({t["time"] for t in T if t["event"] == "offer received"})
T_MAX = max(t["time"] for t in T)
COHORTS = ["Views, then completes", "Completes mostly unviewed", "Buys, never completes", "No purchase"]

# ---------- offer instances: one row per offer received ----------
# A view or completion belongs to a receipt of the same offer by the same member.
# ponytail: assumes time is in hours (duration is in days). Stated as an assumption in the cockpit.
inst = defaultdict(list)          # (person, offer) -> [instance]
unmatched = Counter()
for t in T:                       # file is in time order; receipts precede views at equal time
    ev, who = t["event"], t["person"]
    if ev == "offer received":
        oid = t["value"]["offer id"]
        inst[who, oid].append({"t": t["time"], "end": t["time"] + offers[oid]["duration"] * 24,
                               "view": None, "done": None})
    elif ev == "offer viewed":
        rows = [i for i in inst[who, t["value"]["offer id"]] if i["t"] <= t["time"]]
        if not rows: unmatched[ev] += 1; continue
        tgt = next((i for i in reversed(rows) if i["view"] is None), rows[-1])
        if tgt["view"] is None: tgt["view"] = t["time"]
    elif ev == "offer completed":
        rows = [i for i in inst[who, t["value"]["offer_id"]] if i["t"] <= t["time"]]
        open_ = [i for i in rows if i["done"] is None and t["time"] <= i["end"]]
        if not open_: unmatched[ev] += 1; continue
        open_[0]["done"] = t["time"]

def unviewed(i):  # completed with no view at or before the completion
    return i["done"] is not None and (i["view"] is None or i["view"] > i["done"])

# ---------- member behaviour cohorts (no demographics) ----------
tx = defaultdict(list)
for t in T:
    if t["event"] == "transaction": tx[t["person"]].append((t["time"], t["value"]["amount"]))
done_n, unv_n = Counter(), Counter()
for (who, _), rows in inst.items():
    for i in rows:
        if i["done"] is not None:
            done_n[who] += 1
            unv_n[who] += unviewed(i)
def cohort_of(who):
    if who not in tx: return "No purchase"
    if not done_n[who]: return "Buys, never completes"
    return "Completes mostly unviewed" if unv_n[who] / done_n[who] >= 0.5 else "Views, then completes"
cohort = {m: cohort_of(m) for m in members}

# ---------- cube: offer x wave x cohort ----------
cube = defaultdict(lambda: [0, 0, 0, 0, 0, 0])  # received, viewed, completed, unviewed, reward, unviewed reward
for (who, oid), rows in inst.items():
    r = offers[oid]["reward"]
    for i in rows:
        c = cube[oid, WAVES.index(i["t"]), cohort[who]]
        c[0] += 1; c[1] += i["view"] is not None
        if i["done"] is not None:
            c[2] += 1; c[4] += r
            if unviewed(i): c[3] += 1; c[5] += r

# ---------- spend: period x cohort, and daily series ----------
bounds = WAVES + [T_MAX + 1]
def period_of(time): return max(k for k, w in enumerate(WAVES) if w <= time)
spend = defaultdict(lambda: {"buyers": set(), "spend": 0.0, "tx": 0})
daily = defaultdict(float)
for who, rows in tx.items():
    for time, amt in rows:
        for per in ("all", period_of(time)):
            s = spend[per, cohort[who]]
            s["buyers"].add(who); s["spend"] += amt; s["tx"] += 1
        daily[time // 24, cohort[who]] += amt
n_days = T_MAX // 24 + 1

# ---------- quality checks ----------
total_reward = sum(t["value"]["reward"] for t in T if t["event"] == "offer completed")
total_spend = sum(a for rows in tx.values() for _, a in rows)
dups = Counter(json.dumps(t, sort_keys=True) for t in T)
dup_rows = sum(v - 1 for v in dups.values())
dup_events = Counter(json.loads(k)["event"] for k, v in dups.items() for _ in range(v - 1))
age118 = sum(m["age"] == 118 for M_ in [M] for m in M_)
no_income = sum(m["income"] is None for m in M)
both = sum(m["age"] == 118 and m["income"] is None for m in M)
shape = Counter((t["event"], tuple(sorted(t["value"]))) for t in T)
good_shape = {("transaction", ("amount",)), ("offer received", ("offer id",)),
              ("offer viewed", ("offer id",)), ("offer completed", ("offer_id", "reward"))}
tx_offer_ids = {t["value"].get("offer id") or t["value"].get("offer_id") for t in T if t["event"] != "transaction"}
big = [a for rows in tx.values() for _, a in rows if a > 100]
reward_mismatch = sum(1 for t in T if t["event"] == "offer completed"
                      and t["value"]["reward"] != offers[t["value"]["offer_id"]]["reward"])
info_done = sum(1 for t in T if t["event"] == "offer completed"
                and offers[t["value"]["offer_id"]]["offer_type"] == "informational")
never_received = len(set(members) - {w for w, _ in inst})

def chk(name, ok, detail, warn=False):
    return {"name": name, "status": "pass" if ok else ("warn" if warn else "fail"), "detail": detail}
checks = [
    chk("Row counts match the case exhibit", (len(P), len(M), len(T)) == (10, 17000, 306534),
        f"{len(P)} offers, {len(M):,} members, {len(T):,} events (expected 10 / 17,000 / 306,534)"),
    chk("Every event joins to a known offer and member",
        tx_offer_ids <= set(offers) and {t['person'] for t in T} <= set(members),
        f"{len(tx_offer_ids)} offer IDs in events, all in portfolio; {len({t['person'] for t in T}):,} members in events, all in profile"),
    chk("Event fields have the expected shape", set(shape) == good_shape,
        "received/viewed carry value['offer id']; completed carries value['offer_id'] and reward; transactions carry amount only"),
    chk("Missing income and age 118 coincide", age118 == no_income == both,
        f"{both:,} members have age 118 and no income or gender. Kept in spend totals, never used in targeting"),
    chk("Completion reward equals the portfolio reward", reward_mismatch == 0, f"{reward_mismatch} mismatches"),
    chk("Informational offers are never completed", info_done == 0, f"{info_done} completions on informational offers"),
    chk("Every view and completion follows a receipt", not unmatched,
        f"{sum(unmatched.values())} events without a matching earlier receipt"),
    chk("No exact duplicate event rows", dup_rows == 0,
        f"{dup_rows} duplicate rows, all of them offer completed events. Kept, because a member can hold the same offer twice "
        "and one purchase can complete both. Meaning not validated with the data manager", warn=True),
    chk("No extreme transactions", not big,
        f"{len(big)} transactions above 100 units carry {sum(big) / total_spend:.1%} of spend (largest {max(big):,.2f}). Kept", warn=True),
]

# ---------- self-check: the cube must reconcile to the raw file ----------
assert sum(c[0] for c in cube.values()) == sum(t["event"] == "offer received" for t in T)
assert sum(c[4] for c in cube.values()) == total_reward, "cube reward != raw reward"
assert sum(c[2] for c in cube.values()) == sum(t["event"] == "offer completed" for t in T)
assert abs(sum(s["spend"] for (p, _), s in spend.items() if p == "all") - total_spend) < 0.01

# ---------- proxy audit: does a behaviour cohort mirror a demographic? ----------
audit = []
for c in COHORTS:
    ms = [members[m] for m in members if cohort[m] == c]
    known = [m for m in ms if m["income"] is not None]
    audit.append({"cohort": c, "members": len(ms),
                  "missing_demo": 1 - len(known) / len(ms),
                  "female": sum(m["gender"] == "F" for m in known) / len(known) if known else None,
                  "median_income": statistics.median(m["income"] for m in known) if known else None,
                  "median_age": statistics.median(m["age"] for m in known) if known else None})

def label(o):
    return (f"{o['offer_type'].capitalize() if o['offer_type'] != 'bogo' else 'BOGO'} "
            + (f"£{o['reward']} back on £{o['difficulty']}" if o["reward"] else "message") + f", {int(o['duration'])}d")

DATA = {
    "generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    "rows": {"offers": len(P), "members": len(M), "events": len(T)},
    "waves": WAVES, "bounds": bounds, "cohorts": COHORTS,
    "offers": [{"id": o["id"], "short": o["id"][:6], "label": label(o), "type": o["offer_type"],
                "reward": o["reward"], "difficulty": o["difficulty"], "duration": o["duration"],
                "channels": o["channels"]} for o in P],
    "cube": [[oid, w, c, *v] for (oid, w, c), v in sorted(cube.items())],
    "spend": [[str(p), c, len(s["buyers"]), round(s["spend"], 2), s["tx"]] for (p, c), s in sorted(spend.items(), key=str)],
    "daily": {c: [round(daily[d, c], 2) for d in range(n_days)] for c in COHORTS},
    "cohortMembers": dict(Counter(cohort.values())),
    "totals": {"reward": total_reward, "spend": round(total_spend, 2), "buyers": len(tx),
               "neverReceived": never_received},
    "checks": checks, "audit": audit,
    "case": {"cycles": 4, "A": {"setup": 4000, "run": 500, "p": [0.05, 0.10, 0.15]},
             "B": {"setup": 9000, "run": 1000, "u": [0.01, 0.03, 0.05], "contrib": 0.35, "incentive": 0.10}},
}
(HERE / "cockpit" / "public").mkdir(parents=True, exist_ok=True)
(HERE / "cockpit" / "public" / "data.js").write_text("window.DATA=" + json.dumps(DATA, separators=(",", ":")) + ";", encoding="utf-8")

# =====================  Excel workbook  =====================
wb = Workbook()
HEAD = PatternFill("solid", fgColor="1F3A5F"); INPUT = PatternFill("solid", fgColor="FFF2CC")
def sheet(name, rows, widths=None, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = name
    for r in rows: ws.append(r)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD
    for i, w in enumerate(widths or [], 1): ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows():
        for c in row: c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "A2"
    return ws

def agg(rows):  # rows of cube values -> metrics
    v = [sum(x) for x in zip(*rows)] if rows else [0] * 6
    return v
def by(keyfn):
    g = defaultdict(list)
    for k, v in cube.items(): g[keyfn(k)].append(v)
    return {k: agg(v) for k, v in g.items()}
div = lambda a, b: a / b if b else None

sheet("Read me", [
    ["Meridian Rewards campaign decision cockpit: workbook"],
    [f"Generated {DATA['generated']} by build.py from portfolio.json, profile.json and transcript.json."],
    ["Refresh: put the three JSON-lines files beside build.py, run `python build.py`. The script stops if the cube does not reconcile to the raw file."],
    ["Yellow cells are inputs you can edit. The Prioritisation and Scenarios sheets recalculate from them."],
    ["Every figure is an observed association. Nothing here proves an offer caused a purchase. See the Limits sheet."],
    ["Assumptions: time is in hours, 1 dataset monetary unit = £1, the whole observed period stands in for one campaign cycle."],
], [140], first=True)

sheet("Data dictionary", [
    ["File", "Grain (one row is)", "Key", "Field", "Meaning", "Handling"],
    ["portfolio.json", "One offer (10)", "id", "offer_type", "bogo, discount or informational", "Informational offers have reward 0 and cannot be completed"],
    ["portfolio.json", "", "", "reward", "Face value paid on completion", "Matches the reward on every completed event"],
    ["portfolio.json", "", "", "difficulty", "Spend needed to complete", ""],
    ["portfolio.json", "", "", "duration", "Validity in days", "Converted to hours (x24) to window completions. Assumption"],
    ["portfolio.json", "", "", "channels", "List of advertised channels", "Not used. A list on the offer cannot credit a channel with a response"],
    ["profile.json", "One member (17,000)", "id", "age, gender, income", "Demographics", f"{both:,} members have age 118 with income and gender missing. Never used for targeting; used only in the proxy audit"],
    ["profile.json", "", "", "became_member_on", "Join date, YYYYMMDD", "Not used"],
    ["transcript.json", "One event (306,534)", "person + time + event", "event", "offer received / offer viewed / offer completed / transaction", ""],
    ["transcript.json", "", "", "value['offer id']", "Offer on received and viewed events", "Coalesced with offer_id into one key"],
    ["transcript.json", "", "", "value['offer_id'], value['reward']", "Offer and reward on completed events", ""],
    ["transcript.json", "", "", "value['amount']", "Transaction amount", "No offer ID. Transactions are never joined to an offer"],
    ["transcript.json", "", "", "time", "Relative time, 0 to 714", "Assumed hours. Offers went out in six waves at " + ", ".join(map(str, WAVES))],
    ["Join logic", "transcript.person = profile.id (left join). Coalesced offer id = portfolio.id. A view or completion is attached to a receipt of the same offer by the same member: views to the latest receipt at or before the view, completions to the earliest open receipt still inside its validity window.", "", "", "", ""],
    ["Derived", "One offer instance", "person + offer + receipt time", "unviewed completion", "Completed with no view at or before the completion time", "Inference that the reward did not prompt the purchase, not proof"],
    ["Derived", "One member", "id", "behaviour cohort", "No purchase / Buys, never completes / Completes mostly unviewed (half or more of completions unviewed) / Views, then completes", "Built from behaviour only. Uses the whole period, so live rules must use the previous cycle"],
], [16, 34, 22, 30, 44, 60])

sheet("Metrics", [
    ["Metric", "Numerator", "Denominator", "Type", "Read it as"],
    ["View rate", "Offer instances viewed", "Offer instances received", "Leading", "Did the message reach the member"],
    ["Completion rate", "Offer instances completed", "BOGO and discount instances received", "Lagging", "Never a target on its own: easier, richer offers raise it while cutting contribution"],
    ["Unviewed completion share", "Completions with no prior view", "Completions", "Leading", "Share of rewards likely paid on purchases the offer did not prompt"],
    ["Reward paid", "Sum of reward face value on completions", "n/a (£)", "Lagging", "Promotional cost recorded in the data"],
    ["Unviewed reward", "Reward face value on unviewed completions", "n/a (£)", "Leading", "Upper bound on the pool the A scenario draws from"],
    ["Reward cost per £ of spend", "Reward paid to the cohort", "Spend by the cohort", "Lagging", "Cohort level only. Transactions carry no offer ID, so this is not available per offer"],
    ["Purchasing members", "Members with at least one transaction", "All members in the cohort", "Lagging", ""],
    ["Spend per purchasing member", "Transaction amount", "Purchasing members", "Lagging", ""],
    ["Holdout uplift (after go-live)", "Spend per member, treated minus holdout", "n/a", "Lagging", "The only measure here that can show cause"],
], [28, 44, 40, 10, 70])

sheet("Quality checks", [["Check", "Status", "Detail"]] + [[c["name"], c["status"].upper(), c["detail"]] for c in checks], [48, 10, 110])

rows = [["Offer", "Type", "Reward £", "Spend needed £", "Days", "Offer ID", "Received", "Viewed", "Completed", "Unviewed completions",
         "Reward paid £", "Unviewed reward £", "View rate", "Completion rate", "Unviewed share"]]
for oid, v in sorted(by(lambda k: k[0]).items(), key=lambda kv: -kv[1][5]):
    o = offers[oid]; n = len(rows) + 1
    rows.append([label(o), o["offer_type"], o["reward"], o["difficulty"], o["duration"], oid, *v,
                 f"=H{n}/G{n}", f"=I{n}/G{n}" if o["reward"] else "n/a", f"=J{n}/I{n}" if o["reward"] else "n/a"])
ws = sheet("Offers", rows, [30, 14, 9, 9, 6, 36, 10, 10, 10, 12, 12, 12, 10, 12, 12])
for r in ws.iter_rows(min_row=2, min_col=13, max_col=15):
    for c in r: c.number_format = "0.0%"

rows = [["Offer type", "Received", "Viewed", "Completed", "Unviewed completions", "Reward paid £", "Unviewed reward £",
         "View rate", "Completion rate", "Unviewed share", "Reward per offer sent £"]]
for typ, v in sorted(by(lambda k: offers[k[0]]["offer_type"]).items()):
    n = len(rows) + 1; rew = typ != "informational"
    rows.append([typ, *v, f"=C{n}/B{n}", f"=D{n}/B{n}" if rew else "n/a", f"=E{n}/D{n}" if rew else "n/a", f"=F{n}/B{n}"])
ws = sheet("Offer types", rows, [16, 10, 10, 10, 12, 12, 12, 10, 12, 12, 14])
for r in ws.iter_rows(min_row=2, min_col=8, max_col=10):
    for c in r: c.number_format = "0.0%"

cv = by(lambda k: k[2])
rows = [["Behaviour cohort", "Members", "Purchasing members", "Spend £", "Transactions", "Offers received", "Completions",
         "Unviewed completions", "Reward paid £", "Share purchasing", "Spend per purchasing member £", "Reward cost per £ spend"]]
for c in COHORTS:
    s = spend.get(("all", c), {"buyers": set(), "spend": 0, "tx": 0}); v = cv.get(c, [0] * 6); n = len(rows) + 1
    rows.append([c, DATA["cohortMembers"].get(c, 0), len(s["buyers"]), round(s["spend"], 2), s["tx"], v[0], v[2], v[3], v[4],
                 f"=C{n}/B{n}", f'=IF(C{n}=0,"n/a",D{n}/C{n})', f'=IF(D{n}=0,"n/a",I{n}/D{n})'])
n = len(rows) + 1
rows.append(["All members"] + [f"=SUM({get_column_letter(i)}2:{get_column_letter(i)}{n-1})" for i in range(2, 10)]
            + [f"=C{n}/B{n}", f"=D{n}/C{n}", f"=I{n}/D{n}"])
ws = sheet("Cohorts", rows, [28, 10, 12, 14, 12, 12, 12, 12, 12, 12, 16, 14])
for r in ws.iter_rows(min_row=2):
    r[9].number_format = "0.0%"; r[10].number_format = "0.00"; r[11].number_format = "0.000"

sheet("Proxy audit", [["Behaviour cohort", "Members", "Share with no demographics", "Female share (known)", "Median income (known)", "Median age (known)"]]
      + [[a["cohort"], a["members"], round(a["missing_demo"], 3), a["female"] and round(a["female"], 3), a["median_income"], a["median_age"]] for a in audit]
      + [["Use: before a behaviour rule goes live, compare its cohort with the others. A gap of more than 10 points in female share, or a large income gap, means the rule is a back door to demographic targeting and needs CX sign-off. Demographics appear here only, never in the cockpit filters."]],
      [28, 10, 16, 16, 16, 14])

# Prioritisation: gates, then editable scores with a live P formula
ws = sheet("Prioritisation", [
    ["Option", "Owner gate", "Data gate", "Risk gate", "Able-to-act gate", "Gate result", "V", "F", "A", "R", "P = 0.35V + 0.25F + 0.20A + 0.20(6-R)", "Evidence"],
    ["A. Campaign decision cockpit", "Pass: campaign manager", "Pass: aggregates from files held", "Pass", "Pass: mix changes next cycle", "Eligible", 4, 5, 5, 2, "=0.35*G2+0.25*H2+0.2*I2+0.2*(6-J2)",
     f"V: £{total_reward:,} of rewards per cycle is the pool; base case nets a positive return (Scenarios). F: 2 weeks, £4,000, data in hand. A: owner can re-weight the mix next cycle. R: saving unverified until the holdout reads out."],
    ["B. Behavioural segment pilot", "Pass: marketing sponsor", "Conditional: contact eligibility unverified", "Pass if behaviour-only", "Pass: two rules", "Eligible with prerequisite", 4, 3, 3, 4, "=0.35*G3+0.25*H3+0.2*I3+0.2*(6-J3)",
     "V: larger upside if uplift is real (Scenarios). F: 5 weeks and needs consent. A: rules run from week 8 at the earliest. R: consent and proxy-discrimination risk."],
    ["C. Automated next-best-offer ML", "Fail: no owner", "Fail: needs member-level permission", "Fail: opaque", "Fail", "Rejected", "", "", "", "", "not scored",
     "£24,000 against a £15,000 cap; 10 analyst-weeks against 8; 16 weeks against a 10-week window."],
    ["D. Store labour-demand forecast", "Pass: operations manager", "Fail: no store IDs, rosters or stock", "n/a", "Fail", "Deferred", "", "", "", "", "not scored",
     "Cannot be built from these three files. Prerequisite: store-level transaction and roster data."],
    [],
    ["Constraint", "Limit", "A alone", "A + B phased", "Within limit?"],
    ["Initial spend £", 15000, 4000, "=C8+9000", '=IF(D8<=B8,"Yes","No")'],
    ["Recurring per cycle £", 1500, 500, "=C9+1000", '=IF(D9<=B9,"Yes","No")'],
    ["Analyst person-weeks", 8, 2, "=C10+5", '=IF(D10<=B10,"Yes","No")'],
    ["Ready by week", 10, 3, 8, '=IF(D11<=B11,"Yes","No")'],
], [32, 24, 34, 22, 26, 22, 5, 5, 5, 5, 36, 90])
for r in ws["G2:J3"]:
    for c in r: c.fill = INPUT

# Scenarios: editable inputs, formulas for A and B
tgt = "Views, then completes"
ws = sheet("Scenarios", [
    ["Input", "Value", "Source"],
    ["R: completed-offer reward face value per cycle £", total_reward, "Observed in transcript.json (sum of reward on completed events)"],
    ["Unviewed reward per cycle £", sum(c[5] for c in cube.values()), "Observed. Rewards on completions with no prior view"],
    ["Cycles", 4, "Case exhibit 4"],
    ["A set-up £", 4000, "Case exhibit 3"],
    ["A run cost per cycle £", 500, "Case exhibit 3"],
    ["B set-up £", 9000, "Case exhibit 3"],
    ["B run cost per cycle £", 1000, "Case exhibit 3"],
    ["Contribution rate on incremental sales", 0.35, "Case exhibit 4"],
    ["Incremental incentive cost, share of incremental sales", 0.10, "Case exhibit 4"],
    ["S: target-cohort spend per cycle £", round(spend["all", tgt]["spend"], 2), f"Observed spend of '{tgt}'. Replace with any cohort from the Cohorts sheet"],
    [],
    ["Option A: avoided incentive cost", "Share of R avoided (p)", "Saving over all cycles £", "Cost over all cycles £", "Net £", "Break-even R per cycle £", "p as share of unviewed reward"],
    ["Low", 0.05, "=$B$4*B14*$B$2", "=$B$5+$B$4*$B$6", "=C14-D14", "=D14/($B$4*B14)", "=B14*$B$2/$B$3"],
    ["Base", 0.10, "=$B$4*B15*$B$2", "=$B$5+$B$4*$B$6", "=C15-D15", "=D15/($B$4*B15)", "=B15*$B$2/$B$3"],
    ["High", 0.15, "=$B$4*B16*$B$2", "=$B$5+$B$4*$B$6", "=C16-D16", "=D16/($B$4*B16)", "=B16*$B$2/$B$3"],
    [],
    ["Option B: incremental contribution", "Spend uplift (u)", "Net contribution over all cycles £", "Cost over all cycles £", "Net £", "Break-even S per cycle £"],
    ["Low", 0.01, "=$B$4*B19*$B$11*($B$9-$B$10)", "=$B$7+$B$4*$B$8", "=C19-D19", "=D19/($B$4*B19*($B$9-$B$10))"],
    ["Base", 0.03, "=$B$4*B20*$B$11*($B$9-$B$10)", "=$B$7+$B$4*$B$8", "=C20-D20", "=D20/($B$4*B20*($B$9-$B$10))"],
    ["High", 0.05, "=$B$4*B21*$B$11*($B$9-$B$10)", "=$B$7+$B$4*$B$8", "=C21-D21", "=D21/($B$4*B21*($B$9-$B$10))"],
    [],
    ["Both A's saving and B's uplift are unverified hypotheses. A assumes purchasing is unchanged when rewards are withheld. Test with a 10% random holdout in cycle 1."],
], [52, 22, 30, 22, 14, 24, 28])
for r in list(ws["B2:B11"]) + list(ws["B14:B16"]) + list(ws["B19:B21"]):
    for c in r: c.fill = INPUT
for rng in ("B14:B16", "B19:B21", "G14:G16", "B9:B10"):
    for r in ws[rng]:
        for c in r: c.number_format = "0%"
for rng in ("C14:F16", "C19:F21", "B2:B3", "B11:B11"):
    for r in ws[rng]:
        for c in r: c.number_format = "#,##0"
for c in ws[13] + ws[18]:
    c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD

sheet("Limits", [
    ["Label", "Statement"],
    ["Observed fact", f"{len(tx):,} of {len(M):,} members bought at least once; they spent £{total_spend:,.2f} in {sum(len(v) for v in tx.values()):,} transactions."],
    ["Observed fact", f"{sum(c[2] for c in cube.values()):,} offer completions paid £{total_reward:,} in reward face value; {sum(c[3] for c in cube.values()):,} of them had no prior view."],
    ["Inference", "A completion with no prior view suggests the reward went to a purchase the offer did not prompt. Likely, not proven: the member may have seen the offer in a channel the view event does not record."],
    ["Inference", "Cohort differences in spend reflect who the members are as much as what offers they received. Heavy buyers complete offers by buying, so completion follows spend at least as much as it drives it."],
    ["Assumption", "Time is in hours; one observed period (about 30 days) stands in for one future campaign cycle; 1 dataset unit = £1."],
    ["Assumption", "A scenario: purchasing is unchanged when 5 to 15% of rewards are withheld. B scenario: 1 to 5% spend uplift at 35% contribution less 10% incentive."],
    ["Missingness", f"{both:,} members have no usable demographics (age 118, income and gender null). Their events are complete, so they stay in every behaviour metric."],
    ["Event sequence", f"{dup_rows} completed events are exact duplicates. Kept as two completions of two live instances; the data manager has not confirmed that reading."],
    ["Attribution", "Transactions carry no offer ID, channels are a list per offer, and there is no control group. No figure here is causal uplift or channel credit."],
    ["Not in the data", "Store IDs, product margin, contact consent, redemption cost versus face value."],
], [18, 150])

wb.save(HERE / "Meridian_Cockpit_Workbook.xlsx")

# ---------- console summary ----------
print(f"rows {len(P)}/{len(M)}/{len(T)}  reward £{total_reward:,}  spend £{total_spend:,.2f}  buyers {len(tx):,}")
for c in checks: print(f"  [{c['status']:4}] {c['name']}: {c['detail']}")
for typ, v in sorted(by(lambda k: offers[k[0]]['offer_type']).items()):
    print(f"  {typ:14} recv {v[0]:6} view {v[1]/v[0]:.1%} done {v[2]/v[0]:.1%} unviewed {div(v[3], v[2]) or 0:.1%} reward £{v[4]:,} unviewed £{v[5]:,}")
for oid, v in sorted(by(lambda k: k[0]).items(), key=lambda kv: -kv[1][5]):
    print(f"  {label(offers[oid]):32} recv {v[0]:5} view {v[1]/v[0]:.1%} done {v[2]/v[0]:.1%} unviewed {div(v[3], v[2]) or 0:.1%} reward £{v[4]:,} unviewed £{v[5]:,}")
for c in COHORTS:
    s = spend.get(("all", c)); v = cv.get(c, [0]*6)
    print(f"  {c:28} members {DATA['cohortMembers'].get(c,0):5} buyers {len(s['buyers']) if s else 0:5} spend £{s['spend'] if s else 0:12,.2f} reward £{v[4]:,}")
for a in audit: print("  audit", a)
