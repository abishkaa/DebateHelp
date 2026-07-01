function addWrappedText(doc, text, x, y, width, lineHeight = 5) {
  const lines = doc.splitTextToSize(text, width)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

function ensurePage(doc, y, needed = 28) {
  if (y + needed <= 278) {
    return y
  }

  doc.addPage()
  return 22
}

function addSection(doc, title, items, y) {
  const safeItems = Array.isArray(items) && items.length > 0 ? items : ['No items provided yet.']
  const nextY = ensurePage(doc, y, 34)
  doc.setDrawColor(42, 45, 53)
  doc.line(18, nextY, 192, nextY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(14, 15, 18)
  doc.text(title, 18, nextY + 8)

  let cursor = nextY + 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(55, 58, 65)

  safeItems.forEach((item) => {
    cursor = ensurePage(doc, cursor, 18)
    doc.setFillColor(108, 142, 255)
    doc.circle(20, cursor - 1.5, 1.1, 'F')
    cursor = addWrappedText(doc, String(item), 25, cursor, 164, 4.5) + 4
  })

  return cursor + 2
}

export async function exportDebateReport(report) {
  const { jsPDF } = await import('jspdf')
  const safeReport = {
    topic: report?.topic || 'Debate Analysis',
    score: Number.isFinite(Number(report?.score)) ? Number(report.score) : 0,
    recommendation: report?.recommendation || 'Keep refining the argument with clearer evidence, counterarguments, and a concise final claim.',
    keyArguments: report?.keyArguments,
    evidence: report?.evidence,
    fallacies: report?.fallacies,
    counterarguments: report?.counterarguments,
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const generatedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  doc.setFillColor(14, 15, 18)
  doc.rect(0, 0, 210, 52, 'F')
  doc.setFillColor(108, 142, 255)
  doc.rect(0, 0, 5, 52, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.setTextColor(232, 230, 224)
  doc.text('Debate Analysis Report', 18, 22)

  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(138, 141, 150)
  doc.text('DEBATEHELP - PROFESSIONAL REASONING REVIEW', 18, 31)
  doc.text(`Generated ${generatedAt}`, 18, 40)

  doc.setFillColor(63, 208, 160)
  doc.roundedRect(165, 15, 27, 22, 2, 2, 'F')
  doc.setTextColor(14, 15, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`${safeReport.score}%`, 178.5, 27, { align: 'center' })
  doc.setFontSize(7)
  doc.text('PERSUASIVENESS', 178.5, 33, { align: 'center' })

  doc.setTextColor(14, 15, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Topic', 18, 68)
  doc.setFontSize(17)
  doc.text(String(safeReport.topic), 18, 78)

  let y = 90
  y = addSection(doc, 'Key Arguments', safeReport.keyArguments, y)
  y = addSection(doc, 'Evidence Assessment', safeReport.evidence, y)
  y = addSection(doc, 'Logical Fallacies and Risks', safeReport.fallacies, y)
  y = addSection(doc, 'Counterarguments', safeReport.counterarguments, y)

  y = ensurePage(doc, y, 38)
  doc.setFillColor(239, 242, 255)
  doc.roundedRect(18, y, 174, 34, 3, 3, 'F')
  doc.setTextColor(43, 63, 126)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Final Recommendation', 24, y + 9)
  doc.setTextColor(35, 38, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  addWrappedText(doc, safeReport.recommendation, 24, y + 18, 160, 4.5)

  const pages = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setDrawColor(220, 222, 226)
    doc.line(18, 286, 192, 286)
    doc.setFont('courier', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120, 123, 130)
    doc.text('DebateHelp - Evidence, reasoning, counterargument, confidence.', 18, 291)
    doc.text(`${pageNumber} / ${pages}`, 192, 291, { align: 'right' })
  }

  const filename = `DebateHelp-${safeReport.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
  doc.save(filename)
}
