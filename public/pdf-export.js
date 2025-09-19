/**
 * YBG Universal PDF Export System
 * Version: v1.1.0 - Streamlined for YourBizGuru Mini-Dashboard
 */

// jsPDF is loaded from CDN as window.jspdf

/**
 * Universal PDF generator function
 * @param {Object} options - PDF generation options
 * @param {string} options.toolkitName - Name of the toolkit
 * @param {string} options.toolkitIconUrl - URL to toolkit icon (optional)
 * @param {string} options.content - Content to include in PDF
 * @param {string} options.filename - Output filename
 */
export function generateYBGpdf({ toolkitName, toolkitIconUrl, content, filename }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const marginLeft = 20;
  const marginTop = 30;
  const lineHeight = 18;
  let cursorY = marginTop;
  let pageNumber = 1;

  // Header function
  function drawHeader(pageNum) {
    if (toolkitIconUrl) {
      doc.addImage(toolkitIconUrl, "PNG", marginLeft, 10, 15, 15);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(toolkitName || "YourBizGuru Toolkit", marginLeft + 20, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${pageNum}`, 180, 20, { align: "right" });

    doc.line(20, 25, 190, 25); // divider line
  }

  // Footer function
  function drawFooter() {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Powered by YourBizGuru.com", 105, 285, { align: "center" });
  }

  // Initial header
  drawHeader(pageNumber);

  // Process content (splits by line or \n)
  const lines = content.split("\n");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);

  lines.forEach(line => {
    if (cursorY > 270) {
      drawFooter();
      doc.addPage();
      pageNumber++;
      drawHeader(pageNumber);
      cursorY = marginTop;
    }
    doc.text(line, marginLeft, cursorY);
    cursorY += lineHeight;
  });

  // Final footer
  drawFooter();

  // Save
  doc.save(filename || `${toolkitName || "YBG_Report"}.pdf`);
}

/**
 * Initialize PDF functionality for the YBG Mini-Dashboard
 * Enhances existing download buttons with PDF generation
 */
export function initPDFExport() {
  // Set default toolkit info (can be overridden by individual toolkits)
  if (!window.currentToolkitName) {
    window.currentToolkitName = "YourBizGuru Mini-Dashboard";
  }
  if (!window.currentToolkitIcon) {
    window.currentToolkitIcon = "/favicon-32x32.png";
  }

  // Function to generate PDF from result content
  window.generateResultPDF = function(resultContent, timestamp) {
    const toolkitName = window.currentToolkitName || "YourBizGuru Toolkit";
    const toolkitIconUrl = window.currentToolkitIcon || "";
    const filename = `${toolkitName.replace(/\s+/g, "_")}_${timestamp || new Date().getTime()}.pdf`;

    generateYBGpdf({
      toolkitName,
      toolkitIconUrl,
      content: resultContent,
      filename,
    });
  };

  // Function to generate PDF from all results
  window.generateAllResultsPDF = function() {
    const resultsContainer = document.getElementById("resultsContainer");
    if (!resultsContainer) return;

    const resultItems = resultsContainer.querySelectorAll('.result-item');
    if (resultItems.length === 0) {
      alert("No results available to export.");
      return;
    }

    let allContent = "";
    resultItems.forEach((item, index) => {
      const timestamp = item.querySelector('.result-timestamp')?.textContent || '';
      const content = item.querySelector('.result-content')?.textContent || '';
      
      allContent += `Result ${index + 1} - ${timestamp}\n`;
      allContent += "=" + "=".repeat(50) + "\n\n";
      allContent += content + "\n\n\n";
    });

    const toolkitName = window.currentToolkitName || "YourBizGuru Toolkit";
    const filename = `${toolkitName.replace(/\s+/g, "_")}_All_Results.pdf`;

    generateYBGpdf({
      toolkitName: window.currentToolkitName || "YourBizGuru Toolkit",
      toolkitIconUrl: window.currentToolkitIcon || "",
      content: allContent,
      filename,
    });
  };

  console.log("YBG PDF Export system initialized");
}