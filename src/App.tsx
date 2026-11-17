import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  IconBolt, IconChartBar, IconCheck, IconClipboardCheck, IconDatabase, IconFiles, IconFileSpreadsheet, IconFileZip,
  IconFolder, IconGauge, IconInbox, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand,
  IconLink, IconMail, IconMessage, IconMicrophone, IconMoon, IconPencil, IconPlugConnected, IconPlus,
  IconScan, IconSend, IconSun, IconTable, IconTruck, IconUser, IconCircleCheckFilled, IconPlayerStop, IconLogout,
  IconHistory, IconEye, IconX, IconAlertTriangle,
  IconWorld, IconSearch, IconSpeakerphone, IconBrandInstagram, IconPalette, IconFilter, IconNotebook,
} from "@tabler/icons-react";
import bullHead from "./assets/bull-head.png";
import { LoginPage } from "./LoginPage";
import { useList } from "@refinedev/core";
import { dictationSupported, startDictation, stopDictation, useDictate } from "./dictation";
import Uppy from "@uppy/core";
import { CoverLetterEditor } from "./editor";
import { BomGrid } from "./bomgrid";
import { SKILLS, OUTPUTS, CHAT_START, PLAN_CHECKS, RELEASE_CHECKS, HOOK_LINE, type OutCard, type Skill } from "./data";
import { loadRuns, saveRun, statusLabel, type RunStatus } from "./runs";

const SwapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
    <path d="M15 16a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
    <path d="M21 11v-3a2 2 0 0 0 -2 -2h-6l3 3m0 -6l-3 3" />
    <path d="M3 13v3a2 2 0 0 0 2 2h6l-3 -3m0 6l3 -3" />
  </svg>
);
const SUPPORTED_UPLOAD_TYPES = [".png", ".jpg", ".jpeg", ".svg", ".pdf", ".docx", ".pptx", ".xlsx", ".csv", ".txt", ".md", ".zip"];
const MAX_UPLOAD_FILES = 20;

type DemoFile = { name: string; status: "scanning" | "scanned" };

// Run phases: idle -> running -> gate-plan (Phase 2, Review & Approve) -> running ->
// gate-release (Phase 4, Release & Deliver) -> ... -> done. The two gates per skill are
// the approval checkpoints from the master doc.
type RunPhase = "idle" | "running" | "gate-plan" | "gate-release" | "done";
interface Msg { who: "ai" | "me"; text: string }

const PHASE_NAMES = ["Understand", "Decide & approve", "Produce & refine", "Deliver & learn"];

function getMockReply(question: string, files: DemoFile[], skill: Skill | null, runPhase: RunPhase, phaseIdx: number, stageIdx: number) {
  const q = question.toLowerCase();
  const stage = skill?.name ?? "";
  const hasFiles = files.length > 0;
  const count = files.length;
  const scanned = files.filter(f => f.status === "scanned").length;

  if (/file type|file format|extension|formats? can i upload|what can i upload/.test(q)) {
    return `Supported formats: ${SUPPORTED_UPLOAD_TYPES.join(", ")}.`;
  }
  if (/scan|virus|duplicate/.test(q)) {
    if (!hasFiles) return "No files have been uploaded.";
    return `${scanned} of ${count} files scanned${scanned < count ? `; ${count - scanned} still scanning` : ""}.`;
  }
  if (/what happens after upload|after upload|how.*start|start.*engagement/.test(q)) {
    return hasFiles
      ? "When all files finish scanning, select Start in the Output panel."
      : "Add the client's material with Add files; then select Start in the Output panel.";
  }
  if (/budget|spend|cost|money/.test(q)) {
    return "Mock budget: Paid Ads is planning inside the approved Rs 20,000 - planned spend Rs 18,400 across Google and Meta. Nothing is spent without your approval at the gate.";
  }
  if (/lead|enquir|mql/.test(q)) {
    return "Mock lead flow: 14 enquiries this week, 6 qualified and routed to CRM, 3 junk filtered out.";
  }
  if (/report|numbers|results/.test(q)) {
    if (runPhase !== "done") return "Reports & Publishing has not run yet; the report set lands at the end of the engagement.";
    return "The report set is ready: weekly report and campaign summary in the Output panel, next-cycle recommendations building.";
  }
  if (/review|approval|approve|gate/.test(q)) {
    if (runPhase === "gate-plan" && skill) return `${stage} is waiting for your plan approval - Phase 2, Review & Approve.`;
    if (runPhase === "gate-release" && skill) return `${stage} is waiting for your go-live approval - Phase 4, Release & Deliver.`;
    if (runPhase === "done") return "No approval is pending; the engagement is complete.";
    if (skill) return `No approval pending; ${stage} is running.`;
    return "No approval is pending yet.";
  }
  if (/progress|what.*running|current stage|current output|what.*ready/.test(q)) {
    if (runPhase === "done") return "The engagement is complete.";
    if (!skill) return "No skill is running yet.";
    const ph = skill.phases[Math.min(phaseIdx, 3)];
    const st = ph.stages[Math.min(stageIdx, ph.stages.length - 1)];
    return runPhase === "gate-plan" || runPhase === "gate-release"
      ? `Waiting on you: ${stage} - Phase ${phaseIdx + 1} (${ph.name}), ${st.name}.`
      : `${stage} is running Phase ${phaseIdx + 1} (${ph.name}): ${st.name}.`;
  }
  if (/what.*next|next step/.test(q)) {
    if (runPhase === "done") return "There is no next step; the engagement is complete. Reports & Publishing feeds the lessons into the next cycle.";
    if (runPhase === "gate-plan" || runPhase === "gate-release") return "Your approval is the next step - use the card above.";
    return skill ? `${skill.name} is in progress.` : "Add the client material to begin.";
  }
  if (/uploaded files|which files|what files (are )?(uploaded|received)|file status/.test(q)) {
    return hasFiles ? files.map(f => `${f.name}: ${f.status}`).join("; ") : "No files have been uploaded.";
  }
  if (/summar|overview/.test(q)) {
    if (!hasFiles) return "No client material has been uploaded.";
    return `Mock intake: ${count} file${count === 1 ? "" : "s"} (${files.map(f => f.name).join(", ")}); ${scanned} scanned.`;
  }
  if (/router|who are you|what can you do/.test(q)) {
    return "I am the Router - the front desk of your marketing agent. Tell me the work in plain words; I route it to the right skill and control every approval.";
  }
  return "I don't have a mock answer for that question.";
}

function getPromptSuggestions(question: string, files: DemoFile[], skill: Skill | null, runPhase: RunPhase) {
  const q = question.toLowerCase();
  if (/budget|spend|cost/.test(q)) return ["What is the planned spend?", "What needs my approval?", "What is running now?"];
  if (/lead|enquir|mql/.test(q)) return ["How many leads qualified?", "What is the current stage?", "Show the report status"];
  if (/report|numbers|results/.test(q)) return ["Are the reports ready?", "What is next?", "What needs my approval?"];
  if (/review|approval|approve|gate/.test(q)) return ["What needs my approval?", "What output is ready?", "What happens after approval?"];
  if (/scan|virus|file|upload|format/.test(q)) return ["Show scan status", "What file formats can I upload?", "What happens after upload?"];
  if (runPhase === "done") return ["Show the results", "Are the reports ready?", "Summarize the engagement"];
  if (runPhase === "gate-plan" || runPhase === "gate-release") return ["What needs my approval?", "Summarize current output", "What's next after approval?"];
  if (runPhase === "running") return ["What's running now?", "What output is ready?", "What's next?"];
  if (skill) return ["What is the current stage?", "What output is ready?", "What needs approval?"];
  if (files.length) return ["Summarize the intake", "What happens after upload?", "Show scan status"];
  return ["What file formats can I upload?", "What can the Router do?", "How do I start the engagement?"];
}

const ICONS: Record<string, any> = {
  inbox: IconInbox, scan: IconScan, gauge: IconGauge, truck: IconTruck,
  send: IconSend, database: IconDatabase, clipcheck: IconClipboardCheck,
  sheet: IconFileSpreadsheet, chart: IconChartBar, mail: IconMail,
  table: IconTable, link: IconLink, message: IconMessage, edit: IconPencil,
  world: IconWorld, search: IconSearch, speaker: IconSpeakerphone,
  insta: IconBrandInstagram, palette: IconPalette, filter: IconFilter, notebook: IconNotebook,
};

export default function App() {
  const { result } = useList<Skill>({ resource: "skills" });
  const skills: Skill[] = (result?.data?.length ? result.data : SKILLS) as Skill[];
  const [theme, setTheme] = useState<"light" | "dark">(() => new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light");
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem("cam-rfq-demo-auth") === "true");
  const [skillIdx, setSkillIdx] = useState(-1);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [openPhase, setOpenPhase] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const pushMsg = (text: string) => setMsgs(m => [...m, { who: "ai", text }]);
  // Empty-chat greeting: the BuLL floats in the top centre (BAM_UI orb treatment) and fades away on the first message.
  const gateOpen = runPhase === "gate-plan" || runPhase === "gate-release";
  const chatEmpty = msgs.length === 0 && !gateOpen;
  const wasChatEmpty = useRef(chatEmpty);
  const [greetLeaving, setGreetLeaving] = useState(false);
  useEffect(() => {
    if (wasChatEmpty.current && !chatEmpty) setGreetLeaving(true);
    wasChatEmpty.current = chatEmpty;
  }, [chatEmpty]);
  useEffect(() => {
    if (!greetLeaving) return;
    const t = setTimeout(() => setGreetLeaving(false), 320);
    return () => clearTimeout(t);
  }, [greetLeaving]);
  const [files, setFiles] = useState<DemoFile[]>([]);
  // Uppy manages the picked files (same library BAM_UI uses for intake). The pickers
  // are real - the names listed are the files the user actually chose. Nothing is
  // uploaded anywhere: there is no backend in this demo build, so the scan marks
  // below are simulated intake statuses, not a real antivirus scan.
  const uppy = useMemo(() => new Uppy({
    id: "bullmaps-intake",
    restrictions: { maxNumberOfFiles: MAX_UPLOAD_FILES, allowedFileTypes: SUPPORTED_UPLOAD_TYPES },
  }), []);
  const afWrap = useRef<HTMLDivElement>(null);
  const folderPick = useRef<HTMLInputElement>(null);
  const bulkPick = useRef<HTMLInputElement>(null);
  const zipPick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onAdded = (f: { name?: string }) => {
      const name = f.name || "file";
      setFiles(fs => fs.some(x => x.name === name) ? fs : [...fs, { name, status: "scanning" }]);
      setTimeout(() => setFiles(fs => fs.map(x => x.name === name ? { ...x, status: "scanned" } : x)), 800 + Math.random() * 900);
    };
    uppy.on("file-added", onAdded);
    return () => { uppy.off("file-added", onAdded); };
  }, [uppy]);
  const addPicked = (list: FileList | File[] | null) => {
    setAfOpen(false);
    setUploadModal(null);
    setDropOver(false);
    if (!list || list.length === 0) return;
    const before = uppy.getFiles().length;
    Array.from(list).forEach(f => { try { uppy.addFile({ name: f.name, type: f.type, data: f, source: "AddFilesMenu" }); } catch { /* duplicate or restricted */ } });
    const added = uppy.getFiles().length - before;
    const total = list.length;
    const skipped = total - added;
    setUploadNote(skipped > 0
      ? `Added ${added} of ${total} picked files. ${skipped} skipped - intake accepts up to ${MAX_UPLOAD_FILES} files at once and only these types: ${SUPPORTED_UPLOAD_TYPES.join(", ")}. Files already in the list are not added twice.`
      : "");
  };
  // Demo states for screenshots: ?demo=running|plan|release|final
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("uploaded")) {
      const names = ["brand-kit.zip", "product-photos.zip", "last-month-reports.xlsx"];
      setFiles(names.map(name => ({ name, status: "scanned" as const })));
    }
    const d = params.get("demo");
    if (!d) return;
    const i = 3; // Content & Creatives
    setSkillIdx(i); setExpanded(i);
    if (d === "running") { setPhaseIdx(0); setStageIdx(2); setRunPhase("running"); setOpenPhase(0); }
    else if (d === "plan") { setPhaseIdx(1); setStageIdx(3); setRunPhase("gate-plan"); setOpenPhase(1);
      setMsgs([{ who: "ai", text: "Content & Creatives has finished planning (Phase 2, Plan the Work). The plan is ready for your review - approve it or send it back." }]); }
    else if (d === "release") { setPhaseIdx(3); setStageIdx(1); setRunPhase("gate-release"); setOpenPhase(3);
      setMsgs([{ who: "ai", text: "Content & Creatives is staged and ready to go live (Phase 4, Release & Deliver). Nothing is published until you approve." }]); }
    else { setPhaseIdx(3); setStageIdx(3); setRunPhase("done"); setOpenPhase(3); }
  }, []);
  const [draft, setDraft] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [runStart, setRunStart] = useState<{ t: number; files: string[] } | null>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const dic = useDictate();
  const listening = dic.phase === "listening" || dic.phase === "requesting";
  const elapsed = dic.startedAt ? `${Math.floor((Date.now() - dic.startedAt) / 60000)}:${String(Math.floor((Date.now() - dic.startedAt) / 1000) % 60).padStart(2, "0")}` : "0:00";
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stopDictation(); };
    window.addEventListener("keydown", onKey);
    const t = setInterval(() => setDraft(d => d), 500);
    return () => { window.removeEventListener("keydown", onKey); clearInterval(t); };
  }, [listening]);
  const [railMini, setRailMini] = useState(() => new URLSearchParams(location.search).has("mini"));
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [paneOrder, setPaneOrder] = useState<string[]>(["rail", "mid", "right"]);
  const swapPane = (id: string) => setPaneOrder(o => {
    const i = o.indexOf(id);
    const next = [...o];
    if (i === 0) { next.push(next.shift()!); }
    else { [next[i - 1], next[i]] = [next[i], next[i - 1]]; }
    return next;
  });
  const paneCols = paneOrder.map((id, i) =>
    (id === "rail" && railMini) || (id === "mid" && assistantCollapsed) ? "56px" : `minmax(0, ${[20, 40, 40][i]}fr)`).join(" ");
  const [afOpen, setAfOpen] = useState(() => new URLSearchParams(location.search).has("af"));
  const [uploadModal, setUploadModal] = useState<null | "folder" | "files" | "zip">(null);
  const [dropOver, setDropOver] = useState(false);
  useEffect(() => {
    if (!afOpen) return;
    const onDocDown = (e: MouseEvent) => { if (!afWrap.current?.contains(e.target as Node)) setAfOpen(false); };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [afOpen]);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const skill = skillIdx >= 0 ? skills[skillIdx] : null;
  const doneCount = runPhase === "done" ? skills.length : Math.max(0, skillIdx);
  const lastUserQuestion = [...msgs].reverse().find(m => m.who === "me")?.text ?? "";
  const promptSuggestions = getPromptSuggestions(lastUserQuestion, files, skill, runPhase);

  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".profile")) setProfileOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [profileOpen]);
  const signInToDemo = () => {
    sessionStorage.setItem("cam-rfq-demo-auth", "true");
    setAuthenticated(true);
  };
  const signOutOfDemo = () => {
    sessionStorage.removeItem("cam-rfq-demo-auth");
    setAuthenticated(false);
  };

  // The run engine: walks the active skill's four phases stage by stage. Every skill
  // pauses twice for the owner - at Phase 2 (Review & Approve, the plan gate) and at
  // Phase 4 (Release & Deliver, the go-live gate) - per the BuLLMaps master doc.
  useEffect(() => {
    if (runPhase !== "running" || !skill) return;
    const t = setTimeout(() => {
      const ph = skill.phases[phaseIdx];
      const lastStage = ph.stages.length - 1;
      if (phaseIdx === 1 && stageIdx === lastStage - 1) {
        setStageIdx(lastStage);
        setRunPhase("gate-plan");
        setOpenPhase(1);
        pushMsg(`${skill.name} has finished planning (Phase 2, Plan the Work). The plan is ready for your review - approve it or send it back.`);
        return;
      }
      if (phaseIdx === 3 && stageIdx === 0) {
        setStageIdx(1);
        setRunPhase("gate-release");
        setOpenPhase(3);
        pushMsg(`${skill.name} is staged and ready to go live (Phase 4, Release & Deliver). Nothing is published until you approve.`);
        return;
      }
      if (stageIdx < lastStage) { setStageIdx(stageIdx + 1); return; }
      if (phaseIdx < skill.phases.length - 1) {
        setPhaseIdx(phaseIdx + 1);
        setStageIdx(0);
        setOpenPhase(phaseIdx + 1);
        return;
      }
      if (skillIdx < skills.length - 1) {
        pushMsg(HOOK_LINE(skill.name, skills[skillIdx + 1].name));
        setSkillIdx(skillIdx + 1);
        setPhaseIdx(0);
        setStageIdx(0);
        setExpanded(skillIdx + 1);
        setOpenPhase(0);
      } else {
        recordRun("completed");
        setRunPhase("done");
        pushMsg("Engagement complete. The full report set is in the Output panel - every publish and every rupee spent went through your approvals.");
      }
    }, 650);
    return () => clearTimeout(t);
  }, [runPhase, stageIdx, phaseIdx, skillIdx]);

  const startRun = () => {
    setRunStart({ t: Date.now(), files: files.map(f => f.name) });
    setRejectOpen(false); setRejectNote("");
    setSkillIdx(0); setPhaseIdx(0); setStageIdx(0); setRunPhase("running");
    setExpanded(0); setOpenPhase(0);
    pushMsg("The Router has started the engagement - Audit & Strategy begins with Phase 1 (Understand).");
  };

  const recordRun = (status: RunStatus, note?: string) => {
    saveRun({
      id: String(Date.now()),
      rfq: "BuLLMaps engagement",
      startedAt: runStart?.t ?? Date.now(),
      endedAt: Date.now(),
      status,
      note,
      files: runStart?.files ?? files.map(f => f.name),
      reachedSkill: status === "stopped" ? Math.max(1, skillIdx + 1) : skills.length,
    });
    setRunStart(null);
  };

  const resetRun = () => { setRunPhase("idle"); setSkillIdx(-1); setPhaseIdx(0); setStageIdx(0); setExpanded(null); setOpenPhase(null); };

  // Plan gate: approve moves the skill into Phase 3; reject loops the plan back into
  // Phase 2 with the owner's note, exactly as the master doc's gate rule describes.
  const approvePlan = () => {
    if (runPhase !== "gate-plan") return;
    setRejectOpen(false); setRejectNote("");
    setRunPhase("running");
    setPhaseIdx(2); setStageIdx(0); setOpenPhase(2);
    pushMsg(`Plan approved - ${skill?.name} moves to Phase 3 (Produce & refine).`);
  };
  const sendBack = () => {
    if (runPhase !== "gate-plan") return;
    const note = rejectNote.trim();
    setRejectOpen(false); setRejectNote("");
    setRunPhase("running");
    setPhaseIdx(1); setStageIdx(0); setOpenPhase(1);
    pushMsg(`Sent back${note ? ` with your note: "${note}"` : ""}. ${skill?.name} reworks the plan in Phase 2 and will bring it back for approval.`);
  };
  // Go-live gate: publishing happens only after this approval.
  const approveRelease = () => {
    if (runPhase !== "gate-release") return;
    setRunPhase("running");
    setStageIdx(2);
    pushMsg(`Approved to publish - ${skill?.name} is releasing now.`);
  };
  const stopRun = () => {
    if (runPhase === "idle" || runPhase === "done") return;
    recordRun("stopped");
    setMsgs(m => [...m, { who: "ai", text: "Run stopped. Nothing was published - start it again any time." }]);
    resetRun();
  };

  const sendChat = (suggestion?: string) => {
    const text = (suggestion ?? draft).trim();
    if (!text) return;
    const reply = getMockReply(text, files, skill, runPhase, phaseIdx, stageIdx);
    setMsgs(m => [...m, { who: "me", text }, { who: "ai", text: reply }]);
    setDraft("");
  };

  const phaseStatus = (p: number) =>
    skillIdx < 0 ? "wait" : p < phaseIdx ? "done" : p > phaseIdx ? "wait"
      : runPhase === "done" ? "done"
      : (runPhase === "gate-plan" && p === 1) || (runPhase === "gate-release" && p === 3) ? "review" : "run";
  const stageStatus = (p: number, s: number) => {
    const ps = phaseStatus(p);
    if (ps === "done") return "done";
    if (ps === "wait") return "wait";
    if (ps === "review") return s < stageIdx ? "done" : s === stageIdx ? "review" : "wait";
    return s < stageIdx ? "done" : s === stageIdx ? "run" : "wait";
  };

  if (!authenticated) {
    return <LoginPage theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onSignIn={signInToDemo} />;
  }

  return (
    <div className="app">
      <header className="top">
        <div className="wm-brand">
          <img className="wm-bull" src={bullHead} alt="BuLLM" />
          <span className="wm-name">BuLLM</span>
        </div>
        <div className="scr-t">
          <h1>BuLLMaps - Marketing Agent</h1>
          <p>One agent: Router + 10 skills - approval gates before anything goes live or costs money</p>
        </div>
        <div className="top-right">
          <button className="demo-chip as-btn" onClick={() => { setRunsOpen(true); setOpenRunId(null); }}><IconHistory size={13} /> Runs</button>
          <span className="demo-chip">Demo - mock data, no backend</span>
          <button className="iconbtn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">
            {theme === "light" ? <IconMoon size={16} /> : <IconSun size={16} />}
          </button>
          <div className="profile">
            <button className="avatar" onClick={() => setProfileOpen(o => !o)} aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Profile" title="Profile">V</button>
            {profileOpen && (
              <div className="profile-menu" role="menu">
                <button className="profile-item" role="menuitem" onClick={() => { setProfileOpen(false); signOutOfDemo(); }}>
                  <IconLogout size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={"main" + (assistantCollapsed ? " assistant-collapsed" : "")} style={{ gridTemplateColumns: paneCols }}>
        {/* LEFT RAIL - the agent: Router / Concierge + the ten skills (BAM_UI look) */}
        <section className={"pane rail" + (railMini ? " mini" : "")} style={{ order: paneOrder.indexOf("rail") }}>
          <div className="rail-h">
            {!railMini && <button className="iconbtn sm pane-swap" onClick={() => swapPane("rail")} aria-label="Swap the agent pane one place left" title="Swap pane left"><SwapIcon /></button>}
            {!railMini && <h2>Agent - BuLLMaps</h2>}
            <button className="iconbtn sm" onClick={() => setRailMini(!railMini)} aria-expanded={!railMini}
              aria-label={railMini ? "Expand navigation" : "Collapse navigation"} title={railMini ? "Expand navigation" : "Collapse navigation"}>
              {railMini ? <IconLayoutSidebarLeftExpand size={14} /> : <IconLayoutSidebarLeftCollapse size={14} />}
            </button>
          </div>
          {railMini ? (
            <div className="mini-list">
              <div className="mini-item">
                <button className="mini-dot router-mini" title="Router / Concierge" onClick={() => setRailMini(false)}>
                  <img className="bull" src={bullHead} alt="Router" />
                </button>
                <span className="mini-label">Router</span>
              </div>
              {skills.map((s, i) => {
                const isDone = i < doneCount || (i === skillIdx && runPhase === "done");
                const isActive = !isDone && i === skillIdx;
                const Icon = ICONS[s.icon] || IconBolt;
                return (
                  <div key={s.n} className="mini-item">
                    <button className={"mini-dot" + (isDone ? " done" : isActive ? " on" : "")} title={s.name}
                      onClick={() => { setRailMini(false); setExpanded(i); }}>
                      {isDone ? <IconCheck size={15} /> : <Icon size={15} />}
                      {isActive && <span className="pulse" />}
                    </button>
                    <span className="mini-label">{s.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
          <>
          <div className="pane-b">
            <div ref={afWrap} className={"af-wrap" + (afOpen ? " open" : "")}>
              <button className="af-btn" aria-haspopup="menu" aria-expanded={afOpen} onClick={() => setAfOpen(!afOpen)}>
                <IconPlus size={14} /> Add files
              </button>
              <div className="af-menu" role="menu" aria-label="Add files">
                <button role="menuitem" className="af-item" onClick={() => { setAfOpen(false); setUploadModal("folder"); }}><IconFolder size={16} /> Choose folder</button>
                <button role="menuitem" className="af-item" onClick={() => { setAfOpen(false); setUploadModal("files"); }}><IconFiles size={16} /> Bulk upload</button>
                <button role="menuitem" className="af-item" onClick={() => { setAfOpen(false); setUploadModal("zip"); }}><IconFileZip size={16} /> Upload zip</button>
                <input ref={folderPick} type="file" multiple hidden {...({ webkitdirectory: "" } as object)} onChange={e => { addPicked(e.target.files); e.target.value = ""; }} />
                <input ref={bulkPick} type="file" multiple hidden onChange={e => { addPicked(e.target.files); e.target.value = ""; }} />
                <input ref={zipPick} type="file" accept=".zip,application/zip" hidden onChange={e => { addPicked(e.target.files); e.target.value = ""; }} />
              </div>
            </div>
            <div className="af-s">Company documents, brand kit, photos, templates - the client's own material for the agent</div>

            {/* The Router / Concierge: the front desk of the marketing agency. Pinned
                above the skills - it listens, routes the work and controls every approval. */}
            <div className="router-card">
              <span className="rc-ic"><img className="bull" src={bullHead} alt="" /></span>
              <div className="rc-tx">
                <div className="rc-nm">Router / Concierge</div>
                <div className="rc-ds">The front desk: listens, asks one short question when something is missing, routes work to the right skill and controls every approval.</div>
              </div>
            </div>

            <div className="stages">
            {skills.map((s, i) => {
              const isDone = i < doneCount || (i === skillIdx && runPhase === "done");
              const gate = i === skillIdx && (runPhase === "gate-plan" || runPhase === "gate-release");
              const st = isDone ? "" : i === skillIdx
                ? gate ? "Waiting for your approval" : `In progress - Phase ${phaseIdx + 1} of 4: ${PHASE_NAMES[phaseIdx]}`
                : "Waiting";
              const isActive = !isDone && i === skillIdx;
              const cls = isDone ? "skill done" : isActive ? "skill active" : "skill";
              const Icon = ICONS[s.icon] || IconBolt;
              return (
                <div key={s.n} className="stage-li">
                  {i < skills.length - 1 && <span className="st-line" aria-hidden />}
                  <button className={cls + (expanded === i ? " open" : "")}
                    onClick={() => { setExpanded(expanded === i ? null : i); if (expanded !== i) setOpenPhase(i === skillIdx ? phaseIdx : null); }}
                    aria-expanded={expanded === i}>
                    <div className="dot">{isDone ? <IconCheck size={15} /> : <Icon size={15} />}{isActive && <span className="pulse" />}</div>
                    <div className="tx">
                      <div className="nm">{s.name}</div>
                      <div className="st">{isDone ? <span className="done-tick"><IconCircleCheckFilled size={15} /></span> : st}</div>
                    </div>
                  </button>
                  {expanded === i && (
                    <div className="acc">
                      {s.phases.map((ph, p) => {
                        const ps = i === skillIdx ? phaseStatus(p) : i < doneCount ? "done" : "wait";
                        const open = openPhase === p;
                        return (
                          <div key={ph.id} className={"ph" + (open ? " open" : "")}>
                            <button className="ph-h" onClick={() => setOpenPhase(open ? null : p)} aria-expanded={open}>
                              <span className={"ph-d" + (ps === "done" ? " done" : ps === "run" || ps === "review" ? " act" : "")}>
                                {ps === "done" ? <IconCheck size={11} /> : p + 1}
                              </span>
                              <span className="ph-n">{ph.name}</span>
                              {ps === "review" && <span className="ph-gate">gate</span>}
                              <span className="ph-chev">{open ? "\u2303" : "\u2304"}</span>
                            </button>
                            {open && (
                              <div className="ph-b">
                                {ph.stages.map((stg, k) => {
                                  const ss = i === skillIdx ? stageStatus(p, k) : i < doneCount ? "done" : "wait";
                                  return (
                                    <div key={stg.name} className={"stage-row" + (ss === "done" ? " done" : ss === "run" || ss === "review" ? " act" : "")}>
                                      <span className="sd" />
                                      <span className="sg-nm">{stg.name}</span>
                                      <span className="mode">
                                        {ss === "done" && <span className="done-tick"><IconCircleCheckFilled size={14} /></span>}
                                        <span className="mode-icon">{stg.mode === "human" ? <IconUser size={14} /> : <img className="bull" src={bullHead} alt="Automated" />}</span>
                                      </span>
                                    </div>
                                  );
                                })}
                                {ph.stages.some(stg => stg.mode === "human") && (
                                  <div className="gate-note"><IconUser size={12} /><span>Approval gate - nothing moves on without the owner's yes.</span></div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
          <div className="legend">
            <span><img className="bull" src={bullHead} alt="" /> Automated</span>
            <span><IconUser size={14} /> Owner approval</span>
          </div>
          </>
          )}
        </section>

        {/* MIDDLE - the Router / Concierge chat */}
        <section className={"pane mid" + (assistantCollapsed ? " collapsed" : "")} style={{ order: paneOrder.indexOf("mid") }}>
          {assistantCollapsed ? (
            <div className="assistant-rail-head">
              <button className="assistant-show" onClick={() => setAssistantCollapsed(false)} aria-expanded={false} aria-label="Show the Router">
                <IconLayoutSidebarLeftExpand size={16} /><span>Show the Router</span>
              </button>
            </div>
          ) : (
          <>
          <div className="pane-h">
            <button className="iconbtn sm pane-swap" onClick={() => swapPane("mid")} aria-label="Swap the Router pane one place left" title="Swap pane left"><SwapIcon /></button>
            <div className="assistant-title"><h2 className="assistant-heading">Router / Concierge</h2></div>
            <span className="sub">front desk - controls every approval</span>
            <button className="iconbtn sm assistant-hide" onClick={() => setAssistantCollapsed(true)} aria-expanded={true} aria-label="Hide the Router" title="Hide the Router">
              <IconLayoutSidebarLeftCollapse size={14} />
            </button>
          </div>
          <div className="pane-b">
            {chatEmpty && (
              <div className="chat-empty">
                <span className="ce-bull"><img src={bullHead} alt="" /></span>
                <h3 className="ce-hello">Tell the Router what marketing work you need.</h3>
              </div>
            )}
            {greetLeaving && !chatEmpty && (
              <div className="chat-empty ce-leaving" aria-hidden="true">
                <span className="ce-bull"><img src={bullHead} alt="" /></span>
                <h3 className="ce-hello">Tell the Router what marketing work you need.</h3>
              </div>
            )}
            {msgs.map((m, i) => (
              <Fragment key={i}>
                <div className={"msg " + m.who}>
                  <div><div className="who">{m.who === "ai" ? "Router" : "You"}</div><div className="b">{m.text}</div></div>
                </div>
              </Fragment>
            ))}
            {/* The approval gates live in the conversation: the Router asks, the owner
                answers. Approve continues the skill; reject loops the plan back to
                Phase 2 with the owner's note. */}
            {skill && runPhase === "gate-plan" && (
              <div className="rcard">
                <div className="rh"><div className="ri"><IconUser size={18} /></div>
                  <div><h3>Approval needed - Phase 2: Decide &amp; approve</h3><div className="rs">{skill.name} - nothing is produced until you approve the plan</div></div></div>
                <div className="rb"><div className="rl">What you are approving</div>
                  {PLAN_CHECKS(skill.name).map(c => <div className="rcheck" key={c}><span className="ci"><IconCheck size={14} /></span>{c}</div>)}</div>
                <div className="rf">
                  <button className="rbtn" onClick={approvePlan}><IconCheck size={16} /> Approve - start Phase 3</button>
                  {!rejectOpen ? (
                    <button className="rbtn ghost" onClick={() => setRejectOpen(true)}><IconX size={16} /> Reject - send back to Phase 2</button>
                  ) : (
                    <div className="reject-form">
                      <textarea className="reject-note" rows={2} placeholder="What should change in the plan" value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)} aria-label="Note for the rework" />
                      <div className="reject-actions">
                        <button className="rbtn ghost" onClick={() => { setRejectOpen(false); setRejectNote(""); }}>Cancel</button>
                        <button className="rbtn reject" onClick={sendBack}><IconX size={16} /> Send back</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {skill && runPhase === "gate-release" && (
              <div className="rcard">
                <div className="rh"><div className="ri"><IconUser size={18} /></div>
                  <div><h3>Approval needed - Phase 4: Deliver &amp; learn</h3><div className="rs">{skill.name} - nothing goes live and no money is spent until you approve</div></div></div>
                <div className="rb"><div className="rl">What you are approving</div>
                  {RELEASE_CHECKS.map(c => <div className="rcheck" key={c}><span className="ci"><IconCheck size={14} /></span>{c}</div>)}</div>
                <div className="rf">
                  <button className="rbtn" onClick={approveRelease}><IconCheck size={16} /> Approve - release &amp; deliver</button>
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>
          <div className="prompt-suggestions" role="group" aria-label="Suggested questions">
            {promptSuggestions.map(prompt => <button key={prompt} type="button" className="prompt-chip" onClick={() => sendChat(prompt)}>{prompt}</button>)}
          </div>
          <div className="composer">
            {listening ? (
              <div className="wave" aria-live="polite">
                {dic.levels.map((v, i) => <span key={i} className="wbar" style={{ height: `${6 + v * 24}px` }} />)}
                <span className="wave-t">{dic.phase === "requesting" ? "Requesting microphone..." : elapsed}</span>
              </div>
            ) : (
              <input className="in" value={draft} placeholder="Message the Router"
                onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} />
            )}
            {dictationSupported && (
              <button className={"micb" + (listening ? " live" : "")} aria-label={listening ? "Stop dictation" : "Dictate"}
                onClick={() => listening ? stopDictation() : startDictation(draft, setDraft)}>
                {listening ? <IconPlayerStop size={18} /> : <IconMicrophone size={18} />}
              </button>
            )}
            <button className="sendb" onClick={() => sendChat()} aria-label="Send"><IconSend size={18} /></button>
          </div>
          {dic.phase === "blocked" && <div className="dict-hint">Microphone blocked - allow mic access in the browser to dictate, or type instead.</div>}
          {dic.error && <div className="dict-hint">{dic.error}</div>}
          </>
          )}
        </section>

        {/* RIGHT - stage output */}
        <section className="pane right" style={{ order: paneOrder.indexOf("right") }}>
          <div className="pane-h">
            <button className="iconbtn sm pane-swap" onClick={() => swapPane("right")} aria-label="Swap the output pane one place left" title="Swap pane left"><SwapIcon /></button>
            <IconBolt size={16} />
            <div><h2>Output</h2>
              <div className="sub">{skill ? `${skill.name} - Phase ${phaseIdx + 1}: ${PHASE_NAMES[phaseIdx]}${runPhase === "gate-plan" || runPhase === "gate-release" ? " (gate)" : ""}` : "No skill running yet"}</div>
            </div>
          </div>
          <div className="pane-b">
            {!skill && (
              <>
                {files.length > 0 && (
                <div className="ocard">
                  <h3><span className="oi"><IconFileSpreadsheet size={15} /></span>Client material</h3>
                  {uploadNote && <p className="upload-note">{uploadNote}</p>}
                  {files.map(f => (
                    <div className="orow" key={f.name}><IconFileSpreadsheet size={14} /><span className="n">{f.name}</span>
                      {f.status === "scanned"
                        ? <span className="m" style={{ color: "var(--blue)", display: "inline-flex", alignItems: "center" }} title="Scanned" role="img" aria-label="Scanned"><IconCircleCheckFilled size={15} /></span>
                        : <span className="m" style={{ color: "var(--ink2)" }}>Scanning...</span>}
                    </div>
                  ))}
                </div>
                )}
                <div className="empty" style={{ height: "auto", marginTop: 32 }}>
                  <div className="ei"><IconBolt size={28} /></div>
                  <h3>Stage output appears here</h3>
                  <p>When a skill starts, its stages and their output show up in this pane, phase by phase.</p>
                </div>
              </>
            )}
            {skill && skill.phases.map((ph, p) => {
              const ps = phaseStatus(p);
              if (ps === "wait") return null;
              const chips: Record<string, string> = { run: "Running", wait: "Queued", review: "Gate" };
              return (
                <div key={ph.id}>
                  <div className="ph-out-h">Phase {p + 1} - {ph.name}{ps === "review" ? " (waiting on you)" : ""}</div>
                  {ph.stages.map((stp, k) => {
                    const ss = stageStatus(p, k);
                    if (ss === "wait") return null;
                    return (
                      <div key={stp.name} className={"step" + (ss === "done" ? " done" : ss === "run" ? " run" : "")}>
                        <div className="si">{stp.mode === "human" ? <IconUser size={16} /> : <img className="bull" src={bullHead} alt="Automated" />}</div>
                        <div className="st-t"><div className="st-n">{stp.name}</div><div className="st-m">{stp.note}</div></div>
                        {ss === "done" ? <span className="done-tick"><IconCircleCheckFilled size={20} /></span> : <span className={"chip " + ss}>{chips[ss]}</span>}
                      </div>
                    );
                  })}
                  {(OUTPUTS[ph.id] || []).map((c: OutCard) => (
                    <div className="ocard" key={c.title}>
                      <h3><span className="oi">{(() => { const I = ICONS[c.icon] || IconFileSpreadsheet; return <I size={15} />; })()}</span>{c.title}</h3>
                      {c.editor && <CoverLetterEditor content={c.editor} />}
                      {c.grid && <BomGrid dark={theme === "dark"} columns={c.grid.columns} rows={c.grid.rows} />}
                      {(c.rows || []).map(r => <div className="kv" key={r.k}><span className="k">{r.k}</span><span className="v" style={r.tone ? { color: `var(--${r.tone})` } : undefined}>{r.v}</span></div>)}
                      {(c.files || []).map(f => <div className="orow" key={f.name}><IconFileSpreadsheet size={14} /><span className="n">{f.name}</span><span className="m">{f.meta}</span></div>)}
                      {(c.links || []).map(l => <div className="orow" key={l.name}><IconLink size={14} /><span className="n">{l.name}</span><span className="m">{l.meta}</span></div>)}
                      {(c.risks || []).length > 0 && <div style={{ marginTop: 8 }}>{(c.risks || []).map(r => <span className="risk" key={r}><IconAlertTriangle size={12} /> {r}</span>)}</div>}
                    </div>
                  ))}
                </div>
              );
            })}
            {runPhase === "done" && (
              <div className="ocard"><h3><span className="oi"><IconCheck size={15} /></span>Engagement complete</h3>
                <div className="kv"><span className="k">Skills run</span><span className="v" style={{ color: "var(--blue)" }}>10 of 10</span></div>
                <div className="kv"><span className="k">Report set</span><span className="v" style={{ color: "var(--blue)" }}>Ready in Reports &amp; Publishing</span></div>
                <div className="kv"><span className="k">Published without approval</span><span className="v">Nothing</span></div>
              </div>
            )}
          </div>
          {!skill && runPhase === "idle" && files.length > 0 && files.every(f => f.status === "scanned") && (
            <div className="actionbar">
              <div className="hk">Client material scanned. The Router is ready to start the engagement.</div>
              <button className="abtn" onClick={startRun}><IconBolt size={16} /> Start</button>
            </div>
          )}
          {skill && runPhase !== "done" && (
            <div className="actionbar">
              <div className="hk"><IconPlugConnected size={13} /> {runPhase === "gate-plan" ? "Plan gate open - your approval is needed in the chat." : runPhase === "gate-release" ? "Go-live gate open - your approval is needed in the chat." : "Automated run - the Router pauses at every approval gate."}</div>
              <button className="abtn stop" onClick={stopRun}><IconPlayerStop size={16} /> Stop run</button>
            </div>
          )}
        </section>
      </div>
      {uploadModal && (
        <div className="modal-veil" onClick={() => { setUploadModal(null); setDropOver(false); }}>
          <div className="modal" role="dialog" aria-label="Add files" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{uploadModal === "folder" ? "Choose folder" : uploadModal === "zip" ? "Upload zip" : "Bulk upload"}</h3>
              <button className="iconbtn sm" onClick={() => setUploadModal(null)} aria-label="Close add files"><IconX size={14} /></button>
            </div>
            <div
              className={"up-drop" + (dropOver ? " over" : "")}
              onDragOver={e => { e.preventDefault(); setDropOver(true); }}
              onDragLeave={() => setDropOver(false)}
              onDrop={e => {
                e.preventDefault();
                const dropped = Array.from(e.dataTransfer.files);
                addPicked(uploadModal === "zip" ? dropped.filter(f => /\.zip$/i.test(f.name)) : dropped);
              }}
            >
              <IconFiles size={22} />
              <span>Drag and drop {uploadModal === "zip" ? "a zip file" : "files"} here</span>
              <span className="up-or">or</span>
              <button className="rbtn ghost up-browse" onClick={() => (uploadModal === "folder" ? folderPick : uploadModal === "zip" ? zipPick : bulkPick).current?.click()}>
                {uploadModal === "folder" ? "Browse folders" : "Browse files"}
              </button>
            </div>
            <p className="up-types">Allowed file types: {uploadModal === "zip" ? ".zip" : SUPPORTED_UPLOAD_TYPES.join(", ")}</p>
          </div>
        </div>
      )}
      {runsOpen && (() => {
        const runs = loadRuns();
        const openRun = runs.find(r => r.id === openRunId) || null;
        return (
        <div className="modal-veil" onClick={() => setRunsOpen(false)}>
          <div className="modal wide" role="dialog" aria-label="Run history" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{openRun ? "Run trace" : "Run history"}</h3>
              <span className="demo-chip">Demo</span>
              {openRun && <button className="rbtn ghost" onClick={() => setOpenRunId(null)}>All runs</button>}
              <button className="iconbtn sm" onClick={() => setRunsOpen(false)} aria-label="Close run history"><IconX size={14} /></button>
            </div>
            {!openRun ? (
              runs.length === 0 ? (
                <p className="modal-sub">No runs yet. Start an engagement and it will be recorded here.</p>
              ) : runs.map(r => (
                <button className="mrow" key={r.id} onClick={() => setOpenRunId(r.id)}>
                  <span className="mi"><IconHistory size={16} /></span>
                  <div className="mt">
                    <div className="mn">{r.rfq} - {new Date(r.startedAt).toLocaleString()}</div>
                    <div className="ms">{Math.max(1, Math.round((r.endedAt - r.startedAt) / 1000))}s - {r.files.length} input file(s){r.note ? ` - note: ${r.note}` : ""}</div>
                  </div>
                  <span className={"chip st-" + r.status}>{statusLabel(r.status)}</span>
                </button>
              ))
            ) : (
              <div className="trace">
                <p className="modal-sub"><IconEye size={13} /> View only - what the agent read, decided and did in this run.</p>
                <div className="trace-row"><span className="tk">Outcome</span><span className={"chip st-" + openRun.status}>{statusLabel(openRun.status)}</span></div>
                {openRun.note && <div className="trace-row"><span className="tk">Your note</span><span>{openRun.note}</span></div>}
                <div className="trace-row"><span className="tk">Read</span><span>{openRun.files.length ? openRun.files.join(", ") : "No input files recorded"}</span></div>
                {skills.map((s, i) => {
                  const reached = i < openRun.reachedSkill;
                  return (
                    <div className={"trace-skill" + (reached ? "" : " dim")} key={s.n}>
                      <div className="ts-h">{reached ? <IconCircleCheckFilled size={14} /> : <IconX size={14} />} {s.name}{!reached && " - not reached"}</div>
                      {reached && s.phases.map(ph => (
                        <div className="ts-sub" key={ph.id}>
                          <div className="ts-sn">{ph.id} {ph.name}</div>
                          {ph.stages.map(st => (
                            <div className="ts-step" key={st.name}>
                              {st.mode === "human" ? <IconUser size={13} /> : <img src={bullHead} alt="" />}
                              <span>{st.name}</span>
                              <span className="ts-note">{st.note}</span>
                            </div>
                          ))}
                          {(OUTPUTS[ph.id] || []).map((c: OutCard) => (
                            <div className="ts-out" key={c.title}>Output: {c.title}{c.rows ? " - " + c.rows.map(x => `${x.k}: ${x.v}`).join(", ") : ""}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
