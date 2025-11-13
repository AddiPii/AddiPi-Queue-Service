const { ServiceBusClient, ServiceBusAdministrationClient } = require("@azure/service-bus");
const { CosmosClient } = require("@azure/cosmos");
const http = require('http');


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
let queuesCache = { ts: 0, data: null };
const CACHE_TTL_MS = 30_000; // 30 seconds


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

		if (data.event === 'file_uploaded'){
			const job = {
				id: Date.now().toString(),
				fileId: data.fileId,
				status: data.scheduledAt ? 'scheduled' : 'pending',
				scheduledAt: data.scheduledAt || null,
				createdAt: new Date().toISOString(),
			}
		}

		await container.items.upsert(job);
		console.log(`JOB ${job.status.toUpperCase()}: ${job.id} -> ${job.scheduledAt || 'NOW'}`);
		
		//checkPrinterandStartJob()     TODO
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

function startHttpServer(){
	const server = http.createServer(async (request, response) => {
 		if (request.method === 'GET' && request.url === '/queue'){
 			const info = {
 				serviceBus: { connected: !!sbClient },
 				receiver: receiver ? 'print-queue' : null,
 				recentJobs: []
 			};

 			if (container){
 				try {
 					const query = { query: 'SELECT TOP 10 * FROM c ORDER BY c.createdAt DESC' };
 					const result = await container.items.query(query).fetchAll();
 					info.recentJobs = result.resources || [];
 				} catch (err) {
 					info.recentJobsError = err && err.message ? err.message : String(err);
 				}
 			} else {
 				info.recentJobsError = 'Cosmos container not initialized';
 			}

 			response.setHeader('Content-Type', 'application/json');
			response.end(JSON.stringify(info));
			return;
		}

		if (request.method === 'GET' && request.url.startsWith('/queues')){
			const u = new URL(request.url, `http://localhost`);
			let count = 1;
			if (u.searchParams.has('count')) {
				count = parseInt(u.searchParams.get('count'), 10) || 1;
			} else {
				const parts = u.pathname.split('/').filter(Boolean); // ['queues','13']
				if (parts.length >= 2) count = parseInt(parts[1], 10) || 1;
			}

			const MAX = 100;
			if (count < 1) count = 1;
			if (count > MAX) count = MAX;

			// Require adminClient: we no longer provide simulated queues
			if (!adminClient) {
				response.writeHead(503, { 'Content-Type': 'application/json' });
				response.end(JSON.stringify({ error: 'ServiceBusAdministrationClient not initialized. Ensure SERVICE_BUS_CONN has management permissions.' }));
				return;
			}

			// use admin client to list queues and fetch runtime properties
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
				response.setHeader('Content-Type', 'application/json');
				response.end(JSON.stringify({ count: realQueues.length, queues: realQueues }));
				return;
			} catch (err) {
				response.writeHead(500, { 'Content-Type': 'application/json' });
				response.end(JSON.stringify({ error: err && err.message ? err.message : String(err) }));
				return;
			}
		}
		}

 		if (request.method === 'GET' && request.url === '/health'){
 			response.writeHead(200, { 'Content-Type': 'application/json' });
 			response.end(JSON.stringify({ ok: true }));
 			return;
 		}

 		response.writeHead(404, { 'Content-Type': 'text/plain' });
 		response.end('Not found');
 	});

	server.listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));
}

startHttpServer();