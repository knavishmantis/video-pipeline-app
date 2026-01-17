import { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "./ui/sidebar";
import { IconDashboard, IconUsers, IconCurrencyDollar, IconLogout, IconHelp, IconCamera, IconEdit, IconBrandYoutube, IconBrain, IconFileText } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { usersApi, filesApi } from "../services/api";
import { useToast } from "../hooks/useToast";
import { useAlert } from "../hooks/useAlert";
import { getErrorMessage } from "../utils/errorHandler";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

export function SidebarNav() {
  const { user, logout, isAuthenticated, refreshUser } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const { showAlert, AlertComponent } = useAlert();
  const [open, setOpen] = useState(false); // Start collapsed
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

  // Initialize form when modal opens
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

  // Get profile picture - emoji, image URL, or fallback
  const getProfilePicture = () => {
    if (user?.profile_picture) {
      // If it's a URL (starts with http), return it
      if (user.profile_picture.startsWith('http')) {
        return user.profile_picture;
      }
      // Otherwise it's an emoji, return it
      return user.profile_picture;
    }
    // Fallback to generated avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
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
        setProfileForm({ ...profileForm, profile_picture: '' }); // Clear emoji
        const reader = new FileReader();
        reader.onloadend = () => {
          setProfileImagePreview(reader.result as string);
        };
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

      // If user uploaded an image, upload it first
      if (profileImage) {
        try {
          const formDataUpload = new FormData();
          formDataUpload.append('file', profileImage);
          formDataUpload.append('file_type', 'profile_picture');
          formDataUpload.append('user_id', user.id.toString());
          
          const uploadResult = await filesApi.uploadProfilePicture(formDataUpload);
          // Store the bucket path instead of signed URL (signed URLs are too long and expire)
          // We'll generate signed URLs on-demand when displaying
          profilePictureValue = uploadResult.gcp_bucket_path || uploadResult.url || '';
        } catch (uploadError: unknown) {
          console.error('Image upload error:', uploadError);
          const errorMsg = getErrorMessage(uploadError, 'Image upload failed');
          showAlert(`${errorMsg}. Please try again or use an emoji instead.`, { type: 'error' });
          setSaving(false);
          return;
        }
      }

      const updateData: any = {
        discord_username: profileForm.discord_username.trim() || null,
      };

      // Only include profile_picture if it has a value
      if (profilePictureValue) {
        updateData.profile_picture = profilePictureValue;
      }

      await usersApi.update(user.id, updateData);
      await refreshUser(); // Refresh user data in auth context
      setShowProfileModal(false);
      showToast('Profile updated successfully', 'success');
    } catch (error: unknown) {
      console.error('Failed to update profile:', error);
      showAlert(getErrorMessage(error, 'Failed to update profile'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const links = [
    {
      label: "Dashboard",
      href: "/",
      icon: (
        <IconDashboard className="h-5 w-5 shrink-0 text-neutral-900" />
      ),
    },
    {
      label: "Script Pipeline",
      href: "/script-pipeline",
      icon: (
        <IconFileText className="h-5 w-5 shrink-0 text-neutral-900" />
      ),
    },
    {
      label: "Payments",
      href: "/payments",
      icon: (
        <IconCurrencyDollar className="h-5 w-5 shrink-0 text-neutral-900" />
      ),
    },
    {
      label: "Guide",
      href: "/guide",
      icon: (
        <IconHelp className="h-5 w-5 shrink-0 text-neutral-900" />
      ),
    },
    {
      label: "YouTube Stats",
      href: "/youtube-stats",
      icon: (
        <IconBrandYoutube className="h-5 w-5 shrink-0 text-neutral-900" />
      ),
    },
    ...(isAdmin ? [
      {
        label: "Script Grading",
        href: "/script-grading",
        icon: (
          <IconBrain className="h-5 w-5 shrink-0 text-neutral-900" />
        ),
      },
    ] : []),
    ...((isClipper || isAdmin) ? [
      {
        label: "Flashback Reference",
        href: "/flashback-reference",
        icon: (
          <IconCamera className="h-5 w-5 shrink-0 text-neutral-900" />
        ),
      },
    ] : []),
    ...((isEditor || isAdmin) ? [
      {
        label: "Editing Reference",
        href: "/editing-reference",
        icon: (
          <IconEdit className="h-5 w-5 shrink-0 text-neutral-900" />
        ),
      },
    ] : []),
    ...(isAdmin ? [
      {
        label: "Users",
        href: "/users",
        icon: (
          <IconUsers className="h-5 w-5 shrink-0 text-neutral-900" />
        ),
      },
    ] : []),
  ];

  return (
    <Sidebar open={open} setOpen={setOpen} animate={true}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <SidebarLogo />
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink key={idx} link={link} />
            ))}
          </div>
        </div>
        <div>
          <SidebarLink
            link={{
              label: user?.discord_username || user?.name || "User",
              href: "#",
              icon: (
                user?.profile_picture && !user.profile_picture.startsWith('http') ? (
                  <div className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-base bg-gray-100">
                    {user.profile_picture}
                  </div>
                ) : (
                  <img
                    src={getProfilePicture()}
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                    width={20}
                    height={20}
                    alt="Avatar"
                    style={{ display: 'block' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.discord_username || user?.name || 'User')}&background=random&size=128`;
                    }}
                  />
                )
              ),
            }}
            onClick={handleProfileClick}
            className="cursor-pointer hover:bg-gray-50"
          />
          <SidebarLink
            link={{
              label: "Logout",
              href: "#",
              icon: (
                <IconLogout className="h-5 w-5 shrink-0 text-neutral-900" />
              ),
            }}
            className="!text-red-600 hover:!bg-red-50 hover:!text-red-700"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
          />
        </div>
      </SidebarBody>
      
      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowProfileModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-neutral-900">Edit Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleProfileSubmit}>
              {/* Profile Picture Section */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Profile Picture</label>
                <div className="flex items-center gap-4">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
                  ) : profileForm.profile_picture ? (
                    <div className="flex h-16 w-16 items-center justify-center text-4xl bg-gray-100 rounded-full">
                      {profileForm.profile_picture}
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-2xl text-gray-500">
                      ?
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="px-4 py-2 text-sm font-medium text-neutral-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Choose Emoji
                    </button>
                    <label className="px-4 py-2 text-sm font-medium text-neutral-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer text-center">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                {showEmojiPicker && (
                  <div className="mt-2">
                    <EmojiPicker onEmojiClick={handleEmojiClick} />
                  </div>
                )}
              </div>

              {/* Discord Username */}
              <div className="mb-4">
                <label htmlFor="discord_username" className="block text-sm font-medium text-neutral-700 mb-2">
                  Discord Username
                </label>
                <input
                  type="text"
                  id="discord_username"
                  value={profileForm.discord_username}
                  onChange={(e) => setProfileForm({ ...profileForm, discord_username: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your Discord username"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <img
        src="/knavishmantis-profilepic.jpg"
        alt="Logo"
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
      <motion.span
        animate={{
          opacity: isExpanded ? 1 : 0,
          width: isExpanded ? 'auto' : 0,
        }}
        transition={{ duration: 0.2 }}
        className="text-base font-medium whitespace-pre text-neutral-900 overflow-hidden"
      >
        Knavish Video Pipeline
      </motion.span>
    </a>
  );
};

export const Logo = () => {
  return (
    <a
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-black"
      >
        Knavish Video Pipeline
      </motion.span>
    </a>
  );
};

export const LogoIcon = () => {
  return (
    <a
      href="/"
      className="relative z-20 flex items-center justify-center py-1 text-sm font-normal text-black"
    >
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black" />
    </a>
  );
};
