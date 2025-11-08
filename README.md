# AddiPi-Queue-Service



## Wymagania

- Node.js
- Dostęp do konta Azure (Service Bus namespace z queue, CosmosDB).
- Docker (Konteneryzacja i push konteneru do Azure)
- Zainstalowane zależności:
    - "@azure/cosmos": "^4.7.0"
    - "@azure/service-bus": "^7.9.5"


## Zmienne środowiskowe

Serwis odczytuje następujące zmienne środowiskowe:
- `SERVICE_BUS_CONN` — connection string do Azure Service Bus (opcjonalne; jeśli brak, messaging jest wyłączony).
- `COSMOS_ENDPOINT` - endpoint do bazy danych CosmosDB.
- `COSMOS_KEY` - klucz dostępu do bazy danych CosmosDB.

Przykład pliku `.env` (nie commituj prawdziwych kluczy):

```
SERVICE_BUS_CONN=Endpoint=sb://addipisb.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...
COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
COSMOS_KEY=your-cosmos-key
```

Upewnij się, że nie ma spacji wokół `=` i że nie opakowujesz wartości w `<...>`.