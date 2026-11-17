import { useEffect } from 'react'
import { Tour, Typography } from 'antd'
import { D, O, C, R, costA, gbp, pct, rate, agg, plan, netA } from './lib.js'

// The guided tour doubles as the presenter's script: one talking point per step.
// Numbers are read from the current filters, so the words always match the screen.
const at = name => `[data-tour="${name}"]`
export function tourSteps(S) {
  const t = agg(() => 1, S).get(1) || [0, 0, 0, 0, 0, 0]
  const rw = agg(r => (O[r[0]].reward ? 1 : 0), S).get(1) || [0, 0, 0, 0, 0, 0]
  const P = plan(S), p = C.A.p[S.scen], target = p * P.total, n = P.flagged.length
  const passed = D.checks.filter(c => c.status === 'pass').length
  return [
    { page: 'overview', title: 'Campaign decision cockpit',
      description: 'Before each campaign cycle, this tool shows which offers to stop sending and what that saves. Move through the tour with Next, the arrow keys or a presentation clicker.' },
    { page: 'overview', target: at('filters'), title: 'Filters',
      description: 'These change every number on the page. Each page shows only the filters that affect it.' },
    { page: 'overview', target: at('kpis'), title: 'Headline numbers',
      description: `${pct(rate(rw[3], rw[2]))} of completions came from members who never viewed the offer. Those completions earned ${gbp(t[5])} of the ${gbp(t[4])} paid in rewards. The line under each number is its denominator.` },
    { page: 'overview', target: at('mix'), side: 'right', title: 'Recommended mix change',
      description: `An offer is flagged when ${S.thr}% or more of its completions went unviewed. ${n} ${n === 1 ? 'offer is' : 'offers are'} flagged now. The slider sets how much of their sends go to something else instead.` },
    { page: 'overview', target: at('reward'), side: 'left', title: 'What it saves',
      description: P.saving > 0
        ? `Moving ${S.move}% of flagged sends saves ${gbp(P.saving)} a cycle, ${(P.saving / P.total * 100).toFixed(1)}% of reward paid. The ${p * 100}% target is ${gbp(target)}, so it is ${n && P.saving >= target ? 'reached' : 'not reached'}.`
        : 'With these settings nothing is saved. Lower the flag level or move more sends.' },
    { page: 'overview', target: at('copy'), title: 'Decision summary',
      description: 'Copies a plain-text summary of the decision. The campaign manager sends it to the marketing director for sign-off a week before each cycle.' },
    { page: 'overview', target: at('rule'), title: 'Targeting rule',
      description: 'One behaviour rule to test. The proxy check confirms its group does not stand in for gender. A second rule failed that check and was dropped.' },
    { page: 'offers', target: `${at('offers')} thead`, title: 'Every offer',
      description: 'All 10 offers side by side. Each rate shows its denominator, and offers past the flag level carry a Review tag. Click a column heading to sort.' },
    { page: 'offers', target: at('legend'), title: 'Viewed and unviewed reward',
      description: 'Green is reward paid on completions the member viewed. Amber is reward paid on completions they never viewed. Amber is what the mix change goes after.' },
    { page: 'members', target: `${at('groups')} thead`, title: 'Behaviour groups',
      description: 'Every member sits in one of four groups, based on what they did. Who they are plays no part.' },
    { page: 'members', target: at('audit'), title: 'Proxy audit',
      description: 'The only place demographics appear. It shows whether a behaviour group is really a stand-in for gender, age or income.' },
    { page: 'value', target: at('net'), title: 'Business case',
      description: `Option A, this cockpit, nets ${gbp(netA(C.A.p[0]))} to ${gbp(netA(C.A.p[2]))} over ${C.cycles} cycles. It costs ${gbp(costA)} and breaks even at ${(costA / (C.cycles * R) * 100).toFixed(1)}% of reward avoided.` },
    { page: 'value', target: at('optb'), title: 'Option B, deferred',
      description: 'Kept for comparison, so the case for waiting is on screen. It needs confirmed contact eligibility before it can run.' },
    { page: 'notes', target: at('badge'), title: 'Data checks',
      description: `${passed} of ${D.checks.length} checks pass on the raw files. The badge in the top bar shows the same count on every page and links here.` },
    { page: 'notes', target: at('limits'), side: 'left', title: 'What it cannot tell you',
      description: 'There is no control group, so the tool shows association, not cause. A random 10% holdout in cycle 1 tests whether members keep buying when the reward goes.' },
  ]
}

const NEXT = ['ArrowRight', 'PageDown'], PREV = ['ArrowLeft', 'PageUp']

export function GuidedTour({ steps, current, onChange, onClose }) {
  const open = current >= 0
  const wide = matchMedia('(min-width: 1100px)').matches // tall cards sit side by side; put their popover beside them
  useEffect(() => {
    if (!open) return
    const key = e => {
      if (e.target.closest?.('input, textarea, [role="slider"]')) return // leave controls their own keys
      if (NEXT.includes(e.key)) current < steps.length - 1 ? onChange(current + 1) : onClose()
      else if (PREV.includes(e.key)) current > 0 && onChange(current - 1)
      else if (e.key === 'Escape') onClose()
      else return
      e.preventDefault()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [open, current, steps.length])
  // rc-tour measures its target on open and on resize only, and pins the highlight with position: fixed.
  // So hold the page still while the tour is open, and measure again once fonts and layout settle.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement, was = root.style.overflow, measure = () => dispatchEvent(new Event('resize'))
    root.style.overflow = 'hidden'
    const id = setTimeout(measure, 300)
    document.fonts?.ready.then(measure)
    return () => { clearTimeout(id); root.style.overflow = was }
  }, [open, current])
  return (
    <Tour open={open} scrollIntoViewOptions={{ block: 'center' }} current={Math.max(0, current)} onChange={onChange} onClose={onClose}
      indicatorsRender={(c, total) => <Typography.Text type="secondary">{c + 1} of {total}</Typography.Text>}
      steps={steps.map(s => ({ title: s.title, description: s.description, placement: wide ? s.side : undefined,
        target: s.target ? () => document.querySelector(s.target) : null }))} />
  )
}
