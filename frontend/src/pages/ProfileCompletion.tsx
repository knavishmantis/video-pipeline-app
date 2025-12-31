import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, filesApi } from '../services/api';
import { User } from '../../../shared/types';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import TimezoneSelect, { type ITimezone } from 'react-timezone-select';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex w-full flex-col space-y-2", className)}>
      {children}
    </div>
  );
};

export default function ProfileCompletion() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formData, setFormData] = useState({
    discord_username: '',
    paypal_email: '',
    profile_picture: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as ITimezone,
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const data = await usersApi.getById(user!.id);
      setProfile(data);
      setFormData({
        discord_username: data.discord_username || '',
        paypal_email: data.paypal_email || '',
        profile_picture: data.profile_picture || '',
        timezone: (data.timezone as ITimezone) || Intl.DateTimeFormat().resolvedOptions().timeZone as ITimezone,
      });
      if (data.profile_picture && !data.profile_picture.startsWith('http')) {
        // It's an emoji
        setProfileImagePreview('');
      } else if (data.profile_picture) {
        // It's an image URL
        setProfileImagePreview(data.profile_picture);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setFormData({ ...formData, profile_picture: emojiData.emoji });
    setProfileImage(null);
    setProfileImagePreview('');
    setShowEmojiPicker(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setProfileImage(file);
        setFormData({ ...formData, profile_picture: '' }); // Clear emoji
        const reader = new FileReader();
        reader.onloadend = () => {
          setProfileImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setError('Please select an image file');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (!formData.discord_username || !formData.paypal_email) {
      setError('Discord username and PayPal email are required');
      setSaving(false);
      return;
    }

    // Validate profile picture is selected
    if (!formData.profile_picture && !profileImage) {
      setError('Please select a profile picture (emoji or image)');
      setSaving(false);
      return;
    }

    try {
      let profilePictureValue = formData.profile_picture || '';

      // If user uploaded an image, upload it first
      if (profileImage) {
        try {
          const formDataUpload = new FormData();
          formDataUpload.append('file', profileImage);
          formDataUpload.append('file_type', 'profile_picture');
          formDataUpload.append('user_id', user!.id.toString());
          
          const uploadResult = await filesApi.uploadProfilePicture(formDataUpload);
          profilePictureValue = uploadResult.url || uploadResult.gcp_bucket_path || '';
        } catch (uploadError: any) {
          console.error('Image upload error:', uploadError);
          const errorMsg = uploadError.response?.data?.error || uploadError.message || 'Image upload failed';
          setError(`${errorMsg}. Please try again or use an emoji instead.`);
          setSaving(false);
          return;
        }
      }

      // Extract timezone string value from react-timezone-select
      let timezoneValue: string;
      if (typeof formData.timezone === 'string') {
        timezoneValue = formData.timezone;
      } else if (formData.timezone && typeof formData.timezone === 'object') {
        timezoneValue = (formData.timezone as any).value || '';
      } else {
        timezoneValue = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }

      if (!timezoneValue) {
        setError('Please select a timezone');
        setSaving(false);
        return;
      }

      const updateData: any = {
        discord_username: formData.discord_username.trim(),
        paypal_email: formData.paypal_email.trim(),
        timezone: timezoneValue,
      };

      // Only include profile_picture if it has a value
      if (profilePictureValue) {
        updateData.profile_picture = profilePictureValue;
      }

      console.log('Updating profile with:', updateData);
      const result = await usersApi.update(user!.id, updateData);
      console.log('Profile updated successfully:', result);
      // Reload page to refresh auth state
      window.location.reload();
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update profile';
      setError(errorMsg);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-900">
        <div className="text-neutral-600 dark:text-neutral-400">Loading...</div>
      </div>
    );
  }

  const currentProfileDisplay = profileImagePreview 
    ? <img src={profileImagePreview} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
    : formData.profile_picture 
    ? <div className="flex h-16 w-16 items-center justify-center text-4xl">{formData.profile_picture}</div>
    : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-2xl text-gray-500 dark:bg-neutral-800 dark:text-neutral-600">?</div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-neutral-900">
      <div className="shadow-input mx-auto w-full max-w-md rounded-none bg-white p-4 md:rounded-2xl md:p-8 dark:bg-black">
        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
          Complete Your Profile
        </h2>
        <p className="mt-2 max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
          You must complete your profile before using the app. All fields are required.
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form className="my-8" onSubmit={handleSubmit}>
          {/* Profile Picture Section */}
          <LabelInputContainer className="mb-4">
            <Label htmlFor="profile-picture">Profile Picture</Label>
            <div className="flex items-center gap-4">
              {currentProfileDisplay}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="group/btn shadow-input relative flex h-10 w-full items-center justify-center space-x-2 rounded-md bg-gray-50 px-4 text-sm font-medium text-black transition-all hover:bg-gray-100 dark:bg-zinc-900 dark:text-white dark:shadow-[0px_0px_1px_1px_#262626] dark:hover:bg-zinc-800"
                >
                  <span>Choose Emoji</span>
                  <BottomGradient />
                </button>
                <label className="group/btn shadow-input relative flex h-10 w-full cursor-pointer items-center justify-center space-x-2 rounded-md bg-gray-50 px-4 text-sm font-medium text-black transition-all hover:bg-gray-100 dark:bg-zinc-900 dark:text-white dark:shadow-[0px_0px_1px_1px_#262626] dark:hover:bg-zinc-800">
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <BottomGradient />
                </label>
              </div>
            </div>
            {showEmojiPicker && (
              <div className="relative mt-4">
                <div className="absolute left-1/2 z-50 -translate-x-1/2">
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </div>
              </div>
            )}
          </LabelInputContainer>

          <LabelInputContainer className="mb-4">
            <Label htmlFor="discord_username">Discord Username</Label>
            <Input
              id="discord_username"
              type="text"
              placeholder="username"
              value={formData.discord_username}
              onChange={(e) => setFormData({ ...formData, discord_username: e.target.value })}
              required
            />
          </LabelInputContainer>

          <LabelInputContainer className="mb-4">
            <Label htmlFor="paypal_email">PayPal Email</Label>
            <Input
              id="paypal_email"
              type="email"
              placeholder="your@gmail.com"
              value={formData.paypal_email}
              onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
              required
            />
          </LabelInputContainer>

          <LabelInputContainer className="mb-8">
            <Label htmlFor="timezone">Timezone</Label>
            <div className="[&_.react-select-container]:shadow-input [&_.react-select__control]:border-neutral-200 [&_.react-select__control]:bg-white [&_.react-select__control]:dark:border-neutral-800 [&_.react-select__control]:dark:bg-zinc-900 [&_.react-select__single-value]:text-neutral-900 [&_.react-select__single-value]:dark:text-neutral-100 [&_.react-select__input]:text-neutral-900 [&_.react-select__input]:dark:text-neutral-100">
              <TimezoneSelect
                value={formData.timezone}
                onChange={(tz) => setFormData({ ...formData, timezone: tz })}
              />
            </div>
          </LabelInputContainer>

          <button
            className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset]"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Complete Profile →'}
            <BottomGradient />
          </button>

          <div className="my-8 h-[1px] w-full bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-neutral-700" />

          <button
            className="group/btn shadow-input relative flex h-10 w-full items-center justify-center space-x-2 rounded-md bg-gray-50 px-4 font-medium text-black transition-all hover:bg-gray-100 dark:bg-zinc-900 dark:text-white dark:shadow-[0px_0px_1px_1px_#262626] dark:hover:bg-zinc-800"
            type="button"
            onClick={logout}
          >
            <span>Logout</span>
            <BottomGradient />
          </button>
        </form>
      </div>
    </div>
  );
}
