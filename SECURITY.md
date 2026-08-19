# Smart Exam System — Security Model

> This document describes the security architecture for the penetration testing
> team. It covers authentication, authorization, data isolation, rate limiting,
> cookie handling, and audit logging.

---

## 1. Authentication

### 1.1 Login Flow

```
POST /api/auth/login   { email, password }
  → 200 + accessToken (JWT) + httpOnly refresh cookie
  → 200 + mfaPendingToken (if MFA enabled)
  → 401 invalid_credentials
  → 423 locked (after N failed attempts)
```

- Passwords are hashed with **bcryptjs** (cost 10).
- Failed login counter increments per user; after `LOGIN_MAX_ATTEMPTS` (default 5)
  the account is locked for `LOCKOUT_MINUTES` (default 15 min).
- The lockout response (`423`) does **not** reveal whether the account exists.

### 1.2 Multi-Factor Authentication (MFA)

```
POST /api/auth/verify-otp   { code: "123456", token: "<mfaPendingToken>" }
```

- 6-digit numeric OTP, SHA-256 hashed in memory.
- `OTP_MAX_ATTEMPTS` (3) before lockout.
- `OTP_TTL_SECONDS` (600s) + cooldown between resends (30s).
- OTP is delivered via `ConsoleOtpSender` (logged to server console in dev).
  Swap `OtpSender` interface for email/SMS in production.

### 1.3 Token Architecture

| Token | Storage | Lifetime | Purpose |
|-------|---------|----------|---------|
| **Access token** | In-memory (JS variable) | 30 min | Authenticate API requests via `Authorization: Bearer <jwt>` |
| **Refresh token** | httpOnly cookie (`ses_refresh`) | 14 days | Rotate for new access tokens; stored as SHA-256 hash in DB |
| **MFA pending token** | Client-side only | 10 min | Temporary token during MFA challenge; not accepted elsewhere |

- Access tokens carry claims: `sub` (user id), `email`, `name`, `role`, `departmentId`, `mustChangePassword`.
- Refresh tokens are **rotated** on every use; the old token is revoked.
- The `mustChangePassword` claim blocks all endpoints except `/auth/change-password`, `/auth/logout`, `/auth/refresh`, and `/auth/me`.

### 1.4 Session Management

- `GET /api/auth/sessions` — admin-only; lists all active (non-revoked, non-expired) sessions.
- `DELETE /api/auth/sessions/:id` — owner-only (ownership enforced via `requireOwnership`).

---

## 2. Authorization (RBAC)

### 2.1 Role Hierarchy

| Role | Scope | Description |
|------|-------|-------------|
| `admin` | Full system | All modules, user management, audit log |
| `exam-coordinator` | Full scheduling | Timetables, clashes, invigilator management |
| `dept-coordinator` | Department only | Schedule own department's exams, view own invigilators |
| `hod` | Approvals + reports | Approve overrides, view department reports |
| `invigilator` | Self-service | View assigned duties, set availability |
| `student` | Self-service | View datesheet, download roll-no-slip |

### 2.2 Enforcement Points

Every route has **layered** authorization:

1. **`requireAuth`** — Validates JWT access token. Extracts user claims into `res.locals.user`. Blocks `mustChangePassword` users from all endpoints except password-change/logout/refresh/me.

2. **`requireRole(...roles)`** — Checks `res.locals.user.role` against allowed roles list. Returns 403 `forbidden` if mismatched.

3. **`requirePermission(...keys)`** — Granular permission check for `dept-coordinator` role. Reads permissions JSON from the user record. Admin and exam-coordinator have implicit full access.

4. **`requireOwnership(resolveOwnerId)`** — For user-specific resources (sessions, roll-no-slips). Returns the resource owner's user ID; `requireOwnership` compares against `res.locals.user.id`.

5. **`requireDeptScope`** — Auto-injects `department_id = user.departmentId` for `dept-coordinator` users on list endpoints, preventing cross-department data access at the query level.

### 2.3 Route-Level Role Matrix

| Endpoint | Admin | Exam Coord | Dept Coord | HOD | Invigilator | Student |
|----------|-------|------------|------------|-----|-------------|---------|
| Scheduling CRUD | ✓ | ✓ | ✓ (own dept) | — | — | — |
| Clash scan/resolve | ✓ | ✓ | — | — | — | — |
| Clash list | ✓ | ✓ | ✓ (own dept) | ✓ | — | — |
| Invigilator CRUD | ✓ | ✓ | ✓ (own dept) | — | — | — |
| Override raise | ✓ | ✓ | ✓ | — | — | — |
| Override approve | ✓ | — | ✓ (perm) | ✓ | — | — |
| Export CSV/PDF | ✓ | ✓ | — | ✓ | — | — |
| Roll-no-slip | ✓ | ✓ | ✓ | ✓ | — | ✓ (own only) |
| User management | ✓ | — | — | — | — | — |
| Audit log | ✓ | ✓ | — | — | — | — |
| My datesheet | — | — | — | — | — | ✓ |

---

## 3. Data Isolation

### 3.1 Department Coordinator Scoping

**Problem**: DeptCoordinator users should only see their own department's data.

**Solution**: `requireDeptScope` middleware (`middleware/require-dept-scope.ts`) is applied to all list endpoints that DeptCoordinators can access:

| Endpoint | Middleware Applied | Query Filter |
|----------|--------------------|--------------|
| `GET /api/scheduling/schedule-entries` | ✓ | `department_id` injected into `section.course.department_id` |
| `GET /api/clashes` | ✓ | `department_id` injected into `student.department_id` |
| `GET /api/invigilators` | ✓ | `department_id` injected into query |
| `GET /api/override-requests` | ✓ | `department_id` traced via schedule_entry→section→course or clash→student |

For admin/exam-coordinator/hod roles, the middleware is a no-op.

### 3.2 Student Scoping

- `GET /api/students/me` — Role-gated to `student` only. Resolves student record via name+department matching.
- `GET /api/export/roll-no-slip/:studentId` — Ownership-enforced. Students can only download their own slip. Verified by comparing the resolved student ID against the URL parameter.

### 3.3 Notification Scoping

All notification endpoints filter by `user_id = res.locals.user.id` at the Prisma query level. Users cannot read, modify, or see notifications belonging to other users.

### 3.4 Session Scoping

- `GET /api/auth/sessions` — admin-only (can see all sessions).
- `DELETE /api/auth/sessions/:id` — owner-only (ownership enforced).

---

## 4. Rate Limiting

| Endpoint Group | Limit | Window | Response |
|---------------|-------|--------|----------|
| `/api/auth/*` (all auth routes) | 20 requests/IP | 15 minutes | 429 `rate_limited` + `Retry-After` header |
| `/api/invigilator-assignments/*` (writes) | 60 requests/IP | 1 minute | 429 `rate_limited` |
| `/api/override-requests/*` (writes) | 60 requests/IP | 1 minute | 429 `rate_limited` |
| `/api/notifications/*` (writes) | 60 requests/IP | 1 minute | 429 `rate_limited` |
| `/api/export/*` (writes) | 60 requests/IP | 1 minute | 429 `rate_limited` |
| `/api/scheduling/*` (writes) | 60 requests/IP | 1 minute | 429 `rate_limited` |

Implementation: in-memory sliding window per IP (`lib/rate-limit.ts`). Resets on server restart. For production, swap to Redis-backed store.

Rate limit headers set on every response:
- `RateLimit-Limit`: Max requests in window
- `RateLimit-Remaining`: Remaining requests
- `Retry-After`: Seconds until window resets (on 429 only)

---

## 5. Cookie Security

| Attribute | Value |
|-----------|-------|
| Name | `ses_refresh` |
| HttpOnly | `true` — not accessible via JavaScript |
| SameSite | `Lax` — CSRF-safe for top-level navigations |
| Secure | `true` in production (HTTPS only) |
| Path | `/` |
| MaxAge | 14 days (configurable via `REFRESH_TOKEN_TTL_DAYS`) |

The refresh token is stored as a SHA-256 hash in the database. The raw token is only ever in the cookie.

---

## 6. Security Headers (Helmet)

In production, the following headers are set via `helmet`:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `0` (disabled — modern browsers handle this) |
| `Referrer-Policy` | `no-referrer` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | Default policy (production) |
| `X-Powered-By` | Removed |

In development, CSP and HSTS are disabled for local tooling.

---

## 7. Error Handling

### 7.1 Structured Errors (HttpError)

Service-layer errors use `HttpError(status, code, message, details?)`:
- `400` validation_error — Zod schema validation failure
- `404` not_found — Resource doesn't exist
- `409` conflict — Capacity/clash violation
- `422` weak_password — Password policy violation
- `423` locked — Account/OTP locked out

### 7.2 Generic Errors (500)

Unhandled errors return a generic response:
```json
{ "error": "Internal server error" }
```

In **development**, the error message is included for debugging. In **production**, only the generic message is returned — **no stack traces, SQL errors, or internal details are leaked**.

---

## 8. Audit Logging

Every state-changing operation creates an `audit_log` entry:

| Field | Description |
|-------|-------------|
| `action_type` | E.g. `auth.password_change`, `schedule_entry.create`, `user.permissions_update` |
| `target_type` | Entity type: `user`, `session`, `schedule_entry`, etc. |
| `target_id` | ID of the affected entity |
| `performed_by` | User ID of the actor |
| `meta` | JSON with additional context (old/new values, reasons) |
| `timestamp` | Auto-set via `@default(now())` |

Audit log is read-only via `GET /api/audit-log` (admin + exam-coordinator only).

---

## 9. Input Validation

- **Request bodies**: Zod schemas on every POST/PUT/PATCH endpoint. Invalid bodies return 400 with field-level error details.
- **URL parameters**: Basic sanitization (reject `<>"'`;`). No special characters allowed.
- **Query parameters**: Page/page_size validated numerically; other params checked against known values (status, type enums).

---

## 10. CORS Configuration

```typescript
cors({
  origin: env.CORS_ORIGIN.split(','),  // e.g. "http://localhost:5173"
  credentials: true,                    // Allow cookies + Authorization header
})
```

Only configured origins can make authenticated requests. Credentials are required for the refresh cookie flow.

---

## 11. Known Limitations & Recommendations

1. **Rate limiter is in-memory** — resets on server restart. Use Redis in production.
2. **Student↔User mapping** uses name+department matching (no FK). Add a `user_id` FK to `students` table for production.
3. **No CSRF token** — relies on Bearer token auth + SameSite=Lax cookies (safe for JSON APIs, but consider CSRF tokens for form-based endpoints).
4. **OTP delivery** is console-only — swap `OtpSender` for email/SMS provider.
5. **No request size limits** on query strings — consider `express-query-lexer` or similar.
6. **CSP** is disabled in development — enable in production with strict policy.
