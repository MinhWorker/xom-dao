import { type ReactNode, useId, useState } from 'react';
import { playSound } from '../sound/index.js';
import { rovingKeyDown } from './roving.js';
import styles from './Tabs.module.css';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  label: string;
  tabs: Tab[];
  /** The selected tab when controlled; the first tab when left out. */
  value?: string;
  onChange?(id: string): void;
}

/** A `tablist` with its panel; arrow keys move and select, only the selected tab takes Tab. */
export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const base = useId();
  const [own, setOwn] = useState(tabs[0]?.id);
  const selected = value ?? own;
  const select = (id: string) => {
    playSound('click');
    setOwn(id);
    onChange?.(id);
  };

  return (
    <div className={styles.tabs}>
      <div
        role="tablist"
        aria-label={label}
        className={styles.list}
        onKeyDown={(e) => rovingKeyDown(e, '[role="tab"]')}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === selected}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === selected ? 0 : -1}
            className={styles.tab}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== selected}
          className={styles.panel}
        >
          {tab.id === selected && tab.content}
        </div>
      ))}
    </div>
  );
}
