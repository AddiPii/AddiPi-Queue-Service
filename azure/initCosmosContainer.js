import { CosmosClient } from "@azure/cosmos";

export default function initCosmosContainer(COSMOS_ENDPOINT, COSMOS_KEY){
    let cosmosClient
    let container

    try {
        cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
        container = cosmosClient.database('addipi').container('jobs');
    } catch (err) {
        console.error('Failed to create Cosmos DB client:', err && err.message ? err.message : err);
        process.exit(1);
    }

    return container
}
