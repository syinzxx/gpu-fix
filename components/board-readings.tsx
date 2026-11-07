"use client";

import { useActionState, useState } from "react";
import { addMeasurement, type MeasurementState } from "@/app/actions/library";
import { Button, Input, Label, Select } from "@/components/ui";
import type { Translations } from "@/lib/i18n";

const UNITS: Record<string, string[]> = { DIODE: ["V", "mV"], VOLTAGE: ["V", "mV"], RESISTANCE: ["ohm", "kohm", "Mohm"] };
const UNIT_LABELS: Record<string, string> = { V: "V", mV: "mV", ohm: "Ω", kohm: "kΩ", Mohm: "MΩ" };

export function AddReadingForm({ boardId, t }: { boardId: string; t: Translations }) {
  const [state, action, pending] = useActionState<MeasurementState, FormData>(addMeasurement.bind(null, boardId), {});
  const [mode, setMode] = useState("DIODE");
  const [open, setOpen] = useState(false);
  const usesPolarity = mode === "DIODE";

  return (
    <form action={action} className="space-y-3 border-t border-slate-100 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="reading-target">{t.libReadingTarget}</Label>
          <Input id="reading-target" name="target" dir="ltr" required placeholder="FBVDDQ" />
        </div>
        <div>
          <Label htmlFor="reading-mode">{t.libReadingMode}</Label>
          <Select id="reading-mode" name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="DIODE">{t.libModeDiode}</option>
            <option value="RESISTANCE">{t.libModeResistance}</option>
            <option value="VOLTAGE">{t.libModeVoltage}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="reading-condition">{t.libCondition}</Label>
          <Select id="reading-condition" name="condition" defaultValue="GOOD">
            <option value="GOOD">{t.libGood}</option>
            <option value="FAULTY">{t.libFaulty}</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="reading-value">{t.libReadingValue}</Label>
          <div className="flex gap-1.5">
            <Input id="reading-value" name="value" dir="ltr" inputMode="decimal" disabled={open} required={!open} />
            <Select key={mode} name="unit" aria-label={t.libReadingUnit} disabled={open} className="w-20 shrink-0">
              {UNITS[mode].map((unit) => (
                <option key={unit} value={unit}>{UNIT_LABELS[unit]}</option>
              ))}
            </Select>
          </div>
          <label className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" name="open" checked={open} onChange={(event) => setOpen(event.target.checked)} />
            {t.libReadingOpen}
          </label>
        </div>
        {usesPolarity && (
          <div>
            <Label htmlFor="reading-polarity">{t.libPolarity}</Label>
            <Select id="reading-polarity" name="polarity" defaultValue="RED_ON_GROUND">
              <option value="RED_ON_GROUND">{t.libRedOnGround}</option>
              <option value="BLACK_ON_GROUND">{t.libBlackOnGround}</option>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="reading-meter">{t.libMeter}</Label>
          <Input id="reading-meter" name="meter" placeholder="Fluke 87V" />
        </div>
      </div>

      <div>
        <Label htmlFor="reading-note">{t.libNotes}</Label>
        <Input id="reading-note" name="note" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{t.libAddReading}</Button>
        <p role="status" className={state.error ? "text-sm font-semibold text-rose-600" : "text-sm font-semibold text-emerald-700"}>
          {state.error === "value" ? t.libReadingBadValue : state.error === "target" ? t.libReadingBadTarget : state.ok ? t.libReadingSaved : ""}
        </p>
      </div>
    </form>
  );
}
