/**
 * Условные интерфейсы продуктов для карточек /v3 — нарисованы кодом и анимированы CSS.
 * Это иллюстрации, а не скриншоты: в подписи карточки так и сказано. Когда появятся
 * настоящие скриншоты, их можно поставить вместо этих компонентов.
 */

function Window({ title, dark = false, children }: { title: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`ui-window absolute inset-x-[7%] top-[11%] bottom-[-6%] overflow-hidden rounded-t-[14px] text-[11px] shadow-[0_30px_60px_-25px_rgb(0_0_0/0.45)] sm:text-[12px] ${
        dark ? "bg-[#0d1416] text-white" : "bg-white text-[#0b1214]"
      }`}
    >
      <div className={`flex items-center gap-1.5 border-b px-3 py-2 ${dark ? "border-white/10" : "border-black/8"}`}>
        <span className="size-2 rounded-full bg-[#ff6b5a]" />
        <span className="size-2 rounded-full bg-[#ffc974]" />
        <span className="size-2 rounded-full bg-[#5fd18a]" />
        <span className={`ml-2 font-medium ${dark ? "text-white/70" : "text-black/60"}`}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function ErpUI() {
  const bars = [42, 58, 51, 66, 72, 61, 78, 84, 69, 88, 74, 92];
  return (
    <Window title="ERP.Бюджет — исполнение">
      <div className="grid grid-cols-3 gap-2 p-3">
        {[
          ["План", "100%"],
          ["Исполнено", "78%"],
          ["Остаток", "22%"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-[#f2f5f5] p-2">
            <p className="text-black/50">{k}</p>
            <p className="mt-0.5 text-[1.5em] font-semibold tracking-tight">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex h-[38%] items-end gap-[3%] px-3">
        {bars.map((h, i) => (
          <span
            key={i}
            className="ui-bar flex-1 rounded-t-[3px] bg-[#00bbc4]"
            style={{ height: `${h}%`, animationDelay: `${i * 0.08}s`, opacity: i === 11 ? 1 : 0.35 + (i / 11) * 0.5 }}
          />
        ))}
      </div>
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-lg bg-[#f2f5f5] p-2">
        <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#dfe6e6" strokeWidth="5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#ffb541" strokeWidth="5" strokeDasharray="94.2" className="ui-ring" />
        </svg>
        <div>
          <p className="font-medium">Консолидация отчётности</p>
          <p className="text-black/50">подведомственные организации</p>
        </div>
      </div>
    </Window>
  );
}

export function BatyrUI() {
  const rows = ["ПК-014 · Бухгалтерия", "ПК-027 · Канцелярия", "SRV-02 · Файловый сервер", "ПК-031 · Отдел кадров", "SRV-05 · Почта"];
  return (
    <Window title="Smart Batyr — консоль" dark>
      <div className="flex items-center gap-3 p-3">
        <div className="relative grid size-12 place-items-center rounded-xl bg-[#00bbc4]/15">
          <svg viewBox="0 0 24 24" className="size-7 text-[#3fd3db]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6Z" />
            <path d="m8.5 12 2.4 2.4 4.6-4.8" />
          </svg>
          <span className="ui-ping absolute inset-0 rounded-xl border border-[#3fd3db]" />
        </div>
        <div>
          <p className="text-[1.35em] font-semibold">Защищено</p>
          <p className="text-white/50">Проверка рабочих станций</p>
        </div>
      </div>
      <div className="mx-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <span className="ui-scan block h-full w-1/3 rounded-full bg-[#3fd3db]" />
      </div>
      <ul className="mt-3 grid gap-1 px-3">
        {rows.map((r, i) => (
          <li key={r} className="flex items-center justify-between rounded-md bg-white/[0.04] px-2 py-1.5">
            <span className="text-white/80">{r}</span>
            <span className={`ui-blink size-1.5 rounded-full ${i === 2 ? "bg-[#ffb541]" : "bg-[#5fd18a]"}`} style={{ animationDelay: `${i * 0.3}s` }} />
          </li>
        ))}
      </ul>
    </Window>
  );
}

export function CommandUI() {
  return (
    <Window title="SmartCommand — сеть">
      <div className="flex items-center justify-between px-3 pt-3">
        <p className="font-medium">Компьютеры в сети</p>
        <p className="rounded-full bg-[#00bbc4]/12 px-2 py-0.5 font-medium text-[#00828a]">онлайн 22 из 24</p>
      </div>
      <div className="grid grid-cols-6 gap-1.5 p-3">
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="relative grid aspect-square place-items-center rounded-md bg-[#f2f5f5]">
            <svg viewBox="0 0 24 24" className="size-[55%] text-black/45" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3.5" y="4.5" width="17" height="11" rx="1.5" />
              <path d="M9 19.5h6M12 15.5v4" />
            </svg>
            <span
              className={`ui-blink absolute size-1.5 translate-x-[180%] -translate-y-[180%] rounded-full ${i === 7 || i === 18 ? "bg-[#ff6b5a]" : "bg-[#00bbc4]"}`}
              style={{ animationDelay: `${(i % 7) * 0.25}s` }}
            />
          </div>
        ))}
      </div>
      <svg viewBox="0 0 200 40" className="mx-3 h-[14%] w-[calc(100%-1.5rem)]" preserveAspectRatio="none">
        <path
          d="M0 30 L20 26 L40 28 L60 18 L80 22 L100 12 L120 20 L140 10 L160 16 L180 8 L200 14"
          fill="none"
          stroke="#00bbc4"
          strokeWidth="2"
          pathLength={1}
          className="ui-line"
        />
      </svg>
    </Window>
  );
}

export function RfidUI() {
  const log = [
    ["USB-накопитель · метка 04A1", "вынос разрешён", true],
    ["Внешний диск · метка 09C7", "вынос запрещён", false],
    ["Ноутбук · метка 1F30", "внос зарегистрирован", true],
    ["USB-накопитель · метка 0B52", "вынос разрешён", true],
  ] as const;
  return (
    <Window title="RFID Control — проходная" dark>
      <div className="flex items-center gap-4 p-3">
        <div className="relative grid size-14 place-items-center">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ui-wave absolute inset-0 rounded-full border border-[#ffb541]" style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
          <span className="size-3 rounded-full bg-[#ffb541]" />
        </div>
        <div>
          <p className="text-[1.25em] font-semibold">Считыватель на выходе</p>
          <p className="text-white/50">носители информации под контролем</p>
        </div>
      </div>
      <ul className="grid gap-1 px-3">
        {log.map(([what, status, ok], i) => (
          <li key={what} className="ui-row flex items-center justify-between rounded-md bg-white/[0.05] px-2 py-1.5" style={{ animationDelay: `${i * 0.5}s` }}>
            <span className="text-white/80">{what}</span>
            <span className={ok ? "text-[#5fd18a]" : "text-[#ff8a7a]"}>{status}</span>
          </li>
        ))}
      </ul>
    </Window>
  );
}
