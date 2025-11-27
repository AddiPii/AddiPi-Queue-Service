import initAdminClient from "../azure/initAdminClient.js";
import initCosmosContainer from "../azure/initCosmosContainer.js";
import initServiceBus from "../azure/initServiceBus.js";
import { CONFIG } from "../config.js";


export const { sbClient, receiver } = initServiceBus(CONFIG.SERVICE_BUS_CONN)
export const container = initCosmosContainer(CONFIG.COSMOS_ENDPOINT, CONFIG.COSMOS_KEY)
export const adminClient = initAdminClient(CONFIG.SERVICE_BUS_CONN);