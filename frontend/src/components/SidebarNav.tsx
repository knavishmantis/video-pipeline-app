import { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "./ui/sidebar";
import { IconDashboard, IconUsers, IconCurrencyDollar, IconLogout, IconHelp, IconCamera, IconEdit, IconBrandYoutube, IconTarget } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { usersApi, filesApi } from "../services/api";
import { useToast } from "../hooks/useToast";
import { useAlert } from "../hooks/useAlert";
import { getErrorMessage } from "../utils/errorHandler";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

const ICON_COLOR = '#AAAACC';
const ICON_ACTIVE = '#F5A623';

export function SidebarNav() {
  const { user, logout, isAuthenticated, refreshUser } = useAuth();
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
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=2E2E3C&color=F5A623&size=128&bold=true`;
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
      label: "Script Review",
      href: "/script-review",
      icon: <IconTarget className="h-5 w-5 shrink-0" style={{ color: ICON_COLOR }} />,
    }] : []),
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
          {/* Divider */}
          <div style={{ height: '1px', background: '#30303E', margin: '16px 0' }} />
          <div className="flex flex-col gap-1">
            {links.map((link, idx) => (
              <SidebarLink key={idx} link={link} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {/* Divider */}
          <div style={{ height: '1px', background: '#30303E', marginBottom: '8px' }} />
          <SidebarLink
            link={{
              label: user?.discord_username || user?.name || "User",
              href: "#",
              icon: (
                user?.profile_picture && !user.profile_picture.startsWith('http') ? (
                  <div className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-sm" style={{ background: '#22222C' }}>
                    {user.profile_picture}
                  </div>
                ) : (
                  <img
                    src={getProfilePicture()}
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                    width={24} height={24}
                    alt="Avatar"
                    style={{ border: '1px solid #2E2E3C' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.discord_username || user?.name || 'User')}&background=2E2E3C&color=F5A623&size=128`;
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
              icon: <IconLogout className="h-5 w-5 shrink-0" style={{ color: '#FF5E5E' }} />,
            }}
            className="!text-[#FF5E5E] hover:!text-red-400"
            onClick={(e) => { e.preventDefault(); logout(); }}
          />
        </div>
      </SidebarBody>

      {/* ── Profile Edit Modal ── */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="max-w-md w-full mx-4 p-6 rounded-lg"
            style={{
              background: '#1F1F28',
              border: '1px solid #3E3E54',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-semibold" style={{ color: '#EEEEF5', letterSpacing: '-0.01em' }}>Edit Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ color: '#4A4A60', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', padding: '4px' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EEEEF5'; (e.currentTarget as HTMLElement).style.background = '#22222C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#4A4A60'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-mono mb-2" style={{ color: '#8888A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Profile Picture</label>
                <div className="flex items-center gap-4">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="Profile" className="h-14 w-14 rounded-full object-cover" style={{ border: '2px solid #2E2E3C' }} />
                  ) : profileForm.profile_picture ? (
                    <div className="flex h-14 w-14 items-center justify-center text-3xl rounded-full" style={{ background: '#22222C' }}>
                      {profileForm.profile_picture}
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full text-xl" style={{ background: '#22222C', color: '#4A4A60' }}>?</div>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="px-3 py-1.5 text-xs font-mono rounded transition-all"
                      style={{ background: '#22222C', color: '#EEEEF5', border: '1px solid #2E2E3C' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#F5A623'; (e.currentTarget as HTMLElement).style.color = '#F5A623'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#2E2E3C'; (e.currentTarget as HTMLElement).style.color = '#EEEEF5'; }}
                    >
                      Choose Emoji
                    </button>
                    <label
                      className="px-3 py-1.5 text-xs font-mono rounded transition-all cursor-pointer text-center"
                      style={{ background: '#22222C', color: '#EEEEF5', border: '1px solid #2E2E3C' }}
                    >
                      Upload Image
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                {showEmojiPicker && <div className="mt-2"><EmojiPicker onEmojiClick={handleEmojiClick} /></div>}
              </div>

              <div className="mb-5">
                <label htmlFor="discord_username" className="block text-xs font-mono mb-2" style={{ color: '#8888A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Discord Username
                </label>
                <input
                  type="text"
                  id="discord_username"
                  value={profileForm.discord_username}
                  onChange={(e) => setProfileForm({ ...profileForm, discord_username: e.target.value })}
                  className="w-full px-3 py-2 rounded text-sm font-mono focus:outline-none transition-all"
                  style={{
                    background: '#13131A',
                    border: '1px solid #2E2E3C',
                    color: '#EEEEF5',
                  }}
                  onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#F5A623'; }}
                  onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#2E2E3C'; }}
                  placeholder="Your Discord username"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-xs font-mono rounded transition-all"
                  style={{ background: '#22222C', color: '#8888A8', border: '1px solid #2E2E3C' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EEEEF5'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8888A8'; }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-mono rounded transition-all disabled:opacity-40"
                  style={{ background: '#F5A623', color: '#0E0E12', fontWeight: 600 }}
                  onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.background = '#FFB830'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F5A623'; }}
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
    <a
      href="/"
      className="relative z-20 flex items-center gap-3 py-1"
    >
      <img
        src="/knavishmantis-profilepic.jpg"
        alt="Logo"
        className="h-8 w-8 shrink-0 rounded-full object-cover"
        style={{ border: '1px solid #2E2E3C' }}
      />
      <motion.div
        animate={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 'auto' : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden whitespace-nowrap"
      >
        <span className="font-display text-sm font-semibold" style={{ color: '#EEEEF5', letterSpacing: '-0.01em' }}>
          Knavish
        </span>
        <span className="font-display text-sm font-semibold ml-1" style={{ color: '#F5A623' }}>
          Pipeline
        </span>
      </motion.div>
    </a>
  );
};

export const Logo = () => (
  <a href="/" className="relative z-20 flex items-center gap-2 py-1">
    <div className="h-5 w-6 shrink-0 rounded-sm" style={{ background: '#F5A623' }} />
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-display font-semibold text-sm" style={{ color: '#EEEEF5' }}>
      Knavish Pipeline
    </motion.span>
  </a>
);

export const LogoIcon = () => (
  <a href="/" className="relative z-20 flex items-center justify-center py-1">
    <div className="h-5 w-6 shrink-0 rounded-sm" style={{ background: '#F5A623' }} />
  </a>
);
