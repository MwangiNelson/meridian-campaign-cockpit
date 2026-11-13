// All calculations over the aggregates that build.py writes to public/data.js.
export const D = window.DATA
export const O = Object.fromEntries(D.offers.map(o => [o.id, o]))
export const MIN_N = 50 // cells with a denominator under 50 are withheld
export const R = D.totals.reward
export const C = D.case
export const costA = C.A.setup + C.cycles * C.A.run
export const costB = C.B.setup + C.cycles * C.B.run
export const UNVIEWED_POOL = D.cube.reduce((a, r) => a + r[8], 0)

// U+2212 minus: no line break between the sign and £
export const gbp = (x, d = 0) => (x < 0 ? '−' : '') + '£'+ Math.abs(x).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })
export const num = x => x.toLocaleString('en-GB')
export const rate = (a, b) => (b < MIN_N ? null : a / b)
export const pct = (r, d = 1) => (r == null ? 'n<50' : (r * 100).toFixed(d) + '%')
export const typeName = t => (t === 'bogo' ? 'BOGO' : t[0].toUpperCase() + t.slice(1))
export const waveName = w => (w === 'all' ? 'All waves' : `Wave ${+w + 1}`)
export const netA = p => C.cycles * p * R - costA
export const netB = (u, s) => C.cycles * u * s * (C.B.contrib - C.B.incentive) - costB
export const membersOf = c => (c === 'all' ? D.rows.members : D.cohortMembers[c] || 0)

// cube row: [offer, wave, cohort, received, viewed, completed, unviewed, reward, unviewedReward]
export function agg(keyFn, f) {
  const m = new Map()
  for (const r of D.cube) {
    if (f.type !== 'all' && O[r[0]].type !== f.type) continue
    if (f.wave !== 'all' && r[1] !== +f.wave) continue
    if (f.cohort !== 'all' && r[2] !== f.cohort) continue
    const k = keyFn(r), v = m.get(k) || [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 6; i++) v[i] += r[i + 3]
    m.set(k, v)
  }
  return m
}
const ALL = { type: 'all', wave: 'all', cohort: 'all' }

// spend row: [period, cohort, buyers, spend, tx]. Cohorts are exclusive, so buyers add up.
export function spendOf(cohort, wave) {
  const out = { buyers: 0, spend: 0, tx: 0 }
  for (const r of D.spend) if (r[0] === String(wave) && (cohort === 'all' || r[1] === cohort)) { out.buyers += r[2]; out.spend += r[3]; out.tx += r[4] }
  return out
}

export function offerRows(S) {
  return [...agg(r => r[0], S)].map(([id, v]) => ({
    key: id, o: O[id], n: v[0], viewed: v[1], view: rate(v[1], v[0]), done: O[id].reward ? rate(v[2], v[0]) : null,
    uv: O[id].reward ? rate(v[3], v[2]) : null, completed: v[2], reward: v[4], uvr: v[5], rps: v[0] ? v[4] / v[0] : 0, isReward: !!O[id].reward,
  }))
}

// The mix decision: which offers are flagged, and what moving their sends would save.
export function plan(S) {
  const rows = offerRows(S).filter(r => r.isReward && r.uv != null), thr = S.thr / 100
  const flagged = rows.filter(r => r.uv >= thr).sort((a, b) => b.uvr - a.uvr), keep = rows.filter(r => r.uv < thr)
  let saving = 0
  const moves = flagged.map(f => {
    const best = keep.filter(k => k.o.type === f.o.type).sort((a, b) => a.uv - b.uv)[0]
    const dest = S.dest === 'info' ? { label: 'an informational message', rps: 0 } : best ? { label: best.o.label, rps: best.rps } : null
    const s = dest ? f.n * S.move / 100 * (f.rps - dest.rps) : 0
    saving += s
    return { key: f.key, f, dest, s }
  })
  return { rows, flagged, moves, saving, total: rows.reduce((a, r) => a + r.reward, 0) }
}

// The behaviour rule to test, checked against the proxy audit.
// "Buyers who never complete receive the easiest discount" was dropped: that group fails the proxy check.
export function rules() {
  const a = D.audit, known = a.reduce((s, x) => s + x.members * (1 - x.missing_demo), 0)
  const fAll = a.reduce((s, x) => s + x.members * (1 - x.missing_demo) * (x.female || 0), 0) / known
  const all = agg(r => r[2], ALL)
  const co = n => { const x = a.find(y => y.cohort === n); return { ...x, spend: spendOf(n, 'all').spend, reward: (all.get(n) || [])[4] || 0, gap: Math.abs(x.female - fAll) * 100 } }
  return { fAll, list: [
    { key: 1, name: 'Mostly-unviewed completers receive messages in place of rewards', c: co('Completes mostly unviewed') },
  ] }
}

export function summaryText(S, P, RL) {
  const p = C.A.p[S.scen], target = p * P.total
  const proxy = c => c.gap > 10 ? `Fails the proxy check: ${(c.female * 100).toFixed(0)}% female against ${(RL.fAll * 100).toFixed(0)}% across members. Needs CX sign-off or it is dropped.` : 'Passes the proxy check.'
  return `CAMPAIGN DECISION SUMMARY
Built ${D.generated} from ${num(D.rows.events)} events. View: ${S.type === 'all' ? 'all offer types' : S.type}, ${waveName(S.wave).toLowerCase()}, ${S.cohort === 'all' ? 'all members' : S.cohort}.

1. OFFER MIX (campaign manager, one week before the cycle)
${P.flagged.length ? P.moves.map(m => `- ${m.f.o.label} [${m.f.o.short}]: ${(m.f.uv * 100).toFixed(0)}% of ${num(m.f.completed)} completions unviewed. ` +
  (m.dest ? `Move ${S.move}% of ${num(m.f.n)} sends to ${m.dest.label}: ${m.s >= 0 ? 'saves' : 'costs'} ${gbp(Math.abs(m.s))} per cycle.` : 'No unflagged offer of this type to move to.')).join('\n') : '- No offers flagged.'}
Reward paid: currently ${gbp(P.total)}, projected ${gbp(P.total - P.saving)}. Saving ${gbp(P.saving)} per cycle (${(P.total ? P.saving / P.total * 100 : 0).toFixed(1)}%). Target ${p * 100}% = ${gbp(target)}: ${P.saving >= target && P.flagged.length ? 'reached' : 'not reached'}.

2. TARGETING RULE TO TEST (marketing director, behaviour only, blocked until contact eligibility is confirmed)
${RL.list.map((r, i) => `- Rule ${i + 1}: ${r.name}. ${num(r.c.members)} members, ${gbp(r.c.spend)} spend. ${proxy(r.c)}`).join('\n')}

3. TEST
Hold out a random 10% of members on the old mix in cycle 1. Go if reward per member falls and spend per member stays within 1% of the holdout.

4. KNOWN AND ASSUMED
Known: sends, views, completions, rewards and spend. Inferred: an unviewed completion is a reward the member did not need. Assumed: purchasing holds when the reward goes; time is in hours; one observed period is one cycle; 1 unit = £1.`
}

// self-check: the cube must add back to the build's totals
console.assert(D.cube.reduce((a, r) => a + r[7], 0) === R, 'cube reward does not match total reward')
console.assert(Math.abs(spendOf('all', 'all').spend - D.totals.spend) < 0.01, 'spend does not reconcile')
