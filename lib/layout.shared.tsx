import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      url: '/docs/overview',
      title: (
        <span className="inline-flex items-center text-fd-foreground">
          <picture className="inline-flex h-[40px] w-[112px] shrink-0 items-center">
            <source
              srcSet="/assets/branding/wdk-logo.avif"
              type="image/avif"
            />
            <img
              src="/assets/wdk-logo.png"
              alt="WDK logo"
              width={112}
              height={40}
              className="h-[40px] w-[112px] object-contain"
            />
          </picture>
          <span className="sr-only">WDK documentation</span>
        </span>
      ),
    },
    links: [
      {
        text: 'GitHub',
        url: 'https://github.com/tetherto/wdk-core',
        external: true,
      },
      {
        text: 'Discord',
        url: 'https://discord.gg/arYXDhHB2w',
        external: true,
      },
    ],
  };
}
