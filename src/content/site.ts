/**
 * Тексты главной страницы. Собраны в одном месте, чтобы позже вынести в словари ru/kk/en.
 * Факты взяты со старого сайта sevenhills.kz и требуют подтверждения перед публикацией.
 */

export const company = {
  name: "Seven Hills of Kazakhstan",
  short: "Seven Hills",
  since: 2005,
} as const;

export const contacts = {
  phone: { label: "+7 (7172) 573-573", href: "tel:+77172573573" },
  reception: { label: "+7 (7172) 287-862", href: "tel:+77172287862" },
  accounting: { label: "+7 (7172) 287-863", href: "tel:+77172287863" },
  email: "info@7hills.kz",
  support: "support@7hills.kz",
  helpdesk: "https://helpdesk.sevenhills.kz",
  address: ["010000, Республика Казахстан, г. Астана", "проспект Мәнгілік ел 20/1, 3 этаж"],
} as const;

export const nav = [
  { href: "#directions", label: "Направления" },
  { href: "#products", label: "Продукты" },
  { href: "#trust", label: "О работе" },
  { href: "#contact", label: "Контакты" },
] as const;

/** Подписи, которые сменяют друг друга, пока знак «7» вращается и разбирается. */
export const hero = {
  eyebrow: "Seven Hills of Kazakhstan",
  title: "Системный интегратор.",
  lead: "С 2005 года создаём, модернизируем и сопровождаем информационные системы по всему Казахстану.",
  primary: "Оставить заявку",
  secondary: "Смотреть направления",
  phases: [
    {
      title: "Одна команда — от серверной до отчётности.",
      text: "Инфраструктура, оборудование, учёт, безопасность и разработка у одного подрядчика.",
    },
    {
      title: "Свои продукты.",
      text: "ERP.Бюджет, Smart Batyr, SmartCommand, RFID Control и компьютеры SEVEN HILLS.",
      callout: "Собственные разработки",
    },
    {
      title: "Решения мировых вендоров.",
      text: "Cisco, HPE, Dell EMC, VMware, NetApp — подбираем, поставляем и внедряем.",
      callout: "Мировые вендоры",
    },
    {
      title: "Собираем в одну систему.",
      text: "И сопровождаем её круглосуточно.",
    },
  ],
} as const;

export const statement =
  "Мы строим и сопровождаем информационные системы для государственных учреждений и бизнеса — с представительствами в 20 областях, поддержкой 24/7 и параметрами качества, о которых договариваемся заранее.";

export const numbers = [
  { value: "2005", caption: "На рынке информационных технологий с 2005 года." },
  { value: "20", caption: "Областей Казахстана, где есть наши представительства." },
  { value: "250+", caption: "Государственных и частных учреждений ежегодно." },
  { value: "150+", caption: "Сотрудников по всему Казахстану." },
  { value: "24/7", caption: "Техническая поддержка без выходных." },
] as const;

export type DirectionArt = "network" | "cloud" | "rack" | "ledger" | "shield" | "code" | "clock";

export type Direction = {
  readonly id: string;
  readonly art: DirectionArt;
  readonly title: string;
  readonly text: string;
  readonly items: readonly string[];
};

export const directions: readonly Direction[] = [
  {
    id: "infrastructure",
    art: "network",
    title: "Инфраструктура",
    text: "Строим, внедряем и сопровождаем инфраструктуру: от ремонта оборудования до полного ИТ-аутсорсинга и работы систем в ЦОД.",
    items: ["IT Service Management", "Сетевая инфраструктура", "ИТ-аутсорсинг"],
  },
  {
    id: "cloud",
    art: "cloud",
    title: "Облако",
    text: "Виртуальные серверы VDS и VPS: мощность выделенного сервера без больших стартовых затрат.",
    items: ["VDS", "VPS", "Облачные технологии"],
  },
  {
    id: "hardware",
    art: "rack",
    title: "Оборудование",
    text: "Поставляем технику ведущих вендоров и собственные компьютеры и серверы SEVEN HILLS.",
    items: ["Компьютеры SH300", "Серверы серии SH", "СХД"],
  },
  {
    id: "accounting",
    art: "ledger",
    title: "Учёт и бюджет",
    text: "ERP.Бюджет, бухгалтерский и кадровый учёт, учёт основных средств и консолидация отчётности госучреждений.",
    items: ["ERP.Бюджет", "Конфигурации на 1С", "Консолидация отчётности"],
  },
  {
    id: "security",
    art: "shield",
    title: "Безопасность",
    text: "Защищаем рабочие станции и серверы антивирусом Smart Batyr и контролируем носители с RFID Control.",
    items: ["Smart Batyr Endpoint Security", "RFID Control", "Hex-Rays"],
  },
  {
    id: "development",
    art: "code",
    title: "Разработка",
    text: "Разрабатываем и внедряем информационные системы. SmartCommand следит за компьютерами в локальной сети.",
    items: ["Разработка ПО", "SmartCommand", "Автоматизация учёта"],
  },
  {
    id: "support",
    art: "clock",
    title: "Поддержка 24/7",
    text: "Круглосуточная поддержка и представительства в 20 областях — приедем на удалённый объект.",
    items: ["Единый номер 573-573", "Helpdesk", "SLA"],
  },
];

export const products = {
  eyebrow: "Продукты",
  title: "Не только внедряем. Создаём своё.",
  list: [
    { name: "ERP.Бюджет", kind: "Программное обеспечение", text: "Система управления организацией на основе дашбордов." },
    {
      name: "Smart Batyr Endpoint Security",
      kind: "Программное обеспечение",
      text: "Антивирус корпоративного уровня для рабочих станций и серверов.",
    },
    { name: "SmartCommand", kind: "Программное обеспечение", text: "Мониторинг компьютеров в локальной сети." },
    { name: "RFID Control", kind: "Программное обеспечение", text: "Контроль вноса и выноса носителей информации." },
    {
      name: "Консолидация финансовой отчётности",
      kind: "Программное обеспечение",
      text: "Сбор и проверка отчётности подведомственных организаций.",
    },
    { name: "SEVEN HILLS SH300", kind: "Оборудование", text: "Офисные компьютеры и графические станции QCT и QBT." },
    { name: "SEVEN HILLS серии SH", kind: "Оборудование", text: "Серверы и системы хранения данных." },
  ],
} as const;

export const trust = {
  eyebrow: "Как мы работаем",
  title: "Договариваемся о качестве заранее. Отвечаем за результат.",
  principles: [
    "Согласовываем параметры качества — SLA",
    "Чётко соблюдаем сроки",
    "Работают сертифицированные специалисты",
    "Применяем мультивендорный подход",
    "Берёмся за нестандартные задачи",
    "Строим долгосрочные отношения",
  ],
  vendors: ["Cisco", "HPE", "Dell EMC", "VMware", "NetApp", "Hex-Rays"],
  certificates: [
    "СТ РК ISO 9001-2016 — системы менеджмента качества",
    "СТ РК ИСО 14001-2006 — системы экологического менеджмента",
  ],
} as const;

export const contactSection = {
  title: "Расскажите о задаче.",
  text: "Опишите, что нужно сделать, и оставьте контакт. Или позвоните — поддержка работает круглосуточно.",
  submit: "Отправить заявку",
  note: "Кнопка откроет письмо в вашей почтовой программе.",
} as const;
