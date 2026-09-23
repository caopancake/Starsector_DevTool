import { describe, expect, it } from 'vitest';
import { appendBayPort, bayPorts, removeBayPort, updateBayPort } from './ship-slots';
import { mirrorBayPort, mirrorOffsetPoints, mirrorWeaponSlotForAdd } from './mirror';

describe('launch bay ports', () => {
  it('splits locations into coordinate pairs and drops an odd trailing number', () => {
    expect(bayPorts([-21, 185, -11, 178, 17, 150, 23, 144])).toEqual([
      [-21, 185],
      [-11, 178],
      [17, 150],
      [23, 144],
    ]);
    expect(bayPorts([10, 20, 30])).toEqual([[10, 20]]);
    expect(bayPorts([])).toEqual([]);
    expect(bayPorts(undefined)).toEqual([]);
    expect(bayPorts('bad')).toEqual([]);
  });

  it('appends, updates and removes ports while keeping other pairs intact', () => {
    const appended = appendBayPort([10, 20], [30, 40]);
    expect(appended).toEqual([10, 20, 30, 40]);
    expect(updateBayPort(appended, 1, [-5, 6])).toEqual([10, 20, -5, 6]);
    expect(removeBayPort(appended, 0)).toEqual([30, 40]);
    expect(updateBayPort([10, 20], 3, [0, 0])).toEqual([10, 20]);
    expect(removeBayPort([10, 20], 5)).toEqual([10, 20]);
  });

  it('removing the last port leaves an empty locations array', () => {
    expect(removeBayPort([10, 20], 0)).toEqual([]);
  });
});

describe('bay port mirroring', () => {
  it('mirrors a port inside the same bay across the centerline', () => {
    expect(mirrorBayPort([12, 34])).toEqual([12, -34]);
    expect(mirrorBayPort([12, 0])).toEqual([12, 0]);
  });

  it('mirrors every pair inside a locations array and drops an odd tail', () => {
    expect(mirrorOffsetPoints([10, 20, 30, 40, 50])).toEqual([10, -20, 30, -40]);
    expect(mirrorOffsetPoints(undefined)).toEqual([]);
  });

  it('mirrors the whole locations array when duplicating a bay slot', () => {
    const slot = { id: 'LB 1', size: 'LARGE', type: 'LAUNCH_BAY', mount: 'HIDDEN', arc: 360, angle: 0, locations: [10, 20, 30, 40] };
    expect(mirrorWeaponSlotForAdd(slot).locations).toEqual([10, -20, 30, -40]);
  });
});
