export const getQueuesByCount = async (req, res) => {
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
}

