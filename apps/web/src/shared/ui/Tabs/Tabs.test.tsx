import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tab } from './Tab';
import { TabList } from './TabList';
import { TabPanel } from './TabPanel';
import { Tabs } from './Tabs';

function renderTabs() {
  return render(
    <Tabs defaultValue="overview">
      <TabList>
        <Tab value="overview">Overview</Tab>
        <Tab value="curriculum">Curriculum</Tab>
        <Tab value="archived" disabled>
          Archived
        </Tab>
      </TabList>
      <TabPanel value="overview">Overview content</TabPanel>
      <TabPanel value="curriculum">Curriculum content</TabPanel>
      <TabPanel value="archived">Archived content</TabPanel>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('shows only the selected panel, and selecting a tab switches it', async () => {
    const user = userEvent.setup();
    renderTabs();

    expect(screen.getByText('Overview content')).toBeInTheDocument();
    expect(screen.queryByText('Curriculum content')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Curriculum' }));

    expect(screen.getByRole('tab', { name: 'Curriculum' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Curriculum content')).toBeInTheDocument();
    expect(screen.queryByText('Overview content')).not.toBeInTheDocument();
  });

  it('moves selection with ArrowRight/ArrowLeft, skipping disabled tabs', async () => {
    const user = userEvent.setup();
    renderTabs();

    screen.getByRole('tab', { name: 'Overview' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Curriculum' })).toHaveFocus();
    expect(screen.getByText('Curriculum content')).toBeInTheDocument();

    // Archived is disabled and excluded from the roving selector, so the
    // next ArrowRight wraps back around to Overview instead of landing on it.
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Curriculum' })).toHaveFocus();
  });

  it('only the selected tab is in the Tab sequence (roving tabindex)', () => {
    renderTabs();

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('tabIndex', '0');
    expect(screen.getByRole('tab', { name: 'Curriculum' })).toHaveAttribute('tabIndex', '-1');
  });
});
