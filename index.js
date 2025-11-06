const { ServiceBusClient } = require("@azure/service-bus");
const { CosmosClient } = require("@azure/cosmos");


const SERVICE_BUS_CONN = process.env.SERVICE_BUS_CONN;
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;

const sbClient = new ServiceBusClient(SERVICE_BUS_CONN);
const receiver = sbClient.createReceiver('print-queue');

const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const container = cosmosClient.database('addipi').container('jobs');


console.log('Queue Service STARTED - listening for file uploading...');