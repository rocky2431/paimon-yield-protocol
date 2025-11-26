import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonChart,
  SkeletonTableRow,
  SkeletonAvatar,
  SkeletonButton,
} from '../Skeleton';

describe('Skeleton Components - CLS Prevention', () => {
  describe('Skeleton', () => {
    it('renders with explicit dimensions', () => {
      const { container } = render(<Skeleton width={100} height={50} />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton.style.width).toBe('100px');
      expect(skeleton.style.height).toBe('50px');
    });

    it('renders with string dimensions', () => {
      const { container } = render(<Skeleton width="100%" height="2rem" />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton.style.width).toBe('100%');
      expect(skeleton.style.height).toBe('2rem');
    });

    it('applies animation by default', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton.className).toContain('animate-pulse');
    });

    it('can disable animation', () => {
      const { container } = render(<Skeleton animate={false} />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton.className).not.toContain('animate-pulse');
    });

    it('applies correct rounded classes', () => {
      const { container: none } = render(<Skeleton rounded="none" />);
      const { container: sm } = render(<Skeleton rounded="sm" />);
      const { container: md } = render(<Skeleton rounded="md" />);
      const { container: lg } = render(<Skeleton rounded="lg" />);
      const { container: full } = render(<Skeleton rounded="full" />);

      expect((none.firstChild as HTMLElement).className).toContain('rounded-none');
      expect((sm.firstChild as HTMLElement).className).toContain('rounded-sm');
      expect((md.firstChild as HTMLElement).className).toContain('rounded-md');
      expect((lg.firstChild as HTMLElement).className).toContain('rounded-lg');
      expect((full.firstChild as HTMLElement).className).toContain('rounded-full');
    });

    it('is hidden from accessibility tree', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('SkeletonText', () => {
    it('renders correct number of lines', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const lines = container.querySelectorAll('[aria-hidden="true"]');

      expect(lines).toHaveLength(3);
    });

    it('last line is shorter when multiple lines', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const lines = container.querySelectorAll('[aria-hidden="true"]');
      const lastLine = lines[lines.length - 1] as HTMLElement;

      expect(lastLine.style.width).toBe('75%');
    });

    it('applies custom line height', () => {
      const { container } = render(<SkeletonText lineHeight={24} />);
      const line = container.querySelector('[aria-hidden="true"]') as HTMLElement;

      expect(line.style.height).toBe('24px');
    });
  });

  describe('SkeletonCard', () => {
    it('has fixed height to prevent CLS', () => {
      const { container } = render(<SkeletonCard />);
      const card = container.firstChild as HTMLElement;

      // Default height is 96px
      expect(card.style.height).toBe('96px');
    });

    it('accepts custom height', () => {
      const { container } = render(<SkeletonCard height={120} />);
      const card = container.firstChild as HTMLElement;

      expect(card.style.height).toBe('120px');
    });
  });

  describe('SkeletonStatCard', () => {
    it('has fixed height of 104px to match actual StatCard', () => {
      const { container } = render(<SkeletonStatCard />);
      const card = container.firstChild as HTMLElement;

      // Should match Dashboard StatCard height
      expect(card.style.height).toBe('104px');
    });
  });

  describe('SkeletonChart', () => {
    it('has fixed height to prevent CLS', () => {
      const { container } = render(<SkeletonChart />);
      const chart = container.firstChild as HTMLElement;

      // Default height is 300px
      expect(chart.style.height).toBe('300px');
    });

    it('accepts custom height', () => {
      const { container } = render(<SkeletonChart height={400} />);
      const chart = container.firstChild as HTMLElement;

      expect(chart.style.height).toBe('400px');
    });

    it('renders bar placeholders', () => {
      const { container } = render(<SkeletonChart />);
      const bars = container.querySelectorAll('[aria-hidden="true"]');

      // Should have multiple bar elements (12 bars + 3 header elements)
      expect(bars.length).toBeGreaterThan(10);
    });
  });

  describe('SkeletonTableRow', () => {
    it('has fixed height of 72px to prevent CLS', () => {
      const { container } = render(<SkeletonTableRow />);
      const row = container.firstChild as HTMLElement;

      expect(row.style.height).toBe('72px');
    });

    it('renders correct number of columns', () => {
      const { container } = render(<SkeletonTableRow columns={5} />);
      const cells = container.querySelectorAll('[aria-hidden="true"]');

      expect(cells).toHaveLength(5);
    });

    it('renders custom number of columns', () => {
      const { container } = render(<SkeletonTableRow columns={3} />);
      const cells = container.querySelectorAll('[aria-hidden="true"]');

      expect(cells).toHaveLength(3);
    });
  });

  describe('SkeletonAvatar', () => {
    it('renders small size correctly', () => {
      const { container } = render(<SkeletonAvatar size="sm" />);
      const avatar = container.firstChild as HTMLElement;

      expect(avatar.style.width).toBe('32px');
      expect(avatar.style.height).toBe('32px');
    });

    it('renders medium size correctly', () => {
      const { container } = render(<SkeletonAvatar size="md" />);
      const avatar = container.firstChild as HTMLElement;

      expect(avatar.style.width).toBe('40px');
      expect(avatar.style.height).toBe('40px');
    });

    it('renders large size correctly', () => {
      const { container } = render(<SkeletonAvatar size="lg" />);
      const avatar = container.firstChild as HTMLElement;

      expect(avatar.style.width).toBe('56px');
      expect(avatar.style.height).toBe('56px');
    });

    it('is circular', () => {
      const { container } = render(<SkeletonAvatar />);
      const avatar = container.firstChild as HTMLElement;

      expect(avatar.className).toContain('rounded-full');
    });
  });

  describe('SkeletonButton', () => {
    it('renders small size correctly', () => {
      const { container } = render(<SkeletonButton size="sm" />);
      const button = container.firstChild as HTMLElement;

      expect(button.style.height).toBe('32px');
    });

    it('renders medium size correctly', () => {
      const { container } = render(<SkeletonButton size="md" />);
      const button = container.firstChild as HTMLElement;

      expect(button.style.height).toBe('40px');
    });

    it('renders large size correctly', () => {
      const { container } = render(<SkeletonButton size="lg" />);
      const button = container.firstChild as HTMLElement;

      expect(button.style.height).toBe('48px');
    });

    it('accepts custom width', () => {
      const { container } = render(<SkeletonButton width={200} />);
      const button = container.firstChild as HTMLElement;

      expect(button.style.width).toBe('200px');
    });
  });
});

describe('CLS Prevention Validation', () => {
  it('all skeleton components should have explicit dimensions', () => {
    // This test validates that skeleton components follow CLS best practices
    const components = [
      { component: <SkeletonCard />, expectedHeight: '96px' },
      { component: <SkeletonStatCard />, expectedHeight: '104px' },
      { component: <SkeletonChart />, expectedHeight: '300px' },
      { component: <SkeletonTableRow />, expectedHeight: '72px' },
    ];

    components.forEach(({ component, expectedHeight }) => {
      const { container } = render(component);
      const element = container.firstChild as HTMLElement;
      expect(element.style.height).toBe(expectedHeight);
    });
  });
});
