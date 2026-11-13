import { useEffect, useRef, useState } from 'react'
import { Card, Statistic, Table, Tag, Progress, Slider, Select, Button, Typography, Empty, Space, Descriptions, theme, message } from 'antd'
import { CopyOutlined, PrinterOutlined, ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { D, O, C, R, MIN_N, UNVIEWED_POOL, costA, costB, gbp, num, rate, pct, typeName, netA, netB, membersOf,
         agg, spendOf, offerRows, plan, rules, summaryText } from './lib.js'

const { Text } = Typography
const grid = min => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 16 })
const stack = { display: 'flex', flexDirection: 'column', gap: 16 }
const Sub = ({ children }) => <div><Text type="secondary" style={{ fontSize: 14 }}>{children}</Text></div>
// x: true sizes the table to its container, so cells wrap first and it only scrolls when even wrapped text won't fit
const tbl = { pagination: false, scroll: { x: true }, size: 'middle' }
const right = { align: 'right' }
const byNum = k => (a, b) => (a[k] ?? -1) - (b[k] ?? -1)

// A rate with its bar and its denominator.
function Rate({ r, of, color }) {
  const { token } = theme.useToken()
  if (r == null) return <Text type="secondary">{of == null ? 'n/a' : 'n<50'}</Text>
  return (
    <div style={{ minWidth: 110 }}>
      <Text strong>{pct(r)}</Text>
      <Progress percent={r * 100} showInfo={false} size="small" strokeColor={color || token.colorPrimary} style={{ margin: 0, lineHeight: 1 }} />
      {of != null && <Sub>of {num(of)}</Sub>}
    </div>
  )
}

function Kpi({ title, value, note }) {
  return <Card size="small" styles={{ body: { padding: 18 } }}><Statistic title={title} value={value} /><Sub>{note}</Sub></Card>
}

/* ---------- Overview ---------- */
export function Overview({ S, set }) {
  const { token } = theme.useToken()
  const [msg, holder] = message.useMessage()
  const t = agg(() => 1, S).get(1) || [0, 0, 0, 0, 0, 0], rw = agg(r => (O[r[0]].reward ? 1 : 0), S).get(1) || [0, 0, 0, 0, 0, 0]
  const sp = spendOf(S.cohort, S.wave), mem = membersOf(S.cohort), p = C.A.p[S.scen]
  const P = plan(S), RL = rules(), target = p * P.total, hit = P.flagged.length > 0 && P.saving >= target
  const copy = () => navigator.clipboard.writeText(summaryText(S, P, RL)).then(() => msg.success('Decision summary copied'), () => msg.error('Could not copy'))
  return (
    <div style={stack}>
      {holder}
      <div className="kpis">
        <Kpi title="Viewed" value={pct(rate(t[1], t[0]))} note={`${num(t[1])} of ${num(t[0])} offers sent`} />
        <Kpi title="Completed" value={pct(rate(rw[2], rw[0]))} note={`${num(rw[2])} of ${num(rw[0])} reward offers`} />
        <Kpi title="Unviewed completions" value={pct(rate(rw[3], rw[2]))} note={`${num(rw[3])} of ${num(rw[2])} completions`} />
        <Kpi title="Reward paid" value={gbp(t[4])} note={`${gbp(t[5])} on unviewed completions`} />
        <Kpi title="Spend per buyer" value={!sp.buyers ? 'n/a' : sp.buyers < MIN_N ? 'n<50' : gbp(sp.spend / sp.buyers, 2)} note={`${num(sp.buyers)} of ${num(mem)} members bought`} />
      </div>

      <div className="split">
        <Card title="Recommended mix change" style={{ minWidth: 0 }}>
          <div className="toolbar noprint" style={{ marginBottom: 12 }}>
            <label className="field"><Text type="secondary">Move {S.move}% of flagged sends</Text>
              <Slider min={0} max={100} step={10} value={S.move} onChange={v => set({ move: v })} tooltip={{ formatter: v => v + '%' }} /></label>
            <label className="field"><Text type="secondary">Send instead</Text>
              <Select value={S.dest} onChange={v => set({ dest: v })} options={[{ value: 'info', label: 'Informational message' }, { value: 'best', label: 'Best-viewed offer of that type' }]} /></label>
          </div>
          <Table {...tbl} dataSource={P.moves}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No offer has ${S.thr}% or more of its completions unviewed in this view. Lower the flag level to see candidates.`} /> }}
            columns={[
              { title: 'Offer', render: (_, m) => <><Text strong>{m.f.o.label}</Text><Sub>{m.f.o.short}</Sub></> },
              { title: 'Unviewed', ...right, render: (_, m) => <><Text strong>{pct(m.f.uv, 0)}</Text><Sub>of {num(m.f.completed)}</Sub></> },
              { title: 'Reward now', ...right, render: (_, m) => gbp(m.f.reward) },
              { title: 'Projected', ...right, render: (_, m) => (m.dest ? <Text strong>{gbp(m.f.reward - m.s)}</Text> : <Text type="secondary">No swap</Text>) },
              { title: 'Change', ...right, render: (_, m) => (m.s ? <Text type={m.s > 0 ? 'success' : 'danger'} style={{ whiteSpace: 'nowrap' }}>{m.s > 0 ? '−' : '+'}{gbp(Math.abs(m.s))}</Text> : '£0') },
            ]} />
        </Card>

        <Card title="Reward per cycle" style={{ minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Statistic title="Current" value={gbp(P.total)} valueStyle={{ fontSize: 24, color: token.colorTextSecondary }} />
            <Statistic title={`Projected, ${S.move}% moved`} value={gbp(P.total - P.saving)} />
          </div>
          <div style={{ margin: '14px 0' }}>
            <Tag color={P.saving > 0 ? 'success' : P.saving < 0 ? 'error' : 'default'} icon={P.saving > 0 ? <ArrowDownOutlined /> : P.saving < 0 ? <ArrowUpOutlined /> : null}
                 style={{ fontSize: 16, padding: '5px 12px', margin: 0 }}>
              {P.saving > 0 ? `Saves ${gbp(P.saving)} (${(P.saving / P.total * 100).toFixed(1)}%)` : P.saving < 0 ? `Costs ${gbp(-P.saving)} more` : 'No change'}
            </Tag>
          </div>
          <Descriptions column={1} size="small" colon={false} styles={{ label: { color: token.colorTextSecondary }, content: { justifyContent: 'flex-end', fontWeight: 600 } }}
            items={[
              { key: 1, label: `Target, ${p * 100}% of reward`, children: gbp(target) },
              { key: 2, label: 'Target status', children: <Tag color={hit ? 'success' : 'warning'} style={{ margin: 0 }}>{hit ? 'Reached' : 'Not reached'}</Tag> },
              { key: 3, label: `Net over ${C.cycles} cycles at ${p * 100}%`, children: gbp(netA(p)) },
            ]} />
          <Space className="noprint" style={{ marginTop: 16 }} wrap>
            <Button type="primary" icon={<CopyOutlined />} onClick={copy}>Copy decision summary</Button>
            <Button icon={<PrinterOutlined />} onClick={() => print()}>Print</Button>
          </Space>
        </Card>
      </div>

      <Card title="Targeting rule to test">
        <Table {...tbl} dataSource={RL.list} columns={[
          { title: 'Rule', render: (_, r) => <Text strong>{r.name}</Text> },
          { title: 'Members', ...right, render: (_, r) => num(r.c.members) },
          { title: 'Spend', ...right, render: (_, r) => gbp(r.c.spend) },
          { title: 'Proxy check', render: (_, r) => (r.c.gap > 10
              ? <><Tag color="error">Fail</Tag><Sub>{(r.c.female * 100).toFixed(0)}% female, {(RL.fAll * 100).toFixed(0)}% overall</Sub></>
              : <Tag color="success">Pass</Tag>) },
        ]} />
      </Card>
    </div>
  )
}

/* ---------- Offers ---------- */
export function Offers({ S }) {
  const { token } = theme.useToken()
  const rows = offerRows(S), thr = S.thr / 100, maxR = Math.max(1, ...rows.map(r => r.reward))
  const types = [...agg(r => O[r[0]].type, S)].map(([t, v]) => ({ key: t, t, v, rw: t !== 'informational' }))
  return (
    <div style={stack}>
      <Card title="Offers" extra={<div className="legend hide-sm"><span><i style={{ background: token.colorPrimary }} />Reward on viewed</span><span><i style={{ background: token.colorWarning }} />Reward on unviewed</span></div>}>
        <Table {...tbl} dataSource={rows} columns={[
          { title: 'Offer', render: (_, r) => <><Text strong>{r.o.label}</Text>{r.uv != null && r.uv >= thr && <Tag color="warning" style={{ marginLeft: 8 }}>Review</Tag>}<Sub>{typeName(r.o.type)} · {r.o.short}</Sub></> },
          { title: 'Sent', ...right, sorter: byNum('n'), render: (_, r) => num(r.n) },
          { title: 'Viewed', sorter: byNum('view'), render: (_, r) => <Rate r={r.view} of={r.n} /> },
          { title: 'Completed', sorter: byNum('done'), render: (_, r) => (r.isReward ? <Rate r={r.done} of={r.n} /> : <Rate r={null} />) },
          { title: 'Unviewed', sorter: byNum('uv'), render: (_, r) => (r.isReward ? <Rate r={r.uv} of={r.completed} color={token.colorWarning} /> : <Rate r={null} />) },
          { title: 'Reward paid', sorter: byNum('uvr'), defaultSortOrder: 'descend', render: (_, r) => (!r.isReward ? <Text type="secondary">£0</Text> :
            <div style={{ minWidth: 200 }}>
              <Text strong>{gbp(r.reward)}</Text>
              <div className="seg" style={{ width: `${Math.max(6, r.reward / maxR * 100)}%`, margin: '6px 0 2px' }}>
                <span style={{ flex: r.reward - r.uvr, background: token.colorPrimary }} /><span style={{ flex: r.uvr, background: token.colorWarning }} />
              </div>
              <Sub>{gbp(r.uvr)} on unviewed</Sub>
            </div>) },
        ]} />
      </Card>
      <Card title="By offer type">
        <Table {...tbl} dataSource={types} columns={[
          { title: 'Type', render: (_, r) => <Text strong>{typeName(r.t)}</Text> },
          { title: 'Sent', ...right, render: (_, r) => num(r.v[0]) },
          { title: 'Viewed', render: (_, r) => <Rate r={rate(r.v[1], r.v[0])} of={r.v[0]} /> },
          { title: 'Completed', render: (_, r) => (r.rw ? <Rate r={rate(r.v[2], r.v[0])} of={r.v[0]} /> : <Rate r={null} />) },
          { title: 'Unviewed', render: (_, r) => (r.rw ? <Rate r={rate(r.v[3], r.v[2])} of={r.v[2]} color={token.colorWarning} /> : <Rate r={null} />) },
          { title: 'Reward paid', ...right, render: (_, r) => gbp(r.v[4]) },
          { title: 'Reward per send', ...right, render: (_, r) => gbp(r.v[0] ? r.v[4] / r.v[0] : 0, 2) },
        ]} />
      </Card>
    </div>
  )
}

/* ---------- Members ---------- */
function SpendChart({ series, S }) {
  const { token } = theme.useToken()
  const box = useRef(null), [W, setW] = useState(800), [hover, setHover] = useState(null)
  useEffect(() => { const ro = new ResizeObserver(e => setW(Math.max(280, e[0].contentRect.width))); ro.observe(box.current); return () => ro.disconnect() }, [])
  const narrow = W < 520, H = narrow ? 260 : 320, L = 78, B = 36, T = narrow ? 52 : 30, last = series.length - 1
  const max = Math.max(1, ...series), step = 10 ** Math.floor(Math.log10(max)), top = Math.ceil(max / step) * step
  const x = d => L + d * (W - L - 12) / last, y = v => T + (H - T - B) * (1 - v / top)
  const pts = series.map((v, d) => `${x(d)},${y(v)}`).join(' ')
  const days = narrow ? [0, 15, last] : [0, 5, 10, 15, 20, 25, last]
  const txt = { fill: token.colorTextSecondary, fontSize: 15 }
  const move = e => { const b = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(last, Math.round((e.clientX - b.left - L) / ((W - L - 12) / last))))) }
  return (
    <div ref={box}>
      <svg width={W} height={H} role="img" aria-label="Daily member spend across the period, with the six send waves marked" onPointerMove={move} onPointerLeave={() => setHover(null)} style={{ display: 'block', touchAction: 'pan-y' }}>
        {[0, 0.5, 1].map(f => <g key={f}><line x1={L} x2={W - 12} y1={y(f * top)} y2={y(f * top)} stroke={token.colorBorderSecondary} /><text x={L - 10} y={y(f * top) + 5} textAnchor="end" style={txt}>{gbp(f * top)}</text></g>)}
        {S.wave !== 'all' && <rect x={x(D.bounds[+S.wave] / 24)} y={T} width={x(Math.min(D.bounds[+S.wave + 1] / 24, last)) - x(D.bounds[+S.wave] / 24)} height={H - T - B} fill={token.colorPrimary} opacity={0.12} />}
        {D.waves.map((w, i) => <g key={w}><line x1={x(w / 24)} x2={x(w / 24)} y1={T} y2={H - B} stroke={token.colorBorder} strokeDasharray="4 4" />
          <text x={x(w / 24)} y={T - 10 - (narrow && i % 2 ? 20 : 0)} textAnchor={i ? 'middle' : 'start'} style={txt}>W{i + 1}</text></g>)}
        {days.map(d => <text key={d} x={x(d)} y={H - 8} textAnchor={d === last ? 'end' : d ? 'middle' : 'start'} style={txt}>Day {d}</text>)}
        <polygon points={`${x(0)},${y(0)} ${pts} ${x(last)},${y(0)}`} fill={token.colorPrimary} opacity={0.1} />
        <polyline points={pts} fill="none" stroke={token.colorPrimary} strokeWidth={2.5} strokeLinejoin="round" />
        {hover != null && <g>
          <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={token.colorTextTertiary} />
          <circle cx={x(hover)} cy={y(series[hover])} r={5} fill={token.colorPrimary} stroke={token.colorBgContainer} strokeWidth={2} />
        </g>}
      </svg>
      <div style={{ minHeight: 26 }}><Text type="secondary">{hover == null ? 'Point at the chart to read a day.' : <>Day {hover}: <Text strong>{gbp(series[hover])}</Text></>}</Text></div>
    </div>
  )
}

export function Members({ S }) {
  const { token } = theme.useToken()
  const cv = agg(r => r[2], { ...S, cohort: 'all' })
  const rows = D.cohorts.map(c => ({ key: c, c, m: membersOf(c), sp: spendOf(c, S.wave), v: cv.get(c) || [0, 0, 0, 0, 0, 0] }))
  const maxS = Math.max(1, ...rows.map(r => (r.sp.buyers ? r.sp.spend / r.sp.buyers : 0)))
  const series = D.daily[D.cohorts[0]].map((_, d) => D.cohorts.reduce((s, c) => s + (S.cohort === 'all' || S.cohort === c ? D.daily[c][d] : 0), 0))
  return (
    <div style={stack}>
      <Card title="Member groups">
        <Table {...tbl} dataSource={rows} columns={[
          { title: 'Group', render: (_, r) => <Text strong>{r.c}</Text> },
          { title: 'Members', ...right, render: (_, r) => num(r.m) },
          { title: 'Spend', ...right, render: (_, r) => gbp(r.sp.spend) },
          { title: 'Spend per buyer', render: (_, r) => (!r.sp.buyers ? <Text type="secondary">n/a</Text> : r.sp.buyers < MIN_N ? <Text type="secondary">n&lt;50</Text> :
            <div style={{ minWidth: 130 }}><Text strong>{gbp(r.sp.spend / r.sp.buyers, 2)}</Text><Progress percent={r.sp.spend / r.sp.buyers / maxS * 100} showInfo={false} size="small" strokeColor={token.colorPrimary} style={{ margin: 0, lineHeight: 1 }} /><Sub>{num(r.sp.buyers)} buyers</Sub></div>) },
          { title: 'Completions', ...right, render: (_, r) => num(r.v[2]) },
          { title: 'Unviewed', ...right, render: (_, r) => (r.v[2] ? <><Text strong>{pct(rate(r.v[3], r.v[2]))}</Text><Sub>of {num(r.v[2])}</Sub></> : <Text type="secondary">n/a</Text>) },
          { title: 'Reward paid', ...right, render: (_, r) => gbp(r.v[4]) },
        ]} />
      </Card>
      <Card title={`Daily spend, ${S.cohort === 'all' ? 'all members' : S.cohort.toLowerCase()}`}><SpendChart series={series} S={S} /></Card>
      <Card title="Proxy audit">
        <Table {...tbl} dataSource={D.audit.map(a => ({ ...a, key: a.cohort }))} columns={[
          { title: 'Group', render: (_, a) => <Text strong>{a.cohort}</Text> },
          { title: 'Members', ...right, render: (_, a) => num(a.members) },
          { title: 'No demographics', ...right, render: (_, a) => pct(a.missing_demo) },
          { title: 'Female', ...right, render: (_, a) => <><Text strong>{pct(a.female)}</Text><Sub>of {num(Math.round(a.members * (1 - a.missing_demo)))} known</Sub></> },
          { title: 'Median income', ...right, render: (_, a) => gbp(a.median_income) },
          { title: 'Median age', ...right, render: (_, a) => a.median_age },
        ]} />
      </Card>
    </div>
  )
}

/* ---------- Value ---------- */
export function Value({ S, set }) {
  const { token } = theme.useToken()
  const s = spendOf(S.bCohort, 'all').spend, names = ['Low', 'Base', 'High']
  const A = C.A.p.map(netA), B = C.B.u.map(u => netB(u, s)), all = [...A, ...B], lo = Math.min(0, ...all), hi = Math.max(0, ...all), span = hi - lo || 1
  const bar = (label, v, color) => (
    <div className="netrow" key={label}>
      <Text>{label}</Text>
      <div className="nettrk">
        <i style={{ left: `${(Math.min(v, 0) - lo) / span * 100}%`, width: `${Math.max(0.6, Math.abs(v) / span * 100)}%`, background: v < 0 ? token.colorError : color }} />
        <u style={{ left: `${-lo / span * 100}%`, background: token.colorTextTertiary }} />
      </div>
      <div style={{ textAlign: 'right' }}>{v < 0 && <Tag color="error">Loss</Tag>}<Text strong className="num">{gbp(v)}</Text></div>
    </div>
  )
  return (
    <div style={stack}>
      <Card title={`Net value over ${C.cycles} cycles`} extra={<div className="legend hide-sm"><span><i style={{ background: token.colorPrimary }} />A, cockpit (selected)</span><span><i style={{ background: token.colorInfo }} />B, segment pilot (deferred)</span></div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {A.map((v, i) => bar(`A ${names[i].toLowerCase()}, ${C.A.p[i] * 100}% avoided`, v, token.colorPrimary))}
          {B.map((v, i) => bar(`B ${names[i].toLowerCase()}, ${C.B.u[i] * 100}% uplift`, v, token.colorInfo))}
        </div>
      </Card>
      <div style={{ ...grid(440), alignItems: 'start' }}>
        <Card title={<Space size={10}>A. Campaign cockpit<Tag color="success" style={{ margin: 0 }}>Selected</Tag></Space>}>
          <Table {...tbl} dataSource={C.A.p.map((p, i) => ({ key: i, p, i }))} columns={[
            { title: 'Case', render: (_, r) => <Text strong style={{ whiteSpace: 'nowrap' }}>{names[r.i]}, {r.p * 100}%</Text> },
            { title: 'Saving per cycle', ...right, render: (_, r) => gbp(r.p * R) },
            { title: 'Net', ...right, render: (_, r) => <Text strong>{gbp(A[r.i])}</Text> },
            { title: 'Break-even reward', ...right, render: (_, r) => gbp(costA / (C.cycles * r.p)) },
          ]} />
        </Card>
        <Card title={<Space size={10}>B. Segment pilot<Tag style={{ margin: 0 }}>Deferred</Tag></Space>} extra={<Select className="noprint" aria-label="Target group" value={S.bCohort} onChange={v => set({ bCohort: v })} style={{ minWidth: 220 }} popupMatchSelectWidth={false}
              options={[{ value: 'all', label: 'All members' }, ...D.cohorts.slice(0, 3).map(c => ({ value: c, label: c }))]} />}>
          <Table {...tbl} dataSource={C.B.u.map((u, i) => ({ key: i, u, i }))} columns={[
            { title: 'Case', render: (_, r) => <Text strong style={{ whiteSpace: 'nowrap' }}>{names[r.i]}, {r.u * 100}%</Text> },
            { title: 'Extra sales per cycle', ...right, render: (_, r) => gbp(r.u * s) },
            { title: 'Net', ...right, render: (_, r) => <Text strong type={B[r.i] < 0 ? 'danger' : undefined}>{gbp(B[r.i])}</Text> },
            { title: 'Break-even spend', ...right, render: (_, r) => gbp(costB / (C.cycles * r.u * (C.B.contrib - C.B.incentive))) },
          ]} />
        </Card>
      </div>
    </div>
  )
}

/* ---------- Notes ---------- */
export function Notes() {
  const tag = { pass: ['success', 'Pass'], warn: ['warning', 'Note'], fail: ['error', 'Fail'] }
  return (
    <div style={stack} className="notes">
      <Card title="Data checks">
        <Table {...tbl} dataSource={D.checks.map(c => ({ ...c, key: c.name }))} columns={[
          { title: 'Check', render: (_, c) => <Text strong>{c.name}</Text> },
          { title: 'Result', render: (_, c) => <Tag color={tag[c.status][0]}>{tag[c.status][1]}</Tag> },
          { title: 'Detail', dataIndex: 'detail' },
        ]} />
      </Card>
      <div style={{ ...grid(440), alignItems: 'start' }}>
        <Card title="Definitions"><ul>
          <li><b>Offer sent.</b> One offer received by one member at one time. The base for viewed and completed.</li>
          <li><b>Viewed.</b> Offers viewed ÷ offers sent.</li>
          <li><b>Completed.</b> Offers completed ÷ BOGO and discount offers sent. Informational offers cannot be completed.</li>
          <li><b>Unviewed completion.</b> A completion with no view of that offer at or before the completion.</li>
          <li><b>Reward paid.</b> Reward face value on completions.</li>
          <li><b>Spend per buyer.</b> Transaction amount ÷ members with at least one transaction. Follows the wave and member filters, not the offer type.</li>
          <li><b>Member groups.</b> No purchase; buys, never completes; completes mostly unviewed (half or more); views, then completes. Built from behaviour over the whole period.</li>
          <li><b>Send wave.</b> Offers went out at hours {D.waves.join(', ')}. Windows differ in length, so compare rates across waves, not totals.</li>
          <li><b>Projected reward.</b> Sends moved × observed reward per send. Assumes members buy the same amount.</li>
          <li><b>n&lt;50.</b> Fewer than {MIN_N} in the denominator, so the figure is withheld.</li>
        </ul></Card>
        <div style={stack}>
          <Card title="What the data can and cannot say"><ul>
            <li><b>Observed.</b> {num(D.totals.buyers)} of {num(D.rows.members)} members bought, spending {gbp(D.totals.spend)}. Completions paid {gbp(R)}.</li>
            <li><b>Inferred.</b> An unviewed completion is a reward the member did not need. The member may have seen the offer somewhere the view event does not record.</li>
            <li><b>Inferred.</b> Heavy buyers complete offers by buying. Completion follows spend at least as much as it drives it.</li>
            <li><b>Assumed.</b> Time is in hours. One observed period is one campaign cycle. One dataset unit is £1.</li>
            <li><b>Not possible.</b> Causal uplift, channel credit, margin, store views. Transactions carry no offer ID and there is no control group.</li>
            <li><b>Proxy audit.</b> Demographics appear only there. A group more than 10 points from the overall female share needs CX sign-off before a rule uses it. Buyers who never complete fail this check, so the rule that gave them the easiest discount was dropped.</li>
            <li><b>Privacy.</b> This tool loads aggregates only. No member IDs leave the build script.</li>
          </ul></Card>
          <Card title="Value formulas"><ul>
            <li><b>A.</b> Net = {C.cycles} × share avoided × {gbp(R)} − {gbp(costA)}. Unviewed completions carry {gbp(UNVIEWED_POOL)}, {(UNVIEWED_POOL / R * 100).toFixed(1)}% of reward, so every case asks for less than that pool.</li>
            <li><b>B.</b> Net = {C.cycles} × uplift × group spend × ({C.B.contrib} − {C.B.incentive}) − {gbp(costB)}.</li>
            <li>A is selected. B is deferred to phase 2 and waits on confirmed contact eligibility.</li>
            <li>A then B costs {gbp(costA + costB)} over {C.cycles} cycles and sits at the £1,500 per-cycle cap.</li>
          </ul></Card>
          <Card title="Refresh"><ol>
            <li>Put the three JSON files beside <Text code>build.py</Text>.</li>
            <li>Run <Text code>python build.py</Text>. It prints each check and rewrites <Text code>cockpit/public/data.js</Text> and the workbook.</li>
            <li>Redeploy the <Text code>cockpit</Text> folder. The build time shows in the top bar.</li>
          </ol></Card>
        </div>
      </div>
    </div>
  )
}
