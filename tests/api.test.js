// End-to-end API tests. Run with: npm test
// Uses a temporary data folder so the real data/db.json is never touched.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.GRAMMA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-test-'));
const server = require('../server');

let base;
server.listen(0);
after(() => server.close());

const started = new Promise((resolve) => server.once('listening', resolve));

async function call(method, route, { body, token } = {}) {
  await started;
  if (!base) base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}

test('registration validates input and returns a token', async () => {
  const bad = await call('POST', '/api/auth/register', { body: { name: 'X', email: 'nope', password: '123', role: 'client' } });
  assert.equal(bad.status, 400);

  const ok = await call('POST', '/api/auth/register', {
    body: { name: 'Ravi Client', email: 'client@test.com', password: 'secret1', role: 'client' },
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.data.token);
  assert.equal(ok.data.user.passwordHash, undefined, 'password hash must never be returned');

  const dup = await call('POST', '/api/auth/register', {
    body: { name: 'Again', email: 'client@test.com', password: 'secret1', role: 'client' },
  });
  assert.equal(dup.status, 409);
});

test('login rejects a wrong password and accepts the right one', async () => {
  const wrong = await call('POST', '/api/auth/login', { body: { email: 'client@test.com', password: 'bad-pass' } });
  assert.equal(wrong.status, 401);
  const right = await call('POST', '/api/auth/login', { body: { email: 'client@test.com', password: 'secret1' } });
  assert.equal(right.status, 200);
});

test('protected routes need a valid token', async () => {
  const anon = await call('GET', '/api/jobs');
  assert.equal(anon.status, 401);
  const fake = await call('GET', '/api/jobs', { token: 'abc.def' });
  assert.equal(fake.status, 401);
});

test('full workflow: post job, find worker, appoint, accept, complete', async () => {
  const client = (await call('POST', '/api/auth/register', {
    body: { name: 'Client Two', email: 'c2@test.com', password: 'secret1', role: 'client' },
  })).data;
  const worker = (await call('POST', '/api/auth/register', {
    body: { name: 'Suresh Electric', email: 'w1@test.com', password: 'secret1', role: 'worker',
      skill: 'Electrician', location: 'Gudlavalleru', rate: 800, experience: 5, bio: 'Wiring and repairs' },
  })).data;
  const worker2 = (await call('POST', '/api/auth/register', {
    body: { name: 'Ajay Plumber', email: 'w2@test.com', password: 'secret1', role: 'worker',
      skill: 'Plumber', location: 'Vijayawada', rate: 600, experience: 3 },
  })).data;

  // Client posts a job
  const job = await call('POST', '/api/jobs', {
    token: client.token,
    body: { title: 'Fix fuse box', skill: 'Electrician', location: 'Gudlavalleru', pay: 1500, description: 'Replace fuses' },
  });
  assert.equal(job.status, 201);
  assert.equal(job.data.job.status, 'open');

  // Search filters workers by skill
  const search = await call('GET', '/api/workers?skill=electric', { token: client.token });
  assert.equal(search.data.workers.length, 1);
  assert.equal(search.data.workers[0].name, 'Suresh Electric');
  assert.equal(search.data.workers[0].email, undefined, 'worker cards must not expose email');

  // Client appoints the worker
  const appt = await call('POST', '/api/appointments', {
    token: client.token, body: { jobId: job.data.job.id, workerId: worker.user.id },
  });
  assert.equal(appt.status, 201);
  assert.equal(appt.data.appointment.status, 'pending');

  // A second request to the same worker for the same job is refused
  const dupAppt = await call('POST', '/api/appointments', {
    token: client.token, body: { jobId: job.data.job.id, workerId: worker.user.id },
  });
  assert.equal(dupAppt.status, 409);

  // Second worker also gets a request, which will be auto-rejected when the first accepts
  const appt2 = await call('POST', '/api/appointments', {
    token: client.token, body: { jobId: job.data.job.id, workerId: worker2.user.id },
  });
  assert.equal(appt2.status, 201);

  // Clients cannot answer requests
  const clientAnswers = await call('PATCH', `/api/appointments/${appt.data.appointment.id}`, {
    token: client.token, body: { action: 'accept' },
  });
  assert.equal(clientAnswers.status, 403);

  // Worker accepts
  const accepted = await call('PATCH', `/api/appointments/${appt.data.appointment.id}`, {
    token: worker.token, body: { action: 'accept' },
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.appointment.status, 'accepted');

  // Job is now assigned to that worker
  const jobs = await call('GET', '/api/jobs', { token: client.token });
  const assigned = jobs.data.jobs.find((j) => j.id === job.data.job.id);
  assert.equal(assigned.status, 'assigned');
  assert.equal(assigned.workerName, 'Suresh Electric');

  // The other worker's request was rejected automatically
  const w2 = await call('GET', '/api/appointments', { token: worker2.token });
  assert.equal(w2.data.appointments[0].status, 'rejected');

  // Client marks the job completed
  const done = await call('PATCH', `/api/jobs/${job.data.job.id}`, { token: client.token, body: { action: 'complete' } });
  assert.equal(done.status, 200);
  assert.equal(done.data.job.status, 'completed');
});

test('workers can update their profile and set themselves unavailable', async () => {
  const w = await call('POST', '/api/auth/register', {
    body: { name: 'Mohan Carpenter', email: 'w3@test.com', password: 'secret1', role: 'worker', skill: 'Carpenter', location: 'Machilipatnam' },
  });
  const updated = await call('PUT', '/api/workers/me', {
    token: w.data.token,
    body: { skill: 'Carpenter', location: 'Machilipatnam', rate: 900, experience: 8, bio: 'Furniture', available: false },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.user.available, false);

  const client = await call('POST', '/api/auth/register', {
    body: { name: 'Client Three', email: 'c3@test.com', password: 'secret1', role: 'client' },
  });
  const job = await call('POST', '/api/jobs', {
    token: client.data.token, body: { title: 'Door repair', skill: 'Carpenter', location: 'Machilipatnam', pay: 700 },
  });
  const blocked = await call('POST', '/api/appointments', {
    token: client.data.token, body: { jobId: job.data.job.id, workerId: w.data.user.id },
  });
  assert.equal(blocked.status, 409, 'unavailable workers cannot be appointed');
});

test('unknown routes return 404 and bad JSON returns 400', async () => {
  const missing = await call('GET', '/api/nothing-here');
  assert.equal(missing.status, 404);
  const wrongMethod = await call('DELETE', '/api/jobs');
  assert.equal(wrongMethod.status, 405);

  await started;
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json',
  });
  assert.equal(res.status, 400);
});
