import { sbClient, receiver, adminClient, container } from "../services/clients.js";

const canManageJob = (job, user) => {
	if (!job || !user) return false;

	const requesterId = user.userId || user.id;
	return user.role === 'admin' || (Boolean(requesterId) && job.userId === requesterId);
}


export const getQueue = async (req, res) => {
	const info = {
		serviceBus: { connected: !!sbClient },
		receiver: receiver ? 'print-queue' : null,
		recentJobs: []
	};

	if (container) {
		try {
			const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 1000);
			const continuationToken = req.query.continuationToken || null;
			const sortField = (req.query.sort === 'scheduledAt') ? 'c.scheduledAt' : 'c.createdAt';
			const order = (req.query.order === 'asc') ? 'ASC' : 'DESC';

			const resultInfo = {
				serviceBus: { connected: !!sbClient },
				receiver: receiver ? 'print-queue' : null,
				jobs: [],
				continuationToken: null,
			};

			if (!container) {
				return res.status(503).json({ error: 'Cosmos container not initialized' });
			}

			try {
				const sql = `SELECT c.id, c.fileId, c.originalFileName, c.status, c.scheduledAt, c.createdAt FROM c ORDER BY ${sortField} ${order}`;
				const iterator = container.items.query({ query: sql }, { maxItemCount: limit, continuationToken: continuationToken });
				const page = await iterator.fetchNext();
				const resources = (page && page.resources) ? page.resources : [];

				let cont = null;
				if (page && page.headers) {
					cont = page.headers['x-ms-continuation'] || page.headers['x-ms-continuationtoken'] || page.headers['x-ms-continuation-token'] || page.headers['continuationtoken'] || page.headers['continuation-token'] || null;
				}
				resultInfo.jobs = resources;
				resultInfo.count = resources.length;
				resultInfo.continuationToken = cont || null;
				return res.json(resultInfo.jobs);
			} catch (err) {
				return res.status(500).json({ error: err && err.message ? err.message : String(err) });
			}
		} catch (err) {
			info.recentJobsError = err && err.message ? err.message : String(err);
		}
	} else {
		info.recentJobsError = 'Cosmos container not initialized';
	}

	return res.json(info);
}

export const getNextJob = async (req, res) => {
	if (!container) return res.status(503).json({ error: 'Cosmos container not initialized' });
	try {
		const now = new Date().toISOString();
		const query = {
			query: `SELECT TOP 1 * FROM c WHERE c.status='pending' OR (c.status='scheduled' AND c.scheduledAt <= @now) ORDER BY c.scheduledAt ASC`,
			parameters: [{ name: '@now', value: now }]
		};
		const result = await container.items.query(query).fetchAll();
		const job = (result.resources && result.resources.length) ? result.resources[0] : null;
		if (!job) return res.status(204).end();
		return res.json({ job });
	} catch (err) {
		return res.status(500).json({ error: err && err.message ? err.message : String(err) });
	}
}

export const cancelJobById = async (req, res) => {
	if (!container) return res.status(503).json({ error: 'Cosmos container not initialized' });
	try {
		const id = decodeURIComponent(req.params.id || '');
		if (!id) return res.status(400).json({ error: 'Invalid job id' });

		const query = {
			query: 'SELECT * FROM c WHERE c.id = @id',
			parameters: [{ name: '@id', value: id }]
		};

		const found = await container.items.query(query).fetchAll();
		if (!found.resources || found.resources.length === 0) return res.status(404).json({ error: 'Job not found' });

		const job = found.resources[0];
		if (!canManageJob(job, req.user)) {
			return res.status(403).json({ error: 'Only job owner or admin can cancel this job' });
		}
		job.status = 'cancelled';
		const up = await container.items.upsert(job);
		
		const saved = up && up.resource ? up.resource : job;
		return res.json({ ok: true, job: saved });
	} catch (err) {
		console.log(err)
		return res.status(500).json({ error: err && err.message ? err.message : String(err) });
	}
}