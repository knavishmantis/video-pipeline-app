# Script Review UI - Feature Brainstorm & Implementation Plan

## Core Features

### 1. Random Script Review Flow
- **Random unrated script** appears
- **Script text displayed** (full transcript)
- **Input percentile guess** (0-100 slider or number input)
- **Submit guess** → Shows actual percentile + stats
- **Add notes** (optional, but should be encouraged)
- **Save & Next** → Automatically loads next random unrated script

### 2. Percentile Calculation
- Calculate percentile based on views compared to all camman18 videos
- Store calculated percentile in database (for performance)
- Formula: `percentile = (videos_with_lower_views / total_videos) * 100`

### 3. Answer Reveal
- Show actual percentile (e.g., "This video is in the 87th percentile")
- Show your guess vs actual difference
- Display video stats: views, likes, comments, title
- Optional: Show video thumbnail or link to YouTube

## Additional Valuable Features

### 4. Performance Tracking
- **Accuracy metric**: Track how close your guesses are over time
- **Stats dashboard**: 
  - Average guess error
  - Total scripts reviewed
  - Accuracy trend over time
  - Best/worst predictions
- **Learning progress**: See if you're getting better

### 5. Filtering & Sorting Options
- **Review status filter**: Unrated | Rated | All
- **Sort by**: Views, likes, published date, your guess accuracy
- **Difficulty mode**: Only show high/low percentile scripts (for focused practice)

### 6. Contextual Information
- **Percentile context**: "Top 10%", "Bottom 25%", etc.
- **Comparison**: "This has X% more views than average"
- **Video metadata**: Title, publish date, length (if available)
- **Visual indicator**: Color code by percentile range (green=high, red=low)

### 7. Review Management
- **Mark as reviewed** (even without guessing)
- **Edit previous guesses/notes**
- **Undo last review** (in case of mistakes)
- **Skip script** (mark as "not applicable" or "can't judge")

### 8. Learning Insights
- **Pattern detection**: "You're consistently underestimating high-performing scripts"
- **Category analysis**: What makes scripts good? (hook quality, length, etc.)
- **Comparison view**: Side-by-side comparison of high vs low percentile scripts
- **Common patterns**: Highlight what high-percentile scripts have in common

### 9. Gamification (Optional)
- **Streak counter**: Days in a row reviewing
- **Achievements**: "Reviewed 100 scripts", "Perfect guess (within 1%)"
- **Leaderboard**: If multiple users (future feature)

## Database Schema Changes

### Add to `analyzed_shorts` table:
```sql
ALTER TABLE analyzed_shorts ADD COLUMN IF NOT EXISTS percentile DECIMAL(5,2);
ALTER TABLE analyzed_shorts ADD COLUMN IF NOT EXISTS user_guess_percentile DECIMAL(5,2);
ALTER TABLE analyzed_shorts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE analyzed_shorts ADD COLUMN IF NOT EXISTS review_user_id INTEGER REFERENCES users(id);
```

**Note**: `notes` field already exists in the table.

### Percentile Calculation
- Calculate once when video is added/updated
- Store in database for fast retrieval
- Recalculate periodically if new videos added

## API Endpoints

### Backend Routes (`backend/src/routes/analyzedShorts.ts`)

```
GET  /api/analyzed-shorts/random-unrated
  - Returns random unrated script
  - Response: { id, title, transcript, views, likes, comments, published_at }

GET  /api/analyzed-shorts/:id
  - Get specific script with calculated percentile
  - Response: { ...script, percentile, actual_answer }

POST /api/analyzed-shorts/:id/review
  - Submit guess and notes
  - Body: { guess_percentile: number, notes?: string }
  - Calculates and returns actual percentile
  - Response: { actual_percentile, difference, stats }

GET  /api/analyzed-shorts/stats
  - Get user's review performance stats
  - Response: { total_reviewed, avg_error, accuracy_trend, ... }

GET  /api/analyzed-shorts
  - List all scripts with filters
  - Query params: ?reviewed=true|false|all, ?sort=views|percentile|date
  - Response: { scripts: [...], total, reviewed_count, unrated_count }

PATCH /api/analyzed-shorts/:id
  - Update review (edit guess/notes)
  - Body: { guess_percentile?, notes? }
```

## Implementation Plan

### Phase 1: Core Functionality
1. **Database Migration**
   - Add percentile, user_guess_percentile, reviewed_at, review_user_id columns
   - Create function/script to calculate percentiles for existing videos
   
2. **Backend API**
   - Create `analyzedShorts.ts` controller
   - Implement percentile calculation logic
   - Add routes for random script, submit review, get stats
   - Add auth middleware (require user to be logged in)

3. **Frontend Page**
   - Create `/script-review` route
   - Build review interface:
     - Script text display (readable, formatted)
     - Percentile guess input (0-100 slider)
     - Notes textarea
     - Submit button
   - Results view:
     - Show actual percentile
     - Display difference/error
     - Show video stats
     - Next button

### Phase 2: Enhancements
4. **Performance Tracking**
   - Stats calculation endpoint
   - Stats dashboard component
   - Accuracy metrics display

5. **UI Polish**
   - Better script formatting (paragraphs, spacing)
   - Color-coded percentile indicators
   - Smooth transitions between scripts
   - Loading states

6. **Filtering & Navigation**
   - Filter options (unrated/rated/all)
   - Sort options
   - Manual script selection (browse all)

### Phase 3: Advanced Features
7. **Learning Insights**
   - Pattern detection
   - Comparison views
   - Common patterns highlighting

8. **Review Management**
   - Edit previous reviews
   - Skip functionality
   - Review history

## UI/UX Considerations

### Script Display
- **Readable formatting**: Proper line breaks, paragraphs
- **Character count**: Show script length
- **Scrollable container**: For long scripts
- **Focus mode**: Maybe hide video title initially (to avoid bias)

### Guess Input
- **Slider (0-100)**: Visual, intuitive
- **Number input**: For precise values
- **Keyboard shortcuts**: Arrow keys to adjust
- **Visual feedback**: Color gradient (red=low, green=high)

### Results Display
- **Clear comparison**: "Your guess: 75% | Actual: 87% | Difference: -12%"
- **Color coding**: Green if close, red if far off
- **Contextual info**: "This is in the top 13% of all videos"
- **Smooth reveal**: Animation showing the answer

### Navigation
- **Auto-advance**: Option to automatically load next script after submitting
- **Keyboard shortcuts**: Space to submit, N for next
- **Progress indicator**: "Reviewed 42 of 156 scripts (27%)"

## Technical Considerations

### Percentile Calculation
```typescript
// Calculate once, store in DB
function calculatePercentile(videoViews: number, allVideos: Video[]): number {
  const sortedByViews = allVideos.sort((a, b) => a.views - b.views);
  const videosWithLowerViews = sortedByViews.filter(v => v.views < videoViews).length;
  return (videosWithLowerViews / sortedByViews.length) * 100;
}
```

### Performance
- **Pre-calculate percentiles**: Don't calculate on-the-fly
- **Cache stats**: Calculate user stats periodically
- **Pagination**: If showing all scripts, paginate results

### Data Integrity
- **User association**: Track which user reviewed what
- **Immutable reviews**: Consider versioning or audit log
- **Validation**: Ensure guess is 0-100, notes aren't too long

## Future Enhancements

1. **Multi-user support**: Compare performance with others
2. **AI suggestions**: Use your grading system to predict percentile
3. **Export**: Download reviewed scripts for analysis
4. **Categories**: Tag scripts by topic/theme
5. **Video playback**: Embed YouTube player for context
6. **Batch review**: Review multiple scripts at once

## Priority Ranking

**Must Have:**
1. Random unrated script display
2. Percentile guess input
3. Answer reveal with actual percentile
4. Notes input
5. Save & next functionality

**Should Have:**
6. Performance stats tracking
7. Filter by reviewed status
8. Percentile pre-calculation
9. Better UI formatting

**Nice to Have:**
10. Advanced filtering/sorting
11. Learning insights
12. Comparison views
13. Gamification

