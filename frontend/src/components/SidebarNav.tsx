import { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "./ui/sidebar";
import { IconDashboard, IconUsers, IconCurrencyDollar, IconLogout, IconHelp, IconCamera, IconEdit, IconBrandYoutube, IconTarget, IconSun, IconMoon, IconPencil, IconReportSearch, IconMovie, IconBolt } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usersApi, filesApi, shortsApi } from "../services/api";
import { useToast } from "../hooks/useToast";
import { useAlert } from "../hooks/useAlert";
import { getErrorMessage } from "../utils/errorHandler";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

const ICON_COLOR = 'var(--text-secondary)';

export function SidebarNav() {
  const { user, logout, isAuthenticated, refreshUser } = useAuth();
  const { effectiveTheme, toggle: toggleTheme } = useTheme();
  const { showToast, ToastComponent } = useToast();
  const { showAlert, AlertComponent } = useAlert();
  const [open, setOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    discord_username: user?.discord_username || '',
    profile_picture: user?.profile_picture || '',
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetch = () => shortsApi.getReflectionStats().then(d => setOverdueCount(d.overdue_count)).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  useEffect(() => {
    if (user && showProfileModal) {
      setProfileForm({
        discord_username: user.discord_username || '',
        profile_picture: user.profile_picture || '',
      });
      if (user.profile_picture && user.profile_picture.startsWith('http')) {
        setProfileImagePreview(user.profile_picture);
      } else {
        setProfileImagePreview('');
      }
      setProfileImage(null);
    }
  }, [showProfileModal, user]);

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const isClipper = user?.roles?.includes('clipper') || user?.role === 'clipper';
  const isEditor = user?.roles?.includes('editor') || user?.role === 'editor';

  const getProfilePicture = () => {
    if (user?.profile_picture) {
      if (user.profile_picture.startsWith('http')) return user.profile_picture;
      return user.profile_picture;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=F0EBE0&color=B8922E&size=128&bold=true`;
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowProfileModal(true);
    setProfileForm({
      discord_username: user?.discord_username || '',
      profile_picture: user?.profile_picture || '',
    });
    if (user?.profile_picture && user.profile_picture.startsWith('http')) {
      setProfileImagePreview(user.profile_picture);
    } else {
      setProfileImagePreview('');
    }
    setProfileImage(null);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setProfileForm({ ...profileForm, profile_picture: emojiData.emoji });
    setProfileImage(null);
    setProfileImagePreview('');
    setShowEmojiPicker(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setProfileImage(file);
        setProfileForm({ ...profileForm, profile_picture: '' });
        const reader = new FileReader();
        reader.onloadend = () => setProfileImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        showAlert('Please select an image file', { type: 'error' });
      }
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      let profilePictureValue = profileForm.profile_picture || '';
      if (profileImage) {
        try {
          const formDataUpload = new FormData();
          formDataUpload.append('file', profileImage);
          formDataUpload.append('file_type', 'profile_picture');
          formDataUpload.append('user_id', user.id.toString());
          const uploadResult = await filesApi.uploadProfilePicture(formDataUpload);
          profilePictureValue = uploadResult.gcp_bucket_path || uploadResult.url || '';
        } catch (uploadError: unknown) {
          const errorMsg = getErrorMessage(uploadError, 'Image upload failed');
          showAlert(`${errorMsg}. Please try again or use an emoji instead.`, { type: 'error' });
          setSaving(false);
          return;
        }
      }
      const updateData: any = { discord_username: profileForm.discord_username.trim() || null };
      if (profilePictureValue) updateData.profile_picture = profilePictureValue;
      await usersApi.update(user.id, updateData);
      await refreshUser();
      setShowProfileModal(false);
      showToast('Profile updated successfully', 'success');
    } catch (error: unknown) {
      showAlert(getErrorMessage(error, 'Failed to update profile'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const links = [
    {
      label: "Dashboard",
      href: "/",
      icon: <IconDashboard className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    },
    {
      label: "Payments",
      href: "/payments",
      icon: <IconCurrencyDollar className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    },
    {
      label: "Guide",
      href: "/guide",
      icon: <IconHelp className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    },
    {
      label: "YouTube Stats",
      href: "/youtube-stats",
      icon: <IconBrandYoutube className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    },
    ...(isAdmin ? [{
      label: "Reflections",
      href: "/reflections",
      icon: (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <IconPencil className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />
          {overdueCount > 0 && (
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: '#e05a4e', display: 'block' }} />
          )}
        </div>
      ),
    }, {
      label: "Research",
      href: "/research",
      icon: <IconReportSearch className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    }, {
      label: "Script Engine",
      href: "/script-engine",
      icon: <IconBolt className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    }] : []),
    {
      label: "Presets",
      href: "/presets",
      icon: <IconMovie className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    },
    ...((isClipper || isAdmin) ? [{
      label: "Flashback Reference",
      href: "/flashback-reference",
      icon: <IconCamera className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    }] : []),
    ...((isEditor || isAdmin) ? [{
      label: "Editing Reference",
      href: "/editing-reference",
      icon: <IconEdit className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    }] : []),
    ...(isAdmin ? [{
      label: "Users",
      href: "/users",
      icon: <IconUsers className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    }] : []),
  ];

  return (
    <Sidebar open={open} setOpen={setOpen} animate={true}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <SidebarLogo />
          <div style={{ height: '1px', background: 'var(--border-default)', margin: '16px 0' }} />
          <div className="flex flex-col gap-0.5">
            {links.map((link, idx) => (
              <SidebarLink key={idx} link={link} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <div style={{ height: '1px', background: 'var(--border-default)', marginBottom: '8px' }} />

          {/* Theme toggle */}
          <ThemeToggleRow effectiveTheme={effectiveTheme} toggleTheme={toggleTheme} />

          <SidebarLink
            link={{
              label: user?.discord_username || user?.name || "User",
              href: "#",
              icon: (
                user?.profile_picture && !user.profile_picture.startsWith('http') ? (
                  <div className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-xs" style={{ background: 'var(--gold-dim)' }}>
                    {user.profile_picture}
                  </div>
                ) : (
                  <img
                    src={getProfilePicture()}
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                    width={20} height={20}
                    alt="Avatar"
                    style={{ border: '1.5px solid var(--border-default)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.discord_username || user?.name || 'User')}&background=F0EBE0&color=B8922E&size=128`;
                    }}
                  />
                )
              ),
            }}
            onClick={handleProfileClick}
            className="cursor-pointer"
          />
          <SidebarLink
            link={{
              label: "Logout",
              href: "#",
              icon: <IconLogout className="h-5 w-5 shrink-0" style={{ color: 'var(--text-muted)' }} />,
            }}
            className="opacity-60 hover:opacity-100"
            onClick={(e) => { e.preventDefault(); logout(); }}
          />
        </div>
      </SidebarBody>

      {/* ── Profile Edit Modal ── */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'var(--modal-overlay)' }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="max-w-md w-full mx-4 p-6 rounded-2xl"
            style={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--modal-border)',
              boxShadow: 'var(--modal-shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Edit Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '4px' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profile Picture</label>
                <div className="flex items-center gap-4">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="Profile" className="h-14 w-14 rounded-full object-cover" style={{ border: '2px solid var(--border-default)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                  ) : profileForm.profile_picture ? (
                    <div className="flex h-14 w-14 items-center justify-center text-3xl rounded-full" style={{ background: 'var(--gold-dim)', border: '2px solid var(--gold-border)' }}>
                      {profileForm.profile_picture}
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full text-xl" style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>?</div>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                      style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                    >
                      Choose Emoji
                    </button>
                    <label
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center"
                      style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                    >
                      Upload Image
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                {showEmojiPicker && <div className="mt-2"><EmojiPicker onEmojiClick={handleEmojiClick} /></div>}
              </div>

              <div className="mb-5">
                <label htmlFor="discord_username" className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Discord Username
                </label>
                <input
                  type="text"
                  id="discord_username"
                  value={profileForm.discord_username}
                  onChange={(e) => setProfileForm({ ...profileForm, discord_username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none transition-all"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--gold-border)'; (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--gold-dim)'; }}
                  onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--input-border)'; (e.currentTarget as HTMLInputElement).style.boxShadow = 'none'; }}
                  placeholder="Your Discord username"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
                  style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
                  style={{ background: 'var(--gold)', color: 'var(--bg-base)', boxShadow: 'none' }}
                  onMouseEnter={(e) => { if (!saving) { (e.currentTarget as HTMLElement).style.opacity = '0.88'; } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastComponent />
      <AlertComponent />
    </Sidebar>
  );
}

const SidebarLogo = () => {
  const { isExpanded } = useSidebar();

  return (
    <a href="/" className="relative z-20 flex items-center gap-3 py-1">
      <img
        src="/knavishmantis-profilepic.png"
        alt="Logo"
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        style={{ border: '1.5px solid var(--border-default)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', flexShrink: 0 }}
      />
      <motion.div
        animate={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 150 : 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{ overflow: 'hidden', whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Knavish
        </span>
        <span className="text-sm font-bold ml-1" style={{ color: 'var(--gold)' }}>
          Pipeline
        </span>
      </motion.div>
    </a>
  );
};

export const Logo = () => (
  <a href="/" className="relative z-20 flex items-center gap-2 py-1">
    <div className="h-5 w-6 shrink-0 rounded-sm" style={{ background: 'var(--gold)' }} />
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
      Knavish Pipeline
    </motion.span>
  </a>
);

export const LogoIcon = () => (
  <a href="/" className="relative z-20 flex items-center justify-center py-1">
    <div className="h-5 w-6 shrink-0 rounded-sm" style={{ background: 'var(--gold)' }} />
  </a>
);

/* ── Theme Toggle Row ── */
function ThemeToggleRow({
  effectiveTheme,
  toggleTheme,
}: {
  effectiveTheme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const { isExpanded } = useSidebar();
  const isDark = effectiveTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        width: '100%',
        transition: 'background 0.15s',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)';
        (e.currentTarget as HTMLElement).style.color = 'var(--gold)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
      }}
    >
      {isDark ? (
        <IconSun className="h-5 w-5 shrink-0" style={{ color: 'inherit' }} />
      ) : (
        <IconMoon className="h-5 w-5 shrink-0" style={{ color: 'inherit' }} />
      )}
      <motion.span
        animate={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 'auto' : 0 }}
        transition={{ duration: 0.2 }}
        style={{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: '14px',
          fontWeight: 500,
          color: 'inherit',
        }}
      >
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </motion.span>
    </button>
  );
}
