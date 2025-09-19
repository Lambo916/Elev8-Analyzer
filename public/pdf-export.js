/* public/pdf-export.js
   YBG PDF Export - Production Quality Implementation
   - Consistent typography across all pages
   - Clean pagination with proper word wrapping
   - Correct timestamp-based result filtering
   - No footer/header overlap
*/

(() => {
  'use strict';

  // ---- jsPDF Lazy Loader ---------------------------------------------------
  const loadJsPDF = (() => {
    let cached;
    return async () => {
      if (cached) return cached;
      if (window.jspdf?.jsPDF) {
        cached = window.jspdf.jsPDF;
        return cached;
      }
      const src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Failed to load jsPDF"));
        document.head.appendChild(script);
      });
      cached = window.jspdf.jsPDF;
      return cached;
    };
  })();

  // ---- Constants (A4 Portrait) ---------------------------------------------
  const PAGE = {
    width: 210,  // mm
    height: 297  // mm
  };

  const MARGINS = {
    top: 20,
    bottom: 20,
    left: 16,
    right: 16
  };

  const HEADER = {
    height: 18,      // Total header area height
    iconSize: 10,    // Icon diameter
    iconRing: 0.8    // Ring thickness
  };

  const FOOTER = {
    height: 15       // Total footer area height including text
  };

  // Safe content area calculation
  const CONTENT = {
    top: MARGINS.top + HEADER.height,
    bottom: PAGE.height - MARGINS.bottom - FOOTER.height,
    left: MARGINS.left,
    right: PAGE.width - MARGINS.right,
    width: PAGE.width - MARGINS.left - MARGINS.right
  };
  CONTENT.height = CONTENT.bottom - CONTENT.top;

  // ---- Typography Tokens (Global, Applied Per Page) ------------------------
  const TYPOGRAPHY = {
    fontFamily: "helvetica",
    
    // Sizes
    bodySize: 11,
    h2Size: 13,
    h3Size: 11,
    footerSize: 9,
    headerTitleSize: 12,
    
    // Line heights
    lineHeight: 5.5,  // mm (approx 1.35x for 11pt)
    h2LineHeight: 6.5,
    h3LineHeight: 5.8,
    paragraphSpacing: 3.5,
    
    // Colors (RGB arrays for jsPDF)
    colorBody: [51, 51, 51],      // #333
    colorHeading: [17, 17, 17],   // #111  
    colorMeta: [102, 102, 102],   // #666
    colorAccent: [79, 195, 247]   // Brand blue
  };

  // ---- Global Typography Application ---------------------------------------
  function applyGlobalTypography(doc) {
    doc.setFont(TYPOGRAPHY.fontFamily, "normal");
    doc.setFontSize(TYPOGRAPHY.bodySize);
    doc.setTextColor(...TYPOGRAPHY.colorBody);
    doc.setLineWidth(0.2);
  }

  // ---- Toolkit Configuration -----------------------------------------------
  function getToolkitName() {
    return window.currentToolkitName || "YourBizGuru Mini-Dashboard";
  }

  function getToolkitIcon() {
    return window.currentToolkitIcon || "/favicon.png";
  }

  // ---- Image Loading -------------------------------------------------------
  async function loadImageAsDataURL(url) {
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ---- Header Drawing ------------------------------------------------------
  function drawHeader(doc, pageNum, iconDataUrl) {
    const x = MARGINS.left;
    const y = MARGINS.top;
    
    // Icon with ring
    if (iconDataUrl) {
      try {
        const iconX = x + 1;
        const iconY = y + 2;
        const size = HEADER.iconSize;
        
        // Draw ring
        doc.setDrawColor(...TYPOGRAPHY.colorAccent);
        doc.setLineWidth(HEADER.iconRing);
        doc.circle(iconX + size/2, iconY + size/2, size/2 + 0.5, "S");
        
        // Draw icon
        doc.addImage(iconDataUrl, "PNG", iconX, iconY, size, size, "", "FAST");
      } catch (e) {
        // Silent fail for icon
      }
    }
    
    // Title
    doc.setFont(TYPOGRAPHY.fontFamily, "bold");
    doc.setFontSize(TYPOGRAPHY.headerTitleSize);
    doc.setTextColor(...TYPOGRAPHY.colorHeading);
    doc.text(getToolkitName(), x + HEADER.iconSize + 5, y + 7);
    
    // Date/time
    doc.setFont(TYPOGRAPHY.fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TYPOGRAPHY.colorMeta);
    const now = new Date();
    const dateStr = `${now.toLocaleDateString()} • ${now.toLocaleTimeString()}`;
    doc.text(dateStr, x + HEADER.iconSize + 5, y + 12);
    
    // Reset to body typography
    applyGlobalTypography(doc);
  }

  // ---- Footer Drawing ------------------------------------------------------
  function drawFooter(doc, pageNum, totalPages) {
    const y = PAGE.height - MARGINS.bottom - 5;
    
    // Separator line
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(CONTENT.left, CONTENT.bottom + 2, CONTENT.right, CONTENT.bottom + 2);
    
    // Left text
    doc.setFont(TYPOGRAPHY.fontFamily, "normal");
    doc.setFontSize(TYPOGRAPHY.footerSize);
    doc.setTextColor(...TYPOGRAPHY.colorMeta);
    doc.text("Powered by YourBizGuru.com", CONTENT.left, y);
    
    // Right text (page numbers)
    const pageText = `Page ${pageNum} of ${totalPages}`;
    const pageWidth = doc.getTextWidth(pageText);
    doc.text(pageText, CONTENT.right - pageWidth, y);
    
    // Reset to body typography
    applyGlobalTypography(doc);
  }

  // ---- Text Processing -----------------------------------------------------
  function parseContent(text) {
    if (!text) return [];
    
    const lines = text.split(/\r?\n/);
    const blocks = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('## ')) {
        blocks.push({
          type: 'h2',
          text: trimmed.substring(3).trim()
        });
      } else if (trimmed.startsWith('### ')) {
        blocks.push({
          type: 'h3', 
          text: trimmed.substring(4).trim()
        });
      } else if (trimmed.startsWith('---')) {
        blocks.push({
          type: 'separator',
          text: ''
        });
      } else if (trimmed.length > 0) {
        blocks.push({
          type: 'paragraph',
          text: line  // Keep original spacing
        });
      } else {
        blocks.push({
          type: 'blank',
          text: ''
        });
      }
    }
    
    return blocks;
  }

  // ---- Word Wrapping Algorithm ---------------------------------------------
  function wrapText(doc, text, maxWidth, fontSize) {
    doc.setFontSize(fontSize);
    
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.getTextWidth(testLine);
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [''];
  }

  // ---- Content Writing with Pagination ------------------------------------
  class PDFWriter {
    constructor(doc, iconDataUrl) {
      this.doc = doc;
      this.iconDataUrl = iconDataUrl;
      this.pageNum = 1;
      this.yPosition = CONTENT.top;
      this.totalPages = 1;
    }
    
    needsNewPage(requiredHeight) {
      return this.yPosition + requiredHeight > CONTENT.bottom;
    }
    
    addNewPage() {
      this.pageNum++;
      this.totalPages++;
      this.doc.addPage();
      applyGlobalTypography(this.doc);
      drawHeader(this.doc, this.pageNum, this.iconDataUrl);
      this.yPosition = CONTENT.top;
    }
    
    writeBlock(block) {
      let fontSize = TYPOGRAPHY.bodySize;
      let lineHeight = TYPOGRAPHY.lineHeight;
      let isBold = false;
      let textColor = TYPOGRAPHY.colorBody;
      
      // Configure style based on block type
      switch (block.type) {
        case 'h2':
          fontSize = TYPOGRAPHY.h2Size;
          lineHeight = TYPOGRAPHY.h2LineHeight;
          isBold = true;
          textColor = TYPOGRAPHY.colorHeading;
          // Add space before heading
          if (this.yPosition > CONTENT.top + 10) {
            this.yPosition += TYPOGRAPHY.paragraphSpacing;
          }
          break;
          
        case 'h3':
          fontSize = TYPOGRAPHY.h3Size;
          lineHeight = TYPOGRAPHY.h3LineHeight;
          isBold = true;
          textColor = TYPOGRAPHY.colorHeading;
          // Add space before heading
          if (this.yPosition > CONTENT.top + 10) {
            this.yPosition += TYPOGRAPHY.paragraphSpacing * 0.8;
          }
          break;
          
        case 'separator':
          // Check space for separator
          if (this.needsNewPage(10)) {
            this.addNewPage();
          }
          this.yPosition += 5;
          this.doc.setDrawColor(230, 230, 230);
          this.doc.setLineWidth(0.3);
          this.doc.line(CONTENT.left, this.yPosition, CONTENT.right, this.yPosition);
          this.yPosition += 5;
          return;
          
        case 'blank':
          this.yPosition += TYPOGRAPHY.paragraphSpacing * 0.5;
          return;
      }
      
      // Wrap text
      const lines = wrapText(this.doc, block.text, CONTENT.width, fontSize);
      
      // Calculate required height
      const blockHeight = lines.length * lineHeight;
      
      // Check for widows/orphans (keep at least 2 lines together)
      if (lines.length > 1 && this.needsNewPage(blockHeight)) {
        // If we can fit at least 2 lines, do it; otherwise new page
        const minLines = Math.min(2, lines.length);
        const minHeight = minLines * lineHeight;
        
        if (!this.needsNewPage(minHeight)) {
          // Write first few lines on current page
          this.doc.setFont(TYPOGRAPHY.fontFamily, isBold ? "bold" : "normal");
          this.doc.setFontSize(fontSize);
          this.doc.setTextColor(...textColor);
          
          for (let i = 0; i < minLines; i++) {
            this.doc.text(lines[i], CONTENT.left, this.yPosition);
            this.yPosition += lineHeight;
          }
          
          // Move to new page for remaining lines
          this.addNewPage();
          
          // Write remaining lines
          this.doc.setFont(TYPOGRAPHY.fontFamily, isBold ? "bold" : "normal");
          this.doc.setFontSize(fontSize);
          this.doc.setTextColor(...textColor);
          
          for (let i = minLines; i < lines.length; i++) {
            this.doc.text(lines[i], CONTENT.left, this.yPosition);
            this.yPosition += lineHeight;
          }
        } else {
          // Move everything to new page
          this.addNewPage();
          
          // Write all lines
          this.doc.setFont(TYPOGRAPHY.fontFamily, isBold ? "bold" : "normal");
          this.doc.setFontSize(fontSize);
          this.doc.setTextColor(...textColor);
          
          for (const line of lines) {
            this.doc.text(line, CONTENT.left, this.yPosition);
            this.yPosition += lineHeight;
          }
        }
      } else {
        // Write on current page
        this.doc.setFont(TYPOGRAPHY.fontFamily, isBold ? "bold" : "normal");
        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(...textColor);
        
        for (const line of lines) {
          if (this.needsNewPage(lineHeight)) {
            this.addNewPage();
            this.doc.setFont(TYPOGRAPHY.fontFamily, isBold ? "bold" : "normal");
            this.doc.setFontSize(fontSize);
            this.doc.setTextColor(...textColor);
          }
          
          this.doc.text(line, CONTENT.left, this.yPosition);
          this.yPosition += lineHeight;
        }
      }
      
      // Add paragraph spacing after block
      if (block.type === 'paragraph') {
        this.yPosition += TYPOGRAPHY.paragraphSpacing * 0.6;
      }
      
      // Reset typography
      applyGlobalTypography(this.doc);
    }
    
    finalize() {
      // Draw footers on all pages
      for (let i = 1; i <= this.totalPages; i++) {
        this.doc.setPage(i);
        drawFooter(this.doc, i, this.totalPages);
      }
    }
  }

  // ---- Result Collection (Match YBGToolkit storage) ------------------------
  function getToolkitStorageKey() {
    // Match the exact same logic as YBGToolkit.getStorageKey()
    const toolkitName = getToolkitName().toLowerCase().replace(/\s+/g, '_');
    return `ybg_toolkit_results_${toolkitName}`;
  }

  function collectResults() {
    // Get results from localStorage using the same key as YBGToolkit
    const storageKey = getToolkitStorageKey();
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          console.log('PDF Export: Retrieved', parsed.length, 'results from storage:', storageKey);
          return parsed;
        }
      }
    } catch (e) {
      console.error('PDF Export: Error parsing stored results:', e);
    }
    
    console.log('PDF Export: No results found in storage key:', storageKey);
    return [];
  }

  // ---- Main Export Functions -----------------------------------------------
  async function exportSingleResult(text, resultTitle) {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    
    // Load icon
    const iconDataUrl = await loadImageAsDataURL(getToolkitIcon());
    
    // Initialize writer
    const writer = new PDFWriter(doc, iconDataUrl);
    
    // Apply global typography
    applyGlobalTypography(doc);
    
    // Draw first page header
    drawHeader(doc, 1, iconDataUrl);
    
    // Parse and write content
    const blocks = parseContent(text);
    
    if (blocks.length === 0) {
      writer.writeBlock({
        type: 'paragraph',
        text: 'No content available.'
      });
    } else {
      for (const block of blocks) {
        writer.writeBlock(block);
      }
    }
    
    // Finalize (add footers)
    writer.finalize();
    
    // Generate filename
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const safeName = getToolkitName().replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${yyyy}-${mm}-${dd}_YBG_${safeName}_Report.pdf`;
    
    doc.save(filename);
  }

  async function exportMultipleResults(mode = 'all') {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    
    // Load icon
    const iconDataUrl = await loadImageAsDataURL(getToolkitIcon());
    
    // Initialize writer
    const writer = new PDFWriter(doc, iconDataUrl);
    
    // Apply global typography
    applyGlobalTypography(doc);
    
    // Draw first page header
    drawHeader(doc, 1, iconDataUrl);
    
    // Collect results from storage
    let results = collectResults();
    
    console.log('PDF Export: Collected', results.length, 'results for mode:', mode);
    
    if (results.length > 0) {
      // Sort by timestamp (oldest to newest for proper chronological order)
      results.sort((a, b) => {
        const timestampA = new Date(a.timestamp).getTime();
        const timestampB = new Date(b.timestamp).getTime();
        return timestampA - timestampB;
      });
      
      // Filter based on mode
      if (mode === 'latest') {
        results = [results[results.length - 1]]; // Take only the most recent
        console.log('PDF Export: Using latest result only');
      }
    }
    
    // Write results
    if (results.length === 0) {
      writer.writeBlock({
        type: 'paragraph',
        text: 'No results available.'
      });
    } else {
      results.forEach((result, index) => {
        // Add separator between results (except first)
        if (index > 0) {
          writer.writeBlock({ type: 'separator', text: '' });
        }
        
        // Result header
        const headerText = mode === 'latest' ? 
          'Latest Result' : 
          `Result ${index + 1}`;
        
        writer.writeBlock({
          type: 'h2',
          text: `${headerText} - ${result.displayTime || new Date(result.timestamp).toLocaleString()}`
        });
        
        // Prompt if available
        if (result.prompt) {
          writer.writeBlock({
            type: 'h3',
            text: 'Request'
          });
          writer.writeBlock({
            type: 'paragraph',
            text: result.prompt
          });
        }
        
        // Result content
        if (result.result) {
          writer.writeBlock({
            type: 'h3',
            text: 'Response'
          });
          
          // Parse the result text for any markdown formatting
          const contentBlocks = parseContent(result.result);
          for (const block of contentBlocks) {
            writer.writeBlock(block);
          }
        }
      });
    }
    
    // Finalize (add footers)
    writer.finalize();
    
    // Generate filename based on mode
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const safeName = getToolkitName().replace(/[^a-zA-Z0-9]/g, '');
    
    const suffix = mode === 'latest' ? 'Latest_Result' : 'All_Results';
    const filename = `${yyyy}-${mm}-${dd}_YBG_${safeName}_${suffix}.pdf`;
    
    doc.save(filename);
  }

  // ---- Public API ----------------------------------------------------------
  window.exportResultToPDF = function(text) {
    // Single result export (from Download button)
    return exportSingleResult(text || '');
  };

  window.exportAllResultsToPDF = function(resultsArray, options = {}) {
    // Handle both array input and mode-based export
    if (Array.isArray(resultsArray) && resultsArray.length > 0 && typeof resultsArray[0] === 'string') {
      // Legacy: array of strings
      const combined = resultsArray.join('\n\n---\n\n');
      return exportSingleResult(combined);
    }
    
    // Modern: use mode-based export
    const mode = options.mode || 'all';
    return exportMultipleResults(mode);
  };

  // Additional API aliases
  window.YBG_PDF = {
    exportResultToPDF: window.exportResultToPDF,
    exportAllResultsToPDF: window.exportAllResultsToPDF,
    exportLatestResult: () => exportMultipleResults('latest'),
    exportAllResults: () => exportMultipleResults('all')
  };

})();