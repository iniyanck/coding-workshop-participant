import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, LinearProgress,
  Accordion, AccordionSummary, AccordionDetails, Checkbox, Divider, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, ExpandMore as ExpandIcon,
  Assignment as PlanIcon, CheckCircle as DoneIcon,
  RadioButtonUnchecked as TodoIcon, PlayCircle as InProgressIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import devplansService from '../services/devplansService';
import individualsService from '../services/individualsService';
import teamsService from '../services/teamsService';
import authService from '../services/authService';
import ConfirmDialog from '../components/ConfirmDialog';

const ITEM_TYPES = ['training', 'certification', 'mentoring', 'project', 'reading', 'other'];
const PLAN_STATUSES = ['draft', 'in_progress', 'completed'];

export default function DevPlansPage() {
  const theme = useTheme();
  const [plans, setPlans] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ individual_id: '', title: '', description: '', status: 'draft', target_date: '' });
  const [itemForm, setItemForm] = useState({ plan_id: '', description: '', item_type: 'training', due_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('plan');
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [planDetails, setPlanDetails] = useState({});
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [filterIndividual, setFilterIndividual] = useState('');

  const user = authService.getUser();
  const role = user?.role;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ind, t] = await Promise.all([
        individualsService.getAll().catch(() => []),
        teamsService.getAll().catch(() => []),
      ]);
      setIndividuals(ind);
      setTeams(t);

      // Load plans based on role
      let plansData = [];
      if (role === 'employee') {
        // Find my individual record
        const myInd = ind.find(i => i.user_id === user?.id);
        if (myInd) {
          plansData = await devplansService.getPlans({ individual_id: myInd.id });
        }
      } else if (role === 'manager') {
        // Get plans for my teams
        const myTeams = t.filter(tm => tm.leader_id === user?.id);
        const teamPlans = await Promise.all(
          myTeams.map(tm => devplansService.getPlans({ team_id: tm.id }).catch(() => []))
        );
        plansData = teamPlans.flat();
      } else {
        // Admin/HR see all
        plansData = await devplansService.getPlans();
      }
      setPlans(plansData);
    } catch (err) {
      console.error(err);
      showSnack('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPlanDetails = async (planId) => {
    try {
      const detail = await devplansService.getPlanById(planId);
      setPlanDetails(prev => ({ ...prev, [planId]: detail }));
    } catch {
      showSnack('Failed to load plan details', 'error');
    }
  };

  const handleExpandPlan = (planId) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
    } else {
      setExpandedPlan(planId);
      if (!planDetails[planId]) loadPlanDetails(planId);
    }
  };

  const handleSavePlan = async () => {
    if (!planForm.title.trim() || !planForm.individual_id) return;
    setSaving(true);
    try {
      if (editingPlan) {
        await devplansService.updatePlan(editingPlan, planForm);
        showSnack('Plan updated');
      } else {
        await devplansService.createPlan(planForm);
        showSnack('Plan created');
      }
      setPlanDialogOpen(false);
      setEditingPlan(null);
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemForm.description.trim()) return;
    setSaving(true);
    try {
      await devplansService.createItem(itemForm);
      showSnack('Item added');
      setItemDialogOpen(false);
      loadPlanDetails(itemForm.plan_id);
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleItem = async (item) => {
    const nextStatus = item.status === 'completed' ? 'not_started' : item.status === 'in_progress' ? 'completed' : 'in_progress';
    try {
      await devplansService.updateItem(item.id, { ...item, status: nextStatus });
      loadPlanDetails(item.plan_id);
      loadData();
    } catch {
      showSnack('Failed to update item', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      if (deleteType === 'plan') {
        await devplansService.deletePlan(deleteTarget);
        showSnack('Plan deleted');
        loadData();
      } else {
        const item = Object.values(planDetails).flatMap(p => p.items || []).find(i => i.id === deleteTarget);
        await devplansService.deleteItem(deleteTarget);
        showSnack('Item deleted');
        if (item) loadPlanDetails(item.plan_id);
        loadData();
      }
      setDeleteTarget(null);
    } catch {
      showSnack('Delete failed', 'error');
    }
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan.id);
    setPlanForm({
      individual_id: plan.individual_id,
      title: plan.title,
      description: plan.description || '',
      status: plan.status || 'draft',
      target_date: plan.target_date || '',
    });
    setPlanDialogOpen(true);
  };

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const filteredPlans = filterIndividual
    ? plans.filter(p => p.individual_id === filterIndividual)
    : plans;

  const getIndName = (id) => {
    const ind = individuals.find(i => i.id === id);
    return ind ? `${ind.first_name} ${ind.last_name}` : 'Unknown';
  };

  const statusIcon = (status) => {
    if (status === 'completed') return <DoneIcon sx={{ color: 'success.main', fontSize: 20 }} />;
    if (status === 'in_progress') return <InProgressIcon sx={{ color: 'primary.main', fontSize: 20 }} />;
    return <TodoIcon sx={{ color: 'text.disabled', fontSize: 20 }} />;
  };

  const statusColors = {
    draft: { bg: 'action.hover', color: 'text.secondary' },
    in_progress: { bg: `${theme.palette.primary.main}15`, color: 'primary.main' },
    completed: { bg: `${theme.palette.success.main}15`, color: 'success.main' },
    not_started: { bg: 'action.hover', color: 'text.secondary' },
  };

  const typeColors = {
    training: theme.palette.primary.main,
    certification: theme.palette.secondary.main,
    mentoring: theme.palette.warning.main,
    project: theme.palette.success.main,
    reading: theme.palette.info.main,
    other: theme.palette.text.secondary,
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlanIcon sx={{ color: 'primary.main' }} /> Development Plans
          </Typography>
          <Typography variant="body2" color="text.secondary">Track employee growth, training, and career development</Typography>
        </Box>
        {authService.canCreate() && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => {
              setEditingPlan(null);
              setPlanForm({ individual_id: '', title: '', description: '', status: 'draft', target_date: '' });
              setPlanDialogOpen(true);
            }}
            sx={{
              borderRadius: 2, fontWeight: 600, px: 3,
              background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)'
                : 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
              boxShadow: theme.palette.mode === 'light' 
                ? '0 4px 14px rgba(139,92,246,0.4)'
                : '0 4px 14px rgba(0,0,0,0.4)',
            }}
          >
            New Plan
          </Button>
        )}
      </Box>

      {/* Filter */}
      {role !== 'employee' && (
        <Box sx={{ mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 250, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Filter by Employee</InputLabel>
            <Select value={filterIndividual} label="Filter by Employee"
              onChange={(e) => setFilterIndividual(e.target.value)}
            >
              <MenuItem value="">All Employees</MenuItem>
              {individuals.map(i => <MenuItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      ) : filteredPlans.length === 0 ? (
        <Paper sx={{ borderRadius: 3, p: 6, textAlign: 'center' }}>
          <PlanIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={600}>No development plans yet</Typography>
          <Typography variant="body2" color="text.secondary">Create a plan to start tracking growth and training</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredPlans.map(plan => {
            const detail = planDetails[plan.id];
            const progress = plan.progress || 0;
            return (
              <Accordion key={plan.id} expanded={expandedPlan === plan.id} onChange={() => handleExpandPlan(plan.id)}
                sx={{
                  borderRadius: '12px !important', overflow: 'hidden',
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <AccordionSummary expandIcon={<ExpandIcon />} sx={{ px: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="subtitle1" fontWeight={700}>{plan.title}</Typography>
                      {role !== 'employee' && (
                        <Typography variant="caption" color="text.secondary">
                          {plan.individual_name || getIndName(plan.individual_id)}
                        </Typography>
                      )}
                    </Box>
                    <Chip label={plan.status?.replace('_', ' ')} size="small"
                      sx={{
                        fontWeight: 600, borderRadius: 1.5, textTransform: 'capitalize',
                        bgcolor: statusColors[plan.status]?.bg,
                        color: statusColors[plan.status]?.color,
                      }}
                    />
                    <Box sx={{ minWidth: 120, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={progress}
                        sx={{
                          flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            background: progress === 100 
                              ? `linear-gradient(135deg, ${theme.palette.success.light}, ${theme.palette.success.main})` 
                              : `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                          },
                        }}
                      />
                      <Typography variant="caption" fontWeight={600} color="text.secondary">{progress}%</Typography>
                    </Box>
                    {plan.target_date && (
                      <Chip label={`Due: ${plan.target_date}`} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pt: 0, pb: 3 }}>
                  <Divider sx={{ mb: 2 }} />
                  {plan.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{plan.description}</Typography>
                  )}

                  {/* Plan Items Checklist */}
                  {detail?.items?.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                      {detail.items.map(item => (
                        <Box key={item.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2,
                          bgcolor: item.status === 'completed' ? `${theme.palette.success.main}08` : 'action.hover',
                          border: '1px solid', borderColor: item.status === 'completed' ? `${theme.palette.success.main}20` : 'divider',
                          transition: 'all 0.2s',
                        }}>
                          <Tooltip title={item.status === 'completed' ? 'Mark incomplete' : item.status === 'in_progress' ? 'Mark complete' : 'Start'}>
                            <IconButton size="small" onClick={() => handleToggleItem(item)}>
                              {statusIcon(item.status)}
                            </IconButton>
                          </Tooltip>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={500}
                              sx={{ textDecoration: item.status === 'completed' ? 'line-through' : 'none', color: item.status === 'completed' ? 'text.secondary' : 'text.primary' }}
                            >
                              {item.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              <Chip label={item.item_type} size="small"
                                sx={{ height: 18, fontSize: '0.6rem', borderRadius: 1, bgcolor: `${typeColors[item.item_type]}20`, color: typeColors[item.item_type] }}
                              />
                              {item.due_date && <Typography variant="caption" color="text.secondary">Due: {item.due_date}</Typography>}
                            </Box>
                          </Box>
                          <IconButton size="small" onClick={() => { setDeleteTarget(item.id); setDeleteType('item'); }} sx={{ color: 'error.main' }}>
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                      No items in this plan yet. Add activities to track progress.
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" startIcon={<AddIcon />}
                      onClick={() => { setItemForm({ plan_id: plan.id, description: '', item_type: 'training', due_date: '', notes: '' }); setItemDialogOpen(true); }}
                      sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                      Add Item
                    </Button>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openEditPlan(plan)}
                      sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                      Edit Plan
                    </Button>
                    <Button size="small" startIcon={<DeleteIcon />} color="error"
                      onClick={() => { setDeleteTarget(plan.id); setDeleteType('plan'); }}
                      sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                      Delete Plan
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}

      {/* Create/Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingPlan ? 'Edit Plan' : 'New Development Plan'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <FormControl fullWidth sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Employee *</InputLabel>
            <Select value={planForm.individual_id} label="Employee *"
              onChange={(e) => setPlanForm({ ...planForm, individual_id: e.target.value })}
              disabled={!!editingPlan}
            >
              {individuals.map(i => <MenuItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Plan Title *" value={planForm.title}
            onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField fullWidth label="Description" value={planForm.description} multiline rows={2}
            onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Status</InputLabel>
              <Select value={planForm.status} label="Status"
                onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
              >
                {PLAN_STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField 
              label="Target Date" 
              type="date" 
              value={planForm.target_date}
              onChange={(e) => setPlanForm({ ...planForm, target_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              inputProps={{ placeholder: " " }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPlanDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePlan} disabled={saving || !planForm.title || !planForm.individual_id}
            sx={{ borderRadius: 2, background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)'
                : 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : (editingPlan ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Development Activity</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="Description *" value={itemForm.description}
            onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Activity Type</InputLabel>
              <Select value={itemForm.item_type} label="Activity Type"
                onChange={(e) => setItemForm({ ...itemForm, item_type: e.target.value })}
              >
                {ITEM_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField 
              label="Due Date" 
              type="date" 
              value={itemForm.due_date}
              onChange={(e) => setItemForm({ ...itemForm, due_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              inputProps={{ placeholder: " " }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <TextField fullWidth label="Notes" value={itemForm.notes} multiline rows={2}
            onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setItemDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveItem} disabled={saving || !itemForm.description}
            sx={{ borderRadius: 2, background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)'
                : 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)' }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title={deleteType === 'plan' ? 'Delete Plan' : 'Delete Item'}
        message={deleteType === 'plan' ? 'This will delete the plan and all its items. Continue?' : 'Delete this activity item?'}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

