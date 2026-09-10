require('dotenv').config();

const http = require('http');
const { URL } = require('url');
const { ObjectId } = require('mongodb');
const { connectDB, getDB, closeDB } = require('./db');
const {
    sendJson,
    readJson,
    hashToken,
    verifyPassword
} = require('./utils');
const {
    createSession,
    sessionCookie,
    clearSessionCookie,
    getAuthenticatedUser,
    requireRole
} = require('./auth');

const PORT = Number(process.env.PORT || 3000);
const allowedOrigins = new Set(
    String(process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
);

function applyCors(req, res) {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
}

function isValidObjectId(value) {
    return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

async function login(req, res) {
    const { email, password } = await readJson(req);
    if (!email || !password) {
        return sendJson(res, 400, { error: 'email and password are required' });
    }

    const db = getDB();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: 'Invalid credentials' });
    }

    const { rawToken, expiresAt } = await createSession(user);
    return sendJson(
        res,
        200,
        { message: 'Login successful', user: { id: user._id, name: user.name, role: user.role } },
        { 'Set-Cookie': sessionCookie(rawToken, expiresAt) }
    );
}

async function logout(req, res, user) {
    if (user?.sessionTokenHash) {
        await getDB().collection('sessions').deleteOne({ tokenHash: user.sessionTokenHash });
    }
    return sendJson(res, 200, { message: 'Logged out' }, { 'Set-Cookie': clearSessionCookie() });
}

async function registerAppointment(req, res, user) {
    if (!requireRole(user, ['patient'])) {
        return sendJson(res, 403, { error: 'Only patients can register appointments' });
    }

    const { doctorId, appointmentAt, reason } = await readJson(req);
    if (!doctorId || !appointmentAt || !reason) {
        return sendJson(res, 400, { error: 'doctorId, appointmentAt and reason are required' });
    }
    if (!isValidObjectId(doctorId)) {
        return sendJson(res, 400, { error: 'Invalid doctorId' });
    }

    const appointmentDate = new Date(appointmentAt);
    if (Number.isNaN(appointmentDate.getTime())) {
        return sendJson(res, 400, { error: 'appointmentAt must be a valid ISO date/time' });
    }

    const db = getDB();
    const doctor = await db.collection('users').findOne({ _id: new ObjectId(doctorId), role: 'doctor' });
    if (!doctor) return sendJson(res, 404, { error: 'Doctor not found' });

    const overlapping = await db.collection('appointments').findOne({
        doctorId: doctor._id,
        appointmentAt: appointmentDate,
        status: { $in: ['scheduled', 'confirmed'] }
    });
    if (overlapping) {
        return sendJson(res, 409, { error: 'Doctor already has an appointment at that time' });
    }

    const appointment = {
        patientId: user._id,
        doctorId: doctor._id,
        appointmentAt: appointmentDate,
        reason,
        status: 'scheduled',
        consultationFee: Number(doctor.consultationFee || 0),
        createdAt: new Date()
    };

    const result = await db.collection('appointments').insertOne(appointment);
    return sendJson(res, 201, {
        message: 'Appointment registered',
        appointmentId: result.insertedId,
        appointment: { ...appointment, doctorName: doctor.name }
    });
}

async function listMyAppointments(req, res, user) {
    if (!requireRole(user, ['patient', 'doctor'])) {
        return sendJson(res, 403, { error: 'Patients and doctors only' });
    }

    const db = getDB();
    const match = user.role === 'patient' ? { patientId: user._id } : { doctorId: user._id };
    const appointments = await db.collection('appointments').aggregate([
        { $match: match },
        { $sort: { appointmentAt: -1 } },
        {
            $lookup: {
                from: 'users',
                localField: user.role === 'patient' ? 'doctorId' : 'patientId',
                foreignField: '_id',
                as: 'counterparty'
            }
        },
        { $unwind: { path: '$counterparty', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                patientId: 1,
                doctorId: 1,
                appointmentAt: 1,
                reason: 1,
                status: 1,
                consultationFee: 1,
                counterpartyName: '$counterparty.name'
            }
        }
    ]).toArray();

    return sendJson(res, 200, { appointments });
}

async function getPatientBill(req, res, user, patientId) {
    if (!requireRole(user, ['patient', 'doctor', 'pharmacist'])) {
        return sendJson(res, 403, { error: 'Not authorized' });
    }
    if (!isValidObjectId(patientId)) {
        return sendJson(res, 400, { error: 'Invalid patientId' });
    }

    const requestedPatientId = new ObjectId(patientId);
    if (user.role === 'patient' && !user._id.equals(requestedPatientId)) {
        return sendJson(res, 403, { error: 'Patients can view only their own bill' });
    }

    const db = getDB();
    const patient = await db.collection('users').findOne(
        { _id: requestedPatientId, role: 'patient' },
        { projection: { passwordHash: 0 } }
    );
    if (!patient) return sendJson(res, 404, { error: 'Patient not found' });

    // Core MongoDB aggregation: sum every line item across all bills for one patient.
    const result = await db.collection('bills').aggregate([
        { $match: { patientId: requestedPatientId } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$patientId',
                grossAmount: { $sum: '$items.amount' },
                totalPaid: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'paid'] }, '$items.amount', 0]
                    }
                },
                itemCount: { $sum: 1 },
                billIds: { $addToSet: '$_id' }
            }
        },
        {
            $addFields: {
                outstandingAmount: { $subtract: ['$grossAmount', '$totalPaid'] },
                billCount: { $size: '$billIds' }
            }
        },
        { $project: { billIds: 0 } }
    ]).toArray();

    const summary = result[0] || {
        _id: requestedPatientId,
        grossAmount: 0,
        totalPaid: 0,
        outstandingAmount: 0,
        itemCount: 0,
        billCount: 0
    };

    return sendJson(res, 200, {
        patient: { id: patient._id, name: patient.name, email: patient.email },
        billSummary: summary
    });
}

async function createBill(req, res, user) {
    if (!requireRole(user, ['doctor', 'pharmacist'])) {
        return sendJson(res, 403, { error: 'Only doctors and pharmacists can create bill entries' });
    }

    const { patientId, items, status = 'unpaid' } = await readJson(req);
    if (!isValidObjectId(patientId) || !Array.isArray(items) || items.length === 0) {
        return sendJson(res, 400, { error: 'Valid patientId and non-empty items[] are required' });
    }
    if (!['paid', 'unpaid'].includes(status)) {
        return sendJson(res, 400, { error: 'status must be paid or unpaid' });
    }

    const normalizedItems = items.map(item => ({
        description: String(item.description || '').trim(),
        amount: Number(item.amount)
    }));
    if (normalizedItems.some(item => !item.description || !Number.isFinite(item.amount) || item.amount < 0)) {
        return sendJson(res, 400, { error: 'Each item needs description and non-negative numeric amount' });
    }

    const db = getDB();
    const pid = new ObjectId(patientId);
    const patient = await db.collection('users').findOne({ _id: pid, role: 'patient' });
    if (!patient) return sendJson(res, 404, { error: 'Patient not found' });

    const bill = {
        patientId: pid,
        createdBy: user._id,
        createdByRole: user.role,
        items: normalizedItems,
        status,
        createdAt: new Date()
    };
    const result = await db.collection('bills').insertOne(bill);

    return sendJson(res, 201, { message: 'Bill entry created', billId: result.insertedId, bill });
}

async function route(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        if (origin && !allowedOrigins.has(origin)) {
            return sendJson(res, 403, { error: 'Origin not allowed by CORS policy' });
        }
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
        return sendJson(res, 200, { ok: true, service: 'healthcare-backend' });
    }

    if (req.method === 'POST' && url.pathname === '/auth/login') {
        return login(req, res);
    }

    const user = await getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: 'Authentication required' });

    if (req.method === 'POST' && url.pathname === '/auth/logout') {
        return logout(req, res, user);
    }

    if (req.method === 'GET' && url.pathname === '/auth/me') {
        return sendJson(res, 200, { user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    }

    if (req.method === 'POST' && url.pathname === '/appointments') {
        return registerAppointment(req, res, user);
    }

    if (req.method === 'GET' && url.pathname === '/appointments/me') {
        return listMyAppointments(req, res, user);
    }

    if (req.method === 'POST' && url.pathname === '/bills') {
        return createBill(req, res, user);
    }

    const billMatch = url.pathname.match(/^\/patients\/([a-fA-F0-9]{24})\/bill$/);
    if (req.method === 'GET' && billMatch) {
        return getPatientBill(req, res, user, billMatch[1]);
    }

    return sendJson(res, 404, { error: 'Route not found' });
}

async function start() {
    await connectDB();
    const server = http.createServer((req, res) => {
        route(req, res).catch(err => {
            console.error(err);
            if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
            else res.end();
        });
    });

    server.listen(PORT, () => {
        console.log(`Healthcare backend running on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
        server.close(async () => {
            await closeDB();
            process.exit(0);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

start().catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
});
