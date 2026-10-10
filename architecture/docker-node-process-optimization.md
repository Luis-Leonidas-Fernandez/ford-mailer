# Run Node directly in Docker

The three application services now run their existing Node entrypoints directly instead of through npm. This removes an unnecessary launcher without changing application logic, queue configuration, dependencies, or infrastructure. All work was local; production was neither accessed nor measured.

## Change boundary

| Service | Previous command | New command |
| --- | --- | --- |
| `api` | `["npm", "run", "start"]` | `["node", "src/server.js"]` |
| `worker` | `["npm", "run", "start:worker"]` | `["node", "mailer/worker.js"]` |
| `worker-whatsapp` | `["npm", "run", "start:worker:whatsapp"]` | `["node", "mailer/whatsapp-worker.js"]` |

- `docker-compose.yml`: only these three `command` entries changed. It is the non-local deployment configuration; the separate `docker-compose.local.yml` uses development commands and was left untouched. No server configuration was inspected to confirm what is actually deployed.
- `architecture/docker-node-process-optimization.md`: records rationale, evidence, risks, and the future manual procedure. No pre-existing architecture documentation convention was found.
- `COMANDO.md`: had an existing developer modification before this task; its bytes were preserved.

The services still use `node:18-alpine`, `/usr/src/app`, and the existing repository bind mount. MongoDB, Redis, volumes, networks, ports, environment, restart policies, and `package.json` are unchanged. No repository Dockerfile was found; Compose uses the upstream image directly.

## Process model and memory

Previous conceptual execution:

```text
Docker / image entrypoint
  └── npm run start
       └── node src/server.js
```

New conceptual execution:

```text
Docker / image entrypoint
  └── node src/server.js
```

The same change applies to both workers. These are conceptual diagrams, not observed process trees. npm runs scripts through a platform shell (normally `/bin/sh` on Linux); a shell may remain or replace itself with Node depending on implementation. The Compose argument list avoids an additional Compose shell, but previously did not remove npm's script execution layer.

Removing npm avoids its persistent launcher overhead and simplifies the termination signal path. When the image entrypoint execs the configured command, Node becomes the main container process. The actual deployed entrypoint and PID tree must be verified during manual deployment; this task did not start or inspect containers.

Possible memory savings are not a measured result. RSS includes resident process pages, including shared mappings; adding process RSS can double-count shared pages. Eliminating npm can release private resident memory, but shared mappings may still be used by Node or other processes, and container accounting also includes cache and other memory. Summed npm RSS is therefore not guaranteed to equal recoverable host RAM. Compare like-for-like container usage, host available memory, workload, and elapsed uptime before making any savings claim. No concrete MB or percentage reduction is guaranteed.

## Startup and shutdown evidence

Inspection confirmed that the three `package.json` start scripts contain exactly the Node commands above. No corresponding pre/post lifecycle hooks are defined. A search of application JavaScript/JSON under `src`, `mailer`, and `whatsapp` found no `npm_config`, `npm_lifecycle`, or `npm_package` references; this is bounded source inspection, not proof about dependencies or the server environment. Direct execution omits npm-specific variables and its `node_modules/.bin` PATH additions. Future script changes must also update Compose.

| Entrypoint | Existing behavior | Shutdown limitation |
| --- | --- | --- |
| `src/server.js` | Connects MongoDB, then calls `app.listen`; handles `SIGTERM` and `SIGINT` | Closes Mongoose and calls `process.exit(0)`, but does not retain/close the HTTP server or explicitly drain requests |
| `mailer/worker.js` | Creates a BullMQ `emails` worker and calls `sendReminder` for jobs | No explicit signal handler or `worker.close()` drain |
| `mailer/whatsapp-worker.js` | Creates a BullMQ `whatsapp` worker and calls `waSendTemplate`; concurrency remains 1 | No explicit signal handler or `worker.close()` drain |

Direct execution improves signal routing; it does **not** implement graceful worker shutdown or fix HTTP draining. Those are separate application changes, deliberately outside this task.

## Local verification — 2026-10-10

Commands were run from the repository root. Existing executable locations were used with a standard local PATH; no tools were installed and no secrets were printed.

| Check | Result |
| --- | --- |
| `docker compose config -q` using `/Applications/Docker.app/Contents/Resources/bin/docker` | Exit 0, no output; existing environment file accepted, not modified or displayed |
| Existence of `src/server.js`, `mailer/worker.js`, `mailer/whatsapp-worker.js` | All three regular files exist |
| Static comparison of scripts, service commands, and baseline Compose | Exact expected commands; only three command replacements |
| `node --check` on each entrypoint using `/usr/local/bin/node` | All three exit 0; host Node v22.12.0, not runtime proof for the unchanged Node 18 image |
| `git diff --check` | Exit 0, no output |
| `git diff -- docker-compose.yml` | Exactly three command replacements |
| SHA-256 comparison of `COMANDO.md` and `docker-compose.local.yml` before/after | Unchanged |
| Automated application tests | No test script or tracked test suite found; `send-test.js` is a real-send script and was not run |
| Container startup, signal behavior, throughput, memory measurement | Not executed: would require services and could consume jobs or send messages |

Syntax checks parse files without importing them. They do not prove dependency availability, connectivity, startup, or shutdown behavior. No infrastructure, campaigns, sends, SSH, deployment, staging, commit, or push was performed.

## Problems and handling

- The session PATH initially did not expose ordinary executables. Existing absolute paths and a standard local PATH enabled local checks without installing dependencies or changing repository configuration.
- An initial static assertion incorrectly tried to compare `docker-compose.local.yml` with Git HEAD; that file is ignored and absent from HEAD, so the assertion exited 1. The corrected assertion compared its SHA-256 with the pre-edit baseline and exited 0, also checking the three commands, entrypoints, package scripts, and protected `COMANDO.md` hash.
- An initial read-only native review status reported `git_command_failed`, `mutation_outcome: not_started`, because Git was absent from PATH. The parent orchestration resolved the tooling path and obtained status separately. This document records functional checks, not a native review approval or receipt.
- Workers lack explicit draining, and the API does not drain HTTP requests. These pre-existing limitations were documented, not changed, to preserve the requested three-command scope.

## Deployment risks

Recreating the three services briefly interrupts the API and both workers. A worker can be terminated after a provider accepts a message but before BullMQ records completion. Stalled-job recovery or configured retries can then process it again, causing duplicate sends. Retry/backoff settings depend on the producer and job; no universal retry count or exactly-once delivery is asserted. Deterministic enqueue IDs do not by themselves prevent duplicate external delivery of an interrupted job.

Use a maintenance window. Suspend campaign creation and every other producer through existing operational controls, allow active jobs to finish, and prevent waiting/delayed/retried jobs from becoming active during recreation through existing safe queue controls. Merely observing zero active jobs once is insufficient if another can start immediately. If the operator cannot ensure a quiescent interval, defer deployment rather than assume shutdown is safe. Do not clear queues or alter business logic for this optimization.

## Future manual deployment — not executed

1. Review this document and the three-line functional diff locally. Keep the unrelated `COMANDO.md` edit out of this work unit unless intentionally included.
2. Commit the Compose change and this document with a Conventional Commit, then push manually.
3. Connect to the Droplet manually, confirm its actual checkout, Compose file/project/options, and update the repository without overwriting server-local changes or secrets. The local layout is not proof of the server layout.
4. Using the same Compose project/options as the existing deployment, run `docker compose config -q`. Confirm entrypoints and existing installed dependencies in the bind-mounted repository; do not run an installation or image upgrade as part of this change.
5. Establish the quiescent interval described above and confirm no critical jobs are active. Record baseline service/container memory and host available memory under a comparable workload.
6. After operator review, recreate only the application services:

   ```bash
   docker compose up -d --no-deps --no-build \
     api worker worker-whatsapp
   ```

   Confirm the target images already exist locally. `--no-build` prevents builds, not image pulls; stop if an unexpected pull or image change would occur. Do not use `docker compose down`, delete volumes, or run prune operations.

7. Check `docker compose ps api worker worker-whatsapp` and bounded logs, for example `docker compose logs --tail=100 api worker worker-whatsapp`. Logs may contain personal information; do not publish them unredacted. Confirm the operator's existing health check, Redis/MongoDB connections, expected commands/PIDs, and absence of restart loops. Do not create a campaign or send test messages as validation.
8. Resume producers only after checks succeed. Compare memory with baseline after equal warm-up and similar workload, for example using `docker stats --no-stream` and host metrics. A result from this deployment must be measured, not inferred from this local change.

## Rollback — not executed

If startup fails, retain the quiescent interval, inspect bounded/redacted logs, and restore **only** the three previous `command` arrays from the first table. Preserve all environment files, volumes, queue data, and unrelated repository changes. Alternatively, once the developer creates a dedicated commit for this work unit, revert that exact commit after checking for later changes.

Run `docker compose config -q`, then use the same targeted `up -d --no-deps --no-build api worker worker-whatsapp` procedure and check status/logs again. Rollback also interrupts services; it does not undo already delivered messages or eliminate pre-existing shutdown risks. Never perform a full-stack teardown or volume deletion.

## References

- [npm script execution: shell, PATH, lifecycle environment](https://docs.npmjs.com/cli/v10/commands/npm-run-script/)
- [Docker Compose command configuration](https://docs.docker.com/reference/compose-file/services/#command)
- [BullMQ graceful shutdown and stalled-job recovery](https://docs.bullmq.io/guide/workers/graceful-shutdown)
- [Node process memory usage and RSS](https://nodejs.org/api/process.html#processmemoryusage)
