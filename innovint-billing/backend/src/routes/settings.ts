import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppSettings, BarrelSnapshots, RateRule } from '../types';

const router = Router();
const CONFIG_PATH = path.join(os.homedir(), '.innovint-billing-config.json');

function defaultSettings(): AppSettings {
  return {
    token: '',
    wineryId: '',
    rateRules: [],
    lastUsedMonth: 'January',
    lastUsedYear: new Date().getFullYear(),
    barrelSnapshots: { snap1Day: 1, snap2Day: 15, snap3Day: 'last' },
  };
}

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const defaults = defaultSettings();
      return {
        token: parsed.token ?? defaults.token,
        wineryId: parsed.wineryId ?? defaults.wineryId,
        rateRules: Array.isArray(parsed.rateRules) ? parsed.rateRules : defaults.rateRules,
        lastUsedMonth: parsed.lastUsedMonth ?? defaults.lastUsedMonth,
        lastUsedYear: parsed.lastUsedYear ?? defaults.lastUsedYear,
        barrelSnapshots: parsed.barrelSnapshots ?? defaults.barrelSnapshots,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return defaultSettings();
}

function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/settings — return full config (token masked)
router.get('/', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json({
    token: settings.token ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '',
    wineryId: settings.wineryId,
    hasToken: !!settings.token,
    rateRules: settings.rateRules,
    lastUsedMonth: settings.lastUsedMonth,
    lastUsedYear: settings.lastUsedYear,
    barrelSnapshots: settings.barrelSnapshots,
  });
});

// POST /api/settings — save credentials
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Partial<AppSettings>;
  const current = loadSettings();

  const updated: AppSettings = {
    token: body.token !== undefined && body.token !== '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' ? body.token : current.token,
    wineryId: body.wineryId !== undefined ? body.wineryId : current.wineryId,
    rateRules: body.rateRules !== undefined ? body.rateRules : current.rateRules,
    lastUsedMonth: body.lastUsedMonth !== undefined ? body.lastUsedMonth : current.lastUsedMonth,
    lastUsedYear: body.lastUsedYear !== undefined ? body.lastUsedYear : current.lastUsedYear,
    barrelSnapshots: body.barrelSnapshots !== undefined ? body.barrelSnapshots : current.barrelSnapshots,
  };

  saveSettings(updated);
  res.json({ success: true, wineryId: updated.wineryId, hasToken: !!updated.token });
});

// GET /api/settings/rate-rules — get just rate rules
router.get('/rate-rules', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json(settings.rateRules);
});

// PUT /api/settings/rate-rules — replace all rate rules
router.put('/rate-rules', (req: Request, res: Response) => {
  const rules = req.body as RateRule[];
  if (!Array.isArray(rules)) {
    res.status(400).json({ error: 'Expected an array of rate rules.' });
    return;
  }
  const current = loadSettings();
  current.rateRules = rules;
  saveSettings(current);
  res.json({ success: true, count: rules.length });
});

// PUT /api/settings/billing-prefs — save month/year preferences
router.put('/billing-prefs', (req: Request, res: Response) => {
  const { lastUsedMonth, lastUsedYear } = req.body as { lastUsedMonth?: string; lastUsedYear?: number };
  const current = loadSettings();
  if (lastUsedMonth !== undefined) current.lastUsedMonth = lastUsedMonth;
  if (lastUsedYear !== undefined) current.lastUsedYear = lastUsedYear;
  saveSettings(current);
  res.json({ success: true });
});

// PUT /api/settings/barrel-snapshots — save barrel snapshot day config
router.put('/barrel-snapshots', (req: Request, res: Response) => {
  const body = req.body as Partial<BarrelSnapshots>;
  const current = loadSettings();
  current.barrelSnapshots = {
    snap1Day: body.snap1Day ?? current.barrelSnapshots.snap1Day,
    snap2Day: body.snap2Day ?? current.barrelSnapshots.snap2Day,
    snap3Day: body.snap3Day ?? current.barrelSnapshots.snap3Day,
  };
  saveSettings(current);
  res.json({ success: true, barrelSnapshots: current.barrelSnapshots });
});

export default router;
