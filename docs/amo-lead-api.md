# amoCRM lead endpoint

## Local setup

Create `.env.local` in project root:

```env
AMO_SUBDOMAIN=your_subdomain
AMO_LONG_TOKEN=your_long_lived_token
```

## Test with curl

```bash
curl -X POST http://localhost:3000/api/amo-lead \
  -H "Content-Type: application/json" \
  -d '{
    "name":"John Doe",
    "phone":"+77001234567",
    "email":"john@example.com",
    "message":"Test request",
    "company":""
  }'
```
