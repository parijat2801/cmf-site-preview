# Shader Highlighter Integration Plan

**Goal:** Replace the CSS `.mark` marker-swipe with a WebGL shader highlighter (Paper Shaders `ShaderMount` + custom fragment shader) on ALL 7 `.mark` highlights site-wide, keeping the existing CSS swipe as the WebGL-unavailable fallback.

**Worktree:** `/Users/parijat/dev/cmf-highlighter` (branch `feature/highlighter-realism`).

## Locked recipe (from the lab)
```
draw:0.9  wet:0.95  wetWidth:0.02
dry:3  tipRag:0.006  edgeRag:0
streak:0.78  bubbles:0.4
alpha:0.68  skew:±0.05 (randomized per mark)
```
Colors: per-mark, read from the element's computed `--hl` (6 are `--red` #DB1A21, 1 is `--cream`).

## The 7 marks + their triggers (index.html)
| line | mark | context | fires when |
|---|---|---|---|
| 774 | Brigade | `.head.reveal` | `.reveal.in` (once) |
| 823 | narratives | `.head.reveal` | `.reveal.in` (once) |
| 878 | Acts. (cream) | `.head.reveal` | `.reveal.in` (once) |
| 901 | Made Real | `.head.reveal` (#for-brands) | `.reveal.in` — REPLAYS with section |
| 913 | Cultural Leaders | `.fb-q-tr` in `.fb-chart` | `.fb-chart.in` — REPLAYS, ~3.3s into choreography |
| 933 | email | `.fb-write.reveal` (#for-brands) | `.reveal.in` — REPLAYS |
| 943 | work with | `.head.reveal` | `.reveal.in` (once) |

Trigger signal = the `.in` class on the mark's nearest `.reveal` ancestor, OR `.fb-chart.in` for the chart label. `#for-brands` toggles `.in` off/on on re-entry (existing narrative-replay observer) → shader must replay when `.in` re-appears.

## Architecture: one `initMarkShaders()` in index.html JS
1. **WebGL probe.** `canvas.getContext('webgl2')`. If null → return early; CSS `.mark` swipe stays untouched (current behavior = fallback). ✅ requirement.
2. **Vendor** `vendor/paper-shaders/` (already copied in worktree; copy into repo `vendor/`).
3. Per `.mark`:
   - Add class `.mark-shader` → CSS disables the swipe pseudo (`.mark-shader::before{display:none}`) and keeps text color logic (text still flips per existing rule; but shader draws BEHIND, so keep text at its resting color — see step 6).
   - Read color from `getComputedStyle(el).getPropertyValue('--hl')` → parse hex → [r,g,b] floats. Default red.
   - `new ShaderMount(el, FRAG, uniforms(0, seed, null, skew), undefined, 0)`, style its canvas absolute/behind (z-index below text), overhang a few px.
   - Store `{el, mount, seed, skew, cv, color, trigger}` where `trigger` = nearest `.reveal` ancestor or the `.fb-chart`.
4. **Driver:** a single rAF that, per active mark, advances `u_progress` 0→1 over `draw` seconds from the moment it armed.
5. **Trigger observation:** a MutationObserver (or reuse existing IO) watches each trigger's `classList` for `.in`. On `.in` added → arm/replay that mark (reset progress, start rAF). On `.in` removed (only #for-brands does this) → reset progress to 0 (hidden) so re-entry replays. For once-only headings, arm once.
   - Timing offset: chart label should start ~matching when the note appears. Keep a per-mark `delay` (chart ≈ existing note delay; headings ≈ small stagger). Simplest robust version: start on `.in`, let `draw:0.9` play; the chart's own label already fades in at 1.9s via CSS so the shader can start with the label.
6. **Text legibility:** shader draws behind text (z-index -1 within `.mark`). Text must stay readable over red → keep cream (`.mark-w`) / ink as today, but since the CImg swipe is gone, ensure `.mark-shader` text color is the FINAL color from frame 0 (no wait-for-swipe). Set `.mark-shader{color:var(--cream)}` for mark-w, resting ink otherwise — verify contrast.
7. **Reduced motion:** if `prefers-reduced-motion`, skip shader, snap CSS fallback to filled (existing `@media` rule already does this).
8. **Resize:** on resize, re-place each canvas (ShaderMount auto-handles buffer size; just re-nudge overhang).

## Fallback correctness (the requirement)
- No WebGL → `initMarkShaders` returns before touching anything → CSS `.mark` swipe renders exactly as it does today.
- WebGL present → `.mark-shader` added → CSS swipe suppressed → shader owns the look.
- The CSS swipe rules STAY in the stylesheet untouched; they are the fallback path.

## Risks / sharp edges
- 7 live GL contexts: browsers cap ~16 WebGL contexts. 7 is fine, but pause off-screen ones (IntersectionObserver → stop rAF when not visible).
- The chart label `.fb-q-tr` is `position:absolute` + `translate(-50%,-50%)` and `nowrap`; the canvas must track that transformed box. Verify placement.
- Email `.mark` is inside an `<a>` — canvas must not eat clicks (`pointer-events:none`, already set).
- `--hl:var(--cream)` on "Acts." → shader color cream on a dark card; wet edge mixes toward white (fine).
- Don't double-trigger: headings that are once-only must not re-arm; only #for-brands marks replay.

## Steps
1. Copy `vendor/paper-shaders/` into repo vendor. Commit.
2. Add the FRAG shader string + `initMarkShaders()` to index.html JS (near the reveal/IO code ~line 1050). Add `.mark-shader::before{display:none}` CSS.
3. Wire trigger observation to the existing `.in` toggling.
4. Manual browser verification: each of the 7 marks draws on entry; #for-brands 3 replay on re-scroll; WebGL-off shows CSS swipe; reduced-motion static; mobile ok; no console errors; canvases track boxes on resize.
5. Commit.

## Verification checklist (manual, browser)
- [ ] All 7 marks render the shader stroke on first view.
- [ ] Colors correct (6 red, Acts. cream).
- [ ] Random skew differs per mark.
- [ ] #for-brands (Made Real, Cultural Leaders, email) REPLAY on scroll out+in.
- [ ] WebGL disabled → CSS swipe fallback, no missing highlight.
- [ ] prefers-reduced-motion → static filled, no animation.
- [ ] Mobile: strokes fit, no perf jank; off-screen contexts paused.
- [ ] Email link still clickable.
- [ ] No console errors; resize keeps canvases aligned.
