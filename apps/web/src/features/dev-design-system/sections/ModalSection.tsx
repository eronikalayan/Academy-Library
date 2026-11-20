import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { Section } from '../Section';

export function ModalSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Section
      id="modal"
      title="Modal"
      description="Focus-trapped, scroll-locked, closes on Escape or an outside click, and restores focus to the trigger on close."
    >
      <Button onClick={() => setIsOpen(true)}>Delete resource</Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Delete this resource?"
        description="This can't be undone. The resource will be removed from every collection it's in."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setIsOpen(false)}>
              Delete
            </Button>
          </>
        }
      >
        <p>This is example modal body content — any children can go here.</p>
      </Modal>
    </Section>
  );
}
