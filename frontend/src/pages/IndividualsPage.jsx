import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem,
  InputAdornment, TablePagination, Alert,
  TextField, Rating, Snackbar, IconButton, Tooltip, useTheme,
} from '@mui/material';
import {
  Search as SearchIcon, People as PeopleIcon,
  CloudSync as SyncIcon, Edit as EditIcon,
  Psychology as SkillsIcon, Add as AddIcon, Delete as DeleteIcon,
} from '@mui/icons-material';
import individualsService from '../services/individualsService';
import teamsService from '../services/teamsService';
import skillsService from '../services/skillsService';
import authService from '../services/authService';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button as MuiButton
} from '@mui/material';

export default function IndividualsPage() {
  const theme = useTheme();
  const [individuals, setIndividuals] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [editOpen, setEditOpen] = useState(false);
  const [editInd, setEditInd] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // Skills assessment state
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skillsInd, setSkillsInd] = useState(null);
  const [indSkills, setIndSkills] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [addSkillForm, setAddSkillForm] = useState({ skill_id: '', proficiency: 3 });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const userRole = authService.getUser()?.role;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ind, t] = await Promise.all([
        individualsService.getAll(),
        teamsService.getAll().catch(() => []),
      ]);
      setIndividuals(ind);
      setTeams(t);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = individuals.filter(i => {
    const matchesSearch = !search || 
      `${i.employee_id} ${i.first_name} ${i.last_name} ${i.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !filterTeam || i.team_id === filterTeam;
    return matchesSearch && matchesTeam;
  });

  const handleSaveTeam = async () => {
    if (!editInd) return;
    setSaveLoading(true);
    try {
      await individualsService.update(editInd.id, editInd);
      await loadData();
      setEditOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  // --- Skills Assessment ---
  const openSkillsDialog = async (ind) => {
    setSkillsInd(ind);
    setSkillsOpen(true);
    setSkillsLoading(true);
    try {
      const [skills, cat] = await Promise.all([
        skillsService.getIndividualSkills(ind.id),
        skillsService.getCatalog(),
      ]);
      setIndSkills(skills);
      setCatalog(cat);
    } catch {
      setSnack({ open: true, message: 'Failed to load skills', severity: 'error' });
    } finally {
      setSkillsLoading(false);
    }
  };

  const handleAddSkill = async () => {
    if (!addSkillForm.skill_id || !skillsInd) return;
    try {
      await skillsService.setIndividualSkill({
        individual_id: skillsInd.id,
        skill_id: addSkillForm.skill_id,
        proficiency: addSkillForm.proficiency,
        assessed_by: authService.getUser()?.id,
      });
      const updated = await skillsService.getIndividualSkills(skillsInd.id);
      setIndSkills(updated);
      setAddSkillForm({ skill_id: '', proficiency: 3 });
      setSnack({ open: true, message: 'Skill assessed', severity: 'success' });
    } catch {
      setSnack({ open: true, message: 'Failed to add skill', severity: 'error' });
    }
  };

  const handleUpdateProficiency = async (skill, newValue) => {
    try {
      await skillsService.setIndividualSkill({
        individual_id: skillsInd.id,
        skill_id: skill.skill_id,
        proficiency: newValue,
        assessed_by: authService.getUser()?.id,
      });
      const updated = await skillsService.getIndividualSkills(skillsInd.id);
      setIndSkills(updated);
    } catch {
      setSnack({ open: true, message: 'Failed to update', severity: 'error' });
    }
  };

  const handleDeleteSkill = async (skillRecordId) => {
    try {
      await skillsService.deleteIndividualSkill(skillRecordId);
      const updated = await skillsService.getIndividualSkills(skillsInd.id);
      setIndSkills(updated);
      setSnack({ open: true, message: 'Skill removed', severity: 'success' });
    } catch {
      setSnack({ open: true, message: 'Failed to remove', severity: 'error' });
    }
  };

  const proficiencyLabels = ['', 'Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon sx={{ color: 'primary.main' }} /> Individuals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Employee records synced from the HRIS system
          </Typography>
        </Box>
      </Box>



      <Paper sx={{ borderRadius: 3, overflow: 'hidden', width: '100%', overflowX: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search by ID, name, email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled' }} /></InputAdornment> }}
            sx={{ minWidth: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Filter by Team</InputLabel>
            <Select value={filterTeam} label="Filter by Team" onChange={(e) => { setFilterTeam(e.target.value); setPage(0); }}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">All Teams</MenuItem>
              {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                    <TableCell>Employee ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Staff Type</TableCell>
                    <TableCell>Status</TableCell>
                    {['admin', 'hr', 'manager'].includes(userRole) && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">No individuals found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((ind) => (
                      <TableRow key={ind.id} hover sx={{ transition: 'background 0.2s' }}>
                        <TableCell>
                          <Chip label={ind.employee_id || '—'} size="small"
                            sx={{ borderRadius: 1.5, fontWeight: 600, fontFamily: 'monospace', bgcolor: `${theme.palette.secondary.main}20`, color: 'secondary.main' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {ind.first_name} {ind.last_name}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{ind.email || '—'}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{ind.team_name || '—'}</Typography></TableCell>
                        <TableCell>
                          <Chip size="small" label={ind.is_direct_staff ? 'Direct' : 'Non-Direct'}
                            sx={{
                              borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                              bgcolor: ind.is_direct_staff ? `${theme.palette.success.main}15` : `${theme.palette.warning.main}15`,
                              color: ind.is_direct_staff ? 'success.main' : 'warning.main',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip size="small"
                            label={ind.is_active !== false ? 'Active' : 'Inactive'}
                            sx={{
                              borderRadius: 1.5, fontWeight: 500, fontSize: '0.7rem',
                              bgcolor: ind.is_active !== false ? `${theme.palette.primary.main}15` : `${theme.palette.error.main}15`,
                              color: ind.is_active !== false ? 'primary.main' : 'error.main',
                            }}
                          />
                        </TableCell>
                        {['admin', 'hr', 'manager'].includes(userRole) && (
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                              <Tooltip title="Assess Skills">
                                <MuiButton size="small" variant="outlined" startIcon={<SkillsIcon />}
                                  onClick={() => openSkillsDialog(ind)}
                                  sx={{ borderRadius: 2, fontSize: '0.7rem', minWidth: 'auto' }}
                                >
                                  Skills
                                </MuiButton>
                              </Tooltip>
                              <MuiButton size="small" variant="outlined" startIcon={<EditIcon />} 
                                onClick={() => { setEditInd({...ind}); setEditOpen(true); }}
                                sx={{ borderRadius: 2, fontSize: '0.7rem', minWidth: 'auto' }}
                              >
                                Team
                              </MuiButton>
                            </Box>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={filtered.length} page={page} rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[5, 10, 25]} />
          </>
        )}
      </Paper>

      {/* Team Assignment Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Assign Team</DialogTitle>
        <DialogContent dividers>
          {editInd && (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Team</InputLabel>
              <Select value={editInd.team_id || ''} label="Team"
                onChange={(e) => setEditInd({...editInd, team_id: e.target.value})}
              >
                <MenuItem value="">None</MenuItem>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <MuiButton onClick={() => setEditOpen(false)} disabled={saveLoading}>Cancel</MuiButton>
          <MuiButton onClick={handleSaveTeam} variant="contained" disabled={saveLoading} sx={{ borderRadius: 2 }}>
            {saveLoading ? <CircularProgress size={24} /> : 'Save'}
          </MuiButton>
        </DialogActions>
      </Dialog>

      {/* Skills Assessment Dialog */}
      <Dialog open={skillsOpen} onClose={() => setSkillsOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SkillsIcon sx={{ color: 'primary.main' }} />
          Skills Assessment — {skillsInd?.first_name} {skillsInd?.last_name}
        </DialogTitle>
        <DialogContent dividers>
          {skillsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : (
            <Box>
              {/* Current Skills */}
              {indSkills.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Current Assessed Skills</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {indSkills.map(skill => (
                      <Box key={skill.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600}>{skill.skill_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{skill.category}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Rating value={skill.proficiency} size="small"
                            onChange={(_, v) => { if (v) handleUpdateProficiency(skill, v); }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
                            {proficiencyLabels[skill.proficiency]}
                          </Typography>
                          <IconButton size="small" onClick={() => handleDeleteSkill(skill.id)} sx={{ color: 'error.main' }}>
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Add New Skill */}
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Add Skill Assessment</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 250, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} size="small">
                  <InputLabel>Select Skill</InputLabel>
                  <Select value={addSkillForm.skill_id} label="Select Skill"
                    onChange={(e) => setAddSkillForm({ ...addSkillForm, skill_id: e.target.value })}
                  >
                    {catalog.filter(c => !indSkills.find(s => s.skill_id === c.id)).map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name} ({c.category})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Rating value={addSkillForm.proficiency}
                    onChange={(_, v) => setAddSkillForm({ ...addSkillForm, proficiency: v || 1 })}
                  />
                  <Typography variant="caption" color="text.secondary">{proficiencyLabels[addSkillForm.proficiency]}</Typography>
                </Box>
                <MuiButton variant="contained" startIcon={<AddIcon />} onClick={handleAddSkill}
                  disabled={!addSkillForm.skill_id}
                  sx={{ borderRadius: 2, background: theme.palette.mode === 'light' 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)' }}
                >
                  Assess
                </MuiButton>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <MuiButton onClick={() => setSkillsOpen(false)} sx={{ borderRadius: 2 }}>Close</MuiButton>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

