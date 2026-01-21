import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';

export function SetupPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { mode } = useTheme();
  const [authEnabled, setAuthEnabled] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const setupMutation = useMutation({
    mutationFn: () =>
      api.setupAuth({
        auth_enabled: authEnabled,
        admin_username: authEnabled ? adminUsername : undefined,
        admin_password: authEnabled ? adminPassword : undefined,
      }),
    onSuccess: (data) => {
      if (data.auth_enabled && data.admin_created) {
        showToast('Authentication enabled and admin user created');
        navigate('/login');
      } else {
        showToast('Setup completed');
        navigate('/');
      }
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (authEnabled) {
      if (!adminUsername || !adminPassword) {
        showToast('Please enter admin username and password', 'error');
        return;
      }
      if (adminPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }
      if (adminPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }
    }

    setupMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bambu-dark p-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-gradient-to-br from-bambu-card to-bambu-dark-secondary rounded-xl border border-bambu-dark-tertiary shadow-lg">
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <img
              src={mode === 'dark' ? '/img/bambuddy_logo_dark_transparent.png' : '/img/bambuddy_logo_light.png'}
              alt="Bambuddy"
              className="h-16"
            />
          </div>
          <h2 className="text-3xl font-bold text-white">
            Bambuddy Setup
          </h2>
          <p className="mt-2 text-sm text-bambu-gray">
            Configure authentication for your Bambuddy instance
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-bambu-dark-secondary/50 rounded-lg border border-bambu-dark-tertiary">
              <input
                id="auth-enabled"
                type="checkbox"
                checked={authEnabled}
                onChange={(e) => setAuthEnabled(e.target.checked)}
                className="h-4 w-4 text-bambu-green focus:ring-bambu-green border-bambu-dark-tertiary rounded bg-bambu-dark-secondary"
              />
              <label htmlFor="auth-enabled" className="ml-3 block text-sm font-medium text-white">
                Enable Authentication
              </label>
            </div>

            {authEnabled && (
              <div className="space-y-4 mt-4">
                <div>
                  <label htmlFor="admin-username" className="block text-sm font-medium text-white mb-2">
                    Admin Username
                  </label>
                  <input
                    id="admin-username"
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="block w-full px-4 py-3 bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray focus:outline-none focus:ring-2 focus:ring-bambu-green/50 focus:border-bambu-green transition-colors"
                    placeholder="Enter admin username"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label htmlFor="admin-password" className="block text-sm font-medium text-white mb-2">
                    Admin Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="block w-full px-4 py-3 bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray focus:outline-none focus:ring-2 focus:ring-bambu-green/50 focus:border-bambu-green transition-colors"
                    placeholder="Enter admin password"
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-white mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-4 py-3 bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray focus:outline-none focus:ring-2 focus:ring-bambu-green/50 focus:border-bambu-green transition-colors"
                    placeholder="Confirm admin password"
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={setupMutation.isPending}
              className="w-full flex justify-center py-3 px-4 bg-bambu-green hover:bg-bambu-green-light text-white font-medium rounded-lg shadow-lg shadow-bambu-green/20 hover:shadow-bambu-green/30 focus:outline-none focus:ring-2 focus:ring-bambu-green/50 focus:ring-offset-2 focus:ring-offset-bambu-dark-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bambu-green"
            >
              {setupMutation.isPending ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
