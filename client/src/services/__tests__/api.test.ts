import { tournamentsApi, setUnauthorizedHandler } from '../api';

describe('apiRequest 401 handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    setUnauthorizedHandler(() => {});
  });

  test('throws Unauthorized without navigating the browser', async () => {
    const before = window.location.href;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid token' }),
    }) as unknown as typeof fetch;

    await expect(tournamentsApi.getTournaments(1, 20)).rejects.toThrow('Unauthorized');
    expect(window.location.href).toBe(before);
  });

  test('invokes the registered unauthorized handler exactly once per failed call', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    await expect(tournamentsApi.getTournaments(1, 20)).rejects.toThrow();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a non-401 error still throws the server message and does not touch the handler', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Database unavailable' }),
    }) as unknown as typeof fetch;
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    await expect(tournamentsApi.getTournaments(1, 20)).rejects.toThrow('Database unavailable');

    expect(handler).not.toHaveBeenCalled();
  });
});
