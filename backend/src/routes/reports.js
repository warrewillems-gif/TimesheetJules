const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { queryAll, queryGet } = require('../database');

// GET /api/reports/client/:id?maand=2026-03 - Maandrapport per client
router.get('/client/:id', (req, res) => {
  const { id } = req.params;
  const { maand } = req.query;

  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return res.status(400).json({ error: 'maand parameter verplicht (formaat: YYYY-MM)' });
  }

  const client = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [Number(id)]);
  if (!client) return res.status(404).json({ error: 'Client niet gevonden' });

  const projects = queryAll(req.db,
    'SELECT * FROM projects WHERE clientId = ? ORDER BY naam',
    [Number(id)]
  );

  const report = {
    client: { id: client.id, naam: client.naam },
    maand,
    projecten: [],
    totaal: 0,
  };

  for (const project of projects) {
    const subprojects = queryAll(req.db,
      'SELECT * FROM subprojects WHERE projectId = ? ORDER BY naam',
      [project.id]
    );

    const projectData = {
      id: project.id,
      naam: project.naam,
      subprojecten: [],
      totaal: 0,
    };

    for (const sub of subprojects) {
      const result = queryGet(req.db, `
        SELECT COALESCE(SUM(gefactureerdeUren), 0) as totaal
        FROM time_entries
        WHERE subprojectId = ? AND datum LIKE ? || '%'
      `, [sub.id, maand]);

      const subTotal = result.totaal;
      if (subTotal > 0) {
        projectData.subprojecten.push({
          id: sub.id,
          naam: sub.naam,
          totaal: subTotal,
        });
        projectData.totaal += subTotal;
      }
    }

    if (projectData.totaal > 0) {
      report.projecten.push(projectData);
      report.totaal += projectData.totaal;
    }
  }

  res.json(report);
});

// GET /api/reports/revenue?jaar=2026 - Revenue overview per month/year
router.get('/revenue', (req, res) => {
  const { jaar } = req.query;

  if (!jaar || !/^\d{4}$/.test(jaar)) {
    return res.status(400).json({ error: 'jaar parameter verplicht (formaat: YYYY)' });
  }

  // Per client per month
  const rows = queryAll(req.db, `
    SELECT c.id as clientId, c.naam as clientNaam,
           substr(te.datum, 1, 7) as maand,
           COALESCE(SUM(te.gefactureerdeUren), 0) as uren
    FROM time_entries te
    JOIN subprojects sp ON te.subprojectId = sp.id
    JOIN projects p ON sp.projectId = p.id
    JOIN clients c ON p.clientId = c.id
    WHERE te.datum LIKE ? || '%'
    GROUP BY c.id, substr(te.datum, 1, 7)
    ORDER BY c.naam, maand
  `, [jaar]);

  // Build structured result
  const clientsMap = {};
  let jaarTotaalUren = 0;

  for (const row of rows) {
    if (!clientsMap[row.clientId]) {
      clientsMap[row.clientId] = {
        id: row.clientId,
        naam: row.clientNaam,
        maanden: {},
        totaalUren: 0,
      };
    }
    clientsMap[row.clientId].maanden[row.maand] = row.uren;
    clientsMap[row.clientId].totaalUren += row.uren;
    jaarTotaalUren += row.uren;
  }

  res.json({
    jaar: Number(jaar),
    clients: Object.values(clientsMap),
    totaalUren: jaarTotaalUren,
  });
});

// GET /api/reports/weekly-pdf — PDF for the current week (Mon–Sun)
router.get('/weekly-pdf', (req, res) => {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const vanStr = toDateStr(monday);
  const totStr = toDateStr(weekDays[6]);
  const fmtDisp = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const dagNamen = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const fmtH = (h) =>
    h === 0 ? '' : h % 1 === 0 ? h.toString() : parseFloat(h.toFixed(2)).toString();

  // Fetch all entries for the week with client/project/subproject context
  const alles = queryAll(req.db, `
    SELECT
      c.id  AS clientId,    c.naam  AS clientNaam,
      p.id  AS projectId,   p.naam  AS projectNaam,
      s.id  AS subprojectId, s.naam AS subprojectNaam,
      te.datum, te.gefactureerdeUren
    FROM clients c
    JOIN projects   p  ON p.clientId    = c.id
    JOIN subprojects s  ON s.projectId   = p.id
    JOIN time_entries te ON te.subprojectId = s.id
    WHERE te.datum >= ? AND te.datum <= ?
    ORDER BY c.naam, p.naam, s.naam, te.datum
  `, [vanStr, totStr]);

  // Build hierarchy: client → project → subproject → { datum: hours }
  const clientsMap = new Map();
  for (const row of alles) {
    if (!clientsMap.has(row.clientId)) {
      clientsMap.set(row.clientId, { naam: row.clientNaam, projects: new Map() });
    }
    const client = clientsMap.get(row.clientId);
    if (!client.projects.has(row.projectId)) {
      client.projects.set(row.projectId, { naam: row.projectNaam, subprojects: new Map() });
    }
    const project = client.projects.get(row.projectId);
    if (!project.subprojects.has(row.subprojectId)) {
      project.subprojects.set(row.subprojectId, { naam: row.subprojectNaam, entries: {} });
    }
    project.subprojects.get(row.subprojectId).entries[row.datum] = row.gefactureerdeUren;
  }

  // --- PDF layout (A4 landscape) ---
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="weekrapport_${vanStr}.pdf"`
  );
  doc.pipe(res);

  const M = 40; // page margin
  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;
  const W = PAGE_W - 2 * M; // usable content width ≈ 762 pts

  const LABEL_W = 200;
  const DAY_W = 70;
  const TOTAL_W = W - LABEL_W - 7 * DAY_W; // remainder
  const HDR_H = 20;
  const ROW_H = 16;
  const CLIENT_H = 22;

  let y = M;

  // ── Table header ────────────────────────────────────────────────────────────
  const drawHeader = () => {
    doc.fillColor('#0061FF').rect(M, y, W, HDR_H).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8);

    doc.text('Project / Subproject', M + 4, y + 5, { width: LABEL_W - 4, lineBreak: false });

    for (let i = 0; i < 7; i++) {
      const x = M + LABEL_W + i * DAY_W;
      doc.text(
        `${dagNamen[i]} ${weekDays[i].getDate()}`,
        x + 2, y + 5,
        { width: DAY_W - 4, align: 'center', lineBreak: false }
      );
    }

    const totX = M + LABEL_W + 7 * DAY_W;
    doc.text('Totaal', totX + 2, y + 5, { width: TOTAL_W - 4, align: 'center', lineBreak: false });

    y += HDR_H;
  };

  // ── Page title ───────────────────────────────────────────────────────────────
  doc
    .fontSize(14).font('Helvetica-Bold').fillColor('#0061FF')
    .text(
      `Weekrapport  ·  ${fmtDisp(monday)} – ${fmtDisp(weekDays[6])} ${monday.getFullYear()}`,
      M, y
    );
  y += 28;

  drawHeader();

  // ── No data ─────────────────────────────────────────────────────────────────
  if (clientsMap.size === 0) {
    doc.fillColor('#6B7280').font('Helvetica').fontSize(11)
      .text('Geen uren geregistreerd voor deze week.', M, y + 20);
    doc.end();
    return;
  }

  // ── Data rows ────────────────────────────────────────────────────────────────
  let grandTotal = 0;
  let rowEven = true;

  for (const [, client] of clientsMap) {
    // ensure space for at least the client band + one data row
    if (y > PAGE_H - M - CLIENT_H - ROW_H * 2) {
      doc.addPage();
      y = M;
      drawHeader();
    }

    // Client band
    doc.fillColor('#DBEAFE').rect(M, y, W, CLIENT_H).fill();
    doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(10)
      .text(client.naam, M + 6, y + 5, { width: W - 8, lineBreak: false });
    y += CLIENT_H;

    let clientTotal = 0;

    for (const [, project] of client.projects) {
      // Project label
      doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(8)
        .text(`  ${project.naam}`, M + 4, y + 2, { lineBreak: false });
      y += 14;

      for (const [, sub] of project.subprojects) {
        if (y > PAGE_H - M - ROW_H - 30) {
          doc.addPage();
          y = M;
          drawHeader();
        }

        const bg = rowEven ? '#FFFFFF' : '#F9FAFB';
        rowEven = !rowEven;
        doc.fillColor(bg).rect(M, y, W, ROW_H).fill();

        // Column separator lines
        doc.strokeColor('#E5E7EB').lineWidth(0.5);
        doc.moveTo(M + LABEL_W, y).lineTo(M + LABEL_W, y + ROW_H).stroke();
        for (let i = 1; i <= 7; i++) {
          const lx = M + LABEL_W + i * DAY_W;
          doc.moveTo(lx, y).lineTo(lx, y + ROW_H).stroke();
        }
        doc.moveTo(M, y + ROW_H).lineTo(M + W, y + ROW_H).stroke();

        // Subproject name
        doc.fillColor('#111827').font('Helvetica').fontSize(8)
          .text(`    ${sub.naam}`, M + 4, y + 3, { width: LABEL_W - 8, lineBreak: false });

        let subTotal = 0;
        for (let i = 0; i < 7; i++) {
          const dateStr = toDateStr(weekDays[i]);
          const hours = sub.entries[dateStr] || 0;
          subTotal += hours;
          if (hours > 0) {
            const x = M + LABEL_W + i * DAY_W;
            doc.fillColor('#111827').font('Helvetica').fontSize(8)
              .text(fmtH(hours), x + 2, y + 3, { width: DAY_W - 4, align: 'center', lineBreak: false });
          }
        }

        // Row total
        const totX = M + LABEL_W + 7 * DAY_W;
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8)
          .text(fmtH(subTotal), totX + 2, y + 3, { width: TOTAL_W - 4, align: 'center', lineBreak: false });

        clientTotal += subTotal;
        grandTotal += subTotal;
        y += ROW_H;
      }
    }

    // Client total row
    const totX = M + LABEL_W + 7 * DAY_W;
    doc.fillColor('#BFDBFE').rect(M, y, W, ROW_H).fill();
    doc.fillColor('#1E3A8A').font('Helvetica-Bold').fontSize(9)
      .text(`Totaal ${client.naam}`, M + 6, y + 3, { width: W - TOTAL_W - 10, lineBreak: false });
    doc.text(fmtH(clientTotal), totX + 2, y + 3, { width: TOTAL_W - 4, align: 'center', lineBreak: false });
    y += ROW_H + 12;
  }

  // Grand total row
  const totX = M + LABEL_W + 7 * DAY_W;
  doc.fillColor('#0061FF').rect(M, y, W, CLIENT_H).fill();
  doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
    .text('TOTAAL', M + 6, y + 5, { width: W - TOTAL_W - 10, lineBreak: false });
  doc.text(fmtH(grandTotal), totX + 2, y + 5, { width: TOTAL_W - 4, align: 'center', lineBreak: false });

  doc.end();
});

module.exports = router;
