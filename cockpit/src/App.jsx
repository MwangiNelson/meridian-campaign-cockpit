import { useEffect, useState } from 'react'
import { ConfigProvider, Layout, Menu, Select, Slider, Tag, Button, Tooltip, Typography, theme } from 'antd'
import { DashboardOutlined, TagsOutlined, TeamOutlined, LineChartOutlined, FileTextOutlined, MoonOutlined, SunOutlined,
         CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { themeFor } from './theme.js'
import { D, waveName } from './lib.js'
import { Overview, Offers, Members, Value, Notes } from './pages.jsx'

const PAGES = {
  overview: { label: 'Overview', icon: <DashboardOutlined />, view: Overview, filters: ['type', 'wave', 'cohort', 'scen', 'thr'] },
  offers:   { label: 'Offers', icon: <TagsOutlined />, view: Offers, filters: ['type', 'wave', 'cohort', 'thr'] },
  members:  { label: 'Members', icon: <TeamOutlined />, view: Members, filters: ['type', 'wave', 'cohort'] },
  value:    { label: 'Value', icon: <LineChartOutlined />, view: Value, filters: [] },
  notes:    { label: 'Notes', icon: <FileTextOutlined />, view: Notes, filters: [] },
}
const pageFromHash = () => (PAGES[location.hash.slice(1)] ? location.hash.slice(1) : 'overview')
// ?theme=dark or ?theme=light in the link wins, then the saved choice, then the system setting
const savedDark = () => { const q = new URLSearchParams(location.search).get('theme'); if (q) return q === 'dark'; try { const v = localStorage.getItem('dark'); if (v != null) return v === '1' } catch {} return matchMedia('(prefers-color-scheme: dark)').matches }

function Filters({ S, set, show }) {
  const field = (key, label, control) => show.includes(key) && <label className="field" key={key}><Typography.Text type="secondary">{label}</Typography.Text>{control}</label>
  if (!show.length) return null
  return (
    <div className="toolbar">
      {field('type', 'Offer type', <Select value={S.type} onChange={v => set({ type: v })} options={[
        { value: 'all', label: 'All types' }, { value: 'bogo', label: 'BOGO' }, { value: 'discount', label: 'Discount' }, { value: 'informational', label: 'Informational' }]} />)}
      {field('wave', 'Send wave', <Select value={S.wave} onChange={v => set({ wave: v })} options={[
        { value: 'all', label: 'All waves' }, ...D.waves.map((_, i) => ({ value: String(i), label: waveName(i) }))]} />)}
      {field('cohort', 'Member group', <Select value={S.cohort} onChange={v => set({ cohort: v })} options={[
        { value: 'all', label: 'All members' }, ...D.cohorts.map(c => ({ value: c, label: c }))]} />)}
      {field('scen', 'Reward avoided', <Select value={S.scen} onChange={v => set({ scen: v })} options={[
        { value: 0, label: 'Low, 5% avoided' }, { value: 1, label: 'Base, 10% avoided' }, { value: 2, label: 'High, 15% avoided' }]} />)}
      {field('thr', `Flag offers at ${S.thr}% unviewed or more`, <Slider min={10} max={70} step={5} value={S.thr} onChange={v => set({ thr: v })} tooltip={{ formatter: v => v + '%' }} />)}
    </div>
  )
}

function Shell({ dark, setDark, panel }) {
  const { token } = theme.useToken()
  const [page, setPage] = useState(pageFromHash)
  const [S, setS] = useState({ type: 'all', wave: 'all', cohort: 'all', scen: 1, thr: 40, move: 50, dest: 'info', bCohort: 'Views, then completes' })
  const set = patch => setS(s => ({ ...s, ...patch }))
  useEffect(() => { const h = () => setPage(pageFromHash()); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h) }, [])
  const P = PAGES[page], View = P.view
  const failed = D.checks.filter(c => c.status === 'fail').length, passed = D.checks.filter(c => c.status === 'pass').length
  const line = `1px solid ${token.colorBorderSecondary}`
  return (
    <Layout style={{ minHeight: '100vh', '--brand': token.colorPrimary }}>
      <Layout.Sider width={224} breakpoint="lg" collapsedWidth={0} style={{ borderRight: line }} zeroWidthTriggerStyle={{ top: 8, background: panel, border: line, color: token.colorText }}>
        <div className="brand" style={{ borderBottom: line }}><i>M</i>Meridian Rewards</div>
        <Menu mode="inline" selectedKeys={[page]} style={{ border: 0, padding: 8 }} onClick={e => { location.hash = e.key }}
              items={Object.entries(PAGES).map(([key, p]) => ({ key, icon: p.icon, label: p.label }))} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="topbar" style={{ borderBottom: line }}>
          <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Typography.Text type="secondary" className="hide-sm">Campaign cockpit / </Typography.Text>
            <Typography.Text strong>{P.label}</Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography.Text type="secondary" className="hide-sm" style={{ fontSize: 14 }}>Built {D.generated}</Typography.Text>
            <Tag icon={failed ? <WarningOutlined /> : <CheckCircleOutlined />} color={failed ? 'error' : 'success'} style={{ margin: 0, cursor: 'pointer', fontSize: 14, padding: '3px 10px' }}
                 onClick={() => { location.hash = 'notes' }}>
              {failed ? `${failed} data check${failed > 1 ? 's' : ''} failed` : `${passed} of ${D.checks.length} checks pass`}
            </Tag>
            <Tooltip title={dark ? 'Switch to light' : 'Switch to dark'}>
              <Button aria-label="Toggle dark mode" icon={dark ? <SunOutlined /> : <MoonOutlined />} onClick={() => setDark(!dark)} />
            </Tooltip>
          </div>
        </Layout.Header>
        <Layout.Content>
          <div className="page">
            <Filters S={S} set={set} show={P.filters} />
            <View S={S} set={set} />
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  const [dark, setDarkState] = useState(savedDark)
  const setDark = v => { setDarkState(v); try { localStorage.setItem('dark', v ? '1' : '0') } catch {} }
  const t = themeFor(dark)
  useEffect(() => { document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; document.body.style.background = t.config.token.colorBgLayout }, [dark])
  return <ConfigProvider theme={t.config}><Shell dark={dark} setDark={setDark} panel={t.panel} /></ConfigProvider>
}
