import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import appInfo from "../../app-info.json";
import licenseText from "../../LICENSE?raw";
import noticesText from "../../THIRD-PARTY-NOTICES.md?raw";
import privacyText from "../../PRIVACY.md?raw";
import securityText from "../../SECURITY.md?raw";
import { frequentlyAskedQuestions } from "../data/faq";
import { useUiStore } from "../state/uiStore";

const guideSections = [
  ["Projects", "New clears the current workspace after confirmation. Open browses for a validated .cwb project. Save updates an approved project location; Save As chooses another location. Export creates PNG, JPEG, or PDF output."],
  ["Canvas navigation", "Pan by selecting Pan and left-dragging, Space-dragging, middle-dragging, or right-dragging. Zoom with the wheel, toolbar, or canvas controls. Reset View returns to the default camera."],
  ["Objects", "Select an object to move, resize, rotate, duplicate, lock, layer, or delete it. Shift-select adds to a selection. Use the main menu for front/back layering and locking. Grouping is not supported in this release."],
  ["Drawing, stylus, and text", "Pen, Marker, Brush, Highlighter, and Eraser each provide relevant settings. Wacom-compatible Windows pen tablets use stylus pressure for Pen, Brush, and Marker width, coalesced samples for smoother input, the eraser end for object erasing, the barrel button for panning, and palm rejection while the pen is active. These options can be enabled or disabled in Settings. Text and Comment open a typing layer. Undo and Redo restore editing history."],
  ["Imports", "Import or drag in PNG, JPEG, WebP, PDF, TXT, or Markdown. Files are checked by extension, signature, and size. Scripts, executables, SVG, macros, and malformed content are rejected."],
  ["Document previews", "Imported PDFs open as independent windows. Drag the header, resize the edge, lock, duplicate, minimize, close, change pages, or adjust internal zoom. Preview content runs without operating-system access."],
  ["Recovery and limits", "Unsaved work receives a local recovery snapshot. Save regularly: recovery is intended for unexpected shutdowns, not permanent storage. Very large, damaged, encrypted, or unsupported files may be rejected."]
] as const;

const shortcuts = [
  ["Ctrl+S", "Save"], ["Ctrl+Shift+S", "Save As"], ["Ctrl+O", "Open"], ["Ctrl+Z", "Undo"],
  ["Ctrl+Y / Ctrl+Shift+Z", "Redo"], ["Ctrl+D", "Duplicate selection"], ["Delete", "Delete selection"],
  ["Space + drag", "Pan canvas"], ["Mouse wheel", "Zoom"], ["Escape", "Close menu or dialog"]
] as const;

const textByView = { license: licenseText, notices: noticesText, privacy: privacyText, security: securityText };

export function HelpCenter() {
  const view = useUiStore((state) => state.helpView);
  const close = useUiStore((state) => state.closeHelpView);
  const open = useUiStore((state) => state.openHelpView);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!view) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button,input,a,[tabindex]:not([tabindex='-1'])")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [view, close]);

  if (!view) return null;
  const title = view === "faq" ? "Frequently Asked Questions" : view === "shortcuts" ? "Keyboard Shortcuts" : view === "about" ? `About ${appInfo.applicationName}` : view === "guide" ? "Help & User Guide" : view.charAt(0).toUpperCase() + view.slice(1);
  const copyright = `Copyright © ${appInfo.copyrightYears} ${appInfo.companyName}. All rights reserved.`;
  const filteredFaq = frequentlyAskedQuestions.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase()));
  const approvedWebsite = /^https:\/\//i.test(appInfo.officialWebsite);

  return <div className="modal-backdrop help-backdrop" onMouseDown={close}>
    <section ref={dialogRef} className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="help-title">{title}</h2><button aria-label="Close help" onClick={close}><X size={18}/></button></header>
      <div className="help-content">
        {view === "guide" && guideSections.map(([heading, body]) => <section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}
        {view === "faq" && <><label className="faq-search"><Search size={16}/><span className="sr-only">Search frequently asked questions</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions…" /></label>
          <div className="faq-list">{filteredFaq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></>}
        {view === "shortcuts" && <table><tbody>{shortcuts.map(([keys, action]) => <tr key={keys}><th><kbd>{keys}</kbd></th><td>{action}</td></tr>)}</tbody></table>}
        {view === "about" && <div className="about-content">
          <img src="./app_icon.png" alt="" /><h3>{appInfo.applicationName}</h3><p>{appInfo.productDescription}</p>
          <dl><dt>Version</dt><dd>{appInfo.version} (build {appInfo.buildNumber})</dd><dt>Creator / Developer</dt><dd>{appInfo.developerName}</dd><dt>Company</dt><dd>{appInfo.companyName}</dd><dt>Publisher</dt><dd>{appInfo.publisherName}</dd><dt>Release channel</dt><dd>{appInfo.releaseChannel}</dd><dt>Licence</dt><dd>{appInfo.licenseName}</dd><dt>Support</dt><dd>{appInfo.supportContact}</dd><dt>Official website</dt><dd>{approvedWebsite ? appInfo.officialWebsite : "Coming Soon"}</dd></dl>
          <p>{copyright}</p>
          <p className="ownership-notice">{appInfo.ownershipNotice}</p>
          <p className="disclaimer">{appInfo.thirdPartyDisclaimer}</p>
          <p className="disclaimer">{appInfo.affiliationDisclaimer}</p>
          {!approvedWebsite && <p className="website-coming-soon">{appInfo.websitePlaceholderMessage}</p>}
          <div className="about-actions"><button onClick={() => open("notices")}>Third-Party Notices</button><button onClick={() => open("privacy")}>Privacy Information</button><button onClick={() => open("security")}>Security Information</button><button onClick={() => open("license")}>Full Licence</button>
            <button disabled={!approvedWebsite} onClick={() => void window.desktopExternal?.openApprovedHttps(appInfo.officialWebsite)}>Website</button></div>
        </div>}
        {view in textByView && <pre className="legal-text">{textByView[view as keyof typeof textByView]}</pre>}
      </div>
    </section>
  </div>;
}
