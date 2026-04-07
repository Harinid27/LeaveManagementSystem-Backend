# Phase 1 API Examples

Base URL: `http://localhost:5000/api`

## 1. Register Principal

`POST /auth/register`

```json
{
  "name": "Principal Admin",
  "email": "principal@example.com",
  "password": "Admin@123",
  "department": "Administration"
}
```

Notes:
- This works only once.
- It always creates the user with role `principal`.

## 2. Login

`POST /auth/login`

```json
{
  "email": "principal@example.com",
  "password": "Admin@123"
}
```

## 3. Get Current User

`GET /auth/me`

Headers:

```text
Authorization: Bearer <JWT_TOKEN>
```

## 4. Example Protected Route Header

Use this header in Postman for any protected endpoint:

```text
Authorization: Bearer <JWT_TOKEN>
```

## Roles

- `principal`
- `hod`
- `professor`
- `student`
