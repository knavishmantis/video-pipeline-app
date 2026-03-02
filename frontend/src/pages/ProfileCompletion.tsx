import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, filesApi, authApi } from '../services/api';
import { User } from '../../../shared/types';
import { getErrorMessage } from '../utils/errorHandler';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import TimezoneSelect, { type ITimezone } from 'react-timezone-select';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

export default function ProfileCompletion() {
  const { user, logout } = useAuth();
  const [_profile, setProfile] = useState<User | null>(null);
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
          // Store the bucket path instead of signed URL (signed URLs are too long and expire)
          // We'll generate signed URLs on-demand when displaying
          profilePictureValue = uploadResult.gcp_bucket_path || uploadResult.url || '';
        } catch (uploadError: unknown) {
          console.error('Image upload error:', uploadError);
          const errorMsg = getErrorMessage(uploadError, 'Image upload failed');
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
      
      // Refresh user data from the server and navigate to dashboard
      try {
        const updatedUser = await authApi.getMe();
        localStorage.setItem('user', JSON.stringify(updatedUser));
        // Use window.location to force a full page reload and navigation
        window.location.href = '/';
      } catch (error) {
        console.error('Failed to refresh user data:', error);
        // Still navigate even if refresh fails
        window.location.href = '/';
      }
    } catch (error: unknown) {
      console.error('Profile update error:', error);
      const errorMsg = getErrorMessage(error, 'Failed to update profile');
      setError(errorMsg);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading…</div>
      </div>
    );
  }

  const currentProfileDisplay = profileImagePreview
    ? <img src={profileImagePreview} alt="Profile" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-default)' }} />
    : formData.profile_picture
    ? <div style={{ display: 'flex', width: '60px', height: '60px', alignItems: 'center', justifyContent: 'center', fontSize: '32px', background: 'var(--gold-dim)', borderRadius: '50%', border: '2px solid var(--gold-border)' }}>{formData.profile_picture}</div>
    : <div style={{ display: 'flex', width: '60px', height: '60px', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '22px', border: '2px solid var(--border-default)' }}>?</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '480px', height: '480px', background: 'radial-gradient(ellipse, var(--gold-dim) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '32px', maxWidth: '440px', width: '100%', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px', background: 'linear-gradient(90deg, transparent, var(--gold) 40%, var(--gold) 60%, transparent)', borderRadius: '2px' }} />

        <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
          Complete Your Profile
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
          You must complete your profile before using the app. All fields are required.
        </p>

        {error && (
          <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(224,90,78,0.1)', border: '1px solid rgba(224,90,78,0.3)', fontSize: '12px', color: '#e05a4e' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Profile Picture */}
          <div>
            <Label>Profile Picture</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
              {currentProfileDisplay}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{ padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                >
                  Choose Emoji
                </button>
                <label
                  style={{ padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s ease' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                >
                  Upload Image
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
            {showEmojiPicker && (
              <div style={{ marginTop: '10px', position: 'relative', zIndex: 50 }}>
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="discord_username">Discord Username</Label>
            <Input
              id="discord_username"
              type="text"
              placeholder="username"
              value={formData.discord_username}
              onChange={(e) => setFormData({ ...formData, discord_username: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="paypal_email">PayPal Email</Label>
            <Input
              id="paypal_email"
              type="email"
              placeholder="your@gmail.com"
              value={formData.paypal_email}
              onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <TimezoneSelect
              value={formData.timezone}
              onChange={(tz) => setFormData({ ...formData, timezone: tz })}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{ height: '40px', borderRadius: '8px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, letterSpacing: '-0.01em', transition: 'all 0.2s ease', marginTop: '4px' }}
          >
            {saving ? 'Saving…' : 'Complete Profile →'}
          </button>

          <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }} />

          <button
            type="button"
            onClick={logout}
            style={{ height: '38px', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
