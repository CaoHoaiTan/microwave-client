# Microwave Office API client

Requires Node.js 22+. This is a standalone utility, not a RideX learning lab.

First complete [Local AI setup](#local-ai-setup-ollama) below. Copy `.env.example` to `.env` only if you do not already have one, enter your game credentials, then run:

```sh
npm install
npm start
npm start -- --run coffee
npm start -- --run coffee plant trash quiz typing printer
```

Default mode logs in and reads map data only. `--run` moves the player and submits each selected task once. Close other game tabs before running so another client does not move the same player.

The client uses the login cookie for HTTP and Socket.IO, waits for `init`, navigates around solid objects at less than the frontend's movement speed, and sends `move` events. Task actions use `/api/tasks/:id/start` and `/submit`. Server-side movement checks are unknown; a rejected request stops execution, without automatic retries.

All stages now run without terminal input. English questions are sent one question at a time within a shared deadline to local Ollama, using JSON-schema output containing exact option texts. The client maps those texts to zero-based API indexes to avoid model numbering mistakes. Arithmetic is solved directly when recognized; unfamiliar math expressions use Ollama. Typing and printer stages use the challenge data directly.

Ollama defaults (also listed in `.env.example`):

```dotenv
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

These defaults work with an existing `.env`; no credential changes are needed. Only loopback Ollama URLs are accepted. Questions are sent to Ollama without game cookies or credentials. Model weights must already be installed; the client never downloads a model. Run `node check-local.mjs` to check Ollama against five synthetic questions without accessing the game (use `node --env-file=.env check-local.mjs` for custom config).

The model is warmed up before login and before any timed task. The solver reserves two seconds for submitting, limits inference to 45 seconds, and validates answer count and option bounds. Invalid JSON, timeout, unsupported stages, or a disconnected socket stop the run; there is no manual prompt or random-answer fallback. Format validation cannot guarantee correct English answers. A run still performs each selected task only once; there is no infinite farming loop.

Cooldown tasks are skipped, the daily cap stops the run, and Ctrl+C cancels. POST requests are never retried because repeating them may have side effects. A submitted task changes the account's rewards/progress. Cancelling after starting may leave an active challenge until the server expires it.

The website has bot detection/reporting. This client does not disable security controls, and the server may reject automated submissions. The server determines scores and may apply timing constraints; automated typing is not guaranteed a particular reward.

Validation: run `npm test` for navigation, arithmetic, model response validation, request format, deadline and cancellation tests. `check-local.mjs` measures local inference on synthetic questions. No real game task has been started/submitted during this update; live Socket.IO navigation and challenge schemas remain unverified. Sources: website `app.js?v=15`; https://socket.io/docs/v4/client-options/; https://docs.ollama.com/api/chat; https://docs.ollama.com/capabilities/structured-outputs.


## Local AI setup (Ollama)

### 1. Install and start Ollama

- **macOS:** download the installer from [ollama.com/download](https://ollama.com/download), install Ollama, and open the app. Finish the initial setup, then open a new terminal.
- **Windows:** download and run the Windows installer from the same page. Ollama runs in the background; open a new PowerShell window after installation. See the [official Windows guide](https://docs.ollama.com/windows).
- **Linux:** follow the [official Linux installation guide](https://docs.ollama.com/linux). The standard installation command is:

  ```sh
  curl -fsSL https://ollama.com/install.sh | sh
  ```

Verify that the CLI is available:

```sh
ollama --version
ollama list
```

If the CLI cannot connect to the local service, open the Ollama app (macOS/Windows), or start the server in a separate terminal:

```sh
ollama serve
```

Keep that terminal open while running the client. If it reports that port `11434` is already in use, an Ollama instance may already be running; verify with `ollama list` rather than starting a second instance.

### 2. Download the model

```sh
ollama pull llama3.2:3b
ollama list
ollama run llama3.2:3b "Complete the sentence: She ___ a doctor."
```

The [default model](https://ollama.com/library/llama3.2:3b) download is approximately 2 GB; allow additional disk space for Ollama and memory for inference. Downloading requires internet access. After downloading, this local model runs without a paid API key; the game still needs internet access. The client does not download models automatically.

### 3. Configure the client

In the `microwave-client` project directory, create `.env` only if it does not already exist:

```sh
# macOS / Linux
cp -n .env.example .env
```

```powershell
# Windows PowerShell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env`, fill in `GAME_USERNAME` and `GAME_PASSWORD`, and keep these local AI settings:

```dotenv
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

Use the exact model tag shown by `ollama list`. This client accepts only loopback URLs (`localhost`, `127.0.0.1`, or `[::1]`). An embedding-only model such as `bge-m3` cannot answer questions. To change models later, download a local chat model with `ollama pull <model-tag>`, then update `OLLAMA_MODEL` and run the check below.

### 4. Check local AI before running tasks

From the project directory:

```sh
npm install
node --env-file=.env check-local.mjs
```

This warms up the model and answers five synthetic English questions, printing responses, timing and an accuracy count. It does **not** log in to the game or submit tasks. Successful inference does not guarantee correct answers: the current default model scored 3/5 on the small sample in our earlier check. Treat this as a connectivity/smoke check, not a comprehensive evaluation.

Once the check works:

```sh
npm start
npm start -- --run coffee
```

The first command only reads game data; the second performs the coffee task if it is available, including automatic local AI answers and submission.

### Troubleshooting

| Symptom | What to check |
|---|---|
| `ollama: command not found` | Finish installation, open a new terminal, and verify the CLI is on your PATH. |
| `fetch failed` / connection refused | Start Ollama and check `OLLAMA_URL`; `ollama list` should connect successfully. |
| Ollama HTTP 404 / model not found | Run `ollama pull llama3.2:3b` and make sure `OLLAMA_MODEL` matches an installed tag. |
| Port `11434` already in use | Check whether Ollama is already serving; do not start another instance on the same port. |
| Timeout / too little time left | Close other inference jobs and test with `check-local.mjs`. The client warms up the model before tasks, but slow inference can still exceed the game's deadline. |
| Valid response but wrong answer | The model can make mistakes. Inspect the logged question/choice and compare local chat models; changing the timeout will not fix accuracy. |
| `TASK skipped: cooldown` | This is the game server's cooldown, not an Ollama failure. Rerun after the logged `availableAt` time. |

References: [Ollama quickstart](https://docs.ollama.com/quickstart), [CLI reference](https://docs.ollama.com/cli), [model library entry](https://ollama.com/library/llama3.2:3b).

## Detailed logs

Detailed logging is enabled by default. Every request/response has a timestamp, correlation number, HTTP status and elapsed time. Logs include game request bodies and responses, challenge questions/options, Ollama prompts and raw responses, validated option text and zero-based API answer, submit payloads, rewards/review returned by the server, Socket.IO movement events, and failures. The server may not return the correct answer; the client only reports what is returned.

`WARMUP` is a synthetic question, not a game task. `TASK skipped: cooldown` includes the server's remaining milliseconds and an estimated `availableAt` timestamp (UTC). No task is started or answered when skipped; rerun after that time. The client does not know why the server assigned that cooldown.

Credentials, cookies, token fields and known credential values are redacted. Other account/challenge content can still be present in logs; inspect before sharing. To save terminal output:

```sh
npm start -- --run coffee 2>&1 | tee coffee-run.log
```

After each finished task, `TASK reward summary` reports the actual MCOIN and XP awarded by the final response, plus current balance, total XP and level refreshed from `/api/me`. A short Vietnamese summary is printed as well. Missing award fields are reported as unknown, not zero. Voided tasks do not claim rewards. If balance refresh fails, the award still prints and the completed task is never retried.
