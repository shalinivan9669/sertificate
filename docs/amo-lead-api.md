# amoCRM lead endpoint

## Local setup

Create `.env.local` in project root:

```env
AMO_BASE_URL=https://your-subdomain.amocrm.ru
AMO_ACCESS_TOKEN=your_long_lived_access_token
AMO_LEAD_CITY_FIELD_ID=
AMO_LEAD_COMMENT_FIELD_ID=
```

Supported fallback env names:

```env
AMO_SUBDOMAIN=your-subdomain
AMO_LONG_TOKEN=your_long_lived_access_token
```

## Test with curl

```bash
curl -X POST http://localhost:3000/api/amo-lead \
  -H "Content-Type: application/json" \
  -d '{
    "name":"John Doe",
    "phone":"+77001234567",
    "email":"john@example.com",
    "city":"Almaty",
    "comment":"Need details for corporate training",
    "message":"Test request",
    "company":""
  }'
```
