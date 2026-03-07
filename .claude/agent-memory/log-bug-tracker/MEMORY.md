# log-bug-tracker Memory

## Ticket Numbering

Last used: **BUG-004** (as of 2026-03-06)
Next ticket: **BUG-005**

## Known Open Issues

| Ticket | Summary | First Seen | Last Seen |
|--------|---------|------------|-----------|
| BUG-001 | `edit_history` column missing — edited messages dropped | 2026-03-06 | 2026-03-06 |
| BUG-002 | Slow node handling 5–10s on group/status messages | 2026-03-06 | 2026-03-07 |
| BUG-003 | POST /messages/description returning 400 (n8n) | 2026-03-06 | 2026-03-06 |
| BUG-004 | Status notification nil content + double-fire | 2026-03-06 | 2026-03-06 |

## Effective LogQL Queries

```logql
# All errors and warnings (broad sweep)
{compose_service=~"n8n|whatsapp"} |~ "(?i)error|exception|panic|fatal|warn"

# Slow node handling specifically
{compose_service="whatsapp"} |= "Node handling took"

# HTTP 4xx/5xx on internal endpoints
{compose_service="whatsapp"} | json | status_code >= 400

# Message edit failures
{compose_service="whatsapp"} |= "failed to apply message edit"

# Status notification noise
{compose_service="whatsapp"} |= "Set status notification"
```

## Datasource

- Loki UID: `P8E80F9AEF21F6940`
- Services: `n8n`, `whatsapp`

## Known Noise (do not re-file)

- "Set status notification has unexpected content (<nil>)" — filed as BUG-004, low severity
