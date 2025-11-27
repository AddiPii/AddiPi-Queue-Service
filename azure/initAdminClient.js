import { ServiceBusAdministrationClient } from "@azure/service-bus";

export default function initAdminClient(SERVICE_BUS_CONN){
    let adminClient;

    try{
        adminClient = new ServiceBusAdministrationClient(SERVICE_BUS_CONN);
    }catch (err){
        console.warn('Admin client init failed:', err && err.message ? err.message : err);
    }

    return adminClient
}