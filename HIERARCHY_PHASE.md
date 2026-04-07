# Hierarchical User Creation

## Rules

- `principal` can create `hod`
- `hod` can create `professor`
- `professor` can create `student`
- `student` cannot create users

Each created user stores:

- `createdBy`
- `reportingTo`

## Endpoints

### Create User

`POST /api/users/create`

Authorization header:

```text
Bearer <JWT_TOKEN>
```

Example request body:

```json
{
  "name": "CSE HOD",
  "email": "hod.cse@example.com",
  "password": "Password@123",
  "role": "hod",
  "department": "CSE"
}
```

### List Users

`GET /api/users`

Optional query:

```text
/api/users?role=professor
```

## Enforcement

- Role creation is validated before controller execution
- Department access is enforced for non-principal users
- Users can only request visible roles in list filters
