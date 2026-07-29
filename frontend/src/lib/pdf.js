import { jsPDF } from "jspdf";

export function exportReportPdf(report, verification) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PAGE_WIDTH = 595.28; // A4 width in points
  const PAGE_HEIGHT = 841.89; // A4 height in points
  const MARGIN = 40;
  const usableWidth = PAGE_WIDTH - 2 * MARGIN;
  let y = MARGIN;

  // Helper to add section title
  const addSectionTitle = (text) => {
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(30);
    doc.text(text, MARGIN, y);
    y += 24;
    doc.setDrawColor(200).setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 12;
  };

  // Header
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(30);
  doc.text("TrustHire Verification Report", MARGIN, y);
  y += 30;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
  doc.text(`Generated on ${new Date().toLocaleString()}`, MARGIN, y);
  y += 20;

  // Company and Trust Score
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(20);
  doc.text(report.title || report.company || "Verification Report", MARGIN, y);
  y += 24;
  doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(50);
  doc.text(`Company: ${report.company}`, MARGIN, y);
  y += 18;
  const trustScore = report.trustScore ?? 0;
  const bandLabel = verification?.bandLabel || (report.band ? (typeof report.band === 'string' ? report.band : '') : '');
  doc.setFont("helvetica", "bold").setFontSize(24);
  // Color based on score: green for good, yellow for medium, red for poor
  let scoreColor;
  if (trustScore >= 80) scoreColor = [0, 150, 0]; // green
  else if (trustScore >= 60) scoreColor = [200, 150, 0]; // orange/yellow
  else scoreColor = [200, 0, 0]; // red
  doc.setTextColor(...scoreColor);
  doc.text(`${trustScore}/100`, MARGIN, y);
  y += 30;
  doc.setTextColor(50);
  doc.setFont("helvetica", "normal").setFontSize(11);
  if (bandLabel) {
    doc.text(`Rating: ${bandLabel}`, MARGIN, y);
    y += 16;
  }

  // Add a thin line
  doc.setDrawColor(220).setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 20;

  // Evaluation Factors section
  if (verification?.parameters && Object.keys(verification.parameters).length > 0) {
    addSectionTitle("Evaluation Factors");
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(50);
    // Convert parameters to array of objects for easier handling
    const params = [];
    for (const [key, value] of Object.entries(verification.parameters)) {
      let score = '';
      let explanation = '';
      if (typeof value === 'object' && value !== null) {
        score = value.score ?? value.value ?? '';
        explanation = value.explanation || value.evidence || '';
      } else {
        score = value;
      }
      params.push({ key, score: String(score || ''), explanation: String(explanation || '') });
    }

    // Simple table layout
    const rowHeight = 20;
    const col1Width = 150; // Factor name
    const col2Width = 80;  // Score
    const col3Width = usableWidth - col1Width - col2Width - 40; // Explanation
    let tableY = y;
    // Header
    doc.setFont("helvetica", "bold").setFillColor(245);
    doc.rect(MARGIN, tableY, col1Width, rowHeight, 'F');
    doc.rect(MARGIN + col1Width, tableY, col2Width, rowHeight, 'F');
    doc.rect(MARGIN + col1Width + col2Width, tableY, col3Width, rowHeight, 'F');
    doc.setTextColor(50);
    doc.text("Factor", MARGIN + 10, tableY + 14);
    doc.text("Score", MARGIN + col1Width + 10, tableY + 14);
    doc.text("Explanation", MARGIN + col1Width + col2Width + 10, tableY + 14);
    tableY += rowHeight;
    doc.setFont("helvetica", "normal");
    // Rows
    for (const p of params) {
      // Check for page break
      if (tableY > PAGE_HEIGHT - MARGIN - 40) {
        doc.addPage();
        tableY = MARGIN;
        // Redraw header on new page
        doc.setFont("helvetica", "bold").setFillColor(245);
        doc.rect(MARGIN, tableY, col1Width, rowHeight, 'F');
        doc.rect(MARGIN + col1Width, tableY, col2Width, rowHeight, 'F');
        doc.rect(MARGIN + col1Width + col2Width, tableY, col3Width, rowHeight, 'F');
        doc.setTextColor(50);
        doc.text("Factor", MARGIN + 10, tableY + 14);
        doc.text("Score", MARGIN + col1Width + 10, tableY + 14);
        doc.text("Explanation", MARGIN + col1Width + col2Width + 10, tableY + 14);
        tableY += rowHeight;
        doc.setFont("helvetica", "normal");
      }
      // Background for alternating rows (optional)
      // doc.setFillColor(250); doc.rect(MARGIN, tableY, usableWidth, rowHeight, 'F');
      doc.setTextColor(50);
      // Factor name (truncate if too long)
      const factorText = p.key.length > 30 ? p.key.substring(0, 27) + '...' : p.key;
      doc.text(factorText, MARGIN + 8, tableY + 14);
      // Score
      const scoreText = p.score || '-';
      doc.text(scoreText, MARGIN + col1Width + 8, tableY + 14);
      // Explanation (multi-line)
      if (p.explanation) {
        const splitText = doc.splitTextToSize(p.explanation, col3Width - 10);
        doc.text(splitText, MARGIN + col1Width + col2Width + 8, tableY + 8);
        tableY += Math.max(rowHeight, splitText.length * 10 + 8);
      } else {
        tableY += rowHeight;
      }
    }
    y = tableY + 20;
  }

  // Reasoning section
  if (verification?.reason) {
    // Check if we need a new page
    if (y > PAGE_HEIGHT - MARGIN - 100) {
      doc.addPage();
      y = MARGIN;
    }
    addSectionTitle("Explanation");
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(50);
    const lines = doc.splitTextToSize(verification.reason, usableWidth);
    doc.text(lines, MARGIN, y);
    y += lines.length * 14 + 20;
  }

  // Footer with page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10).setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, MARGIN, PAGE_HEIGHT - MARGIN / 2);
  }

  doc.save(`trusthire-${(report.company || "report").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}