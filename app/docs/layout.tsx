import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from '@/lib/layout.shared';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const options = baseOptions();

  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...options}
      tabMode="navbar"
      nav={{
        ...(options.nav ?? {}),
        mode: 'top',
      }}
    >
      {children}
    </DocsLayout>
  );
}
