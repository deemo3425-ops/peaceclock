'use client';

import { Category } from '@peaceclock/api-types';
import { CATEGORY_LABEL } from '@/lib/labels';

interface Props {
  category: Category;
  onChange: (c: Category) => void;
}

const ORDER: Category[] = [Category.KILLED, Category.WOUNDED, Category.MISSING_POW];

/** Category toggle (T3.4): killed (default) / wounded / missing-POW. */
export function CategoryToggle({ category, onChange }: Props) {
  return (
    <div className="control control--category" role="radiogroup" aria-label="Casualty category">
      {ORDER.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === category}
          className={c === category ? 'toggle toggle--on' : 'toggle'}
          onClick={() => onChange(c)}
        >
          {CATEGORY_LABEL[c]}
        </button>
      ))}
    </div>
  );
}
