import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Checkbox } from '../../../shared/ui/Checkbox';
import { Input } from '../../../shared/ui/Input';
import { Radio } from '../../../shared/ui/Radio';
import { Select } from '../../../shared/ui/Select';
import { Switch } from '../../../shared/ui/Switch';
import { Textarea } from '../../../shared/ui/Textarea';
import { Section } from '../Section';
import styles from './FormsSection.module.css';

const resourceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(280, 'Keep it under 280 characters').optional(),
  category: z.enum(['book', 'article', 'video']),
  visibility: z.enum(['public', 'private']),
  featured: z.boolean().optional(),
  notify: z.boolean().optional(),
});

type ResourceFormValues = z.infer<typeof resourceSchema>;

/**
 * One cohesive form exercises every control type at once — a more
 * convincing proof of React Hook Form compatibility than isolated
 * snippets, and a more realistic usage example.
 */
export function FormsSection() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'book',
      visibility: 'public',
      featured: false,
      notify: true,
    },
  });

  return (
    <Section
      id="forms"
      title="Form controls"
      description="Input, Textarea, Select, Checkbox, Radio, and Switch, wired to React Hook Form with Zod validation."
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          void handleSubmit(() => {
            /* demo only — nothing is actually submitted */
          })(event);
        }}
      >
        <Input
          label="Title"
          placeholder="Intro to Algorithms"
          required
          leadingIcon={<Mail aria-hidden="true" />}
          error={errors.title?.message}
          {...register('title')}
        />
        <Textarea
          label="Description"
          placeholder="Shown on the resource card…"
          helperText="Optional, up to 280 characters."
          error={errors.description?.message}
          {...register('description')}
        />
        <Select label="Category" error={errors.category?.message} {...register('category')}>
          <option value="book">Book</option>
          <option value="article">Article</option>
          <option value="video">Video</option>
        </Select>
        <fieldset className={styles.radioGroup}>
          <legend className={styles.radioLegend}>Visibility</legend>
          <Radio label="Public" value="public" {...register('visibility')} />
          <Radio label="Private" value="private" {...register('visibility')} />
        </fieldset>
        <Checkbox label="Feature on the homepage" {...register('featured')} />
        <Switch label="Notify subscribers" {...register('notify')} />
        <div className={styles.actions}>
          <Button type="submit">Save resource</Button>
          {isSubmitSuccessful && (
            <p className={styles.success}>Valid — nothing is actually submitted.</p>
          )}
        </div>
      </form>
    </Section>
  );
}
