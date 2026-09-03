# Staff Dashboard Redesign Plan

## Current Problems
- Generic, boring layout with plain cards
- No clear workflow for staff tasks
- Courses/exams/rooms are separate pages with no visual connection
- No visual representation of room seating maps
- No inline actions (everything requires navigation)

## Design Vision
A modern, task-oriented dashboard with a **workspace pattern** — staff selects a course context first, then sees everything relevant to that course in one place. Think Linear/Notion-style clean UI with subtle gradients and visual hierarchy.

---

## Architecture: Course-Centered Workspace

### Layout Change
Replace the current flat dashboard with a **two-panel workspace**:

```
┌─────────────────────────────────────────────────────┐
│  Navbar (existing)                                  │
├──────────────┬──────────────────────────────────────┤
│  Course      │  Course Workspace                    │
│  Sidebar     │  ┌──────────┬──────────┬──────────┐  │
│              │  │ Exams    │ Roster   │ Rooms    │  │
│  ┌────────┐  │  ├──────────┴──────────┴──────────┤  │
│  │ Search │  │  │                                │  │
│  └────────┘  │  │  Content area (tab-based)      │  │
│  ┌────────┐  │  │                                │  │
│  │ Course │  │  │                                │  │
│  │ Card 1 │  │  │                                │  │
│  │ Course │  │  │                                │  │
│  │ Card 2 │  │  └────────────────────────────────┘  │
│  │ ...    │  │                                      │
│  └────────┘  │  Quick Actions Bar                   │
│              │  [Upload CSV] [Upload Template] [+]  │
├──────────────┴──────────────────────────────────────┤
│  Global Stats Footer                                │
└─────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Course Sidebar (`/components/dashboard/CourseSidebar.tsx`)
- Searchable course list
- Each course shows: code, name, exam count badge
- Selected course gets highlighted with a subtle blue accent
- "All Courses" option at top to see global dashboard
- Compact design: ~280px width

### 2. Course Workspace Tabs
When a course is selected, show tabs:
- **Overview** — Course stats, recent activity, quick actions
- **Exams** — Exams for this course with inline status
- **Roster** — Students enrolled, CSV import
- **Rooms** — Room assignment, seat mapping visualization

### 3. Overview Tab
- Course info header (code, name, department)
- Stat cards: Total Exams, Active Students, Rooms Assigned
- Recent activity timeline
- Quick action buttons:
  - "New Exam" → creates exam for this course
  - "Import Roster" → CSV upload modal
  - "Upload Template" → Crowdmark template upload

### 4. Exams Tab
- Visual exam cards (not table rows) showing:
  - Exam name, date, status with color-coded indicator
  - Progress bar (students assigned / total)
  - Room assignment count
  - One-click actions based on status:
    - DRAFT → "Import Roster" / "Add Room"
    - CONFIGURED → "Generate Seating"
    - READY → "Generate Exams"
    - GENERATED → "Download Package"
- Click card → navigates to exam detail page

### 5. Roster Tab
- Student count header with import button
- Searchable student table
- CSV drag-and-drop zone (prominent)
- Inline student cards showing: name, student number, assigned seat (if any)
- Bulk actions: "Assign All Seats", "Export List"

### 6. Rooms Tab
- Room selection grid (visual cards, not table)
- Each room card shows:
  - Building + room number
  - Capacity bar (used/total)
  - Mini seat map preview (grid visualization)
- Selected rooms highlighted with blue border
- "Add Room" button
- Seat assignment visualization:
  - Grid layout representing physical seats
  - Color-coded: occupied (green), available (gray), blocked (red)
  - Hover shows student name
  - Click to reassign

### 7. Seat Map Component (`/components/dashboard/SeatMap.tsx`)
- Visual grid representation of room seats
- Each seat is a small square/rectangle
- Colors:
  - Green = assigned student
  - Gray = empty available seat
  - Red = blocked/unavailable
  - Blue = selected seat (for editing)
- Hover tooltip: student name + seat code
- Click to toggle seat status
- Responsive: scales with room size

### 8. Quick Actions Bar (bottom)
- Floating action bar when course is selected
- Context-aware buttons based on current tab
- Always visible: "New Exam", "Import Roster", "Upload Template"

---

## Visual Design System

### Color Palette (beyond zinc)
- Primary: Blue (blue-500 to blue-600) for selections and CTAs
- Success: Emerald (emerald-500) for completed/assigned
- Warning: Amber (amber-500) for pending attention
- Danger: Rose (rose-500) for errors/blocked
- Info: Sky (sky-500) for informational

### Card Design
- Subtle gradient backgrounds (not flat white)
- Micro-interactions: scale on hover, smooth transitions
- Status indicators: colored left border or top accent
- Shadow depth varies by importance

### Animations
- Framer Motion for page transitions
- Smooth tab switching
- Card hover effects (subtle lift)
- Loading skeletons instead of spinners

---

## Implementation Plan

### Phase 1: Core Components (Priority)
1. Create `CourseSidebar` component
2. Create `SeatMap` visualization component
3. Create `ExamCard` component with progress indicators
4. Create `StudentCard` component

### Phase 2: Dashboard Page
5. Redesign `/app/page.tsx` with two-panel layout
6. Implement course selection and context switching
7. Add tab navigation system

### Phase 3: Feature Tabs
8. Build Overview tab with stats and actions
9. Build Exams tab with visual cards
10. Build Roster tab with drag-and-drop import
11. Build Rooms tab with seat map

### Phase 4: Polish
12. Add animations and transitions
13. Implement loading skeletons
14. Dark mode refinement
15. Mobile responsive adaptation

---

## Files to Create/Modify

### New Files
- `/components/dashboard/CourseSidebar.tsx`
- `/components/dashboard/SeatMap.tsx`
- `/components/dashboard/ExamCard.tsx`
- `/components/dashboard/StudentCard.tsx`
- `/components/dashboard/RoomCard.tsx`
- `/components/dashboard/StatCard.tsx`
- `/components/dashboard/QuickActions.tsx`
- `/components/dashboard/WorkspaceTabs.tsx`

### Modified Files
- `/app/app/page.tsx` — Complete redesign
- `/app/globals.css` — Add custom animations
- `/components/index.ts` — Export new components

---

## Success Criteria
- Staff can select a course and see all relevant info in one view
- Room seat assignment is visual and intuitive
- CSV import is drag-and-drop with preview
- Template upload is one-click from any view
- Status progression is clear with visual indicators
- Mobile-friendly with collapsible sidebar