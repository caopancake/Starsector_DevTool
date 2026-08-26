import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import CsvGridHeader from '@/app/components/tables/CsvGridHeader.vue';
import type { CsvGridColumn } from '@/domain/tables/csv-grid-model';

const column: CsvGridColumn = {
  className: 'schema-col-text',
  enumOptions: [],
  key: 'id',
  schema: null,
  widthPx: 120,
};

let wrapper: VueWrapper | null = null;

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

function mountHeader() {
  wrapper = mount(CsvGridHeader, {
    attachTo: document.body,
    props: { columns: [column] },
  });
  return wrapper;
}

describe('CsvGridHeader column resize', () => {
  it('sets the document interaction styles when resizing starts', async () => {
    const mounted = mountHeader();

    await mounted.get('.csv-th-resize').trigger('mousedown', { clientX: 100 });

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
  });

  it('emits the resized column width while the pointer moves', async () => {
    const mounted = mountHeader();
    await mounted.get('.csv-th-resize').trigger('mousedown', { clientX: 100 });

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 145 }));

    expect(mounted.emitted('resize-column')).toEqual([['id', 165]]);
  });

  it('clears styles and listeners when resizing ends', async () => {
    const mounted = mountHeader();
    await mounted.get('.csv-th-resize').trigger('mousedown', { clientX: 100 });
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 145 }));

    document.dispatchEvent(new MouseEvent('mouseup'));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 180 }));

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    expect(mounted.emitted('resize-column')).toEqual([['id', 165]]);
  });

  it('clears styles and listeners when unmounted during resizing', async () => {
    const mounted = mountHeader();
    await mounted.get('.csv-th-resize').trigger('mousedown', { clientX: 100 });

    mounted.unmount();
    wrapper = null;
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 145 }));

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    expect(mounted.emitted('resize-column')).toBeUndefined();
  });
});
