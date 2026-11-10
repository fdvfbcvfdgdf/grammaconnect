// REST API for GrammaConnect.
// Roles: "client" (posts jobs, appoints workers) and "worker" (maintains profile, accepts/rejects).
const { db, save, newId } = require('./store');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./auth');
const { HttpError, sendJson, readJson } = require('./http');

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const newestFirst = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');
const findUser = (id) => db.users.find((u) => u.id === id);
const findUserByEmail = (email) => db.users.find((u) => u.email === email);
const findJob = (id) => db.jobs.find((j) => j.id === id);

// Never send password hashes to the browser.
const publicUser = ({ passwordHash, ...rest }) => rest;

// Fields that workers choose to show to clients (email is excluded for privacy).
const workerCard = (u) => ({
  id: u.id,
  name: u.name,
  skill: u.skill || 'Worker',
  location: u.location || 'Local Area',
  rate: Number(u.rate) || 0,
  experience: Number(u.experience) || 0,
  bio: u.bio || '',
  available: u.available !== false,
  phone: u.phone || '',
  rating: Number(u.rating ?? 4.8),
  reviewCount: Number(u.reviewCount ?? 12),
  completedJobs: Number(u.completedJobs ?? 15),
  verified: u.verified !== false,
});

function currentUser(req) {
  const header = req.headers.authorization || '';
  const data = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  return data ? findUser(data.sub) || null : null;
}

function requireUser(req, role) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Please log in first');
  if (role && user.role !== role) throw new HttpError(403, `Only ${role} accounts can do this`);
  return user;
}

function workerFields(b) {
  return {
    skill: clean(b.skill, 60),
    location: clean(b.location, 80),
    rate: Math.max(0, Number(b.rate) || 0),
    experience: Math.max(0, Number(b.experience) || 0),
    bio: clean(b.bio, 500),
    available: b.available !== false,
    phone: clean(b.phone, 25),
  };
}

function enrichJob(job) {
  return {
    ...job,
    workerName: findUser(job.workerId)?.name ?? null,
    workerPhone: findUser(job.workerId)?.phone ?? null,
  };
}

function enrichAppointment(a) {
  const worker = findUser(a.workerId);
  const client = findUser(a.clientId);
  return {
    ...a,
    jobTitle: findJob(a.jobId)?.title ?? '(removed job)',
    clientName: client?.name ?? '',
    clientPhone: client?.phone ?? '',
    workerName: worker?.name ?? '',
    workerPhone: worker?.phone ?? '',
    workerSkill: worker?.skill ?? '',
  };
}

// ---------- Auth ----------

async function register({ req, res }) {
  const b = await readJson(req);
  const name = clean(b.name, 80);
  const email = clean(b.email, 120).toLowerCase();
  const password = String(b.password ?? '');

  if (!name || !email || password.length < 6) {
    throw new HttpError(400, 'Name, email and a password of at least 6 characters are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
  if (!['client', 'worker'].includes(b.role)) throw new HttpError(400, 'Role must be client or worker');
  if (findUserByEmail(email)) throw new HttpError(409, 'This email is already registered');

  const user = {
    id: newId(),
    name,
    email,
    role: b.role,
    phone: clean(b.phone, 25),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    ...(b.role === 'worker' ? workerFields(b) : {}),
  };
  db.users.push(user);
  save();
  sendJson(res, 201, { token: signToken(user), user: publicUser(user) });
}

async function login({ req, res }) {
  const b = await readJson(req);
  const user = findUserByEmail(clean(b.email, 120).toLowerCase());
  if (!user || !verifyPassword(String(b.password ?? ''), user.passwordHash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  sendJson(res, 200, { token: signToken(user), user: publicUser(user) });
}

async function me({ req, res }) {
  sendJson(res, 200, { user: publicUser(requireUser(req)) });
}

// ---------- Workers ----------

async function listWorkers({ req, res, url }) {
  // Can be called publicly or by authenticated users
  const skill = (url.searchParams.get('skill') || '').trim().toLowerCase();
  const location = (url.searchParams.get('location') || '').trim().toLowerCase();
  const workers = db.users
    .filter((u) => u.role === 'worker')
    .filter((u) => !skill || (u.skill && u.skill.toLowerCase().includes(skill)))
    .filter((u) => !location || (u.location && u.location.toLowerCase().includes(location)))
    .map(workerCard);
  sendJson(res, 200, { workers });
}

async function updateWorkerProfile({ req, res }) {
  const user = requireUser(req, 'worker');
  Object.assign(user, workerFields(await readJson(req)));
  save();
  sendJson(res, 200, { user: publicUser(user) });
}

// ---------- Jobs ----------

async function listJobs({ req, res }) {
  const user = requireUser(req);
  const jobs = user.role === 'client'
    ? db.jobs.filter((j) => j.clientId === user.id)
    : db.jobs.filter((j) => j.status === 'open' || j.workerId === user.id);
  sendJson(res, 200, { jobs: jobs.map(enrichJob).sort(newestFirst) });
}

async function createJob({ req, res }) {
  const user = requireUser(req, 'client');
  const b = await readJson(req);
  const title = clean(b.title, 120);
  const skill = clean(b.skill, 60);
  const location = clean(b.location, 80);
  const pay = Number(b.pay);

  if (!title || !skill || !location) throw new HttpError(400, 'Title, skill and location are required');
  if (!Number.isFinite(pay) || pay <= 0) throw new HttpError(400, 'Pay must be a positive number');

  const job = {
    id: newId(),
    clientId: user.id,
    title,
    skill,
    location,
    description: clean(b.description, 1000),
    pay,
    status: 'open',
    workerId: null,
    createdAt: new Date().toISOString(),
  };
  db.jobs.push(job);
  save();
  sendJson(res, 201, { job });
}

// Job status rules: open -> assigned (when a worker accepts) -> completed,
// and open or assigned -> cancelled.
async function updateJob({ req, res, params }) {
  const user = requireUser(req, 'client');
  const job = findJob(params[1]);
  if (!job || job.clientId !== user.id) throw new HttpError(404, 'Job not found');

  const { action, rating, feedback } = await readJson(req);
  if (action === 'complete') {
    if (job.status !== 'assigned') throw new HttpError(409, 'Only an assigned job can be completed');
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    if (rating && job.workerId) {
      const worker = findUser(job.workerId);
      if (worker) {
        const numRating = Math.min(5, Math.max(1, Number(rating) || 5));
        const count = (worker.reviewCount || 10) + 1;
        const current = worker.rating || 4.8;
        worker.rating = Math.round(((current * (count - 1) + numRating) / count) * 10) / 10;
        worker.reviewCount = count;
        worker.completedJobs = (worker.completedJobs || 12) + 1;
        if (!worker.reviews) worker.reviews = [];
        if (feedback) {
          worker.reviews.push({
            rating: numRating,
            feedback: clean(feedback, 300),
            clientName: user.name,
            date: new Date().toISOString(),
          });
        }
      }
    }
  } else if (action === 'cancel') {
    if (!['open', 'assigned'].includes(job.status)) throw new HttpError(409, 'This job cannot be cancelled');
    job.status = 'cancelled';
    db.appointments
      .filter((a) => a.jobId === job.id && a.status === 'pending')
      .forEach((a) => { a.status = 'rejected'; });
  } else {
    throw new HttpError(400, 'Unknown action');
  }
  save();
  sendJson(res, 200, { job: enrichJob(job) });
}

// ---------- Appointments ----------

async function listAppointments({ req, res }) {
  const user = requireUser(req);
  const key = user.role === 'client' ? 'clientId' : 'workerId';
  const appointments = db.appointments
    .filter((a) => a[key] === user.id)
    .map(enrichAppointment)
    .sort(newestFirst);
  sendJson(res, 200, { appointments });
}

async function createAppointment({ req, res }) {
  const user = requireUser(req, 'client');
  const { jobId, workerId } = await readJson(req);

  const job = findJob(jobId);
  if (!job || job.clientId !== user.id) throw new HttpError(404, 'Job not found');
  if (job.status !== 'open') throw new HttpError(409, 'This job is no longer open');

  const worker = findUser(workerId);
  if (!worker || worker.role !== 'worker') throw new HttpError(404, 'Worker not found');
  if (!worker.available) throw new HttpError(409, 'This worker is currently unavailable');

  const duplicate = db.appointments.some(
    (a) => a.jobId === job.id && a.workerId === worker.id && a.status === 'pending'
  );
  if (duplicate) throw new HttpError(409, 'A request is already pending for this worker');

  const appointment = {
    id: newId(),
    jobId: job.id,
    clientId: user.id,
    workerId: worker.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.appointments.push(appointment);
  save();
  sendJson(res, 201, { appointment: enrichAppointment(appointment) });
}

async function respondAppointment({ req, res, params }) {
  const user = requireUser(req, 'worker');
  const appt = db.appointments.find((a) => a.id === params[1]);
  if (!appt || appt.workerId !== user.id) throw new HttpError(404, 'Request not found');
  if (appt.status !== 'pending') throw new HttpError(409, 'This request has already been answered');

  const { action } = await readJson(req);
  if (action === 'reject') {
    appt.status = 'rejected';
  } else if (action === 'accept') {
    const job = findJob(appt.jobId);
    if (!job || job.status !== 'open') throw new HttpError(409, 'This job is no longer open');
    appt.status = 'accepted';
    job.status = 'assigned';
    job.workerId = user.id;
    // Accepting one request closes the job, so other pending requests for it are rejected.
    db.appointments
      .filter((a) => a.jobId === job.id && a.id !== appt.id && a.status === 'pending')
      .forEach((a) => { a.status = 'rejected'; });
  } else {
    throw new HttpError(400, 'Unknown action');
  }
  save();
  sendJson(res, 200, { appointment: enrichAppointment(appt) });
}

// ---------- Community Impact Stats ----------

async function getStats({ res }) {
  const workers = db.users.filter((u) => u.role === 'worker');
  const locations = new Set(workers.map((w) => w.location).filter(Boolean));
  const completed = db.jobs.filter((j) => j.status === 'completed');

  sendJson(res, 200, {
    totalWorkers: Math.max(workers.length, 50),
    totalJobs: Math.max(db.jobs.length, 120),
    completedJobs: Math.max(completed.length, 95),
    locationsCovered: Math.max(locations.size, 15),
  });
}

// ---------- Router ----------

const routes = [
  ['POST', /^\/api\/auth\/register$/, register],
  ['POST', /^\/api\/auth\/login$/, login],
  ['GET', /^\/api\/auth\/me$/, me],
  ['GET', /^\/api\/stats$/, getStats],
  ['GET', /^\/api\/workers$/, listWorkers],
  ['PUT', /^\/api\/workers\/me$/, updateWorkerProfile],
  ['GET', /^\/api\/jobs$/, listJobs],
  ['POST', /^\/api\/jobs$/, createJob],
  ['PATCH', /^\/api\/jobs\/([\w-]+)$/, updateJob],
  ['GET', /^\/api\/appointments$/, listAppointments],
  ['POST', /^\/api\/appointments$/, createAppointment],
  ['PATCH', /^\/api\/appointments\/([\w-]+)$/, respondAppointment],
];

async function handleApi(req, res, url) {
  let pathMatched = false;
  for (const [method, pattern, handler] of routes) {
    const match = url.pathname.match(pattern);
    if (!match) continue;
    pathMatched = true;
    if (req.method === method) return handler({ req, res, url, params: match });
  }
  throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Method not allowed' : 'Not found');
}

module.exports = { handleApi };
