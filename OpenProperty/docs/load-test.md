# Basic API load smoke (pre-launch)

Not a full benchmark — confirms the Worker responds under light concurrency.

## Prerequisites

- Target URL (prod or preview), e.g. `https://rent.sistemas-d5d.workers.dev`
- Valid JWT and `X-Organization-Id` for a tenant route (optional)

## Health endpoint

With [oha](https://github.com/hatoo/oha) or `curl` in a loop:

```bash
oha -n 200 -c 10 https://rent.sistemas-d5d.workers.dev/api/health
```

Expect mostly `200`; occasional `429` if rate limits trigger (tune concurrency down).

## Authenticated route (manual)

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  https://rent.sistemas-d5d.workers.dev/api/properties
```

Repeat 20–50 times; all should be `200` (or `403` if org header wrong — not a load issue).

Record date, URL, tool, and p99 latency in your launch notes.
