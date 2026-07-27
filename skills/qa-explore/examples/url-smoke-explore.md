# Example: URL-only smoke explore

## Request

```text
/qa-explore https://staging.example.com/app/orders
```

## Context

No test-case attachment. Staging orders list is reachable after the user signs in. Browser adapter available (Playwright MCP).

## Expected behavior

1. Ask nothing further (URL present); create `qa-artifacts/explore-<run-id>/`.
2. Open the URL; on login wall, hand off to the user; continue after login.
3. Run functional exploration, API replay, performance, client security, UI/UX.
4. Skip DB validation (not provided).
5. Write MD, HTML, and `explore-result.json` with stable finding ids and screenshot proof for each confirmed bug.

## Expected output

`qa-artifacts/explore-a1b2/explore-result.json` (excerpt):

```json
{
  "contract": { "name": "qa-explore/explore-result", "version": "1.0.0" },
  "skill": { "name": "qa-explore", "version": "0.1.0" },
  "generatedAt": "2026-07-24T10:00:00Z",
  "summary": "Orders explore on staging: 1 high, 2 medium findings. Filter date range does not reach the API; empty state is clear.",
  "classification": "issues-found",
  "url": "https://staging.example.com/app/orders",
  "reportVersion": "v1.0",
  "browserAdapter": "playwright-mcp",
  "dimensionsRun": ["functional", "api", "performance", "security", "ui", "ux"],
  "severityCounts": { "critical": 0, "high": 1, "medium": 2, "low": 0 },
  "evidence": [
    {
      "type": "screenshot",
      "description": "Orders list after applying date filter",
      "source": "qa-artifacts/explore-a1b2/screenshots/EXP-1-filter.png"
    }
  ],
  "findings": [
    {
      "id": "EXP-1",
      "severity": "high",
      "dimension": "api",
      "title": "Date filter not sent on orders API",
      "repro": "1. Open Orders. 2. Set date range. 3. Apply.",
      "actual": "UI updates labels but GET /api/orders has no from/to query params.",
      "expected": "API request includes the selected date range.",
      "fixDirection": "Propagate filter state into the orders list request query.",
      "status": "confirmed",
      "evidence": [
        {
          "type": "network",
          "source": "qa-artifacts/explore-a1b2/network/orders-get.json",
          "excerpt": "GET /api/orders (no from/to)"
        },
        {
          "type": "screenshot",
          "source": "qa-artifacts/explore-a1b2/screenshots/EXP-1-filter.png"
        }
      ]
    }
  ],
  "whatWorksWell": [
    "Empty state copy when there are no orders is clear and actionable."
  ],
  "fixOrder": ["EXP-1"],
  "recommendations": [
    {
      "action": "Fix date filter propagation before release.",
      "priority": "high"
    }
  ],
  "metadata": {}
}
```
