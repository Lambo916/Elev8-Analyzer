/**
 * YourBizGuru - Universal PDF Export System (v1.2)
 * - Circle-cropped toolkit icon in header
 * - Styled header (toolkit name, date)
 * - Styled footer (page X of Y + Powered by YourBizGuru.com)
 * - Multi-page content with smart wrapping
 * - Standard filename: YYYY-MM-DD_YBG_[ToolkitName]_Report.pdf
 *
 * Exposed globals:
 *   window.exportResultToPDF(text)
 *   window.exportAllResultsToPDF(resultsArrayOfStrings)
 * 
 * Customization (set anywhere in your app before calling exports):
 *   window.currentToolkitName = "Grant Genie";
 *   window.currentToolkitIcon = "https://example.com/grant-genie-icon.png";
 */

(function () {
  const CDN_JSPDF =
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";

  // Lazy-load jsPDF once, cache the promise.
  let __pdfLibPromise = null;
  function loadJsPDF() {
    if (__pdfLibPromise) return __pdfLibPromise;
    __pdfLibPromise = new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
      const s = document.createElement("script");
      s.src = CDN_JSPDF;
      s.onload = () => resolve(window.jspdf.jsPDF);
      s.onerror = () =>
        reject(new Error("Failed to load jsPDF from CDN."));
      document.head.appendChild(s);
    });
    return __pdfLibPromise;
  }

  // Utilities
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function formatDate(d = new Date()) {
    // YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function safeToolkitName() {
    const name =
      (typeof window.currentToolkitName === "string" &&
        window.currentToolkitName.trim()) ||
      "Toolkit";
    return name.replace(/[^\w\s\-]/g, "").trim();
  }

  function makeFilename(suffix = "Report") {
    const date = formatDate();
    const toolkit = safeToolkitName().replace(/\s+/g, "");
    return `${date}_YBG_${toolkit}_${suffix}.pdf`;
  }

  async function loadImageCircleDataURL(src, size = 64) {
    // Returns a circular-masked PNG data URL from the source URL.
    // If load fails, returns null.
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });

      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");

      // Draw circle clip & image
      const r = size / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Cover mode (center-crop)
      const ratio = Math.max(size / img.width, size / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (size - w) / 2;
      const y = (size - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();

      // Add thin ring
      ctx.beginPath();
      ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(79,195,247,0.9)"; // YBG primary ring
      ctx.lineWidth = 2;
      ctx.stroke();

      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  // Header & footer painters
  async function drawHeader(doc, pageWidth, marginLeft, marginRight) {
    const y = 20;
    const title = safeToolkitName();
    const dateStr = formatDate();

    // Icon (circle PNG from URL or fallback dot)
    const iconUrl =
      (typeof window.currentToolkitIcon === "string" &&
        window.currentToolkitIcon.trim()) ||
      null;
    let dx = marginLeft;
    const iconSize = 14; // mm

    if (iconUrl) {
      const dataURL = await loadImageCircleDataURL(iconUrl, 128);
      if (dataURL) {
        try {
          doc.addImage(dataURL, "PNG", dx, y - 4, iconSize, iconSize);
          dx += iconSize + 4;
        } catch {
          // If addImage fails, skip gracefully
        }
      }
    }

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 24, 39); // near-black for print
    doc.text(title, dx, y + 6);

    // Date (right side)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 98, 110);
    const rightX = pageWidth - marginRight;
    doc.text(dateStr, rightX, y + 6, { align: "right" });

    // Divider
    doc.setDrawColor(200, 220, 255);
    doc.setLineWidth(0.6);
    doc.line(marginLeft, y + 10, pageWidth - marginRight, y + 10);
  }

  function drawFooter(doc, pageWidth, pageHeight, marginLeft, marginRight, pageNumber, totalPages = null) {
    const y = pageHeight - 12;

    // Divider
    doc.setDrawColor(230, 235, 240);
    doc.setLineWidth(0.4);
    doc.line(marginLeft, y - 5, pageWidth - marginRight, y - 5);

    // Left: Powered by
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 145);
    doc.text("Powered by YourBizGuru.com", marginLeft, y);

    // Right: page numbering
    const pText = totalPages ? `Page ${pageNumber} of ${totalPages}` : `Page ${pageNumber}`;
    doc.text(pText, pageWidth - marginRight, y, { align: "right" });
  }

  async function exportTextsToPDF(textBlocks, filename = makeFilename("Report")) {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 18;
    const marginRight = 18;
    const marginTop = 30;   // room for header
    const marginBottom = 18;

    let cursorY = marginTop + 12; // after header
    let pageNumber = 1;

    await drawHeader(doc, pageWidth, marginLeft, marginRight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);

    const lineHeight = 6; // ~12pt
    const maxWidth = pageWidth - marginLeft - marginRight;

    // Helper to add new page and redraw header
    async function newPage() {
      drawFooter(doc, pageWidth, pageHeight, marginLeft, marginRight, pageNumber);
      doc.addPage();
      pageNumber++;
      await drawHeader(doc, pageWidth, marginLeft, marginRight);
      cursorY = marginTop + 12;
    }

    // Write each block with spacing
    for (let bi = 0; bi < textBlocks.length; bi++) {
      const block = String(textBlocks[bi] ?? "").trim();
      if (!block) continue;

      const lines = doc.splitTextToSize(block, maxWidth);
      for (const line of lines) {
        if (cursorY > pageHeight - marginBottom) {
          await newPage();
        }
        doc.text(line, marginLeft, cursorY);
        cursorY += lineHeight;
      }
      cursorY += 2; // small gap between blocks
    }

    // Compute total page count and retrofit footers
    const total = doc.getNumberOfPages();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 145);
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      drawFooter(doc, pageWidth, pageHeight, marginLeft, marginRight, i, total);
    }

    doc.save(filename);
  }

  // Public API (expects plain text or array of plain texts)
  window.exportResultToPDF = async function (text, opts = {}) {
    const name = makeFilename(opts.suffix || "Report");
    await exportTextsToPDF([String(text || "")], name);
  };

  window.exportAllResultsToPDF = async function (resultsArray, opts = {}) {
    const arr = Array.isArray(resultsArray) ? resultsArray : [];
    const clean = arr.map(v => String(v || "").trim()).filter(Boolean);
    const name = makeFilename(opts.suffix || "All_Results");
    await exportTextsToPDF(clean.length ? clean : ["(No results)"], name);
  };
})();