const getRequired = (name) => {
  const v = process.env[name];

  if (!v) {
    console.error('Missing required environment variables:', name);
    console.error('Please set these before starting the service. Example (PowerShell):');
    console.error('$env:SERVICE_BUS_CONN = "Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."');
    console.error('$env:COSMOS_ENDPOINT = "https://<account>.documents.azure.com:443/"');
    console.error('$env:COSMOS_KEY = "<primary-key>"');

    throw new Error(`Missing env var: ${name}`);
  } 

  return v;
};

export const CONFIG = {
  SERVICE_BUS_CONN: getRequired('SERVICE_BUS_CONN'),
  COSMOS_ENDPOINT: getRequired('COSMOS_ENDPOINT'),
  COSMOS_KEY: getRequired('COSMOS_KEY'),
  PORT: Number(process.env.QUEUE_PORT || 3070),
};