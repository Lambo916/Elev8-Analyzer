/* YBG Universal PDF Export v1.2.3
   - Fixes footer overlap using content bounds + reserved footer height
   - Enforces global typography per page (prevents bold/size drift after addPage)
   - Keeps circle icon header, page X of Y footer, and smart filenames
*/

(function () {
  const YBG_PDF = {};

  // ---- Constants (tuned for A4 portrait) ----
  const PAGE = { width: 210, height: 297 };               // mm
  const MARGINS = { top: 22, right: 16, bottom: 22, left: 16 }; // mm
  const HEADER = { h: 20 };  // header block height (incl. icon ring)
  const FOOTER = { h: 14 };  // footer block height
  const CONTENT_TOP = MARGINS.top + HEADER.h;
  const CONTENT_BOTTOM = PAGE.height - MARGINS.bottom - FOOTER.h;
  const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;

  // Global typography tokens (re-applied on EVERY page)
  const TYPE = {
    family: "helvetica",     // use built-in helvetica for reliability
    bodySize: 11,
    line: 5.5,               // line height in mm (approx ~1.25)
    color: [30, 34, 41],     // slate-ish
    h2Size: 13,
    h2Weight: "bold",
    h3Size: 12,
    h3Weight: "bold",
    codeSize: 10
  };

  // Lazy-load jsPDF if not present on window (should already be loaded via CDN)
  async function ensureJsPDF() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load jsPDF"));
      document.head.appendChild(s);
    });
    return window.jspdf.jsPDF;
  }

  // ---- Helpers ----
  function applyGlobalType(doc) {
    // Always re-apply on each page and after addPage()
    doc.setFont(TYPE.family, "normal");
    doc.setFontSize(TYPE.bodySize);
    doc.setTextColor(...TYPE.color);
  }

  function drawHeader(doc, toolkitName, iconImg, pageNumber) {
    // subtle header bar + icon ring + title
    const y0 = MARGINS.top;
    // Title
    doc.setFont(TYPE.family, "bold");
    doc.setFontSize(14);
    doc.setTextColor(23, 85, 200); // brand-ish blue
    doc.text(toolkitName || "YourBizGuru", MARGINS.left + 22, y0 + 8);

    // Circle-cropped icon ring (if provided)
    if (iconImg) {
      // outer ring
      doc.setDrawColor(255, 195, 59); // yellow ring
      doc.setLineWidth(0.8);
      doc.circle(MARGINS.left + 8, y0 + 6.5, 6, "S"); // just a ring
      // icon bitmap (approx circle)
      try { doc.addImage(iconImg, "PNG", MARGINS.left + 2, y0 + 0.5, 12, 12, "", "FAST"); } catch {}
    }

    // reset body type after header
    applyGlobalType(doc);
  }

  function drawFooter(doc, pageNumber, pageCount) {
    const y = PAGE.height - MARGINS.bottom - 6;
    doc.setFont(TYPE.family, "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 117, 124);

    const left = "Powered by YourBizGuru.com";
    const right = `Page ${pageNumber} of ${pageCount || "…"}`;
    doc.text(left, MARGINS.left, y);

    const w = doc.getTextWidth(right);
    doc.text(right, PAGE.width - MARGINS.right - w, y);

    // Ensure footer area is reserved visually (no text underneath)
    // (Optional soft divider line)
    doc.setDrawColor(230, 234, 239);
    doc.setLineWidth(0.2);
    doc.line(MARGINS.left, y - 6, PAGE.width - MARGINS.right, y - 6);
  }

  // Very simple Markdown-ish parser for ##/### headings; everything else = body
  function parseBlocks(text) {
    const lines = text.split(/\r?\n/);
    return lines.map((line) => {
      if (/^#{2}\s+/.test(line)) return { type: "h2", text: line.replace(/^#{2}\s+/, "") };
      if (/^#{3}\s+/.test(line)) return { type: "h3", text: line.replace(/^#{3}\s+/, "") };
      return { type: "p", text: line.length ? line : " " };
    });
  }

  function wrapText(doc, text, maxWidth) {
    // jsPDF splits to array based on font metrics
    return doc.splitTextToSize(text, maxWidth);
  }

  // write a block with pagination awareness
  function writeBlock(doc, block, cursorX, cursorY, maxWidth) {
    let neededHeight = TYPE.line; // minimum
    let fontStyle = "normal";
    let fontSize = TYPE.bodySize;

    if (block.type === "h2") { fontStyle = TYPE.h2Weight; fontSize = TYPE.h2Size; }
    if (block.type === "h3") { fontStyle = TYPE.h3Weight; fontSize = TYPE.h3Size; }

    doc.setFont(TYPE.family, fontStyle);
    doc.setFontSize(fontSize);

    const lines = wrapText(doc, block.text, maxWidth);
    neededHeight = lines.length * TYPE.line;

    // If not enough space on page, tell caller
    if (cursorY + neededHeight > CONTENT_BOTTOM) {
      // restore body defaults (caller will add a page)
      applyGlobalType(doc);
      return { wrote: false, height: neededHeight, lines };
    }

    // Write lines
    lines.forEach((ln) => {
      doc.text(ln, cursorX, cursorY);
      cursorY += TYPE.line;
    });

    // restore defaults after headings
    applyGlobalType(doc);
    return { wrote: true, cursorY };
  }

  async function createDoc() {
    const jsPDF = await ensureJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    applyGlobalType(doc);
    return doc;
  }

  async function exportTextToPDF({ text, toolkitName, toolkitIconUrl }) {
    const doc = await createDoc();
    let pageNumber = 1;
    let iconImg = null;
    if (toolkitIconUrl) {
      try {
        const res = await fetch(toolkitIconUrl);
        const buf = await res.arrayBuffer();
        iconImg = btoa(
          new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
        );
        iconImg = "data:image/png;base64," + iconImg;
      } catch {}
    }

    // First page header
    drawHeader(doc, toolkitName, iconImg, pageNumber);

    const blocks = parseBlocks(text || "");
    let cursorX = MARGINS.left;
    let cursorY = CONTENT_TOP;

    const writeOrPaginate = (block) => {
      const attempt = writeBlock(doc, block, cursorX, cursorY, PAGE.width - MARGINS.left - MARGINS.right);
      if (!attempt.wrote) {
        // New page: finish footer first with page count unknown (placeholder)
        drawFooter(doc, pageNumber, null);

        doc.addPage();
        pageNumber += 1;
        applyGlobalType(doc);          // <== CRITICAL: lock fonts on new page
        drawHeader(doc, toolkitName, iconImg, pageNumber);
        cursorY = CONTENT_TOP;

        // Now write for sure (enough room because of pagination)
        const wrote = writeBlock(doc, block, cursorX, cursorY, PAGE.width - MARGINS.left - MARGINS.right);
        cursorY = wrote.cursorY;
      } else {
        cursorY = attempt.cursorY;
      }
    };

    blocks.forEach(writeOrPaginate);

    // Close out final page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      applyGlobalType(doc);            // reinforce uniform styles per page
      drawFooter(doc, i, pageCount);
    }

    // filename
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const safeToolkit = (toolkitName || "YourBizGuru").replace(/[^a-z0-9_\-]+/gi, "_");
    const filename = `${yyyy}-${mm}-${dd}_YBG_${safeToolkit}_Report.pdf`;

    doc.save(filename);
  }

  // ---- Public API (unchanged) ----
  YBG_PDF.exportResultToPDF = async function (text) {
    await exportTextToPDF({
      text,
      toolkitName: window.currentToolkitName || "YourBizGuru Mini-Dashboard",
      toolkitIconUrl: window.currentToolkitIcon || "/favicon.png"
    });
  };

  YBG_PDF.exportAllResultsToPDF = async function (resultsArray, opts = {}) {
    const mode = opts.mode || "all";
    let items = Array.isArray(resultsArray) ? resultsArray : [];
    
    // Handle mode selection
    if (mode === "latest" && items.length > 0) {
      items = [items[items.length - 1]];
    }
    
    // Convert to text format
    const combined = items.map(item => {
      if (typeof item === 'string') return item;
      if (item.text) return item.text;
      if (item.title && item.text) return `## ${item.title}\n\n${item.text}`;
      return String(item);
    }).join("\n\n---\n\n");
    
    await exportTextToPDF({
      text: combined,
      toolkitName: window.currentToolkitName || "YourBizGuru Mini-Dashboard",
      toolkitIconUrl: window.currentToolkitIcon || "/favicon.png"
    });
  };

  // Maintain backward compatibility with existing API
  window.exportResultToPDF = YBG_PDF.exportResultToPDF;
  window.exportAllResultsToPDF = YBG_PDF.exportAllResultsToPDF;
  window.YBG_PDF = YBG_PDF;
})();