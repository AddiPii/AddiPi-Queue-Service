// AddiPi Queue Service
import express from 'express';
import cors from 'cors';
import { adminClient, container, receiver, sbClient } from './services/clients.js';
import { startPrintQueueListener } from './listeners/printQueueListener.js';
import { queueRouter } from './routes/queueRouter.js';
import { queuesRouter } from './routes/queuesRouter.js';


const app = express();

app.use(express.json());

app.use(cors());

console.log('Queue Service STARTED - listening for file uploading...');


async function main(){
	const stopListener = startPrintQueueListener(container, receiver)

	process.on('SIGINT', async () => { await stopListener(); process.exit(0); });
	process.on('SIGTERM', async () => { await stopListener(); process.exit(0); });
}

main().catch(console.error);

const PORT = process.env.QUEUE_PORT || 4000;


app.use('/queue', queueRouter)

app.use('/queues', queuesRouter)

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).type('text').send('Not found'));


app.listen(PORT, ()=>{
	console.log(`HTTP server listening on port ${PORT}`)
})