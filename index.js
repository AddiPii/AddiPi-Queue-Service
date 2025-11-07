const { ServiceBusClient } = require("@azure/service-bus");
const { CosmosClient } = require("@azure/cosmos");


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