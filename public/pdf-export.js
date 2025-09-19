(function () {
  // YBG PDF Export v1.2.1 — footer fix + margins + helpers
  const PX_PER_MM = 2.834645669; // jsPDF units are "pt" by default (1 mm ≈ 2.8346 pt) but we will stay in pt everywhere

  // Exposed defaults (the page will set these before exporting)
  window.currentToolkitName  = window.currentToolkitName  || "YourBizGuru Mini-Dashboard";
  window.currentToolkitIcon  = window.currentToolkitIcon  || "/favicon.png";

  // Central export API
  window.exportResultToPDF = async function exportResultToPDF(text, opts = {}) {
    const mode = (opts.mode || "latest"); // not used here (single text), kept for symmetry
    const branding = getBranding();
    const doc = await makeDoc(branding);

    const layout = getLayout(doc);
    let cursorY = drawHeader(doc, layout, branding, 1);
    cursorY = drawBody(doc, layout, text, cursorY);
    finalizeFooters(doc, layout, branding); // SINGLE footer pass
    doc.save(fileName(branding.toolkitName, "Report"));
  };

  window.exportAllResultsToPDF = async function exportAllResultsToPDF(resultsArray, opts = {}) {
    const mode = (opts.mode || "latest"); // "latest" | "all"
    const branding = getBranding();
    const doc = await makeDoc(branding);
    const layout = getLayout(doc);

    let items = Array.isArray(resultsArray) ? resultsArray : [];
    if (mode === "latest" && items.length > 0) {
      items = [items[items.length - 1]]; // last item only
    }

    let pageNumber = 1;
    let cursorY = drawHeader(doc, layout, branding, pageNumber);
    items.forEach((item, idx) => {
      if (idx > 0) {
        // space between entries
        cursorY = addSpacer(doc, cursorY, 8);
      }
      // Title per entry (optional)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      cursorY = writeWrapped(doc, layout, (item.title || `Result ${idx + 1}`), cursorY, 18);

      // Body
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      cursorY = drawBody(doc, layout, (item.text || ""), cursorY);
    });

    finalizeFooters(doc, layout, branding); // SINGLE footer pass
    const suffix = mode === "latest" ? "Latest_Result" : "All_Results";
    doc.save(fileName(branding.toolkitName, suffix));
  };

  // --------- helpers ----------
  function getBranding() {
    return {
      toolkitName: window.currentToolkitName || "YourBizGuru Mini-Dashboard",
      iconUrl:     window.currentToolkitIcon || "/favicon.png",
      brand:       "YourBizGuru.com",
    };
  }

  async function makeDoc() {
    // lazy-load jsPDF from CDN if needed (cached by browser)
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: "pt", format: "a4" });
  }

  function getLayout(doc) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginLeft   = 56;     // L/R page margin
    const marginRight  = 56;
    const marginTop    = 72;     // header top
    const footerHeight = 36;     // reserved area for footer
    const marginBottom = 56 + footerHeight; // reserve space so content never overlaps footer
    const contentWidth = pageW - marginLeft - marginRight;
    const usableHeight = pageH - marginTop - marginBottom;
    return { pageW, pageH, marginLeft, marginRight, marginTop, marginBottom, contentWidth, usableHeight, footerHeight };
  }

  function drawHeader(doc, layout, branding, pageNumber) {
    const { marginLeft, marginTop, contentWidth } = layout;
    // Icon (circle clipped)
    let iconSize = 32;
    try {
      // load image to canvas for circle clip
      // If CORS blocks, we'll skip the icon gracefully.
      // (Agent: we already set same-origin favicon by default)
      doc.saveGraphicsState && doc.saveGraphicsState();
      // simple ring
      doc.setDrawColor(79,195,247); doc.setLineWidth(1.5);
      doc.circle(marginLeft + iconSize/2, marginTop - 24, iconSize/2 + 3, "S");
      doc.addImage(branding.iconUrl, "PNG", marginLeft, marginTop - iconSize - 8, iconSize, iconSize, "", "FAST");
      doc.restoreGraphicsState && doc.restoreGraphicsState();
    } catch (_) {}

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(branding.toolkitName, marginLeft + iconSize + 10, marginTop - 4);

    // divider
    doc.setDrawColor(230, 236, 244);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, marginTop + 8, marginLeft + contentWidth, marginTop + 8);
    return marginTop + 24; // cursor after header
  }

  function addSpacer(doc, y, amount) {
    return y + amount;
  }

  function writeWrapped(doc, layout, text, y, lineHeight = 16) {
    const lines = doc.splitTextToSize(text, layout.contentWidth);
    lines.forEach((ln) => {
      // new page if needed
      if (y + lineHeight > layout.pageH - layout.marginBottom) {
        doc.addPage();
        y = drawHeader(doc, layout, getBranding(), doc.getCurrentPageInfo().pageNumber);
      }
      doc.text(ln, layout.marginLeft, y);
      y += lineHeight;
    });
    return y;
  }

  function drawBody(doc, layout, text, y) {
    const paragraphs = String(text || "").split(/\n{2,}/);
    paragraphs.forEach((p, idx) => {
      if (idx > 0) y = addSpacer(doc, y, 6);
      y = writeWrapped(doc, layout, p.trim(), y, 18);
    });
    return y;
  }

  function finalizeFooters(doc, layout, branding) {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      drawFooterOnce(doc, layout, branding, p, total);
    }
  }

  function drawFooterOnce(doc, layout, branding, pageNum, totalPages) {
    const { marginLeft, contentWidth, pageH, footerHeight } = layout;
    const yTop = pageH - footerHeight - 18;

    // clear area to prevent any old footer text "echo"
    doc.setFillColor(255,255,255);
    doc.rect(marginLeft, pageH - footerHeight - 24, contentWidth, footerHeight + 28, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 96, 110);
    const left = `Powered by ${branding.brand}`;
    const right = `Page ${pageNum} of ${totalPages}`;

    doc.text(left,  marginLeft, yTop + 18);
    const rightX = marginLeft + contentWidth - doc.getTextWidth(right);
    doc.text(right, rightX, yTop + 18);
  }

  function fileName(toolkitName, suffix) {
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const safe  = toolkitName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g,"");
    return `${stamp}_YBG_${safe}_${suffix}.pdf`;
  }
})();