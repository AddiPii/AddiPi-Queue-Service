import { ServiceBusClient } from "@azure/service-bus";

export default function initServiceBus(SERVICE_BUS_CONN){
    let sbClient; 
    let receiver;

    try {
        sbClient = new ServiceBusClient(SERVICE_BUS_CONN);
        receiver = sbClient.createReceiver('print-queue');
    } catch (err) {
        console.error('Failed to create Service Bus client:', err && err.message ? err.message : err);
        process.exit(1);
    }

    const serviceBus = {
        sbClient: sbClient,
        receiver: receiver
    }

    return serviceBus
}