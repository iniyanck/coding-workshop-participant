import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Skeleton, Chip, Avatar, List,
  ListItem, ListItemAvatar, ListItemText, Divider, Paper,
} from '@mui/material';
import {
  People as PeopleIcon, Groups as GroupsIcon, EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon, LocationOn as LocationIcon,
} from '@mui/icons-material';
import teamsService from '../services/teamsService';
import individualsService from '../services/individualsService';
import achievementsService from '../services/achievementsService';
import authService from '../services/authService';

const StatCard = ({ title, value, icon, gradient, loading, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      borderRadius: 3, cursor: onClick ? 'pointer' : 'default', transition: 'all 0.3s',
      '&:hover': onClick ? { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' } : {},
      overflow: 'visible', position: 'relative',
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
            {title}
          </Typography>
          {loading ? (
            <Skeleton width={60} height={42} />
          ) : (
            <Typography variant="h3" sx={{ fontWeight: 800, background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {value}
            </Typography>
          )}
        </Box>
        <Avatar sx={{ width: 48, height: 48, background: gradient, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const [teams, setTeams] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = authService.getUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, i, a] = await Promise.all([
        teamsService.getAll().catch(() => []),
        individualsService.getAll().catch(() => []),
        achievementsService.getAll().catch(() => []),
      ]);
      setTeams(t);
      setIndividuals(i);
      setAchievements(a);
    } finally {
      setLoading(false);
    }
  };

  // Business metrics from requirements
  const remoteLeaderTeams = teams.filter(t => {
    if (!t.leader_id) return false;
    const leader = individuals.find(i => i.id === t.leader_id);
    return leader && leader.location !== t.location;
  });

  const nonDirectLeaderTeams = teams.filter(t => {
    if (!t.leader_id) return false;
    const leader = individuals.find(i => i.id === t.leader_id);
    return leader && !leader.is_direct_staff;
  });

  const highNonDirectRatioTeams = teams.filter(t => {
    const members = individuals.filter(i => i.team_id === t.id);
    if (members.length === 0) return false;
    const nonDirect = members.filter(m => !m.is_direct_staff).length;
    return (nonDirect / members.length) > 0.2;
  });

  const orgLeaderTeams = teams.filter(t => t.org_leader_id);

  const recentAchievements = achievements.slice(0, 5);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Welcome back, {user?.username}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's your team management overview
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Total Individuals" value={individuals.length} loading={loading}
            icon={<PeopleIcon />} gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            onClick={() => navigate('/individuals')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Total Teams" value={teams.length} loading={loading}
            icon={<GroupsIcon />} gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            onClick={() => navigate('/teams')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Achievements" value={achievements.length} loading={loading}
            icon={<TrophyIcon />} gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            onClick={() => navigate('/achievements')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Locations" value={[...new Set(teams.map(t => t.location).filter(Boolean))].length} loading={loading}
            icon={<LocationIcon />} gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingIcon sx={{ color: '#667eea' }} /> Key Insights
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { label: 'Teams with remote leaders', value: remoteLeaderTeams.length, color: '#f59e0b' },
                { label: 'Teams with non-direct staff leaders', value: nonDirectLeaderTeams.length, color: '#ef4444' },
                { label: 'Teams with >20% non-direct ratio', value: highNonDirectRatioTeams.length, color: '#8b5cf6' },
                { label: 'Teams reporting to org leader', value: orgLeaderTeams.length, color: '#10b981' },
              ].map((item) => (
                <Box key={item.label} sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #f1f5f9',
                }}>
                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                  <Chip label={loading ? '...' : item.value} size="small"
                    sx={{ fontWeight: 700, bgcolor: `${item.color}15`, color: item.color, minWidth: 36 }} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ borderRadius: 3, p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrophyIcon sx={{ color: '#f59e0b' }} /> Recent Achievements
            </Typography>
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} height={60} sx={{ mb: 1 }} />)
            ) : recentAchievements.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No achievements yet. Start tracking your team's wins!
              </Typography>
            ) : (
              <List disablePadding>
                {recentAchievements.map((ach, idx) => (
                  <Box key={ach.id}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#fef3c7', color: '#f59e0b' }}>
                          <TrophyIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="subtitle2" fontWeight={600}>{ach.title}</Typography>}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            {ach.team_name && <Chip label={ach.team_name} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />}
                            <Typography variant="caption" color="text.secondary">{ach.achievement_date}</Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {idx < recentAchievements.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
