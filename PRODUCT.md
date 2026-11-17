# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 18 with Ant Design 5, built by Vite, in `cockpit/`. `build.py` (Python, openpyxl) writes `cockpit/public/data.js` from the three source files. Deployed to Vercel, which runs `npm run build` and serves `dist`.

## Users

- A lecturer and classmates watching a live 10-minute walkthrough on a projector, from a distance.
- In the case scenario, a campaign manager who opens it one week before each campaign cycle, and a marketing director who signs off the result.
- The same people opening the Vercel link afterwards on laptops and phones.

Several viewers have poor eyesight. This is confirmed by the owner.

## Product Purpose

The Meridian Rewards campaign decision cockpit is the working information product for a Strathmore DSA 8404 practice CAT. It turns three JSON-lines files (10 offers, 17,000 members, 306,534 events) into a decision about the next campaign's offer mix. Success is a viewer reading the headline numbers at a glance, then seeing which offers to cut and what that saves.

## Positioning

It ranks offers by rewards paid on completions the member never viewed. That figure comes from event sequence, which the supplied data supports, and makes no claim about causal uplift.

## Operating Context

- Assessed on fitness to a decision, analytical validity, usability and actionability. Graphical polish and ROI size are explicitly not assessed.
- The rubric requires interactive controls, at least three decision KPIs, an action-oriented output, explicit denominators, readable definitions, quality warnings, refresh steps and documented limitations.
- Presented alongside a six-page brief and an eight-slide deck.

## Capabilities and Constraints

- Filters: offer type, send wave, behaviour cohort, scenario (5, 10 or 15% of reward avoided), flag threshold.
- Views: headline KPIs, offer comparison, cohorts with daily spend, value scenarios for options A and B, a generated decision summary, data checks.
- Aggregates only. No member IDs reach the browser. Cells with a denominator under 50 are suppressed.
- Demographics appear only in a proxy audit, never as a filter.
- Explanatory text (definitions, assumptions, limitations, refresh steps) lives in a single Notes tab. Working screens carry numbers and charts.
- A 15-step guided tour, started from the top bar or with `?tour` in the link, walks all five pages. It doubles as the presenter's script, and a clicker's PageDown and PageUp move it.
- The first screen leads with the headline numbers.

## Brand Commitments

The owner wants a conventional, official-looking console dashboard in the style of the Supabase dashboard, built from Ant Design components. Themed or novelty looks are out.

## Evidence on Hand

Real computed figures in `cockpit/public/data.js`. No margin, store, consent or control-group data exists, and none may be implied.

## Product Principles

- Numbers before words. A working screen should be readable from the back of a room.
- Every rate shows its denominator.
- Nothing on screen claims cause.
- Behaviour, never demographics, drives any targeting rule.

## Accessibility & Inclusion

Viewers with poor eyesight. Larger type than a typical dashboard, strong contrast, and no meaning carried by colour alone.
