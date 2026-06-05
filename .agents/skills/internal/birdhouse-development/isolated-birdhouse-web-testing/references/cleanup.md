# Cleanup

The default rule is: keep the isolated run intact for review until Cody explicitly asks for cleanup.

## Stop Versus Trash

### Stop

Use `scripts/stop-isolated-birdhouse.sh` when you want to stop the isolated server but preserve the run directory and artifacts.

Use this when:

- Cody still wants to review screenshots or MP4s
- Cody may want to inspect logs
- Cody may want to restart the environment later

### Trash

Use `scripts/trash-isolated-run.sh` only when Cody explicitly says cleanup is okay.

This should:

- close browser sessions
- stop the isolated Birdhouse server
- remove the claimed port lock
- delete the entire timestamped run directory

Do not delete piecemeal files. Delete the whole run directory.

## Reporting Cleanup

When cleanup is done, report:

- which run dir was deleted
- which base port range was released
- whether browser sessions were closed
- whether the server was already stopped or had to be stopped

## Sensitive Artifacts

Run directories can contain sensitive data such as:

- copied provider config
- server logs that include request bodies

That is another reason to keep the run intact during review and to delete it fully once Cody says cleanup is okay.
