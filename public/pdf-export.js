/* public/pdf-export.js
   YBG PDF Export v1.2.4
   - Fixes footer collisions & duplicate footers
   - Ensures consistent typography across pages
   - Makes "Latest only" truly latest via timestamp sort
   - Safe with existing buttons / API
*/

(() => {
  // ---- jsPDF Lazy Loader ---------------------------------------------------
  const loadJsPDF = (() => {
    let cached;
    return async () => {
      if (cached) return cached;
      // Use the same CDN the template uses
      const src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
      // eslint-disable-next-line no-undef
      cached = window.jspdf.jsPDF;
      return cached;
    };
  })();

  // ---- Constants (A4 Portrait) ---------------------------------------------
  const MM = 1; // jsPDF default unit is 'mm' in our init
  const PAGE = {
    width: 210 * MM,
    height: 297 * MM,
  };

  const MARGINS = {
    top: 22,
    bottom: 18, // room above footer
    left: 16,
    right: 16,
  };

  const HEADER = {
    h: 20,
    iconSize: 12,
    ring: 1.5,
  };

  const FOOTER = {
    h: 14, // reserved space for footer band
  };

  // Computed safe writing area
  const CONTENT_TOP = MARGINS.top + HEADER.h;
  const CONTENT_BOTTOM = PAGE.height - MARGINS.bottom - FOOTER.h;

  // ---- Toolkit Branding -----------------------------------------------------
  // These are set by the template before calling export:
  //   window.currentToolkitName
  //   window.currentToolkitIcon (URL)
  function getToolkitName() {
    return window.currentToolkitName || "YourBizGuru";
  }
  function getToolkitIcon() {
    return window.currentToolkitIcon || "/favicon.png";
  }

  // ---- Typography Tokens ----------------------------------------------------
  const TYPE = {
    family: "helvetica",
    bodySize: 11,
    line: 5.5, // line height in mm
    h2Size: 13,
    h3Size: 11,
    colorBody: [33, 37, 41],  // dark gray
    colorHead: [20, 24, 39],  // slightly darker for headers
    colorMeta: [90, 95, 105], // footer/meta gray
    accentBlue: [79, 195, 247],
  };

  function applyGlobalType(doc) {
    doc.setFont(TYPE.family, "normal");
    doc.setFontSize(TYPE.bodySize);
    doc.setTextColor(...TYPE.colorBody);
  }

  // ---- Header / Footer ------------------------------------------------------
  async function drawHeader(doc, pageNumber, imgCache) {
    const x = MARGINS.left;
    const y = MARGINS.top;

    // Icon (circle crop illusion with ring)
    if (imgCache && imgCache.img) {
      const s = HEADER.iconSize;
      const ring = HEADER.ring;
      // ring
      doc.setDrawColor(...TYPE.accentBlue);
      doc.setLineWidth(ring);
      doc.circle(x + s/2 + 1, y + s/2 + 1, s/2 + 0.8, "S");
      // icon
      doc.addImage(imgCache.img, imgCache.type, x + 1, y + 1, s, s);
    }

    // Toolkit + Title
    doc.setFont(TYPE.family, "bold");
    doc.setFontSize(12);
    doc.setTextColor(...TYPE.colorHead);
    const tk = getToolkitName();
    doc.text(`${tk} – Report`, x + HEADER.iconSize + 6, y + 6);

    doc.setFont(TYPE.family, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TYPE.colorMeta);
    const d = new Date();
    const meta = `${d.toLocaleDateString()}  •  ${d.toLocaleTimeString()}`;
    doc.text(meta, x + HEADER.iconSize + 6, y + 12);
  }

  function drawFooter(doc, pageNumber, totalPages) {
    const y = PAGE.height - FOOTER.h + 6; // inside footer band
    const leftX = MARGINS.left;
    const rightX = PAGE.width - MARGINS.right;

    // Hairline
    doc.setDrawColor(230, 233, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGINS.left, PAGE.height - FOOTER.h, PAGE.width - MARGINS.right, PAGE.height - FOOTER.h);

    // Left: powered by
    doc.setFont(TYPE.family, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TYPE.colorMeta);
    doc.text("Powered by YourBizGuru.com", leftX, y);

    // Right: page x of y
    const pageStr = `Page ${pageNumber} of ${totalPages || " "}`;
    const w = doc.getTextWidth(pageStr);
    doc.text(pageStr, rightX - w, y);
  }

  // ---- Pagination-safe write helpers ---------------------------------------
  function willOverflow(currentY, needed) {
    return currentY + needed > CONTENT_BOTTOM;
  }

  async function ensureSpace(doc, state, needed, imgCache) {
    if (!willOverflow(state.y, needed)) return;

    // Finish the current page by drawing footer ONCE
    state.pageNumber++;
    state.deferredFooters.push(state.pageNumber);

    doc.addPage();
    await drawHeader(doc, state.pageNumber, imgCache);
    state.y = CONTENT_TOP;
  }

  // ---- Image Loader (cached) ------------------------------------------------
  async function loadImage(url) {
    if (!url) return null;
    try {
      const resp = await fetch(url, { cache: "force-cache" }).catch(() => null);
      if (!resp || !resp.ok) return null;
      const blob = await resp.blob();
      const reader = new FileReader();
      const fr = await new Promise(res => {
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(blob);
      });
      // Determine type from dataURL header
      const type = fr.startsWith("data:image/png") ? "PNG" : "JPEG";
      return { img: fr, type };
    } catch {
      return null;
    }
  }

  // ---- Content Writers ------------------------------------------------------
  async function writeMarkdownish(doc, state, text, imgCache) {
    // Super-light MD-ish parsing for ### and **bold** lines
    const lines = text.split(/\r?\n/);

    for (let raw of lines) {
      const line = raw.trimEnd();

      // Heading H2
      if (/^###[ ]?/.test(line)) {
        const content = line.replace(/^###[ ]?/, "").trim();
        await ensureSpace(doc, state, TYPE.line * 2.2, imgCache);
        doc.setFont(TYPE.family, "bold");
        doc.setFontSize(TYPE.h2Size);
        doc.setTextColor(...TYPE.colorHead);
        doc.text(content, MARGINS.left, state.y);
        // Reset back to body
        doc.setFont(TYPE.family, "normal");
        doc.setFontSize(TYPE.bodySize);
        doc.setTextColor(...TYPE.colorBody);
        state.y += TYPE.line * 1.8;
        continue;
      }

      // Paragraph (bold inline kept simple)
      if (line.length === 0) {
        state.y += TYPE.line * 0.8;
        continue;
      }

      // Wrap text within content width
      const maxWidth = PAGE.width - MARGINS.left - MARGINS.right;
      const wrapped = doc.splitTextToSize(line, maxWidth);

      // Reserve height for wrapped block
      const blockHeight = wrapped.length * TYPE.line;
      await ensureSpace(doc, state, blockHeight, imgCache);

      wrapped.forEach((l) => {
        doc.text(l, MARGINS.left, state.y);
        state.y += TYPE.line;
      });
    }
  }

  // ---- Public API (adapted for existing button calls) ----------------------
  async function exportResultToPDF(text) {
    // Single result export
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

    applyGlobalType(doc);

    const imgCache = await loadImage(getToolkitIcon());

    // State
    const state = {
      y: CONTENT_TOP,
      pageNumber: 1,
      deferredFooters: [], // we'll draw footers once totalPages is known
    };

    await drawHeader(doc, state.pageNumber, imgCache);

    // Write the single result content
    if (!text) {
      await ensureSpace(doc, state, TYPE.line * 2, imgCache);
      doc.text("No content available.", MARGINS.left, state.y);
      state.y += TYPE.line;
    } else {
      await writeMarkdownish(doc, state, text, imgCache);
    }

    // Close final page
    state.deferredFooters.push(state.pageNumber);

    // ---- Second pass: draw footers with total page count -------------------
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      drawFooter(doc, p, total);
    }

    // Filename: YYYY-MM-DD_YBG_[Toolkit]_Report.pdf
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const safeToolkit = getToolkitName().replace(/[^\w-]+/g, "");
    const filename = `${yyyy}-${mm}-${dd}_YBG_${safeToolkit}_Report.pdf`;

    doc.save(filename);
  }

  async function exportAllResultsToPDF(resultsArray, opts = {}) {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

    applyGlobalType(doc);

    const imgCache = await loadImage(getToolkitIcon());

    // State
    const state = {
      y: CONTENT_TOP,
      pageNumber: 1,
      deferredFooters: [],
    };

    await drawHeader(doc, state.pageNumber, imgCache);

    // Handle export mode
    const mode = opts.mode || "all";
    let items = Array.isArray(resultsArray) ? resultsArray : [];
    
    // Sort by timestamp if available and handle "latest only" mode
    if (items.length > 0 && items[0].timestamp) {
      items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    
    if (mode === "latest" && items.length > 0) {
      items = [items[items.length - 1]]; // Take the most recent
    }

    // Collect content
    if (!items.length) {
      await ensureSpace(doc, state, TYPE.line * 2, imgCache);
      doc.text("No content available.", MARGINS.left, state.y);
      state.y += TYPE.line;
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let content = "";
        
        // Handle different data formats
        if (typeof item === 'string') {
          content = item;
        } else if (item.text) {
          if (item.title) {
            content = `### ${item.title}\n\n${item.text}`;
          } else {
            content = item.text;
          }
        } else if (item.result) {
          // Handle the format from YBG toolkit
          const header = `### Result ${i + 1}${item.displayTime ? ' - ' + item.displayTime : ''}\n\n`;
          const prompt = item.prompt ? `Request: ${item.prompt}\n\n` : '';
          const result = `Result:\n${item.result}`;
          content = header + prompt + result;
        }
        
        await writeMarkdownish(doc, state, content, imgCache);
        
        // Spacer between results (except last)
        if (i < items.length - 1) {
          state.y += TYPE.line * 2;
          await ensureSpace(doc, state, TYPE.line, imgCache);
          // Add separator
          doc.setDrawColor(230, 233, 240);
          doc.setLineWidth(0.2);
          const lineY = state.y - TYPE.line;
          doc.line(MARGINS.left, lineY, PAGE.width - MARGINS.right, lineY);
        }
      }
    }

    // Close final page
    state.deferredFooters.push(state.pageNumber);

    // Second pass: draw footers with total page count
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      drawFooter(doc, p, total);
    }

    // Filename with mode indicator
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const safeToolkit = getToolkitName().replace(/[^\w-]+/g, "");
    const suffix = mode === "latest" ? "Latest_Result" : "All_Results";
    const filename = `${yyyy}-${mm}-${dd}_YBG_${safeToolkit}_${suffix}.pdf`;

    doc.save(filename);
  }

  // Expose in window (used by buttons)
  window.exportResultToPDF = exportResultToPDF;
  window.exportAllResultsToPDF = exportAllResultsToPDF;

})();