import { runOnUIAsync, scheduleOnUI } from 'react-native-worklets';

jest.mock('../src/platformChecker', () => ({ IS_JEST: false }));

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

async function waitForUIQueueFlush(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe.each([true, false])('web threads (rAF: %s)', (hasRAF) => {
  beforeEach(() => {
    if (hasRAF) {
      globalThis.requestAnimationFrame = jest.fn((callback) => {
        setTimeout(() => callback(performance.now()), 0);
        return 0;
      });
    } else {
      Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    }
  });

  test('executes the rest of the batch when a callback throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('boom');
    const calls: string[] = [];

    scheduleOnUI(() => {
      calls.push('first');
    });
    scheduleOnUI(() => {
      throw error;
    });
    scheduleOnUI(() => {
      calls.push('third');
    });
    expect(calls).toEqual([]);
    await waitForUIQueueFlush();

    expect(calls).toEqual(['first', 'third']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    if (hasRAF) {
      expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);
    }
  });

  test('resolves promises returned by runOnUIAsync', async () => {
    await expect(
      runOnUIAsync((a: number, b: number) => a + b, 2, 3)
    ).resolves.toBe(5);
  });

  test('rejects promises returned by runOnUIAsync', async () => {
    const error = new Error('boom');
    await expect(
      runOnUIAsync(() => {
        throw error;
      })
    ).rejects.toBe(error);
  });
});
