// BuLLMaps workflow content from the BuLLMaps master document ("BuLLMaps: how the
// marketing agent works"): one marketing agent = a Router / Concierge at the front and
// ten execution skills behind it. Every skill runs the same four-phase loop, shown in
// the front end as an accordion; one shared set of 16 stages sits behind the four
// phases, four stages per phase (the owner's 4 Nov 2026 list, verbatim).
// Mode: human = the owner's approval gate; auto = automated.
// Front-end mock data only - no backend is connected.

export type Mode = "human" | "auto";
export interface Stage { name: string; note: string; mode: Mode }
export interface Phase { id: string; name: string; stages: Stage[] }
export interface Skill { n: number; name: string; role: string; icon: string; phases: Phase[] }

const A = (name: string, note: string): Stage => ({ name, note, mode: "auto" });
const H = (name: string, note: string): Stage => ({ name, note, mode: "human" });

// Skill-specific notes where the generic wording would be vague.
const OVERRIDE: Record<number, Record<string, string>> = {
  1: { "Discover & Research": "Pull last cycle's report and fresh analytics, Search Console and Maps data",
       "Analyze & Interpret": "Where marketing stands today, and the three moves worth making" },
  2: { "Produce & Configure": "Apply the fixes: pages, speed, structure, metadata",
       "Improve & Test": "Re-test load time and mobile rendering before handoff" },
  3: { "Discover & Research": "Keyword, Maps and AI-answer visibility research",
       "Produce & Configure": "On-page changes, Google Business Profile, answer-ready content blocks" },
  4: { "Produce & Configure": "Write and design the text, image, video and audio drafts",
       "Correct & Rework": "Rework whatever the owner rejected, with the note applied" },
  5: { "Plan the Work": "Split the approved budget across platforms and audiences",
       "Track & Respond": "Watch spend daily; pause anything over budget" },
  6: { "Release & Deliver": "Publish to the approved social channels - only after the gate",
       "Track & Respond": "Answer comments and messages on the published posts" },
  8: { "Assess & Validate": "Score every enquiry against the MQL rules",
       "Stage & Hand Off": "Route qualified leads to CRM, junk out" },
  9: { "Collect & Structure": "Every customer conversation logged against the right record",
       "Set Timing & Sequence": "Follow-up reminders sequenced per lead" },
  10: { "Produce & Configure": "Pull the numbers together into the report set",
        "Report & Learn": "What worked, what did not, what changes next cycle" },
};

function phasesFor(n: number): Phase[] {
  const ov = OVERRIDE[n] || {};
  const st = (name: string, note: string, human = false): Stage =>
    human ? H(name, ov[name] || note) : A(name, ov[name] || note);
  return [
    { id: `${n}.1`, name: "Understand", stages: [
      st("Discover & Research", "Pull the previous cycle's results and fresh inputs"),
      st("Collect & Structure", "Bring the material together in one place, in order"),
      st("Assess & Validate", "Check it against the masters and the house rules"),
      st("Analyze & Interpret", "Work out what it means for this skill"),
    ] },
    { id: `${n}.2`, name: "Decide & approve", stages: [
      st("Recommend Actions", "Shortlist the moves worth making"),
      st("Define the Approach", "Set the scope, the audience and the expected output"),
      st("Plan the Work", "Steps, owners, timing and budget"),
      st("Review & Approve", "The owner's gate: approve the plan or send it back for revision", true),
    ] },
    { id: `${n}.3`, name: "Produce & refine", stages: [
      st("Produce & Configure", "Draft the work and set up the tools"),
      st("Correct & Rework", "Fix whatever review rejected"),
      st("Improve & Test", "Tighten and test before anything ships"),
      st("Set Timing & Sequence", "Schedule and order the releases"),
    ] },
    { id: `${n}.4`, name: "Deliver & learn", stages: [
      st("Stage & Hand Off", "Package the work for release"),
      st("Release & Deliver", "Goes live only after the owner's approval", true),
      st("Track & Respond", "Watch the results and answer reactions"),
      st("Report & Learn", "Feed results and lessons into the next cycle"),
    ] },
  ];
}

export const SKILLS: Skill[] = [
  { n: 1, name: "Audit & Strategy", role: "the consultant", icon: "gauge", phases: phasesFor(1) },
  { n: 2, name: "Website", role: "the storefront", icon: "world", phases: phasesFor(2) },
  { n: 3, name: "SEO - Organic, Local & AEO/GEO", role: "the signposts", icon: "search", phases: phasesFor(3) },
  { n: 4, name: "Content & Creatives", role: "the studio", icon: "edit", phases: phasesFor(4) },
  { n: 5, name: "Paid Ads", role: "the media buyer", icon: "speaker", phases: phasesFor(5) },
  { n: 6, name: "Social Media", role: "the noticeboard", icon: "insta", phases: phasesFor(6) },
  { n: 7, name: "Brand", role: "the brand guardian", icon: "palette", phases: phasesFor(7) },
  { n: 8, name: "MQL", role: "the lead sorter", icon: "filter", phases: phasesFor(8) },
  { n: 9, name: "CRM", role: "the notebook", icon: "notebook", phases: phasesFor(9) },
  { n: 10, name: "Reports & Publishing", role: "the report desk", icon: "chart", phases: phasesFor(10) },
];

// Sample output cards per phase (front-end mock data). Keyed by phase id ("skill.phase").
export interface OutRow { k: string; v: string; tone?: "blue" | "orange" }
export interface OutCard { title: string; icon: string; rows?: OutRow[]; files?: { name: string; meta: string }[]; risks?: string[]; links?: { name: string; meta: string }[]; editor?: string; grid?: { columns: string[]; rows: string[][] } }
export const OUTPUTS: Record<string, OutCard[]> = {
  "1.2": [ { title: "Material collected", icon: "sheet", rows: [
      { k: "Data sources connected", v: "4" }, { k: "Last cycle's reports", v: "2" },
      { k: "Gaps flagged", v: "2", tone: "blue" } ],
      risks: ["GA4 not connected", "No CRM export yet"] } ],
  "1.4": [ { title: "Marketing audit scorecard", icon: "table", grid: {
      columns: ["Area", "Score", "Target", "Status"],
      rows: [
        ["Website health", "72 / 100", "85", "Below target"],
        ["Google visibility", "41 / 100", "70", "Below target"],
        ["Social presence", "63 / 100", "75", "Close"],
        ["Lead capture", "35 / 100", "60", "Below target"],
        ["Brand consistency", "80 / 100", "80", "On target"] ] } } ],
  "2.3": [ { title: "Website fixes applied", icon: "world", rows: [
      { k: "Pages optimized", v: "6" }, { k: "Load time", v: "2.1s", tone: "blue" },
      { k: "Mobile score", v: "88", tone: "blue" } ] } ],
  "4.3": [ { title: "Draft launch post", icon: "edit",
      editor: "<p>New this week: our fastest turnaround yet on custom enclosures.</p><p>Send your drawing, get a quote in 48 hours. Link in bio.</p>",
      files: [{ name: "launch-visual-v2.png", meta: "Image" }, { name: "launch-video-script.docx", meta: "Script" }] } ],
  "5.2": [ { title: "Budget plan", icon: "speaker", rows: [
      { k: "Approved budget", v: "Rs 20,000" }, { k: "Planned spend", v: "Rs 18,400" },
      { k: "Platforms", v: "Google + Meta" }, { k: "Reserve", v: "Rs 1,600", tone: "blue" } ] } ],
  "6.4": [ { title: "Published this cycle", icon: "insta", rows: [
      { k: "Posts published", v: "3", tone: "blue" }, { k: "Comments answered", v: "11" } ],
      links: [ { name: "Instagram - launch post", meta: "Live" }, { name: "LinkedIn - launch post", meta: "Live" } ] } ],
  "8.2": [ { title: "Enquiries this week", icon: "filter", rows: [
      { k: "New enquiries", v: "14" }, { k: "Qualified (MQL)", v: "6", tone: "blue" },
      { k: "Routed to CRM", v: "6" }, { k: "Junk filtered", v: "3" } ] } ],
  "9.3": [ { title: "Follow-ups", icon: "notebook", rows: [
      { k: "Follow-ups sent", v: "6" }, { k: "Replies", v: "2", tone: "blue" },
      { k: "Next reminders set", v: "4" } ] } ],
  "10.4": [ { title: "Report set", icon: "sheet", files: [
      { name: "Weekly marketing report.xlsx", meta: "Ready" }, { name: "Campaign summary.pdf", meta: "Ready" },
      { name: "Next-cycle recommendations.docx", meta: "Building" } ] } ],
};

export const CHAT_START: [string, string][] = [
  ["ai", "Client material received - brand kit, product photos and last month's reports. All 3 files passed the scan."],
  ["ai", "Select Start in the Output panel and the Router will run the engagement across the ten skills, pausing at every approval gate."],
];

// Plan-gate and release-gate copy. The gates are the safety net: nothing goes live
// and no money is spent without the owner's approval; a rejected plan loops back to
// Phase 2 instead of shipping.
export const PLAN_CHECKS = (name: string) => [
  `${name} findings analyzed - Phase 1 (Understand) complete`,
  "Scope, expected output, audience and budget defined",
  "Plan ready - steps, timing and owners set",
  "A rejection sends the plan back to Phase 2 for revision",
];
export const RELEASE_CHECKS = [
  "Work produced, tested and scheduled - Phase 3 complete",
  "Staged and ready for release",
  "Publishing happens only on your approval",
];

export const HOOK_LINE = (fromName: string, toName: string) =>
  `${fromName} finished its four phases. The Router has handed the work to ${toName} - starting now.`;
