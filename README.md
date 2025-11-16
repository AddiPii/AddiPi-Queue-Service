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
     - Zwraca listę jobów z Cosmos DB oraz informacje o stanie połączenia do Service Bus.
     - Obsługiwane query params:
         - `limit` — maksymalna liczba elementów w odpowiedzi (domyślnie 50, min 1, max 1000).
         - `continuationToken` — token do pobrania kolejnej strony wyników (z poprzedniej odpowiedzi).
         - `sort` — `scheduledAt` lub `createdAt` (domyślnie `createdAt`).
         - `order` — `asc` lub `desc` (domyślnie `desc`).
     - Zwracany format (JSON):
       - `serviceBus`: { connected: boolean }
       - `receiver`: nazwa receivera lub null
       - `jobs`: tablica dokumentów jobów
       - `count`: liczba zwróconych jobów
       - `continuationToken`: token (string) lub null — użyj go w kolejnym wywołaniu aby pobrać dalsze strony
     - Przykłady:
         - Pobierz pierwszą stronę (domyślnie 50):

             ```powershell
             Invoke-RestMethod 'http://localhost:4000/queue'
             ```

         - Pobierz 20 elementów posortowanych po `scheduledAt` rosnąco:

             ```powershell
             Invoke-RestMethod 'http://localhost:4000/queue?limit=20&sort=scheduledAt&order=asc'
             ```

         - Pobierz następną stronę (użyj tokena zwróconego w `continuationToken`):

             ```powershell
             $token = '<token-from-previous-response>'
             Invoke-RestMethod "http://localhost:4000/queue?limit=20&continuationToken=$token"
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

## Dodatkowe endpointy i zarządzanie jobami

1. GET /queue/next
     - Zwraca pojedynczy najbliższy job do wykonania: status `'pending'` lub `'scheduled'` gdzie `scheduledAt` <= teraz. Sortowane po `createdAt` rosnąco.
     - Odpowiedzi:
         - 200 + `{ job: { ... } }` gdy jest job
         - 204 gdy brak jobów do wykonania
         - 503 gdy Cosmos container nie jest zainicjalizowany
         - 500 przy błędzie wewnętrznym
     - Przykład:

         ```powershell
         Invoke-RestMethod http://localhost:4000/queue/next
         ```

2. POST /queue/{id}/cancel
     - Anuluje job o danym `id` — aktualizuje dokument w Cosmos DB (`status` -> `'cancelled'`).
     - Odpowiedzi:
         - 200 + `{ ok: true, job: <updatedDoc> }` przy powodzeniu
         - 400 przy niepoprawnym id
         - 404 gdy job nie istnieje
         - 503 gdy Cosmos container nie jest zainicjalizowany
         - 500 przy błędzie wewnętrznym
     - Przykład (PowerShell):

         ```powershell
         Invoke-RestMethod -Method Post http://localhost:4000/queue/<JOB_ID>/cancel
         ```

Uwaga: aktualizacja joba odbywa się przez `container.items.upsert(job)` w obecnej implementacji. Jeśli chcesz użyć `replace` z określeniem partition key, podaj wartość partition key i mogę to zmienić.
