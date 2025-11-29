# AddiPi Queue Service

A lightweight Node.js service that listens for print-related events from Azure Service Bus, stores jobs in Azure Cosmos DB, and exposes a small HTTP API for inspecting and managing the queue. The service is designed to run locally (development) or inside Docker in production-like environments.

This repository includes:
- a message receiver for a `print-queue` (Service Bus)
- persistence of jobs in a Cosmos DB container (`addipi`.`jobs`)
- a simple Express HTTP API for viewing jobs and queue information
- helper scripts: `send-test.js`, `listen-printer.js`, and `sb-test.js`
- Dockerfile for containerized deployment

**Quick links**
- Main service entry: `index.js`
- Service client factory: `services/clients.js`
- Queue listener: `listeners/printQueueListener.js`
- Example sender: `send-test.js`
- Test admin script: `sb-test.js`

---

**Table of Contents**
- **Getting Started**
- **Environment variables**
- **Run locally**
- **Docker**
- **API endpoints**
- **Message format**
- **Architecture & folders**
- **Troubleshooting**
- **Contributing**
- **License**

---

**Getting Started**

Prerequisites:
- Node.js 18+ (we use Node 22 in Dockerfile)
- npm
- Azure Service Bus namespace with a queue (e.g. `print-queue`)
- Azure Cosmos DB account (SQL API) with a database named `addipi` and container `jobs` (container will be used by the app)

Clone the repository:

```bash
git clone <repo-url>
cd AddiPi-Queue-Service
```

Install dependencies:

```powershell
npm install
```

---

**Environment variables**

Create a `.env` (do not commit) with:

```text
SERVICE_BUS_CONN=Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=<policy>;SharedAccessKey=<key>
COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
COSMOS_KEY=<primary-key>
PORT=4000
# optional
QUEUE_NAME=print-queue
```

Notes:
- Use a Shared Access Policy connection string that has the required permissions. For receiving messages you need `Listen`. For management duties (creating queues) you need `Manage`.
- In development you can use `dotenv` or pass these via PowerShell: ` $env:SERVICE_BUS_CONN = "..."`

---

**Run locally**

Set env vars (PowerShell example):

```powershell
$env:SERVICE_BUS_CONN = "Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."
$env:COSMOS_ENDPOINT = "https://<account>.documents.azure.com:443/"
$env:COSMOS_KEY = "<primary-key>"
node index.js
```

The app listens on `PORT` (default 4000). Logs show subscription status and incoming events.

Example: send a test message using the included `send-test.js` (ensure env is set):

```powershell
node send-test.js
```

Use `listen-printer.js` to run a small standalone listener that prints any incoming messages to the console (useful for debugging).

---

**Docker**

Build the image:

```powershell
docker build -t addipi-queue-service .
```

Run using an env file (.env):

```powershell
docker run --env-file .env -p 4000:4000 --name addipi-queue addipi-queue-service
```

Or with `docker-compose` (recommended for development):

```yaml
version: '3.8'
services:
  queue:
    build: .
    env_file: .env
    ports:
      - "4000:4000"
    restart: unless-stopped
```

Important notes:
- The Dockerfile copies the whole project into the image. Use a `.dockerignore` to avoid copying `node_modules`, `.git`, and `.env`.

---

**API endpoints**

The HTTP API is implemented with Express and provides the following endpoints:

- GET `/queue` — list recent jobs (query params: `limit`, `sort`, `order`, `continuationToken`)
- GET `/queue/next` — returns the next pending/scheduled job (204 when none)
- POST `/queue/:id/cancel` — cancel a job by id
- GET `/queues` — list Service Bus queues (requires adminClient)
- GET `/health` — basic health check

Responses are JSON. Example:

```http
GET /queue
200 OK
{
  "jobs": [ { "id": "...", "fileId": "...", "status": "pending" } ],
  "count": 1
}
```

---

**Message format**

The listener expects messages with `message.body` being an object. The minimal structure:

```json
{
  "event": "file_uploaded",
  "fileId": "20251126_035102_test.gcode",
  "originalFileName": "test.gcode",
  "timestamp": "1764125463.9541295",
  "scheduledAt": "2025-11-26T03:51:00.000Z" // optional, if present -> scheduled
}
```

The service will create a job document in Cosmos DB with fields: `id`, `fileId`, `originalFileName`, `status`, `scheduledAt`, `timestamp`, `createdAt`.

The app accepts `message.body` as either an object or a JSON string — it will attempt to parse strings.

---

**Architecture & folders**

- `index.js` — application entry, wiring, Express route wiring and graceful shutdown
- `services/clients.js` — central initialization of `sbClient`, `adminClient`, `cosmosClient`, and `container`
- `listeners/printQueueListener.js` — encapsulated listener logic (starts subscription and returns `stop()` function)
- `routes/` and `controllers/` — API route handlers (controllers expose factory functions and are wired in `index.js`)
- `send-test.js`, `sb-test.js`, `listen-printer.js` — helper/test scripts
- `Dockerfile`, `docker-compose.yml` (example)

This structure encourages singletons for shared clients and dependency injection for controllers/listeners.

---

**Troubleshooting**

- InvalidSignature / UnauthorizedAccess when subscribing:
  - Check `SERVICE_BUS_CONN` format. Make sure endpoint matches the namespace used in logs.
  - Ensure the SAS policy has the correct rights (`Listen` for receiving; `Manage` for creating queues).
  - Re-copy the connection string from Azure Portal (no extra newlines or quotes).

- PowerShell `npm` ExecutionPolicy error when running scripts:
  - Either run `powershell -ExecutionPolicy Bypass -Command "npm install"` or set `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force` (understand security implications).

- Docker missing module error (`Cannot find module '/app/services/clients.js'`):
  - Ensure Dockerfile copies the entire project into image (this repo includes a Dockerfile that uses `COPY . .`).
  - Ensure files are not excluded via `.dockerignore` incorrectly.

---

**Testing tips**

- Use `sb-test.js` to list queues and see runtime properties for `print-queue`.
- Use `send-test.js` to push test messages to `print-queue`.
- Use `listen-printer.js` to run a separate lightweight listener that logs messages.

---

**Contributing**

Contributions are welcome. Suggested workflow:

1. Fork the repo
2. Create a feature branch
3. Add tests where applicable
4. Submit a pull request

Please keep secrets out of commits — use `.env` and add it to `.gitignore`.

---

**License**

This project does not include a license file by default. If you plan to publish, add an appropriate `LICENSE` file.

---

If you want, I can also add a `docker-compose.yml`, `.dockerignore`, or a `config.js` validator (using `envalid`) to make environment validation stricter.


[PL]

Lekka usługa Node.js nasłuchująca zdarzeń związanych z drukowaniem z Azure Service Bus, zapisująca zadania w Azure Cosmos DB i udostępniająca prosty HTTP API do przeglądania i zarządzania kolejką. Usługa nadaje się do uruchomienia lokalnie (development) lub w kontenerze Docker.

Repozytorium zawiera:
- odbiornik wiadomości dla kolejki `print-queue` (Service Bus)
- persystencję zadań w Cosmos DB (`addipi`.`jobs`)
- proste API Express do przeglądu zadań i informacji o kolejce
- narzędzia pomocnicze: `send-test.js`, `listen-printer.js`, `sb-test.js`
- `Dockerfile` do pakowania obrazu kontenera

Szybkie odnośniki:
- Główny punkt wejścia: `index.js`
- Inicjalizacja klientów: `services/clients.js`
- Listener kolejki: `listeners/printQueueListener.js`
- Przykładowy sender: `send-test.js`
- Skrypt testowy administracyjny: `sb-test.js`

---

## Spis treści
- **Rozpoczęcie**
- **Zmienne środowiskowe**
- **Uruchamianie lokalne**
- **Docker**
- **Endpointy API**
- **Format wiadomości**
- **Architektura i foldery**
- **Rozwiązywanie problemów**
- **Testowanie**
- **Wkład (Contributing)**

---

## Rozpoczęcie

Wymagania:
- Node.js 18+ (w `Dockerfile` używamy Node 22)
- npm
- Azure Service Bus z kolejką (np. `print-queue`)
- Azure Cosmos DB (SQL API) z bazą `addipi` i kontenerem `jobs`

Klonowanie repozytorium:

```powershell
git clone <repo-url>
cd AddiPi-Queue-Service
```

Instalacja zależności:

```powershell
npm install
```

---

## Zmienne środowiskowe

Utwórz plik `.env` (nie commitować) z:

```text
SERVICE_BUS_CONN=Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=<policy>;SharedAccessKey=<key>
COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
COSMOS_KEY=<primary-key>
PORT=4000
# opcjonalnie
QUEUE_NAME=print-queue
```

Uwagi:
- Użyj Shared Access Policy z wymaganymi uprawnieniami: `Listen` do odbioru, `Manage` jeśli aplikacja ma tworzyć kolejkę i zmieniać konfigurację.
- W development możesz korzystać z `dotenv` lub ustawiać zmienne w PowerShell: `$env:SERVICE_BUS_CONN = "..."`

---

## Uruchamianie lokalne

Przykład (PowerShell):

```powershell
$env:SERVICE_BUS_CONN = "Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."
$env:COSMOS_ENDPOINT = "https://<account>.documents.azure.com:443/"
$env:COSMOS_KEY = "<primary-key>"
node index.js
```

Aplikacja nasłuchuje na porcie określonym przez `PORT` (domyślnie 4000). W logach zobaczysz informacje o subskrypcji i nadchodzących zdarzeniach.

Przykładowe narzędzia:
- `node send-test.js` — wysyła przykładowe wiadomości (upewnij się, że zmienne środowiskowe są ustawione)
- `node listen-printer.js` — lekki listener, który wypisuje przychodzące wiadomości (przydatne do debugowania)

---

## Docker

Budowanie obrazu:

```powershell
docker build -t addipi-queue-service .
```

Uruchomienie z plikiem `.env`:

```powershell
docker run --env-file .env -p 4000:4000 --name addipi-queue addipi-queue-service
```

Przykład `docker-compose` (zalecane do developmentu):

```yaml
version: '3.8'
services:
  queue:
    build: .
    env_file: .env
    ports:
      - "4000:4000"
    restart: unless-stopped
```

Ważne:
- `Dockerfile` kopiuje cały projekt do obrazu — użyj `.dockerignore`, aby wykluczyć `node_modules`, `.git`, `.env` itp.

---

## Endpointy API

Implementacja oparta na Express, dostępne endpointy:

- `GET /queue` — lista ostatnich zadań (query params: `limit`, `sort`, `order`, `continuationToken`)
- `GET /queue/next` — zwraca kolejne oczekujące/zaplanowane zadanie (204 gdy brak)
- `POST /queue/:id/cancel` — anuluj zadanie po `id`
- `GET /queues` — lista kolejek Service Bus (wymaga `adminClient`)
- `GET /health` — podstawowy health-check

Odpowiedzi w formacie JSON.

Przykład:

```http
GET /queue
200 OK
{
  "jobs": [ { "id": "...", "fileId": "...", "status": "pending" } ],
  "count": 1
}
```

---

## Format wiadomości

Listener oczekuje, że `message.body` będzie obiektem. Minimalna struktura:

```json
{
  "event": "file_uploaded",
  "fileId": "20251126_035102_test.gcode",
  "originalFileName": "test.gcode",
  "timestamp": "1764125463.9541295",
  "scheduledAt": "2025-11-26T03:51:00.000Z" // opcjonalne
}
```

Serwis utworzy dokument zadania w Cosmos DB z polami: `id`, `fileId`, `originalFileName`, `status`, `scheduledAt`, `timestamp`, `createdAt`.

Aplikacja akceptuje `message.body` jako obiekt albo string JSON — spróbuje sparsować string, jeśli będzie taka potrzeba.

---

## Architektura i foldery

- `index.js` — punkt wejścia aplikacji, wiring, trasy Express i zamykanie procesu
- `services/clients.js` — centralna inicjalizacja `sbClient`, `adminClient`, `cosmosClient` oraz `container`
- `listeners/printQueueListener.js` — logika subskrypcji kolejki (uruchamia subskrypcję i zwraca funkcję `stop()`)
- `routes/` i `controllers/` — handlery API (kontrolery mogą być faktoriami i przyjmować zależności)
- `send-test.js`, `sb-test.js`, `listen-printer.js` — skrypty pomocnicze
- `Dockerfile`, (przykładowy) `docker-compose.yml`

Wzorzec projektowy: singletony dla klientów (shared clients) + dependency injection dla kontrolerów/listenerów.

---

## Rozwiązywanie problemów

- `InvalidSignature` / `UnauthorizedAccess` przy subskrypcji:
  - Sprawdź format `SERVICE_BUS_CONN` i czy endpoint pasuje do namespace.
  - Upewnij się, że używana polityka SAS ma odpowiednie uprawnienia (`Listen` lub `Manage`).
  - Sklopiuj ponownie connection string z Azure Portal (uwaga na dodatkowe spacje/nowe linie).

- Błąd PowerShell przy `npm` (ExecutionPolicy):
  - Uruchom `powershell -ExecutionPolicy Bypass -Command "npm install"` lub ustaw: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force` (świadom skutków bezpieczeństwa).

- Błąd w Docker `Cannot find module '/app/services/clients.js'`:
  - Upewnij się, że `Dockerfile` kopiuje cały projekt (`COPY . .`) i że `.dockerignore` nie wyklucza potrzebnych plików.

---

## Testowanie

- `sb-test.js` — listuje kolejki i właściwości runtime (przydatne do potwierdzenia, że `print-queue` istnieje)
- `send-test.js` — wysyła wiadomości testowe do `print-queue`
- `listen-printer.js` — uruchamia prosty listener wypisujący wiadomości

---

## Wkład (Contributing)

1. Forkuj repozytorium
2. Utwórz feature branch
3. Dodaj testy jeśli to możliwe
4. Wyślij pull request

Nie dodawaj sekretów do commitów — używaj `.env` i dodaj go do `.gitignore`.

---

## Licencja

Projekt nie zawiera domyślnie pliku licencji. Jeśli planujesz publikować, dodaj odpowiedni plik `LICENSE`.

---

Jeśli chcesz, mogę też dodać przykładowy `docker-compose.yml`, `.dockerignore` lub plik `config.js` z walidacją środowiska (np. `envalid`).
