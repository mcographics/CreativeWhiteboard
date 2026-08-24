export const frequentlyAskedQuestions = [
  { question: "How are projects saved?", answer: "Save creates a .cwb project containing canvas objects, camera position, and embedded supported files. Save As asks you to choose a new approved location." },
  { question: "Does Creative Whiteboard autosave?", answer: "A local crash-recovery snapshot is maintained while work is unsaved. It is not a replacement for saving a project and is cleared after a successful save or explicit discard." },
  { question: "Which imports are supported?", answer: "PNG, JPEG, WebP, PDF, TXT, and Markdown are supported. Extensions and file signatures must agree. Executables, scripts, SVG, macros, and unsupported document containers are rejected." },
  { question: "Why is a font missing?", answer: "Text uses fonts available to the application and operating system. A project opened on another computer may use a fallback font when the original font is unavailable." },
  { question: "Why can a large file be rejected or feel slow?", answer: "Imports have safety limits and large images or PDFs require more memory. Resize unusually large assets before importing and divide complex boards into separate projects." },
  { question: "How do I navigate the infinite canvas?", answer: "Use Pan with the left mouse button, hold Space while dragging, or drag with the middle or right mouse button. Use the wheel or zoom controls to zoom around the pointer." },
  { question: "How do I get the best export quality?", answer: "Choose the application resolution and export scale in Settings, then export PNG for lossless raster output, JPEG for smaller files, or PDF for a page document." },
  { question: "Is my work uploaded?", answer: "The current application is designed for local processing and contains no approved analytics or advertising integration. See Privacy Information for the precise current statement." },
  { question: "Does the application work offline?", answer: "Core drawing, project, import, and export features work locally. Approved external website or support links require a network connection." },
  { question: "How are updates installed?", answer: "No signed automatic updater is configured in this build. Check for Updates therefore does not download or install code. Obtain releases only from an approved publisher source." },
  { question: "Where can I find keyboard shortcuts?", answer: "Open Help → Keyboard Shortcuts. Common shortcuts include Ctrl+S, Ctrl+Shift+S, Ctrl+Z, Ctrl+Y, Ctrl+D, Delete, and Space-drag." },
  { question: "What if a project or import is damaged?", answer: "The application rejects malformed, mismatched, oversized, or unsupported content. Try a known-good copy, re-export the source file, or contact support without sending sensitive data." }
] as const;
