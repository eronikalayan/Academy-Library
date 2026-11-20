import { ChevronDown, Pencil, Share2, Trash2 } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '../../../shared/ui/Dropdown';
import { Section } from '../Section';

export function DropdownSection() {
  return (
    <Section
      id="dropdown"
      title="Dropdown"
      description="Arrow-key navigation, closes on Escape/outside click/Tab, and focuses the first item on open."
    >
      <Dropdown>
        <DropdownTrigger>
          Actions
          <ChevronDown aria-hidden="true" style={{ width: '1em', height: '1em' }} />
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownItem icon={<Pencil aria-hidden="true" />}>Rename</DropdownItem>
          <DropdownItem icon={<Share2 aria-hidden="true" />}>Share</DropdownItem>
          <DropdownItem icon={<Trash2 aria-hidden="true" />} destructive>
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </Section>
  );
}
