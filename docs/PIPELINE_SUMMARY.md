# Video Pipeline: End-to-End Connection Summary

This document maps the complete data flow and connections across the video production pipeline, from idea to upload and reflection.

## Pipeline Status Flow

```
idea → script → clipping → clips → clip_changes → editing → editing_changes → completed → uploaded
```

Each status corresponds to a Kanban column on the Dashboard. Shorts move through these stages via drag-and-drop (admin) or automatic transitions triggered by assignment completion.

## Component Connection Map

### Frontend → Backend → Database

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)                                            │
│                                                                     │
│  Pages              Services           Contexts                     │
│  ─────              ────────           ────────                     │
│  Login.tsx ────────→ authApi ─────────→ AuthContext (JWT + User)    │
│  Dashboard.tsx ────→ shortsApi ──┐                                  │
│                  ├─→ assignmentsApi ─┤                              │
│                  ├─→ usersApi ───────┤                              │
│                  └─→ filesApi ───────┤                              │
│  ShortDetail.tsx ──→ shortsApi ──────┤                              │
│                  ├─→ assignmentsApi ─┤                              │
│                  ├─→ filesApi ───────┤                              │
│                  └─→ usersApi ───────┤                              │
│  PaymentTracking ──→ paymentsApi ────┤                              │
│  UserManagement ───→ usersApi ───────┤                              │
│  ScriptReview ─────→ analyzedShortsApi                              │
│  Reflections ──────→ shortsApi ──────┘                              │
│  ProfileCompletion → usersApi, filesApi, authApi                    │
│                                                                     │
│  All API calls go through Axios instance with:                      │
│  - JWT Authorization header injection                               │
│  - 401 auto-logout interceptor                                      │
│  - Configurable timeouts (scaled for file uploads)                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP (Vite proxy /api → localhost:3001)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND (Express.js)                                               │
│                                                                     │
│  Middleware Chain:                                                   │
│  requestLogger → rateLimiter → CORS → JSON parser → routes         │
│                                                                     │
│  Route Groups          Controllers        Services                  │
│  ────────────          ───────────        ────────                  │
│  /api/auth ──────────→ auth.ts                                      │
│  /api/shorts ────────→ shorts.ts ───────→ vertexAI.ts (Gemini)     │
│  /api/assignments ───→ assignments.ts                               │
│  /api/files ─────────→ files.ts ────────→ gcpStorage.ts            │
│  /api/users ─────────→ users.ts                                     │
│  /api/payments ──────→ payments.ts                                  │
│  /api/analyzed-shorts→ analyzedShorts.ts                            │
│                                                                     │
│  Auth Middleware:                                                    │
│  authenticateToken → requireRole() → requireProfileComplete         │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                         │
│                                                                     │
│  PostgreSQL (prod) / SQLite (dev)     GCP Cloud Storage             │
│  ─────────────────────────────────    ─────────────────             │
│  users          ← multi-role via →   /users/{id}/profile_picture/   │
│  user_roles        junction table                                   │
│  shorts         ← status pipeline    /shorts/{id}/script/           │
│  assignments    ← links users↔shorts /shorts/{id}/clips_zip/        │
│  files          ← metadata refs →    /shorts/{id}/audio/            │
│  payments       ← per-assignment     /shorts/{id}/final_video/      │
│  analyzed_shorts← competitor data                                   │
│                                                                     │
│  Query caching: in-memory with TTL, auto-invalidated on writes      │
└─────────────────────────────────────────────────────────────────────┘
```

## Pipeline Stage Connections

### Stage 1: Idea → Script

| Action | Frontend | API Call | Backend Handler | Database |
|--------|----------|----------|-----------------|----------|
| Create short | Dashboard → CreateShortModal | `POST /api/shorts` | shorts.create | INSERT shorts (status='idea') |
| Assign script writer | Dashboard → SortableCard dropdown | `POST /api/assignments` | assignments.create | INSERT assignments (role='script_writer') |
| Upload script | Dashboard → ContentModal | `POST /api/files/upload-url` + `POST /api/files/confirm-upload` | files.getUploadUrl + files.confirmUpload | INSERT files (type='script') |
| AI grade script | ShortDetail | `POST /api/shorts/:id/grade` | shorts.gradeScript → vertexAI.gradeScript | UPDATE shorts.ai_feedback |
| Move to script | Drag-and-drop | `PUT /api/shorts/:id` | shorts.update | UPDATE shorts SET status='script' |

### Stage 2: Script → Clipping → Clips

| Action | Frontend | API Call | Backend Handler | Database |
|--------|----------|----------|-----------------|----------|
| Assign clipper | Dashboard dropdown | `POST /api/assignments` | assignments.create | INSERT assignments (role='clipper') |
| Upload clips zip | Dashboard → ContentModal | `POST /api/files/upload-url` + confirm | files.getUploadUrl + confirmUpload | INSERT files (type='clips_zip') |
| Upload audio | Dashboard → ContentModal | `POST /api/files/upload-url` + confirm | files.getUploadUrl + confirmUpload | INSERT files (type='audio') |
| Mark clips complete | Admin action | `POST /api/shorts/:id/mark-clips-complete` | shorts.markClipsComplete | UPDATE shorts SET status='clips' |
| Request changes | Drag to clip_changes | `PUT /api/shorts/:id` | shorts.update | UPDATE shorts SET status='clip_changes' |

### Stage 3: Editing → Completed → Uploaded

| Action | Frontend | API Call | Backend Handler | Database |
|--------|----------|----------|-----------------|----------|
| Assign editor | Dashboard dropdown | `POST /api/assignments` | assignments.create | INSERT assignments (role='editor') |
| Upload final video | Dashboard → ContentModal | `POST /api/files/upload-url` + confirm | files.getUploadUrl + confirmUpload | INSERT files (type='final_video') |
| Mark editing complete | Admin action | `POST /api/shorts/:id/mark-editing-complete` | shorts.markEditingComplete | UPDATE shorts SET status='completed' |
| Move to uploaded | Drag-and-drop | `PUT /api/shorts/:id` | shorts.update | UPDATE shorts SET status='uploaded' |

### Stage 4: Post-Upload Reflection

| Action | Frontend | API Call | Backend Handler | Database |
|--------|----------|----------|-----------------|----------|
| Check overdue reflections | Reflections page load | `GET /api/shorts/reflection-stats` | shorts.getReflectionStats | SELECT where uploaded > 7 days ago |
| Submit reflection | Reflections form | `PUT /api/shorts/:id` | shorts.update | UPDATE shorts SET reflection fields |

## Payment Flow

```
Assignment created → rate pulled from user_rates
       │
       ▼
Assignment completed → payment record auto-created
       │
       ▼
Admin reviews pending → GET /api/payments/pending
       │
       ▼
Admin marks paid → POST /api/payments/:id/mark-paid
       │
       ▼
Optional: Admin adds incentive → POST /api/payments/incentive
```

**Connected pages:** PaymentTracking.tsx → paymentsApi → payments controller → payments table

## File Upload Flow (Signed URL Pattern)

```
Frontend                        Backend                     GCP Storage
────────                        ───────                     ───────────
1. Request upload URL ─────────→ Generate signed URL ──────→ (pre-signed PUT)
   POST /api/files/upload-url    gcpStorage.getSignedUrl

2. Upload directly ─────────────────────────────────────────→ PUT to signed URL
   (browser → GCS)

3. Confirm upload ─────────────→ Create file record
   POST /api/files/confirm-upload  INSERT into files table

4. Download request ───────────→ Generate signed GET URL ──→ (pre-signed GET)
   GET /api/files/:id/signed-url   gcpStorage.getSignedUrl
```

## Authentication Flow

```
Google OAuth                    Backend                     Frontend
────────────                    ───────                     ────────
1. Google Sign-In ──────────────────────────────────────────→ Google popup
2. ID token received ──────────→ POST /api/auth/login
3. Verify with Google ←────────→ OAuth2Client.verifyIdToken
4. Find/create user ───────────→ DB lookup/insert
5. Generate JWT ───────────────→ Return { token, user }
6. Store in localStorage ──────────────────────────────────→ AuthContext.login()
7. All subsequent requests include Authorization: Bearer <jwt>
8. Profile completion check ───→ GET /api/auth/profile-complete
9. If incomplete ──────────────────────────────────────────→ Redirect to /complete-profile
```

## Competitive Analysis Pipeline

```
analyzed_shorts table (pre-loaded competitor data)
       │
       ▼
GET /api/analyzed-shorts/random-unrated → Random unreviewed script
       │
       ▼
ScriptReview.tsx → User guesses percentile (0-100)
       │
       ▼
POST /api/analyzed-shorts/:id/review → Store guess + calculate accuracy
       │
       ▼
GET /api/analyzed-shorts/stats → Running accuracy stats (last 10, 30, all-time)
```

## API Endpoint Coverage

| Route Group | Endpoints | Frontend Connected | Unused |
|-------------|-----------|-------------------|--------|
| /api/auth | 3 | 3 | 0 |
| /api/shorts | 9 | 9 | 0 |
| /api/assignments | 8 | 8 | 0 |
| /api/files | 6 | 5 | 1 (download - frontend uses signed URLs directly) |
| /api/users | 8 | 7 | 1 (profile - frontend uses getById instead) |
| /api/payments | 9 | 9 | 0 |
| /api/analyzed-shorts | 4 | 4 | 0 |
| **Total** | **47** | **45** | **2** |

The 2 unused endpoints are intentional alternatives, not bugs:
- `GET /api/files/:id/download` — server-side download alternative (frontend prefers signed URL approach)
- `GET /api/users/:id/profile` — bypasses profile-completion middleware (used for internal access patterns)

## Shared Types

All frontend and backend code references `shared/types.ts` for consistent type definitions:
- `User`, `Short`, `Assignment`, `File`, `Payment`, `UserRate`, `AnalyzedShort`
- Status enum values and role constants
- Request/response interfaces

This ensures type safety across the full stack and prevents drift between frontend expectations and backend responses.
