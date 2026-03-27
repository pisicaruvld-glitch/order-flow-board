import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '@/lib/authApi';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login: setUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const resp = await login({ username: username.trim(), password });
      setUser(resp.user);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs tracking-wider">VS</span>
            </div>
            <span className="font-semibold text-lg text-foreground">VSRO Dashboard</span>
          </div>

          <h1 className="text-lg font-semibold text-center mb-4">Login</h1>

          {error && (
            <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded border border-destructive/30 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading || !username.trim() || !password}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Login
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
