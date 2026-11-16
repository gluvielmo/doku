"use client";

import type { Settings } from "@/lib/game/types";

const TOGGLES: { key: keyof Settings; label: string; help: string }[] = [
  { key: "highlightPeers", label: "Highlight row, column & box", help: "Shade the cells that see the selected cell." },
  { key: "highlightSameDigit", label: "Highlight same digit", help: "Emphasise matching digits and pencil marks." },
  { key: "showConflicts", label: "Show duplicates", help: "Mark digits that repeat in a row, column or box." },
  { key: "showMistakes", label: "Show mistakes instantly", help: "Mark digits that don't match the solution." },
  { key: "autoRemoveNotes", label: "Auto-remove notes", help: "Placing a digit clears it from marks in its row, column and box." },
  { key: "showTimer", label: "Show timer", help: "" },
  { key: "sound", label: "Sounds", help: "Clicks when you place digits, and a chime when you solve." },
];

export function SettingsSheet({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="ghost" onClick={onClose}>
            Done
          </button>
        </div>
        {TOGGLES.map((t) => (
          <label key={t.key} className="toggle">
            <span>
              <strong>{t.label}</strong>
              {t.help && <small>{t.help}</small>}
            </span>
            <input type="checkbox" checked={Boolean(settings[t.key])} onChange={(e) => onChange({ ...settings, [t.key]: e.target.checked })} />
          </label>
        ))}
        <label className="toggle">
          <span>
            <strong>Corner mark layout</strong>
            <small>Grid puts each digit in a fixed spot; Corners fills the corners in order (SudokuPad style).</small>
          </span>
          <select value={settings.cornerLayout} onChange={(e) => onChange({ ...settings, cornerLayout: e.target.value as Settings["cornerLayout"] })}>
            <option value="grid">Grid</option>
            <option value="corners">Corners</option>
          </select>
        </label>
        <div className="shortcuts">
          <h3>Keyboard</h3>
          <p>
            <kbd>1</kbd>–<kbd>9</kbd> place · <kbd>Shift</kbd>+digit corner · <kbd>Ctrl</kbd>+digit centre · <kbd>Alt</kbd>+digit colour
          </p>
          <p>
            <kbd>V</kbd> normal · <kbd>Space</kbd> corner · <kbd>X</kbd> centre · <kbd>Z</kbd> colour · <kbd>C</kbd> swap notes · <kbd>T</kbd> test · arrows move (+<kbd>Shift</kbd> extend)
          </p>
          <p>
            <kbd>Backspace</kbd> erase · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>Ctrl</kbd>+<kbd>A</kbd> select all · <kbd>Enter</kbd> deselect ·
            double-click selects all of a digit
          </p>
        </div>
      </div>
    </div>
  );
}
