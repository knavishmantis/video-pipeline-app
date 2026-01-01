import { Short } from '../../../shared/types';
import { ColumnType, Column } from '../utils/dashboardUtils';
import { shortsApi } from '../services/api';

interface UseCardClickProps {
  assignments: any[];
  user: any;
  isAdmin: boolean;
  setContentShort: (short: Short | null) => void;
  setContentColumn: (column: ColumnType | null) => void;
  setContentForm: (form: {
    script_content: string;
    file: File | null;
    scriptFile: File | null;
    audioFile: File | null;
  }) => void;
  setShowContentModal: (show: boolean) => void;
  navigate: (path: string) => void;
}

export function useCardClick({
  assignments,
  user,
  isAdmin,
  setContentShort,
  setContentColumn,
  setContentForm,
  setShowContentModal,
  navigate,
}: UseCardClickProps) {
  const handleCardClick = async (short: Short, column: Column) => {
    if (!short) return;
    
    // Check permissions
    const canEdit = isAdmin || (
      (column.id === 'clips' || column.id === 'clip_changes') && 
      assignments.some(a => a.short_id === short.id && a.role === 'clipper' && a.user_id === user?.id)
    ) || (
      (column.id === 'editing' || column.id === 'editing_changes') && 
      assignments.some(a => a.short_id === short.id && a.role === 'editor' && a.user_id === user?.id)
    );
    
    if (!canEdit && (column.id === 'clips' || column.id === 'editing' || column.id === 'clip_changes' || column.id === 'editing_changes')) {
      return; // Don't allow editing if not assigned
    }
    
    // Open content modal based on column
    if (column.id === 'script' && !short.script_content) {
      // Load full short data with files
      try {
        const fullShort = await shortsApi.getById(short.id);
        setContentShort(fullShort);
        setContentColumn(column.id);
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      } catch (error) {
        console.error('Failed to load short:', error);
        // Fallback to using existing short data
        setContentShort(short);
        setContentColumn(column.id);
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      }
    } else if (column.id === 'clips' || column.id === 'clip_changes') {
      // Load full short data with files
      try {
        const fullShort = await shortsApi.getById(short.id);
        setContentShort(fullShort);
        setContentColumn('clips'); // Use 'clips' for both clips and clip_changes
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      } catch (error) {
        console.error('Failed to load short:', error);
        // Fallback to using existing short data
        setContentShort(short);
        setContentColumn('clips');
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      }
    } else if (column.id === 'editing' || column.id === 'editing_changes') {
      // Load full short data with files
      try {
        const fullShort = await shortsApi.getById(short.id);
        setContentShort(fullShort);
        setContentColumn('editing'); // Use 'editing' for both editing and editing_changes
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      } catch (error) {
        console.error('Failed to load short:', error);
        // Fallback to using existing short data
        setContentShort(short);
        setContentColumn('editing');
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      }
    } else {
      // Navigate to detail page
      navigate(`/shorts/${short.id}`);
    }
  };

  return { handleCardClick };
}

