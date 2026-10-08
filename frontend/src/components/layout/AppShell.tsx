import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthProvider';
import { getNavigationItemsByRole, normalizeRole } from '../../app/auth/roleAccess';

const drawerWidth = 260;

const ShellRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflowX: 'hidden',
  '&::before': {
    content: '""',
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(circle at 14% 12%, rgba(37, 99, 235, 0.08), transparent 24%), radial-gradient(circle at 88% 10%, rgba(56, 189, 248, 0.06), transparent 20%)',
    zIndex: 0,
  },
  '& > *': {
    position: 'relative',
    zIndex: 1,
  },
}));

const ShellDrawer = styled(Drawer)({
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, rgba(248,251,255,0.97) 0%, rgba(244,248,253,0.94) 100%)',
    border: '1px solid rgba(219, 228, 240, 0.9)',
    borderLeft: 'none',
    backdropFilter: 'blur(18px)',
    borderRadius: '0 18px 18px 0',
    boxShadow: '0 20px 42px rgba(15, 23, 42, 0.10)',
    transition: 'transform 240ms ease, box-shadow 220ms ease',
    overflow: 'hidden',
  },
});

const NavigationList = styled(List)({
  paddingInline: 12,
  paddingTop: 18,
  paddingBottom: 16,
});

const DrawerTopArea = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 76,
  display: 'flex',
  alignItems: 'center',
  paddingInline: 20,
  background: 'linear-gradient(180deg, rgba(248,251,255,0.97) 0%, rgba(244,248,253,0.94) 100%)',
  zIndex: 1,
  boxSizing: 'border-box',
  color: theme.palette.text.primary,
}));

const NavigationItem = styled(ListItemButton)(({ theme }) => ({
  paddingInline: 12,
  marginBottom: 4,
  borderRadius: 20,
  color: theme.palette.text.secondary,
  transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease',
  '&:hover': {
    backgroundColor: '#f1f5fc',
    transform: 'translateX(2px)',
  },
  '&.Mui-selected': {
    backgroundColor: '#eaf1ff',
    color: theme.palette.primary.main,
    border: '1px solid #cfe0ff',
  },
})) as typeof ListItemButton;

const ShellHeader = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== '$drawerOpen',
})<{ $drawerOpen: boolean }>(({ theme, $drawerOpen }) => ({
  position: 'relative',
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  backdropFilter: 'blur(18px)',
  boxShadow: '0 10px 26px rgba(15, 23, 42, 0.06)',
  zIndex: theme.zIndex.modal + 1,
  '&::before': $drawerOpen ? {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: drawerWidth,
    background: 'linear-gradient(180deg, rgba(248,251,255,0.97) 0%, rgba(244,248,253,0.94) 100%)',
    boxShadow: '0 20px 42px rgba(15, 23, 42, 0.10)',
    pointerEvents: 'none',
  } : {},
}));

const HeaderToolbar = styled(Toolbar)({
  justifyContent: 'space-between',
  minHeight: 76,
  position: 'relative',
  zIndex: 1,
});

const HeaderActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const ShellContent = styled(Box)({
  flexGrow: 1,
  minWidth: 0,
});

const MenuButton = styled(IconButton)(({ theme }) => ({
  display: 'inline-flex',
  width: 36,
  height: 36,
  color: theme.palette.text.secondary,
  borderRadius: 10,
  transition: 'background-color 180ms ease, color 180ms ease, transform 180ms ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.07),
    color: theme.palette.primary.main,
  },
  '&:active': {
    transform: 'translateY(1px)',
  },
}));

const HeaderBrand = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
});

const HeaderTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  fontFamily: theme.typography.fontFamily,
  fontSize: '1.08rem',
  lineHeight: 1.2,
}));

const SecondaryHeaderText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontFamily: theme.typography.caption.fontFamily,
}));

const LogoutDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiPaper-root': {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
    boxShadow: '0 22px 44px rgba(15, 23, 42, 0.12)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.98) 100%)',
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(23, 32, 51, 0.12)',
  },
}));

export function AppShell({ children }: PropsWithChildren) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const role = normalizeRole(user?.role);
  const navItems = getNavigationItemsByRole(role).map((item) => ({
    ...item,
    icon:
      item.to === '/' || item.to === '/member'
        ? <DashboardOutlinedIcon />
        : item.to === '/tasks/new' || item.to === '/member/tasks'
          ? <TaskAltOutlinedIcon />
          : item.to === '/member/history'
            ? <HistoryRoundedIcon />
            : <FactCheckOutlinedIcon />,
  }));

  const navigationContent = (
    <>
      <DrawerTopArea>
        <HeaderBrand>
          <MenuButton
            onClick={handleDrawerToggle}
            aria-label={drawerOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
          >
            <MenuRoundedIcon />
          </MenuButton>
          <Box sx={{ minWidth: 0 }}>
            <HeaderTitle variant="body2">IDS Team</HeaderTitle>
          </Box>
        </HeaderBrand>
      </DrawerTopArea>
      <NavigationList>
        {navItems.map((item) => (
          <NavigationItem
            key={item.to}
            component={Link}
            to={item.to}
            selected={location.pathname === item.to}
            onClick={() => setDrawerOpen(false)}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 500 }} />
          </NavigationItem>
        ))}
      </NavigationList>
    </>
  );

  function handleDrawerToggle() {
    setDrawerOpen((current) => !current);
  }

  return (
    <ShellRoot>
      <ShellDrawer
        variant="temporary"
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          zIndex: (theme) => theme.zIndex.modal,
          '& .MuiDrawer-paper': {
            left: 0,
            top: 0,
            bottom: 0,
            height: '100%',
            paddingTop: '76px',
            boxSizing: 'border-box',
          },
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(23, 32, 51, 0.08)',
          },
        }}
      >
        {navigationContent}
      </ShellDrawer>
      <ShellContent>
        <ShellHeader position="sticky" color="transparent" elevation={0} $drawerOpen={drawerOpen}>
          <HeaderToolbar sx={{ px: { xs: 2.5, md: 4 } }}>
            <HeaderBrand>
              <MenuButton
                onClick={handleDrawerToggle}
                aria-label={drawerOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
              >
                <MenuRoundedIcon />
              </MenuButton>
              <Box sx={{ minWidth: 0 }}>
                <HeaderTitle variant="body2">IDS Team</HeaderTitle>
              </Box>
            </HeaderBrand>
            <HeaderActions>
              <Box
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  minWidth: 0,
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 0.2,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={(theme) => ({
                    fontWeight: 600,
                    fontFamily: theme.typography.fontFamily,
                    fontSize: '1rem',
                    lineHeight: 1.25,
                  })}
                >
                  {user?.fullName ?? 'User'}
                </Typography>
                <SecondaryHeaderText variant="caption">
                  {user?.role ?? 'Role'}
                </SecondaryHeaderText>
              </Box>
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontWeight: 700 }}>
                {user?.fullName?.charAt(0) ?? 'U'}
              </Avatar>
              <Button
                color="inherit"
                onClick={() => setLogoutDialogOpen(true)}
                startIcon={<LogoutRoundedIcon />}
                sx={(theme) => ({
                  ml: 0.5,
                  color: 'text.secondary',
                  fontFamily: theme.typography.fontFamily,
                  fontWeight: 500,
                })}
              >
                Logout
              </Button>
            </HeaderActions>
          </HeaderToolbar>
        </ShellHeader>
        <Box
          component="main"
          sx={{
            width: '100%',
            maxWidth: 1600,
            mx: 'auto',
            px: { xs: 2, sm: 2.5, md: 4 },
            py: { xs: 2.5, md: 4 },
            minWidth: 0,
          }}
        >
          {children}
        </Box>
      </ShellContent>
      <LogoutDialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        aria-labelledby="logout-confirmation-title"
      >
        <DialogTitle
          id="logout-confirmation-title"
          sx={(theme) => ({
            pb: 1,
            fontFamily: theme.typography.fontFamily,
            fontWeight: 700,
            fontSize: '1.15rem',
            color: 'text.primary',
          })}
        >
          Confirm logout
        </DialogTitle>
        <DialogContent
          sx={(theme) => ({
            pt: '4px !important',
            color: 'text.secondary',
            fontFamily: theme.typography.body2.fontFamily,
          })}
        >
          Are you sure you want to log out of IDS Team?
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setLogoutDialogOpen(false)}
            sx={{ minWidth: 96 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={logout}
            sx={{ minWidth: 96 }}
          >
            Logout
          </Button>
        </DialogActions>
      </LogoutDialog>
    </ShellRoot>
  );
}
