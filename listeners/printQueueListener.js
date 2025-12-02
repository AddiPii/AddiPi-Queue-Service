import getLocalISO from "../helpers/getLocalISO.js";


export function startPrintQueueListener(container, receiver){
	if (!container) throw new Error('container is required for printQueueListener');
	if (!receiver) throw new Error('receiver is required for printQueueListener');

	const messageHandler = async (message) => {
		try{
			let data = message.body;
			if (typeof data === 'string') {
				try { data = JSON.parse(data); } catch(e) { console.warn('Invalid JSON body, abandoning message'); await receiver.abandonMessage(message); return; }
			}

			console.log('Received EVENT:', data);

			if (!data || data.event !== 'file_uploaded'){
				console.log('Ignored event or missing data');
				return;
			}

			const job = {
				id: Date.now().toString(),
				fileId: data.fileId,
				originalFileName: data.originalFileName || null,
				userId: data.userId,
				userEmail: data.userEmail,
				status: data.scheduledAt ? 'scheduled' : 'pending',
				scheduledAt: data.scheduledAt || null,
				createdAt: getLocalISO(),
			};

			try{
				await container.items.upsert(job);
				console.log(`JOB ${job.status.toUpperCase()}: ${job.id} -> ${job.scheduledAt || 'NOW'}`);
			}catch(upErr){
				console.error('Failed to upsert job to Cosmos:', upErr);
				throw upErr;
			}
		}catch(err){
			console.error('messageHandler error:', err);
			try{ await receiver.abandonMessage(message); }catch(e){ console.warn('Failed to abandon message:', e); }
		}
	};

	const errorHandler = (error) => {
		console.error('EVENT ERROR:', error);
	};

	receiver.subscribe({ 
        processMessage: messageHandler, 
        processError: errorHandler 
    });

	return async function stop(){
		try{ await receiver.close(); }catch(e){ console.warn('Error closing receiver:', e); }
	};
}