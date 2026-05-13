const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestApp } = require('./helpers');

describe('Client CRUD with uurtarief', () => {
  let app, db;

  beforeEach(() => {
    ({ app, db } = createTestApp());
  });

  it('1. POST without uurtarief → uses global default (35)', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ naam: 'TestClient' })
      .expect(201);

    assert.equal(res.body.naam, 'TestClient');
    assert.equal(res.body.uurtarief, 35);
  });

  it('2. POST with uurtarief: 75 → stores 75', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ naam: 'Premium', uurtarief: 75 })
      .expect(201);

    assert.equal(res.body.uurtarief, 75);
  });

  it('3. POST with uurtarief: 0 → succeeds (pro bono)', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ naam: 'ProBono', uurtarief: 0 })
      .expect(201);

    assert.equal(res.body.uurtarief, 0);
  });

  it('4. POST with uurtarief: -10 → rejected (400)', async () => {
    await request(app)
      .post('/api/clients')
      .send({ naam: 'Bad', uurtarief: -10 })
      .expect(400);
  });

  it('5. POST with uurtarief: "abc" → rejected (400)', async () => {
    await request(app)
      .post('/api/clients')
      .send({ naam: 'Bad', uurtarief: 'abc' })
      .expect(400);
  });

  it('6. GET /api/clients → includes uurtarief as number', async () => {
    await request(app).post('/api/clients').send({ naam: 'A', uurtarief: 50 });
    await request(app).post('/api/clients').send({ naam: 'B' });

    const res = await request(app).get('/api/clients').expect(200);

    assert.ok(Array.isArray(res.body));
    for (const client of res.body) {
      assert.equal(typeof client.uurtarief, 'number');
    }
    const clientA = res.body.find(c => c.naam === 'A');
    const clientB = res.body.find(c => c.naam === 'B');
    assert.equal(clientA.uurtarief, 50);
    assert.equal(clientB.uurtarief, 35);
  });

  it('7. GET /api/clients/hierarchy → includes uurtarief per client', async () => {
    await request(app).post('/api/clients').send({ naam: 'Hierarchie', uurtarief: 60 });

    const res = await request(app)
      .get('/api/clients/hierarchy?maand=2026-01')
      .expect(200);

    assert.ok(res.body.hierarchy.length > 0);
    const client = res.body.hierarchy.find(c => c.naam === 'Hierarchie');
    assert.equal(client.uurtarief, 60);
  });

  it('8. PUT with uurtarief: 50 → rate updated', async () => {
    const create = await request(app).post('/api/clients').send({ naam: 'Update' });
    const id = create.body.id;

    const res = await request(app)
      .put(`/api/clients/${id}`)
      .send({ uurtarief: 50 })
      .expect(200);

    assert.equal(res.body.uurtarief, 50);
  });

  it('9. PUT without uurtarief → rate unchanged', async () => {
    const create = await request(app).post('/api/clients').send({ naam: 'Keep', uurtarief: 42 });
    const id = create.body.id;

    const res = await request(app)
      .put(`/api/clients/${id}`)
      .send({ naam: 'KeepRenamed' })
      .expect(200);

    assert.equal(res.body.uurtarief, 42);
    assert.equal(res.body.naam, 'KeepRenamed');
  });

  it('10. PUT with naam only → rate unchanged, name updated', async () => {
    const create = await request(app).post('/api/clients').send({ naam: 'Old', uurtarief: 99 });
    const id = create.body.id;

    const res = await request(app)
      .put(`/api/clients/${id}`)
      .send({ naam: 'New' })
      .expect(200);

    assert.equal(res.body.naam, 'New');
    assert.equal(res.body.uurtarief, 99);
  });
});
