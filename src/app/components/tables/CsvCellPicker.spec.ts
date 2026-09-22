import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CsvCellPicker from './CsvCellPicker.vue';

vi.mock('@/services/resource-media.service', () => ({
  ensureResourceMedia: vi.fn().mockResolvedValue(undefined),
  resourceMediaDataUrl: vi.fn().mockReturnValue(undefined),
}));

function mountPicker(anchor: { height: number; left: number; top: number; width: number }) {
  return mount(CsvCellPicker, {
    props: { anchor, multiple: false, options: [], values: [] },
    global: { plugins: [createPinia()] },
  });
}

describe('CsvCellPicker placement', () => {
  beforeEach(() => {
    vi.stubGlobal('innerHeight', 800);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens downward when the panel fully fits below the anchor', () => {
    const wrapper = mountPicker({ height: 30, left: 40, top: 100, width: 200 });

    const style = wrapper.attributes('style');
    expect(style).toContain('top: 132px');
    expect(style).not.toContain('bottom');
    wrapper.unmount();
  });

  it('flips upward when the downward panel would be clipped by the window edge', () => {
    const wrapper = mountPicker({ height: 30, left: 40, top: 700, width: 200 });

    const style = wrapper.attributes('style');
    expect(style).toContain('bottom: 102px');
    expect(style).not.toContain('top:');
    wrapper.unmount();
  });

  it('keeps the downward side when the window is too short for either side', () => {
    vi.stubGlobal('innerHeight', 60);
    const wrapper = mountPicker({ height: 30, left: 40, top: 10, width: 200 });

    const style = wrapper.attributes('style');
    expect(style).toContain('top: 42px');
    expect(style).not.toContain('bottom');
    wrapper.unmount();
  });
});
