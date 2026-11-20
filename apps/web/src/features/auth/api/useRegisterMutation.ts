import { useMutation } from '@tanstack/react-query';
import { register } from './authApi';

/**
 * Deliberately does not touch the `['auth', 'me']` cache — registration
 * does not log the new account in (see
 * docs/architecture/authentication.md, "Registration does not
 * auto-login"); the caller still has to submit a separate login after
 * this succeeds.
 */
export function useRegisterMutation() {
  return useMutation({
    mutationFn: register,
  });
}
