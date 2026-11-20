import { Badge } from '../../shared/ui/Badge';
import { SectionNav } from './SectionNav';
import { AvatarsSection } from './sections/AvatarsSection';
import { BadgesSection } from './sections/BadgesSection';
import { ButtonsSection } from './sections/ButtonsSection';
import { CardsSection } from './sections/CardsSection';
import { ColorsSection } from './sections/ColorsSection';
import { DropdownSection } from './sections/DropdownSection';
import { FormsSection } from './sections/FormsSection';
import { ModalSection } from './sections/ModalSection';
import { SkeletonsSection } from './sections/SkeletonsSection';
import { StatesSection } from './sections/StatesSection';
import { TabsSection } from './sections/TabsSection';
import { ThemingSection } from './sections/ThemingSection';
import { ToastSection } from './sections/ToastSection';
import { TooltipSection } from './sections/TooltipSection';
import { TypographySection } from './sections/TypographySection';
import styles from './DesignSystemPage.module.css';

export function DesignSystemPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Design System</h1>
          <Badge variant="warning">Dev only</Badge>
        </div>
        <p className={styles.subtitle}>
          A living gallery of Academy Library's reusable UI primitives. This route is excluded from
          production builds.
        </p>
      </header>

      <div className={styles.layout}>
        <SectionNav />
        <main className={styles.content}>
          <TypographySection />
          <ColorsSection />
          <ButtonsSection />
          <FormsSection />
          <CardsSection />
          <BadgesSection />
          <AvatarsSection />
          <TabsSection />
          <ModalSection />
          <DropdownSection />
          <TooltipSection />
          <SkeletonsSection />
          <ToastSection />
          <StatesSection />
          <ThemingSection />
        </main>
      </div>
    </div>
  );
}
