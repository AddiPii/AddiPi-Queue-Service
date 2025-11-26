const { ServiceBusClient, ServiceBusAdministrationClient } = require("@azure/service-bus");
const { CosmosClient } = require("@azure/cosmos");
const express = require('express');

const app = express();

const SERVICE_BUS_CONN = process.env.SERVICE_BUS_CONN;
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;

const missing = [];
if (!SERVICE_BUS_CONN) missing.push('SERVICE_BUS_CONN');
if (!COSMOS_ENDPOINT) missing.push('COSMOS_ENDPOINT');
if (!COSMOS_KEY) missing.push('COSMOS_KEY');

if (missing.length) {
	console.error('Missing required environment variables:', missing.join(', '));
	console.error('Please set these before starting the service. Example (PowerShell):');
	console.error('$env:SERVICE_BUS_CONN = "Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."');
	console.error('$env:COSMOS_ENDPOINT = "https://<account>.documents.azure.com:443/"');
	console.error('$env:COSMOS_KEY = "<primary-key>"');
	process.exit(1);
}

let sbClient; // Service Bus client
let receiver;
let cosmosClient;
let container;
let adminClient;
// let queuesCache = { ts: 0, data: null };
// const CACHE_TTL_MS = 30_000; // 30 seconds


try{
	adminClient = new ServiceBusAdministrationClient(SERVICE_BUS_CONN);
}catch (err){
	console.warn('Admin client init failed:', err && err.message ? err.message : err);
}
try {
	sbClient = new ServiceBusClient(SERVICE_BUS_CONN);
	receiver = sbClient.createReceiver('print-queue');
} catch (err) {
	console.error('Failed to create Service Bus client:', err && err.message ? err.message : err);
	process.exit(1);
}

try {
	cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
	container = cosmosClient.database('addipi').container('jobs');
} catch (err) {
	console.error('Failed to create Cosmos DB client:', err && err.message ? err.message : err);
	process.exit(1);
}

console.log('Queue Service STARTED - listening for file uploading...');


async function main(){
	const messageHandler = async (message) => {
		const data = message.body;
		console.log('Received EVENT:', data);

		let job

		if (data.event === 'file_uploaded'){
			job = {
				id: Date.now().toString(),
				fileId: data.fileId,
				originalFileName: data.originalFileName,
				status: data.scheduledAt ? 'scheduled' : 'pending',
				scheduledAt: data.scheduledAt || null,
				createdAt: new Date().toISOString(),
			}
		}

		await container.items.upsert(job);
		console.log(`JOB ${job.status.toUpperCase()}: ${job.id} -> ${job.scheduledAt || 'NOW'}`);
		
		//checkPrinterandStartJob()     TODO (printerservice?)
	};

	const errorHandler = (error) => {
		console.error('EVENT ERROR:', error);
	};
	receiver.subscribe({
		processMessage: messageHandler,
		processError: errorHandler
	});
}

main().catch(console.error);

const PORT = process.env.PORT || 4000;

// Express routes (replaces the old http.createServer)

app.get('/queue', async (req, res) => {
	const info = {
		serviceBus: { connected: !!sbClient },
		receiver: receiver ? 'print-queue' : null,
		recentJobs: []
	};

	if (container) {
		try {
			const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 1000);
			const continuationToken = req.query.continuationToken || null;
			const sortField = (req.query.sort === 'scheludedAt') ? 'c.scheludedAt' : 'c.createdAt';
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
				const sql = `SELECT id, fileId, scheludedAt, createdAt FROM c ORDER BY ${sortField} ${order}`;
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
				return res.json(resultInfo);
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
});

app.get('/queue/next', async (req, res) => {
	if (!container) return res.status(503).json({ error: 'Cosmos container not initialized' });
	try {
		const now = new Date().toISOString();
		const query = {
			query: `SELECT TOP 1 * FROM  c WHERE c.status='pending' OR (c.status='scheluded' AND c.scheludedAt <=@now) ORDER BY ASC`,
			parameters: [{ name: '@now', value: now }]
		};
		const result = await container.items.query(query).fetchAll();
		const job = (result.resources && result.resources.length) ? result.resources[0] : null;
		if (!job) return res.status(204).end();
		return res.json({ job });
	} catch (err) {
		return res.status(500).json({ error: err && err.message ? err.message : String(err) });
	}
});

app.post('/queue/:id/cancel', async (req, res) => {
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
		job.status = 'cancelled';
		const up = await container.items.upsert(job);
		return res.json({ ok: true, job: up });
	} catch (err) {
		return res.status(500).json({ error: err && err.message ? err.message : String(err) });
	}
});

app.get(['/queues', '/queues/:count'], async (req, res) => {
	let count = 1;
	if (req.query.count) count = parseInt(req.query.count, 10) || 1;
	else if (req.params.count) count = parseInt(req.params.count, 10) || 1;

	const MAX = 100;
	if (count < 1) count = 1;
	if (count > MAX) count = MAX;

	if (!adminClient) return res.status(503).json({ error: 'ServiceBusAdministrationClient not initialized. Ensure SERVICE_BUS_CONN has management permissions.' });

	const realQueues = [];
	try {
		for await (const q of adminClient.listQueues()) {
			if (realQueues.length >= count) break;
			try {
				const runtime = await adminClient.getQueueRuntimeProperties(q.name);
				realQueues.push({
					name: q.name,
					activeMessageCount: runtime.activeMessageCount || 0,
					deadLetterMessageCount: runtime.deadLetterMessageCount || 0,
					createdOn: runtime.createdOn,
					updatedOn: runtime.updatedOn
				});
			} catch (innerErr) {
				realQueues.push({ name: q.name, error: innerErr && innerErr.message ? innerErr.message : String(innerErr) });
			}
		}
		return res.json({ count: realQueues.length, queues: realQueues });
	} catch (err) {
		return res.status(500).json({ error: err && err.message ? err.message : String(err) });
	}
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).type('text').send('Not found'));


app.listen(PORT, ()=>{
	console.log(`HTTP server listening on port ${PORT}`)
})