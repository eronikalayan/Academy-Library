import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LoginInputSchema, type LoginInput } from '@academy-library/contracts';
import { resolveSafeRedirect } from '../../app/auth/safeRedirect';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { applyServerFieldErrors, getAuthErrorMessage } from './authErrors';
import { useLoginMutation } from './api/useLoginMutation';
import { AuthCard } from './components/AuthCard';
import styles from './AuthForm.module.css';

const DEFAULT_AUTHENTICATED_PATH = '/dashboard';
const AUTH_PATHS = ['/login', '/register'];

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const loginMutation = useLoginMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    loginMutation.mutate(values, {
      onSuccess: () => {
        const destination = resolveSafeRedirect(searchParams.get('from'), {
          fallback: DEFAULT_AUTHENTICATED_PATH,
          excludePaths: AUTH_PATHS,
        });
        navigate(destination, { replace: true });
      },
      onError: (error) => {
        setFormError(getAuthErrorMessage(error));
        applyServerFieldErrors(error, setError);
      },
    });
  });

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to Academy Library."
      footer={
        <>
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </>
      }
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        {formError && (
          <Alert variant="danger" role="alert" className={styles.alert}>
            {formError}
          </Alert>
        )}

        <div className={styles.fields}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <Button
          type="submit"
          fullWidth
          isLoading={loginMutation.isPending}
          className={styles.submit}
        >
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
