import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { RegisterInputSchema, type RegisterInput } from '@academy-library/contracts';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { useToast } from '../../shared/ui/Toast';
import { applyServerFieldErrors, getAuthErrorMessage } from './authErrors';
import { useRegisterMutation } from './api/useRegisterMutation';
import { AuthCard } from './components/AuthCard';
import styles from './AuthForm.module.css';

/**
 * Only `email`/`password`/`displayName` — exactly what
 * `RegisterInputSchema` accepts and nothing more. There is no role or
 * status field to omit "carefully"; the schema is `.strict()`, so there
 * is no field here that could even be wired up to send one (see
 * `packages/contracts/src/auth.ts`) — a user of this form has no way to
 * request anything other than a `STUDENT` account, structurally, not by
 * convention.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const registerMutation = useRegisterMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    registerMutation.mutate(values, {
      onSuccess: () => {
        // Registration does not log the new account in (see
        // docs/architecture/authentication.md) — send them to sign in
        // explicitly, rather than silently landing on a dashboard they
        // were never actually authenticated into.
        showToast({
          variant: 'success',
          title: 'Account created',
          description: 'Sign in with your new account to continue.',
        });
        navigate('/login', { replace: true });
      },
      onError: (error) => {
        setFormError(getAuthErrorMessage(error));
        applyServerFieldErrors(error, setError);
      },
    });
  });

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join Academy Library as a student. Lecturer and admin accounts are provisioned separately."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
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
            label="Full name"
            autoComplete="name"
            required
            error={errors.displayName?.message}
            {...register('displayName')}
          />
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
            autoComplete="new-password"
            helperText={errors.password ? undefined : 'At least 10 characters.'}
            required
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <Button
          type="submit"
          fullWidth
          isLoading={registerMutation.isPending}
          className={styles.submit}
        >
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
