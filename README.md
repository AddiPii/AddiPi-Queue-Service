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

## HTTP endpoints (użycie)

Serwis udostępnia prosty HTTP API do podglądu stanu kolejek i ostatnich zadań.

1. GET /queue
     - Zwraca informację o połączeniu z Service Bus, nazwę receivera oraz listę ostatnich 10 dokumentów z Cosmos DB (jeśli dostępne).
     - Przykład (PowerShell):

         ```powershell
         Invoke-RestMethod http://localhost:4000/queue
         ```

     - Przykład (curl):

         ```bash
         curl http://localhost:4000/queue
         ```

2. GET /queues or /queues/<n> and /queues?count=<n>
     - Uwaga: od tej wersji endpoint **zwraca WYŁĄCZNIE rzeczywiste kolejki** z Azure Service Bus — symulacja nazw została usunięta.
     - Wymagane: `SERVICE_BUS_CONN` z uprawnieniami **Manage** (np. `RootManageSharedAccessKey`) — bez tego endpoint zwróci `503 Service Unavailable` i informację, że klient administracyjny nie został zainicjalizowany.
     - Zwracane dane: lista obiektów z polami `name`, `activeMessageCount`, `deadLetterMessageCount`, `createdOn`, `updatedOn`.
     - Obsługiwane formy:
         - `GET /queues` — zwraca pierwsze `count` kolejek (domyślnie 1).
         - `GET /queues/13` — zwraca do 13 kolejek (jeśli ich tyle istnieje).
         - `GET /queues?count=5` — zwraca 5 kolejek.
     - Uwaga: dla bezpieczeństwa `count` jest ograniczony do maksymalnie 100.
     - Przykład (PowerShell):

         ```powershell
         Invoke-RestMethod 'http://localhost:4000/queues?count=5'
         ```

     - Przykład (curl):

         ```bash
         curl 'http://localhost:4000/queues?count=5'
         ```

3. GET /health
     - Prosty healthcheck zwracający `{ "ok": true }`.

     ```powershell
     Invoke-RestMethod http://localhost:4000/health
     ```

Jak działa ten endpoint?
- `/queues` używa `ServiceBusAdministrationClient` do listowania kolejek i pobierania ich runtime properties. W tej wersji nie ma lokalnej symulacji nazw kolejek.
- Jeśli serwis nie mógł zainicjalizować klienta administracyjnego (np. brak praw Manage), endpoint odpowie `503 Service Unavailable` z krótką instrukcją. 
- Wywołania administracyjne mogą być wolniejsze i podlegać throttlingowi — w implementacji znajduje się prosty cache in-memory z TTL (30s).

Uruchomienie serwisu lokalnie
1. Ustaw zmienne środowiskowe (PowerShell):

     ```powershell
     $env:SERVICE_BUS_CONN = 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...'
     $env:COSMOS_ENDPOINT = 'https://your-cosmos-account.documents.azure.com:443/'
     $env:COSMOS_KEY = 'your-cosmos-key'
     node .\index.js
     ```

2. Jeśli wolisz użyć `setx` by zapisać zmienne na stałe w systemie, pamiętaj że nowe wartości będą widoczne dopiero w nowej sesji PowerShell.

Bezpieczeństwo
- Nie commituj prawdziwych connection stringów ani kluczy. W CI używaj GitHub Secrets lub innego bezpiecznego mechanizmu przechowywania sekretów.
