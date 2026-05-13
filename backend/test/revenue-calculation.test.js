const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestApp, createClientChain, insertTimeEntry } = require('./helpers');

describe('Revenue calculations with client-specific rates', () => {
  let app, db;

  beforeEach(() => {
    ({ app, db } = createTestApp());
  });

  it('11. Revenue response includes uurtarief per client', async () => {
    const chainA = createClientChain(db, 'ClientA', 'ProjA', 'SubA', 50);
    insertTimeEntry(db, chainA.subprojectId, '2026-01-05', 10, 10);

    const res = await request(app).get('/api/reports/revenue?jaar=2026').expect(200);

    const clientA = res.body.clients.find(c => c.naam === 'ClientA');
    assert.ok(clientA, 'ClientA should be in the response');
    assert.equal(clientA.uurtarief, 50);
  });

  it('12. ClientA: 10h at €50/hr', async () => {
    const chainA = createClientChain(db, 'ClientA', 'ProjA', 'SubA', 50);
    insertTimeEntry(db, chainA.subprojectId, '2026-01-05', 10, 10);

    const res = await request(app).get('/api/reports/revenue?jaar=2026').expect(200);

    const clientA = res.body.clients.find(c => c.naam === 'ClientA');
    assert.equal(clientA.maanden['2026-01'], 10);
    assert.equal(clientA.uurtarief, 50);
  });

  it('13. ClientB: 5h at €80/hr', async () => {
    createClientChain(db, 'ClientA', 'ProjA', 'SubA', 50);
    const chainB = createClientChain(db, 'ClientB', 'ProjB', 'SubB', 80);
    insertTimeEntry(db, chainB.subprojectId, '2026-01-10', 5, 5);

    const res = await request(app).get('/api/reports/revenue?jaar=2026').expect(200);

    const clientB = res.body.clients.find(c => c.naam === 'ClientB');
    assert.equal(clientB.maanden['2026-01'], 5);
    assert.equal(clientB.uurtarief, 80);
  });

  it('14. Weighted total: 10*50 + 5*80 = €900', async () => {
    const chainA = createClientChain(db, 'ClientA', 'ProjA', 'SubA', 50);
    const chainB = createClientChain(db, 'ClientB', 'ProjB', 'SubB', 80);
    insertTimeEntry(db, chainA.subprojectId, '2026-01-05', 10, 10);
    insertTimeEntry(db, chainB.subprojectId, '2026-01-10', 5, 5);

    const res = await request(app).get('/api/reports/revenue?jaar=2026').expect(200);

    const clientA = res.body.clients.find(c => c.naam === 'ClientA');
    const clientB = res.body.clients.find(c => c.naam === 'ClientB');

    // Frontend calculation simulation
    const clientARevenue = clientA.maanden['2026-01'] * clientA.uurtarief;
    const clientBRevenue = clientB.maanden['2026-01'] * clientB.uurtarief;
    assert.equal(clientARevenue, 500);
    assert.equal(clientBRevenue, 400);
    assert.equal(clientARevenue + clientBRevenue, 900);

    // Yearly totals
    const yearlyA = clientA.totaalUren * clientA.uurtarief;
    const yearlyB = clientB.totaalUren * clientB.uurtarief;
    assert.equal(yearlyA + yearlyB, 900);
  });

  it('15. Multi-month: Jan(10*50+5*80) + Feb(8*50+12*80) = €2260', async () => {
    const chainA = createClientChain(db, 'ClientA', 'ProjA', 'SubA', 50);
    const chainB = createClientChain(db, 'ClientB', 'ProjB', 'SubB', 80);

    // January
    insertTimeEntry(db, chainA.subprojectId, '2026-01-05', 10, 10);
    insertTimeEntry(db, chainB.subprojectId, '2026-01-10', 5, 5);
    // February
    insertTimeEntry(db, chainA.subprojectId, '2026-02-05', 8, 8);
    insertTimeEntry(db, chainB.subprojectId, '2026-02-10', 12, 12);

    const res = await request(app).get('/api/reports/revenue?jaar=2026').expect(200);

    const clientA = res.body.clients.find(c => c.naam === 'ClientA');
    const clientB = res.body.clients.find(c => c.naam === 'ClientB');

    // Jan totals
    const janA = (clientA.maanden['2026-01'] || 0) * clientA.uurtarief;
    const janB = (clientB.maanden['2026-01'] || 0) * clientB.uurtarief;
    assert.equal(janA, 500);
    assert.equal(janB, 400);
    assert.equal(janA + janB, 900);

    // Feb totals
    const febA = (clientA.maanden['2026-02'] || 0) * clientA.uurtarief;
    const febB = (clientB.maanden['2026-02'] || 0) * clientB.uurtarief;
    assert.equal(febA, 400);
    assert.equal(febB, 960);
    assert.equal(febA + febB, 1360);

    // Yearly totals (weighted)
    const yearlyTotal = clientA.totaalUren * clientA.uurtarief + clientB.totaalUren * clientB.uurtarief;
    assert.equal(yearlyTotal, 2260);
  });

  it('16. Zero-rate client: 20h at €0 = €0', async () => {
    const chainA = createClientChain(db, 'ClientA', 'ProjA', 'SubA', 50);
    const chainC = createClientChain(db, 'ClientC', 'ProjC', 'SubC', 0);
    insertTimeEntry(db, chainA.subprojectId, '2026-01-05', 10, 10);
    insertTimeEntry(db, chainC.subprojectId, '2026-01-05', 20, 20);

    const res = await request(app).get('/api/reports/revenue?jaar=2026').expect(200);

    const clientC = res.body.clients.find(c => c.naam === 'ClientC');
    assert.ok(clientC, 'Zero-rate client should appear in results');
    assert.equal(clientC.uurtarief, 0);
    assert.equal(clientC.totaalUren * clientC.uurtarief, 0);

    // Total should only include ClientA revenue
    const clientA = res.body.clients.find(c => c.naam === 'ClientA');
    const total = clientA.totaalUren * clientA.uurtarief + clientC.totaalUren * clientC.uurtarief;
    assert.equal(total, 500); // 10*50 + 20*0
  });

  it('17. Client with no entries → absent from revenue', async () => {
    createClientChain(db, 'ClientD', 'ProjD', 'SubD', 60);
    // No time entries inserted

    const res = await request(app).get('/api/reports/revenue?jaar=2026').expect(200);

    const clientD = res.body.clients.find(c => c.naam === 'ClientD');
    assert.equal(clientD, undefined, 'Client with no entries should not appear');
  });
});
