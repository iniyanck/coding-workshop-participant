import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <WarningIcon sx={{ color: 'warning.main' }} />
        {title || 'Confirm Action'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>{message || 'Are you sure you want to proceed?'}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color="error" sx={{ borderRadius: 2 }}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
