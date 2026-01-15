import { Short } from '../../../shared/types';

export type ColumnType = 'idea' | 'script' | 'clips' | 'clip_changes' | 'editing' | 'editing_changes' | 'ready_to_upload' | 'uploaded';

export interface Column {
  id: ColumnType;
  title: string;
  color: string;
  canAdd?: boolean;
  order: number; // For validation
}

export const columns: Column[] = [
  { id: 'idea', title: 'Idea', color: '#8B5CF6', canAdd: true, order: 0 },
  { id: 'script', title: 'Script', color: '#3B82F6', canAdd: true, order: 1 },
  { id: 'clips', title: 'Clips', color: '#F59E0B', order: 2 },
  { id: 'clip_changes', title: 'Clip Changes', color: '#EF4444', order: 3 },
  { id: 'editing', title: 'Editing', color: '#10B981', order: 4 },
  { id: 'editing_changes', title: 'Editing Changes', color: '#06B6D4', order: 5 },
  { id: 'ready_to_upload', title: 'Ready to Upload', color: '#F59E0B', order: 6 },
  { id: 'uploaded', title: 'Uploaded/Scheduled', color: '#84CC16', order: 7 },
];

// Map database status to column
export const statusToColumn = (status: string): ColumnType => {
  const map: Record<string, ColumnType> = {
    'idea': 'idea',
    'script': 'script',
    'clipping': 'clips',
    'clips': 'clips',
    'clip_changes': 'clip_changes',
    'editing': 'editing',
    'editing_changes': 'editing_changes',
    'completed': 'ready_to_upload',
    'ready_to_upload': 'ready_to_upload',
    'uploaded': 'uploaded',
  };
  return map[status] || 'idea';
};

// Map column to database status
export const columnToStatus = (column: ColumnType): string => {
  const map: Record<ColumnType, string> = {
    'idea': 'idea',
    'script': 'script',
    'clips': 'clips',
    'clip_changes': 'clip_changes',
    'editing': 'editing',
    'editing_changes': 'editing_changes',
    'ready_to_upload': 'ready_to_upload',
    'uploaded': 'uploaded',
  };
  return map[column];
};

// Get valid columns for a given column (can move forward or backward one step, or admin can move to clip_changes/editing_changes)
// Also allows clips->editing and editing->uploaded if marked complete
export const getValidColumns = (currentColumn: ColumnType, isAdmin: boolean = false, short?: Short): ColumnType[] => {
  const current = columns.find(c => c.id === currentColumn);
  if (!current) return [];
  
  const valid: ColumnType[] = [];
  // Can move to previous column
  const prev = columns.find(c => c.order === current.order - 1);
  if (prev) valid.push(prev.id);
  // Can move to next column
  const next = columns.find(c => c.order === current.order + 1);
  if (next) valid.push(next.id);
  
  // Admin can also move to clip_changes or editing_changes from clips/editing
  if (isAdmin) {
    if (currentColumn === 'clips') {
      valid.push('clip_changes');
    } else if (currentColumn === 'editing') {
      valid.push('editing_changes');
    }
  }
  
  // Allow clips->editing if clips are marked complete
  if (currentColumn === 'clips' || currentColumn === 'clip_changes') {
    if (short?.clips_completed_at) {
      const editingColumn = columns.find(c => c.id === 'editing');
      if (editingColumn) valid.push('editing');
    }
  }
  
  // Allow editing->ready_to_upload if editing is marked complete
  if (currentColumn === 'editing' || currentColumn === 'editing_changes') {
    if (short?.editing_completed_at) {
      const readyToUploadColumn = columns.find(c => c.id === 'ready_to_upload');
      if (readyToUploadColumn) valid.push('ready_to_upload');
    }
  }
  
  // Allow ready_to_upload->uploaded (can always move forward)
  if (currentColumn === 'ready_to_upload') {
    const uploadedColumn = columns.find(c => c.id === 'uploaded');
    if (uploadedColumn) valid.push('uploaded');
  }
  
  return valid;
};

