const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestApp } = require('./helpers');

describe('Client report calculations with client-specific rate', () => {
  let app, db;

  beforeEach(() => {
    ({ app, db } = createTestApp());
  });

  /**
   * Helper: create a client with rate, 2 projects, 2 subprojects each, and time entries.
   * Returns the client ID.
   */
  function setupTestClient(rate) {
    const client = db.prepare('INSERT INTO clients (naam, uurtarief) VALUES (?, ?)').run('TestClient', rate);
    const clientId = client.lastInsertRowid;

    const proj1 = db.prepare('INSERT INTO projects (clientId, naam) VALUES (?, ?)').run(clientId, 'Project1');
    const proj2 = db.prepare('INSERT INTO projects (clientId, naam) VALUES (?, ?)').run(clientId, 'Project2');

    const sub1a = db.prepare('INSERT INTO subprojects (projectId, naam) VALUES (?, ?)').run(proj1.lastInsertRowid, 'Sub1A');
    const sub1b = db.prepare('INSERT INTO subprojects (projectId, naam) VALUES (?, ?)').run(proj1.lastInsertRowid, 'Sub1B');
    const sub2a = db.prepare('INSERT INTO subprojects (projectId, naam) VALUES (?, ?)').run(proj2.lastInsertRowid, 'Sub2A');
    const sub2b = db.prepare('INSERT INTO subprojects (projectId, naam) VALUES (?, ?)').run(proj2.lastInsertRowid, 'Sub2B');

    // Insert time entries for March 2026
    db.prepare('INSERT INTO time_entries (subprojectId, datum, werkelijkeUren, gefactureerdeUren) VALUES (?, ?, ?, ?)').run(sub1a.lastInsertRowid, '2026-03-05', 5, 5);
    db.prepare('INSERT INTO time_entries (subprojectId, datum, werkelijkeUren, gefactureerdeUren) VALUES (?, ?, ?, ?)').run(sub1b.lastInsertRowid, '2026-03-10', 3, 3);
    db.prepare('INSERT INTO time_entries (subprojectId, datum, werkelijkeUren, gefactureerdeUren) VALUES (?, ?, ?, ?)').run(sub2a.lastInsertRowid, '2026-03-15', 4, 4);
    db.prepare('INSERT INTO time_entries (subprojectId, datum, werkelijkeUren, gefactureerdeUren) VALUES (?, ?, ?, ?)').run(sub2b.lastInsertRowid, '2026-03-20', 2, 2);

    return clientId;
  }

  it('18. Report includes uurtarief: 65', async () => {
    const clientId = setupTestClient(65);

    const res = await request(app)
      .get(`/api/reports/client/${clientId}?maand=2026-03`)
      .expect(200);

    assert.equal(res.body.uurtarief, 65);
  });

  it('19. Subproject totals correct: sub1A=5h, sub1B=3h → project totaal=8h', async () => {
    const clientId = setupTestClient(65);

    const res = await request(app)
      .get(`/api/reports/client/${clientId}?maand=2026-03`)
      .expect(200);

    const project1 = res.body.projecten.find(p => p.naam === 'Project1');
    assert.ok(project1, 'Project1 should exist');
    assert.equal(project1.totaal, 8);

    const sub1A = project1.subprojecten.find(s => s.naam === 'Sub1A');
    const sub1B = project1.subprojecten.find(s => s.naam === 'Sub1B');
    assert.equal(sub1A.totaal, 5);
    assert.equal(sub1B.totaal, 3);
  });

  it('20. Grand total correct: sum of all project hours', async () => {
    const clientId = setupTestClient(65);

    const res = await request(app)
      .get(`/api/reports/client/${clientId}?maand=2026-03`)
      .expect(200);

    // 5 + 3 + 4 + 2 = 14
    assert.equal(res.body.totaal, 14);
  });

  it('21. Calculation integrity: totaal * uurtarief ≈ sum of sub-level amounts', async () => {
    const clientId = setupTestClient(65);

    const res = await request(app)
      .get(`/api/reports/client/${clientId}?maand=2026-03`)
      .expect(200);

    const uurtarief = res.body.uurtarief;
    const grandTotal = parseFloat((res.body.totaal * uurtarief).toFixed(2));

    // Sum of individual sub amounts
    let subSum = 0;
    for (const project of res.body.projecten) {
      for (const sub of project.subprojecten) {
        subSum += parseFloat((sub.totaal * uurtarief).toFixed(2));
      }
    }

    assert.ok(
      Math.abs(grandTotal - subSum) < 0.01,
      `Grand total €${grandTotal} should match sub-sum €${subSum} within €0.01`
    );

    // Verify actual values
    assert.equal(grandTotal, 14 * 65); // 910
    assert.equal(subSum, 5 * 65 + 3 * 65 + 4 * 65 + 2 * 65); // 910
  });

  it('22. Rate change reflects in next fetch', async () => {
    const clientId = setupTestClient(65);

    // Verify initial rate
    const res1 = await request(app)
      .get(`/api/reports/client/${clientId}?maand=2026-03`)
      .expect(200);
    assert.equal(res1.body.uurtarief, 65);

    // Update rate
    await request(app)
      .put(`/api/clients/${clientId}`)
      .send({ uurtarief: 90 })
      .expect(200);

    // Verify new rate in report
    const res2 = await request(app)
      .get(`/api/reports/client/${clientId}?maand=2026-03`)
      .expect(200);
    assert.equal(res2.body.uurtarief, 90);
    assert.equal(res2.body.totaal * res2.body.uurtarief, 14 * 90); // 1260
  });
});
