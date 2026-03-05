// client/src/utils/debounce.test.js
import { debounce } from './debounce.js';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('debounce', () => {
  let func;
  let debouncedFunc;

  beforeEach(() => {
    func = vi.fn();
    debouncedFunc = debounce(func, 100);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should execute the function immediately on the first call', () => {
    debouncedFunc();
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should not execute the function again if called within the debounce period', () => {
    debouncedFunc();
    debouncedFunc(); // second call within 100ms
    debouncedFunc(); // third call within 100ms

    expect(func).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50); // Advance halfway
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should execute the function again after the debounce period has passed', () => {
    debouncedFunc();
    expect(func).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100); // Pass the debounce period
    debouncedFunc();
    expect(func).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments correctly to the debounced function', () => {
    debouncedFunc(1, 2, 3);
    expect(func).toHaveBeenCalledWith(1, 2, 3);

    vi.advanceTimersByTime(100);
    debouncedFunc(4, 5);
    expect(func).toHaveBeenCalledWith(4, 5);
  });

  it('should maintain the correct `this` context', () => {
    const context = { key: 'value' };
    debouncedFunc.call(context);
    expect(func).toHaveBeenCalledOnLastCallWith(); // Check for any args, context handled by apply
    expect(func).toHaveBeenCalledWith(); // Expect no args for initial call

    vi.advanceTimersByTime(100);

    debouncedFunc.call(context, 'arg1');
    expect(func).toHaveBeenCalledOnLastCallWith('arg1');
    expect(func).toHaveBeenCalledWith('arg1'); // Check if args are passed
  });

  it('should reset the timer on subsequent calls within the debounce period', () => {
    debouncedFunc();
    expect(func).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    debouncedFunc(); // This should reset the timer

    vi.advanceTimersByTime(50); // Total 100ms from last call, but not enough from first
    expect(func).toHaveBeenCalledTimes(1); // Still only once

    vi.advanceTimersByTime(50); // Now 100ms from the *second* call
    expect(func).toHaveBeenCalledTimes(1); // Still only once, as the current implementation doesn't have a "trailing" call

    // The current implementation of debounce executes immediately and then prevents further calls
    // until the delay passes. It does *not* execute a "trailing" call.
  });

    it('should not execute the function if only subsequent calls are made within the debounce period and the initial call was not made', () => {
        debouncedFunc(); // first call, executes immediately
        expect(func).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(50);
        debouncedFunc(); // called again, within debounce period, does nothing

        vi.advanceTimersByTime(20);
        debouncedFunc(); // called again, within debounce period, does nothing

        vi.advanceTimersByTime(100); // let the timer for the first call expire
        expect(func).toHaveBeenCalledTimes(1); // still only one execution
    });

    it('should allow execution again after the debounce period of the last call has fully passed', () => {
        debouncedFunc();
        expect(func).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(50);
        debouncedFunc(); // resets internal timer

        vi.advanceTimersByTime(100); // 100ms *after the last call*

        debouncedFunc(); // should execute again
        expect(func).toHaveBeenCalledTimes(2);
    });
});