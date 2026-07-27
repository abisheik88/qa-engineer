<!-- synced-from: shared/domains/websocket.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# WebSocket Testing

How to test real-time, message-based connections, where timing and ordering are the hard parts. Recommendations only.

## Best practices

- **Best practice:** assert on received messages by waiting for the expected message to arrive, never on a fixed delay — the same web-first principle as UI waiting, applied to the message stream.
- **Best practice:** test the connection lifecycle explicitly: open, message exchange, reconnection, and clean close, including error frames and unexpected disconnects.
- **Recommendation:** assert message *shape and content*, and where order matters, assert order; tolerate benign interleaving where it does not.
- **Recommendation:** isolate real-time tests from each other — a shared channel or broadcast can leak messages between tests.

## Common failures

- Fixed sleeps waiting for a message — flaky when the message is slow, wasteful when fast.
- No coverage of reconnection or abnormal close — the paths that break in production.
- Cross-test message leakage on a shared channel.

## Detection signals

- Sleeps around socket reads instead of waiting on the message.
- Tests covering only the happy message path; no disconnect/reconnect cases.
- Shared subscription state across tests.

## Repair guidance

- Wait for the specific expected message (a predicate on the stream) rather than a duration.
- Add lifecycle cases: reconnection, server-initiated close, error frames.
- **Recommendation only:** surfaced as findings; the skill does not rewrite the socket tests.

## Framework notes

- **Playwright:** exposes `WebSocket` events on the page for observation, and can wait on frames — the strongest **framework** support among the four.
- **Cypress:** less native WebSocket support; often a client library plus intercept/stub of the handshake — a **known limitation**.
- **Selenium / WebdriverIO:** no WebSocket primitives; drive a client in the test's language and assert its received messages.

## Anti-patterns

- **Anti-pattern:** `sleep` then check for a message — replace with a wait on the message itself.
- **Anti-pattern:** asserting only that a socket opened, never that the right messages flowed.

## Future extension

Message-sequence assertions, load/soak patterns for sustained connections, and reconnection-storm scenarios would deepen this domain.
