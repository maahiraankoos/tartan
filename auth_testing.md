# Auth Testing Playbook (Tartan)

## Admin credentials
- email: `admin@tartan.app`
- password: `TartanAdmin2026!`

## MongoDB verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email.

## API testing
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
# register a creator
curl -c ck.txt -X POST "$API/api/auth/register" -H "Content-Type: application/json" -d '{"email":"creator1@test.com","password":"pass123","name":"Creator One","account_type":"creator"}'
# me
curl -b ck.txt "$API/api/auth/me"
# login admin
curl -c admin.txt -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@tartan.app","password":"TartanAdmin2026!"}'
# admin overview
curl -b admin.txt "$API/api/admin/overview"
```
Login/register set `access_token` + `refresh_token` cookies. `/auth/me` returns same user via cookies.
Non-admin calling `/api/admin/*` must get 403.
