# Architecture Overview

## System Design Philosophy

This application is designed with **maintainability** as the primary concern. The codebase follows clear separation of concerns, making it easy to extend and modify as requirements evolve.

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (with SQLite option for development)
- **Storage**: Google Cloud Storage (GCP)
- **Authentication**: JWT tokens

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **HTTP Client**: Axios

## Architecture Patterns

### Backend Structure

```
backend/
├── src/
│   ├── controllers/     # Business logic handlers
│   │   ├── auth.ts
│   │   ├── shorts.ts
│   │   ├── assignments.ts
│   │   ├── users.ts
│   │   ├── files.ts
│   │   └── payments.ts
│   ├── routes/          # API route definitions
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── shorts.ts
│   │   └── ...
│   ├── middleware/      # Express middleware
│   │   └── auth.ts      # JWT authentication
│   ├── services/        # External service integrations
│   │   └── gcpStorage.ts # GCP Storage operations
│   ├── db/              # Database layer
│   │   ├── index.ts     # Connection pool
│   │   └── migrate.ts   # Schema migrations
│   └── index.ts         # Application entry point
└── package.json
```

**Key Principles:**
- Controllers handle request/response logic
- Routes define API endpoints and middleware chain
- Services abstract external dependencies (GCP)
- Database layer provides connection management

### Frontend Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   └── PrivateRoute.tsx
│   ├── pages/          # Page-level components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ShortDetail.tsx
│   │   ├── UserManagement.tsx
│   │   └── PaymentTracking.tsx
│   ├── contexts/       # React Context providers
│   │   └── AuthContext.tsx
│   ├── services/       # API client
│   │   └── api.ts      # Axios-based API functions
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
└── package.json
```

**Key Principles:**
- Pages represent distinct routes/views
- Contexts manage global state (auth)
- Services abstract API communication
- Components are reusable and focused

## Data Flow

### Authentication Flow
1. User submits credentials → `authApi.login()`
2. Backend validates → Returns JWT token
3. Frontend stores token → Adds to request headers
4. Backend middleware validates token → Attaches user to request

### File Upload Flow
1. User selects file → Frontend creates FormData
2. POST to `/api/files/upload` → Multer processes file
3. File uploaded to GCP Storage → Returns bucket path
4. Database record created → Links file to short

### Assignment Flow
1. Admin/Script Writer creates assignment → POST `/api/assignments`
2. Assignment linked to short and user → Database record
3. User sees assignment in "Assigned" filter → Dashboard query
4. User completes work → Marks assignment complete

## Database Schema

### Core Tables

**users**
- Stores user accounts with roles
- Links to Discord, PayPal, Google accounts
- Password hashed with bcrypt

**shorts**
- Main entity representing a video project
- Tracks status through pipeline stages
- Links to script writer

**assignments**
- Links users to shorts for specific roles
- Tracks due dates and completion
- Unique constraint on (short_id, role)

**files**
- References to files in GCP Storage
- Organized by file_type (script/clip/audio/final_video)
- Tracks upload metadata

**payments**
- Admin-only payment tracking
- Links to users and shorts
- Tracks payment status and amounts

## Security Considerations

### Authentication
- JWT tokens with expiration
- Password hashing with bcrypt
- Token stored in localStorage (consider httpOnly cookies for production)

### Authorization
- Role-based access control (RBAC)
- Middleware checks user role
- Admin-only endpoints protected

### File Security
- Signed URLs for file access (time-limited)
- File uploads require authentication
- File type validation (can be enhanced)

## Scalability Considerations

### Current Design
- Stateless API (JWT tokens)
- Database connection pooling
- File storage in GCP (scalable)

### Future Enhancements
- Caching layer (Redis) for frequently accessed data
- Queue system for background jobs (auto-uploads)
- CDN for file delivery
- Database read replicas for heavy read workloads

## Extension Points

### Adding Auto-Upload Feature
1. Create new service: `services/youtubeUpload.ts`
2. Add queue system (Bull/BullMQ)
3. Add endpoint: `POST /api/shorts/:id/upload-to-youtube`
4. Add UI button in ShortDetail page
5. Track upload status in database

### Adding Notifications
1. Create notification service (email/Discord webhooks)
2. Add notification table
3. Trigger on assignment creation/completion
4. Add notification preferences to user profiles

### Adding Analytics
1. Create analytics service
2. Track metrics (completion times, bottlenecks)
3. Add dashboard page
4. Store metrics in time-series database (optional)

## Maintenance Guidelines

### Code Organization
- Keep controllers focused on single responsibilities
- Extract complex logic to service functions
- Use TypeScript types from `shared/types.ts`
- Document non-obvious business logic

### Database Changes
- Always create migrations (don't modify existing)
- Test migrations on development database first
- Keep migrations reversible when possible

### API Changes
- Maintain backward compatibility when possible
- Version API if breaking changes needed (`/api/v2/...`)
- Update shared types when changing data structures

### Testing Strategy (Future)
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

## Deployment Considerations

### Environment Variables
- Never commit `.env` files
- Use different values for dev/staging/production
- Rotate JWT secrets regularly
- Secure GCP service account keys

### Database
- Use connection pooling in production
- Set up database backups
- Monitor query performance

### GCP Storage
- Set up lifecycle policies for old files
- Configure CORS for frontend access
- Monitor storage costs

### Frontend
- Build for production: `npm run build`
- Serve static files via CDN or nginx
- Enable compression
- Set up error tracking (Sentry, etc.)

