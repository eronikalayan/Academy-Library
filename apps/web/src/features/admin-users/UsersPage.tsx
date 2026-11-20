import { useState } from 'react';
import { UserPlus, Users2 } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { ComingSoonDialog } from '../../shared/ui/ComingSoonDialog';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../widgets/page-header';

export function UsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage who has access to Academy Library and their role."
        actions={
          <Button
            leadingIcon={<UserPlus aria-hidden="true" />}
            onClick={() => setIsDialogOpen(true)}
          >
            Invite user
          </Button>
        }
      />

      <EmptyState
        icon={<Users2 aria-hidden="true" />}
        title="No users yet"
        description="User accounts, invitations, and role management will land alongside authentication in a later task."
      />

      <ComingSoonDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Invite a user"
        description="Invitations aren't implemented yet — they arrive alongside authentication."
      />
    </div>
  );
}
