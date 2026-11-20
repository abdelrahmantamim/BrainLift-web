# Better Auth Native Endpoints

## Authentication Endpoints

### Sign Up
- **Endpoint**: `POST /api/auth/sign-up/email`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "User Name"
  }
  ```
- **Response**: 
  ```json
  {
    "token": "session-token",
    "user": { "id": "...", "email": "...", "name": "..." }
  }
  ```

### Sign In
- **Endpoint**: `POST /api/auth/sign-in/email`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response**: Same as sign up

### Get Session
- **Endpoint**: `GET /api/auth/get-session`
- **Headers**: 
  - `Cookie: better-auth.session_token=<token>` OR
  - `Authorization: Bearer <token>`
- **Response**: Session object or null

### Sign Out
- **Endpoint**: `POST /api/auth/sign-out`
- **Headers**: Same as get-session
- **Response**: Success message

### Update User
- **Endpoint**: `POST /api/auth/update-user`
- **Headers**: Same as get-session
- **Body**: User fields to update

### Change Password
- **Endpoint**: `POST /api/auth/change-password`
- **Headers**: Same as get-session
- **Body**: 
  ```json
  {
    "currentPassword": "old-password",
    "newPassword": "new-password"
  }
  ```

### Forgot Password
- **Endpoint**: `POST /api/auth/forget-password`
- **Body**: 
  ```json
  {
    "email": "user@example.com"
  }
  ```

### List Sessions
- **Endpoint**: `GET /api/auth/list-sessions`
- **Headers**: Same as get-session

### OAuth Providers
- **Google**: `GET /api/auth/sign-in/google`
- **Apple**: `GET /api/auth/sign-in/apple`
- **Facebook**: `GET /api/auth/sign-in/facebook`
- **GitHub**: `GET /api/auth/sign-in/github`

## API Mapping (Better Auth internal to HTTP endpoints)

- `signUpEmail` → `/sign-up/email`
- `signInEmail` → `/sign-in/email`
- `getSession` → `/get-session`
- `signOut` → `/sign-out`
- `updateUser` → `/update-user`
- `changePassword` → `/change-password`
- `forgetPassword` → `/forget-password`
- `listSessions` → `/list-sessions`
- `signInSocial` → `/sign-in/{provider}`

## Notes

1. Better Auth stores passwords in the `account` table, not a separate password table
2. Sessions are stored with tokens in the `session` table
3. The session token can be passed either as a cookie or Bearer token
4. Default session expiry is 7 days (configured as 30 days in our setup)