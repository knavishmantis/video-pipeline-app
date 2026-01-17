# Script Creation Pipeline - Implementation Plan

## Overview
A new sidebar view for managing script drafts with a 3-stage pipeline (First Draft, 2nd Draft, Final Draft). **This is now the ONLY way to create new shorts** - when a script reaches "final_draft" stage, it automatically appears in the main kanban dashboard. The "Add Script" and "Add Idea" buttons in the kanban view will be removed.

## Design Decisions

### 1. Data Model

#### Database Schema Changes
Add new columns to the `shorts` table:
- `script_first_draft` TEXT - Stores first draft content
- `script_second_draft` TEXT - Stores second draft content  
- `script_final_draft` TEXT - Stores final draft content
- `script_draft_stage` VARCHAR(50) - Tracks current stage: 'first_draft', 'second_draft', 'final_draft', or NULL
- `script_pipeline_notes` TEXT - Universal notes field (same for all 3 stages)
- `first_draft_completed_at` TIMESTAMP - When first draft was completed
- `second_draft_completed_at` TIMESTAMP - When second draft was completed
- `final_draft_completed_at` TIMESTAMP - When final draft was completed

**Rationale:**
- Separate fields for each draft allow version history
- `script_draft_stage` tracks progression through pipeline
- NULL stage means not yet started in pipeline
- Completion timestamps track when each stage was finished
- Universal notes field allows comments that apply to all stages
- When `final_draft_completed_at` is set, the short automatically appears in kanban
- Existing `script_content` field will be populated from `script_final_draft` when advancing to final_draft

#### TypeScript Types
Update `shared/types.ts`:
```typescript
export type ScriptDraftStage = 'first_draft' | 'second_draft' | 'final_draft' | null;

export interface Short {
  // ... existing fields
  script_first_draft?: string;
  script_second_draft?: string;
  script_final_draft?: string;
  script_draft_stage?: ScriptDraftStage;
  script_pipeline_notes?: string;
  first_draft_completed_at?: string | null;
  second_draft_completed_at?: string | null;
  final_draft_completed_at?: string | null;
}
```

### 2. Validation Rules System

#### Rule Structure
Each stage will have configurable validation rules (checkboxes) that must be checked before advancing:
- Rules stored as JSON in database or as constants in frontend
- Rules are stage-specific (different rules for each draft stage)
- Rules can be simple boolean checks or more complex validations

#### Initial Rule Sets (Configurable)
**First Draft → 2nd Draft:**
- Script has a clear hook
- Script has a main narrative/payoff
- Script is at least 200 words
- Script addresses the core idea

**2nd Draft → Final Draft:**
- All first draft rules met
- Script has been reviewed for pacing
- Script includes a mid-video retention point
- Script is polished and ready for production

**Final Draft:**
- All previous rules met
- Script has been proofread
- Script meets length requirements
- Script is production-ready

**Design Decision:** Rules will be hardcoded initially but structured to allow future configuration via admin panel.

### 3. UI/UX Design

#### List View (Main Page)
- **Layout:** Table or card-based list showing all shorts
- **Header:** 
  - "Script Pipeline" title
  - "Create New Script" button (admin/script_writer only, visible to all but disabled for non-editors)
- **Columns/Info:**
  - Short title
  - Current draft stage (with visual indicator/badge)
  - Completion timestamps (when each stage was completed)
  - Last updated timestamp
  - Quick actions (edit, view)
- **Filtering:** Optional filter by stage
- **Empty State:** Message when no shorts exist + "Create New Script" button
- **Create Modal:** 
  - Simple form: Title (required), Description (optional), Idea (optional)
  - Creates short with `script_draft_stage = 'first_draft'`
  - Immediately opens edit view for first draft

#### Detail/Edit View
- **Layout:** Split view
  - **Left Side (60-70%):**
    - Plain text textarea for script editing
    - Auto-save functionality (debounced, every 2-3 seconds)
    - Character/word count
    - Stage indicator (which draft you're editing)
    - Read-only mode for non-editors (admin/script_writer can edit, others view-only)
  - **Right Side (30-40%):**
    - Current stage display with completion timestamp (if completed)
    - Validation rules checklist (editable only by admin/script_writer)
    - "Advance to Next Stage" button (disabled until all rules checked, only for editors)
    - **Notes Section** (below checkboxes):
      - Textarea for universal notes
      - Applies to all 3 stages (same notes field)
      - Auto-saves with draft content
- **Navigation:** Back button to list view
- **Save Indicator:** Visual feedback for save status
- **Access Control:** 
  - View: All authenticated users
  - Edit: Only admin or script_writer roles

### 4. API Design

#### New Endpoints
```
GET /api/shorts/script-pipeline
  - Returns all shorts with draft stage info
  - Query params: ?stage=first_draft (optional filter)
  - Access: All authenticated users (view-only)

GET /api/shorts/:id/script-draft
  - Returns specific short with all draft content and notes
  - Access: All authenticated users (view-only)

PATCH /api/shorts/:id/script-draft
  - Updates draft content for current stage and/or notes
  - Body: { 
      draft_text?: string, 
      stage: 'first_draft' | 'second_draft' | 'final_draft',
      notes?: string 
    }
  - Access: Only admin or script_writer roles

POST /api/shorts/script-pipeline/create
  - Creates a new short in the script pipeline
  - Body: { title: string, description?: string, idea?: string }
  - Sets script_draft_stage to 'first_draft'
  - Returns created short
  - Access: Only admin or script_writer roles

POST /api/shorts/:id/advance-stage
  - Advances short to next stage
  - Validates all rules are checked
  - Sets completion timestamp for current stage
  - If advancing to final_draft:
    - Sets final_draft_completed_at
    - Copies script_final_draft to script_content
    - Sets status to 'script' (makes it appear in kanban)
  - Body: { validated_rules: string[] }
  - Access: Only admin or script_writer roles
```

#### Backend Controller
Create `backend/src/controllers/scriptPipeline.ts`:
- `getAll()` - Get all shorts with draft info (view-only, all users)
- `getDraft(shortId)` - Get specific short's drafts (view-only, all users)
- `create(req, res)` - Create new short in pipeline (admin/script_writer only)
  - Creates short with basic info (title, description, idea)
  - Sets script_draft_stage to 'first_draft'
  - Returns created short
- `updateDraft(shortId, stage, content, notes)` - Save draft content and notes (admin/script_writer only)
- `advanceStage(shortId, validatedRules)` - Move to next stage (admin/script_writer only)
  - Sets completion timestamp
  - If final_draft: copies to script_content, sets status to 'script'

#### Middleware Updates
- Add role-based authorization middleware for edit endpoints
- Check if user has 'admin' or 'script_writer' role before allowing edits

### 5. Frontend Structure

#### New Files
```
frontend/src/
  pages/
    ScriptPipeline.tsx          # Main list view
    ScriptPipelineEdit.tsx       # Edit view for individual script
  components/
    ScriptDraftEditor.tsx       # Reusable editor component
    ValidationRules.tsx          # Rules checklist component
    DraftStageBadge.tsx          # Stage indicator component
```

#### Routing
Add routes in `App.tsx`:
- `/script-pipeline` - List view
- `/script-pipeline/:id` - Edit view

#### Sidebar Integration
Add to `SidebarNav.tsx`:
- New link: "Script Pipeline" (Icon: IconFileText or IconEdit)
- Visible to all authenticated users (or specific role if needed)

### 6. State Management

#### Local State (React Hooks)
- Draft content (textarea value)
- Validation rules (checked/unchecked)
- Save status (saving/saved/error)
- Current stage

#### API Integration
- Use existing `api.ts` service pattern
- Add `scriptPipelineApi` object with methods
- Handle loading/error states

### 7. Auto-Save Implementation

#### Strategy
- Debounced auto-save (2-3 second delay after typing stops)
- Visual indicator: "Saving...", "Saved", "Error"
- Save to current stage's draft field
- No manual save button needed (but can add one)

#### Implementation
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (draftText.trim()) {
      saveDraft();
    }
  }, 2500);
  return () => clearTimeout(timer);
}, [draftText]);
```

### 8. Stage Advancement Logic

#### Flow
1. User (admin/script_writer) checks all required rules for current stage
2. "Advance to Next Stage" button becomes enabled
3. On click:
   - Validate all rules are checked (frontend + backend)
   - Set completion timestamp for current stage:
     - `first_draft_completed_at` when advancing from first_draft
     - `second_draft_completed_at` when advancing from second_draft
     - `final_draft_completed_at` when advancing to final_draft
   - Copy current draft text to next stage's draft field
   - Update `script_draft_stage` field
   - **If advancing to final_draft:**
     - Copy `script_final_draft` to `script_content`
     - Set `status` to 'script' (makes it appear in kanban)
     - Short now visible in main dashboard
   - Show success message
   - Refresh UI to show new stage

#### Validation
- Backend validates rules are checked
- Frontend disables button until all checked
- Clear error messages if validation fails
- Only admin/script_writer can advance stages

### 9. Migration Strategy

#### Database Migration
Create `backend/src/db/migrateScriptPipeline.ts`:
- Add new columns to shorts table:
  - `script_first_draft`, `script_second_draft`, `script_final_draft` (TEXT, NULL)
  - `script_draft_stage` (VARCHAR(50), NULL)
  - `script_pipeline_notes` (TEXT, NULL)
  - `first_draft_completed_at`, `second_draft_completed_at`, `final_draft_completed_at` (TIMESTAMP, NULL)
- Set default values (NULL for all new fields)
- Existing shorts remain unaffected (NULL stage = not in pipeline)

#### Backward Compatibility
- Existing `script_content` field remains unchanged
- Existing shorts in kanban continue to work normally
- Only new shorts created via pipeline will have draft stages
- Scripts can exist in kanban without going through pipeline (legacy support)
- Existing shorts have `script_draft_stage = NULL` (not in pipeline)
- Pipeline shorts only appear in kanban when `final_draft_completed_at` is set
- Status field behavior:
  - Pipeline shorts: start with NULL status, set to 'script' when final_draft completed
  - Existing kanban shorts: keep their current status, unaffected

#### Breaking Changes
- **Remove "Add Script" and "Add Idea" buttons from kanban dashboard**
  - Update `KanbanBoard.tsx` to hide these buttons
  - Update `Dashboard.tsx` to remove create functionality for 'script' and 'idea' columns
  - Users must create shorts via script pipeline instead

### 10. Future Enhancements (Out of Scope)

- Draft comparison/diff view
- Edit history tracking (who changed what, when)
- Export drafts to PDF
- Rule configuration UI (admin panel)
- Draft templates
- Collaboration features (multiple editors)
- Notifications when stages are completed
- Draft versioning/rollback

## Implementation Order

1. **Database Migration**
   - Add columns to shorts table (drafts, stage, notes, timestamps)
   - Update TypeScript types in shared/types.ts
   - Run migration script

2. **Backend API**
   - Create `scriptPipeline.ts` controller
   - Add role-based authorization middleware
   - Add routes with proper access control
   - Implement auto-create in kanban when final_draft reached
   - Update API service types

3. **Remove Kanban Create Buttons**
   - Remove "Add Script" and "Add Idea" buttons from KanbanBoard
   - Remove create functionality from Dashboard for script/idea columns
   - Update column definitions if needed

4. **Frontend List View**
   - Create ScriptPipeline page
   - Fetch and display shorts with stage badges
   - Show completion timestamps
   - Add routing

5. **Frontend Edit View**
   - Create ScriptPipelineEdit page
   - Implement editor with auto-save (admin/script_writer only)
   - Add read-only mode for other users
   - Add validation rules component
   - Add notes section (universal, below checkboxes)

6. **Stage Advancement**
   - Implement advancement logic with timestamps
   - Add validation (frontend + backend)
   - Implement auto-create in kanban on final_draft
   - Test integration with main dashboard

7. **Sidebar Integration**
   - Add navigation link (visible to all users)
   - Test routing and access control

8. **Polish & Testing**
   - Error handling
   - Loading states
   - Edge cases (existing shorts, permissions)
   - UI refinements
   - Test full workflow: create → drafts → kanban

## Technical Considerations

### Performance
- Auto-save debouncing prevents excessive API calls
- List view pagination if many shorts
- Lazy loading of draft content

### Security
- Authentication required (existing middleware)
- **Authorization:**
  - **View:** All authenticated users can view drafts
  - **Edit:** Only admin or script_writer roles can edit drafts and advance stages
  - Role check middleware on edit endpoints
- Input sanitization for draft text and notes
- Backend validates user roles before allowing edits

### Error Handling
- Network errors during auto-save
- Validation failures
- Concurrent edit conflicts (optional: last-write-wins)

### Testing
- Unit tests for stage advancement logic
- Integration tests for API endpoints
- E2E tests for user flow

## Resolved Design Decisions

1. **Access Control:** ✅ RESOLVED
   - **View:** All authenticated users can view scripts in progress
   - **Edit:** Only admin or script_writer roles can edit drafts and advance stages

2. **Rule Configuration:** ✅ RESOLVED
   - Rules will be hardcoded initially in frontend
   - Structured to allow future configuration if needed

3. **Draft History:** ✅ RESOLVED
   - Track completion timestamps for each stage
   - Store all three drafts (first, second, final) for version history
   - No edit history tracking initially (can be added later)

4. **Integration:** ✅ RESOLVED
   - When script reaches "final_draft" stage:
     - Automatically creates entry in kanban dashboard
     - Sets status to 'script'
     - Copies final_draft to script_content
     - Short becomes visible in main kanban view
   - This is the ONLY way to create new shorts (removed Add Script/Idea buttons)

5. **Notes:** ✅ RESOLVED
   - Universal notes field (same for all 3 stages)
   - Displayed below validation checkboxes
   - Auto-saves with draft content
   - Editable by admin/script_writer, viewable by all

6. **Creation Workflow:** ✅ RESOLVED
   - Script pipeline is the entry point for ALL new shorts
   - Remove "Add Script" and "Add Idea" buttons from kanban
   - Users create shorts in pipeline, work through drafts, then it appears in kanban

## Estimated Complexity

- **Database:** Low (simple column additions)
- **Backend:** Medium (new controller, routes, validation)
- **Frontend:** Medium-High (new pages, auto-save, validation UI)
- **Testing:** Medium (comprehensive coverage needed)

**Total Estimated Time:** 10-14 hours

## Key Workflow

### Creating a New Short
1. User navigates to Script Pipeline
2. Clicks "Create New Script" (admin/script_writer only)
3. Enters title, description, idea (basic info)
4. Short created with `script_draft_stage = 'first_draft'`
5. User edits first draft, adds notes, checks validation rules
6. Advances to second_draft (sets `first_draft_completed_at`)
7. Edits second draft, checks rules
8. Advances to final_draft (sets `second_draft_completed_at`)
9. Edits final draft, checks rules
10. Advances to completion (sets `final_draft_completed_at`)
11. **Short automatically appears in kanban dashboard** with status 'script'
12. Workflow continues in main kanban (clipping, editing, etc.)

### Viewing Scripts (Non-Editors)
- All users can view list of scripts in pipeline
- Can see current stage, completion timestamps
- Can view draft content (read-only)
- Cannot edit or advance stages

