import { DEFAULT_LOCALE, type LocaleCode } from "./locales";

// Flat translation table keyed by message id, each with every supported locale.
// Use {var} placeholders; interpolation is handled by `translate`.

export type Translations = Record<string, Record<LocaleCode, string>>;

export type MessageVars = Record<string, string | number>;

// Look up a message for `locale`, falling back to English then the raw key, and
// substitute any {var} placeholders.
export function translate(
  locale: LocaleCode,
  key: string,
  vars?: MessageVars,
): string {
  const entry = translations[key];
  let message = entry?.[locale] ?? entry?.[DEFAULT_LOCALE] ?? key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      message = message.split(`{${name}}`).join(String(value));
    }
  }

  return message;
}

export const translations: Translations = {
  "common.close": {
    en: "Close",
    es: "Cerrar",
    ar: "إغلاق",
    zh: "关闭",
    fa: "بستن",
  },
  "common.save": {
    en: "Save",
    es: "Guardar",
    ar: "حفظ",
    zh: "保存",
    fa: "ذخیره",
  },
  "common.reset": {
    en: "Reset",
    es: "Restablecer",
    ar: "إعادة تعيين",
    zh: "重置",
    fa: "بازنشانی",
  },
  "common.copy": {
    en: "Copy",
    es: "Copiar",
    ar: "نسخ",
    zh: "复制",
    fa: "کپی",
  },

  "popup.statusEnabled": {
    en: "Enabled for all websites",
    es: "Activado para todos los sitios",
    ar: "مُفعّل لجميع المواقع",
    zh: "已对所有网站启用",
    fa: "برای همهٔ وب‌سایت‌ها فعال است",
  },
  "popup.statusDisabled": {
    en: "Disabled for all websites",
    es: "Desactivado para todos los sitios",
    ar: "مُعطّل لجميع المواقع",
    zh: "已对所有网站禁用",
    fa: "برای همهٔ وب‌سایت‌ها غیرفعال است",
  },
  "popup.fontFamily": {
    en: "Font family",
    es: "Tipo de letra",
    ar: "عائلة الخط",
    zh: "字体",
    fa: "خانوادهٔ فونت",
  },
  "popup.fontFamilyHelp": {
    en: "Add a font by name, or pick a bundled or uploaded font.",
    es: "Añade una fuente por nombre, o elige una incluida o subida.",
    ar: "أضف خطًا بالاسم، أو اختر خطًا مُضمّنًا أو مرفوعًا.",
    zh: "按名称添加字体，或选择内置或已上传的字体。",
    fa: "یک فونت را با نام اضافه کنید، یا یک فونت همراه یا بارگذاری‌شده را انتخاب کنید.",
  },
  "popup.fontPlaceholder": {
    en: "Type font and press Enter",
    es: "Escribe una fuente y pulsa Enter",
    ar: "اكتب اسم الخط واضغط Enter",
    zh: "输入字体名称并按回车",
    fa: "نام فونت را بنویسید و Enter بزنید",
  },
  "popup.addFont": {
    en: "Add font",
    es: "Añadir fuente",
    ar: "أضف خطًا",
    zh: "添加字体",
    fa: "افزودن فونت",
  },
  "popup.pressEnterSave": {
    en: "Press Enter to save this font.",
    es: "Pulsa Enter para guardar esta fuente.",
    ar: "اضغط Enter لحفظ هذا الخط.",
    zh: "按回车保存此字体。",
    fa: "برای ذخیرهٔ این فونت Enter را بزنید.",
  },
  "popup.savedFonts": {
    en: "Saved fonts",
    es: "Fuentes guardadas",
    ar: "الخطوط المحفوظة",
    zh: "已保存的字体",
    fa: "فونت‌های ذخیره‌شده",
  },
  "popup.bundledFonts": {
    en: "Bundled fonts",
    es: "Fuentes incluidas",
    ar: "الخطوط المُضمّنة",
    zh: "内置字体",
    fa: "فونت‌های همراه",
  },
  "popup.uploadedFonts": {
    en: "Uploaded fonts",
    es: "Fuentes subidas",
    ar: "الخطوط المرفوعة",
    zh: "已上传的字体",
    fa: "فونت‌های بارگذاری‌شده",
  },
  "popup.preActivated": {
    en: "Pre-activated sites",
    es: "Sitios preactivados",
    ar: "المواقع المُفعّلة مسبقًا",
    zh: "预先启用的网站",
    fa: "سایت‌های از پیش فعال",
  },
  "popup.clickToToggle": {
    en: "click to toggle",
    es: "clic para alternar",
    ar: "انقر للتبديل",
    zh: "点击切换",
    fa: "برای تغییر کلیک کنید",
  },
  "popup.disablePreset": {
    en: "Disable {site}",
    es: "Desactivar {site}",
    ar: "تعطيل {site}",
    zh: "禁用 {site}",
    fa: "غیرفعال کردن {site}",
  },
  "popup.enablePreset": {
    en: "Enable {site}",
    es: "Activar {site}",
    ar: "تفعيل {site}",
    zh: "启用 {site}",
    fa: "فعال کردن {site}",
  },
  "popup.applyFontFor": {
    en: "Apply font for {page}",
    es: "Aplicar fuente en {page}",
    ar: "تطبيق الخط على {page}",
    zh: "为 {page} 应用字体",
    fa: "اعمال فونت برای {page}",
  },
  "popup.applyFontHelp": {
    en: "Turn StyleShift font changes on or off for {page}.",
    es: "Activa o desactiva los cambios de fuente de StyleShift en {page}.",
    ar: "تفعيل أو تعطيل تغييرات خط StyleShift على {page}.",
    zh: "为 {page} 开启或关闭 StyleShift 字体更改。",
    fa: "تغییرات فونت StyleShift را برای {page} روشن یا خاموش کنید.",
  },
  "popup.codeFont": {
    en: "Code font",
    es: "Fuente de código",
    ar: "خط الشيفرة",
    zh: "代码字体",
    fa: "فونت کد",
  },
  "popup.codeFontHelp": {
    en: "Choose one font for code blocks, editors, and monospace content.",
    es: "Elige una fuente para bloques de código, editores y contenido monoespaciado.",
    ar: "اختر خطًا لكتل الشيفرة والمحرّرات والمحتوى أحادي المسافة.",
    zh: "为代码块、编辑器和等宽内容选择一种字体。",
    fa: "یک فونت برای بلوک‌های کد، ویرایشگرها و محتوای تک‌فاصله انتخاب کنید.",
  },
  "popup.searchCodeFont": {
    en: "Search code fonts",
    es: "Buscar fuentes de código",
    ar: "ابحث عن خطوط الشيفرة",
    zh: "搜索代码字体",
    fa: "جستجوی فونت‌های کد",
  },
  "popup.noCodeFont": {
    en: "No code font",
    es: "Sin fuente de código",
    ar: "بدون خط للشيفرة",
    zh: "不使用代码字体",
    fa: "بدون فونت کد",
  },
  "popup.noFontsFound": {
    en: "No fonts found.",
    es: "No se encontraron fuentes.",
    ar: "لم يتم العثور على خطوط.",
    zh: "未找到字体。",
    fa: "فونتی یافت نشد.",
  },
  "popup.pickCodeFont": {
    en: "Pick one code font",
    es: "Elige una fuente de código",
    ar: "اختر خط شيفرة واحدًا",
    zh: "选择一种代码字体",
    fa: "یک فونت کد انتخاب کنید",
  },

  "availability.bundled": {
    en: "Bundled with StyleShift — always available.",
    es: "Incluida con StyleShift: siempre disponible.",
    ar: "مُضمّن مع StyleShift — متاح دائمًا.",
    zh: "随 StyleShift 内置 — 始终可用。",
    fa: "همراه StyleShift — همیشه در دسترس.",
  },
  "availability.uploaded": {
    en: "Uploaded by you — always available.",
    es: "Subida por ti: siempre disponible.",
    ar: "مرفوع بواسطتك — متاح دائمًا.",
    zh: "由你上传 — 始终可用。",
    fa: "بارگذاری‌شده توسط شما — همیشه در دسترس.",
  },
  "availability.unknown": {
    en: "Can't verify — browsers don't reveal which fonts are installed on your system. It will be used if your device has it.",
    es: "No se puede verificar: los navegadores no revelan qué fuentes hay instaladas. Se usará si tu dispositivo la tiene.",
    ar: "لا يمكن التحقق — لا تكشف المتصفحات عن الخطوط المثبتة على جهازك. سيُستخدم إن كان متوفرًا.",
    zh: "无法验证 — 浏览器不会公开你系统中已安装的字体。如果你的设备有它，则会使用。",
    fa: "قابل تأیید نیست — مرورگرها فاش نمی‌کنند چه فونت‌هایی روی سیستم شما نصب است. اگر دستگاه شما آن را داشته باشد استفاده می‌شود.",
  },

  "editor.applyCss": {
    en: "Apply",
    es: "Aplicar",
    ar: "تطبيق",
    zh: "应用",
    fa: "اعمال",
  },
  "editor.editingFor": {
    en: "Editing CSS for:",
    es: "Editando CSS para:",
    ar: "تحرير CSS لـ:",
    zh: "正在编辑 CSS：",
    fa: "ویرایش CSS برای:",
  },
  "editor.cssPlaceholder": {
    en: "/* Custom CSS for this site */",
    es: "/* CSS personalizado para este sitio */",
    ar: "/* CSS مخصّص لهذا الموقع */",
    zh: "/* 此网站的自定义 CSS */",
    fa: "/* CSS سفارشی برای این سایت */",
  },
  "editor.customCSS": {
    en: "Custom CSS",
    es: "CSS personalizado",
    ar: "CSS مخصّص",
    zh: "自定义 CSS",
    fa: "CSS سفارشی",
  },
  "editor.format": {
    en: "Format",
    es: "Formatear",
    ar: "تنسيق",
    zh: "格式化",
    fa: "قالب‌بندی",
  },
  "editor.lines": {
    en: "{count} lines",
    es: "{count} líneas",
    ar: "{count} أسطر",
    zh: "{count} 行",
    fa: "{count} خط",
  },
  "editor.saveCss": {
    en: "Save CSS",
    es: "Guardar CSS",
    ar: "حفظ CSS",
    zh: "保存 CSS",
    fa: "ذخیرهٔ CSS",
  },
  "editor.saving": {
    en: "Saving...",
    es: "Guardando...",
    ar: "جارٍ الحفظ...",
    zh: "正在保存…",
    fa: "در حال ذخیره...",
  },
  "editor.removeCss": {
    en: "Remove CSS",
    es: "Eliminar CSS",
    ar: "إزالة CSS",
    zh: "移除 CSS",
    fa: "حذف CSS",
  },
  "editor.unsaved": {
    en: "You have unsaved changes",
    es: "Tienes cambios sin guardar",
    ar: "لديك تغييرات غير محفوظة",
    zh: "你有未保存的更改",
    fa: "تغییرات ذخیره‌نشده دارید",
  },

  "fonts.customFonts": {
    en: "Custom Fonts",
    es: "Fuentes personalizadas",
    ar: "الخطوط المخصّصة",
    zh: "自定义字体",
    fa: "فونت‌های سفارشی",
  },
  "fonts.uploadedFonts": {
    en: "Uploaded fonts",
    es: "Fuentes subidas",
    ar: "الخطوط المرفوعة",
    zh: "已上传的字体",
    fa: "فونت‌های بارگذاری‌شده",
  },
  "fonts.uploadFont": {
    en: "Upload Font",
    es: "Subir fuente",
    ar: "رفع خط",
    zh: "上传字体",
    fa: "بارگذاری فونت",
  },
  "fonts.uploading": {
    en: "Uploading...",
    es: "Subiendo...",
    ar: "جارٍ الرفع...",
    zh: "正在上传…",
    fa: "در حال بارگذاری...",
  },
  "fonts.supportedFormats": {
    en: "Supported formats: WOFF2, WOFF, TTF, OTF",
    es: "Formatos admitidos: WOFF2, WOFF, TTF, OTF",
    ar: "الصيغ المدعومة: WOFF2, WOFF, TTF, OTF",
    zh: "支持的格式：WOFF2、WOFF、TTF、OTF",
    fa: "قالب‌های پشتیبانی‌شده: WOFF2، WOFF، TTF، OTF",
  },
  "fonts.bundledTitle": {
    en: "Bundled fonts",
    es: "Fuentes incluidas",
    ar: "الخطوط المُضمّنة",
    zh: "内置字体",
    fa: "فونت‌های همراه",
  },
  "fonts.bundledSubtitle": {
    en: "These fonts ship with StyleShift and are always available.",
    es: "Estas fuentes vienen con StyleShift y siempre están disponibles.",
    ar: "تأتي هذه الخطوط مع StyleShift وهي متاحة دائمًا.",
    zh: "这些字体随 StyleShift 提供，始终可用。",
    fa: "این فونت‌ها همراه StyleShift عرضه می‌شوند و همیشه در دسترس‌اند.",
  },

  "settings.language": {
    en: "Language",
    es: "Idioma",
    ar: "اللغة",
    zh: "语言",
    fa: "زبان",
  },
  "settings.languageHelp": {
    en: "Choose the language for the StyleShift interface.",
    es: "Elige el idioma de la interfaz de StyleShift.",
    ar: "اختر لغة واجهة StyleShift.",
    zh: "选择 StyleShift 界面的语言。",
    fa: "زبان رابط کاربری StyleShift را انتخاب کنید.",
  },
  "settings.autoEnableAllSites": {
    en: "Enable for every website",
    es: "Activar para todos los sitios web",
    ar: "تفعيل لجميع المواقع",
    zh: "为所有网站启用",
    fa: "فعال‌سازی برای همهٔ وب‌سایت‌ها",
  },
  "settings.autoEnableAllSitesHelp": {
    en: "Automatically apply fonts to every website you visit, not just the pre-activated ones.",
    es: "Aplicar fuentes automáticamente en todos los sitios que visites, no solo los preactivados.",
    ar: "تطبيق الخطوط تلقائيًا على جميع المواقع التي تزورها، وليس فقط المُفعّلة مسبقًا.",
    zh: "自动将字体应用到你访问的所有网站，而不仅仅是预先激活的网站。",
    fa: "به‌طور خودکار فونت‌ها را روی همهٔ وب‌سایت‌هایی که بازدید می‌کنید اعمال کنید، نه فقط سایت‌های از پیش فعال.",
  },

  "tabs.fonts": {
    en: "Fonts",
    es: "Fuentes",
    ar: "الخطوط",
    zh: "字体",
    fa: "فونت‌ها",
  },
  "tabs.upload": {
    en: "Upload",
    es: "Subir",
    ar: "رفع",
    zh: "上传",
    fa: "بارگذاری",
  },
  "tabs.settings": {
    en: "Settings",
    es: "Ajustes",
    ar: "الإعدادات",
    zh: "设置",
    fa: "تنظیمات",
  },
  "tabs.css": {
    en: "CSS",
    es: "CSS",
    ar: "CSS ",
    zh: "CSS",
    fa: "CSS",
  },
  "tabs.about": {
    en: "About",
    es: "Acerca de",
    ar: "حول",
    zh: "关于",
    fa: "درباره",
  },

  "about.description": {
    en: "StyleShift is a browser extension that lets you customize fonts and styles on any website. Choose from bundled fonts or upload your own — then apply them globally or per-site. Everything stays on your device.",
    es: "StyleShift es una extensión de navegador que permite personalizar fuentes y estilos en cualquier sitio web. Elige entre fuentes incluidas o sube las tuyas, y aplícalas globalmente o por sitio. Todo permanece en tu dispositivo.",
    ar: "StyleShift هو إضافة متصفح تتيح لك تخصيص الخطوط والأنماط على أي موقع. اختر من الخطوط المُضمّنة أو ارفع خطوطك — ثم طبّقها عالميًا أو لكل موقع. يبقى كل شيء على جهازك.",
    zh: "StyleShift 是一款浏览器扩展，可让你自定义任何网站的字体和样式。从内置字体中选择或上传自己的字体——然后全局或按网站应用。所有数据都保留在你的设备上。",
    fa: "StyleShift یک افزونهٔ مرورگر است که به شما امکان می‌دهد فونت‌ها و سبک‌ها را در هر وب‌سایتی سفارشی کنید. از فونت‌های همراه انتخاب کنید یا فونت خود را بارگذاری کنید — سپس آن‌ها را به‌صورت سراسری یا برای هر سایت اعمال کنید. همه‌چیز روی دستگاه شما باقی می‌ماند.",
  },
  "about.madeBy": {
    en: "Made by",
    es: "Hecho por",
    ar: "صنع بواسطة",
    zh: "开发者",
    fa: "ساخته‌شده توسط",
  },
  "about.contact": {
    en: "Contact",
    es: "Contacto",
    ar: "تواصل",
    zh: "联系方式",
    fa: "تماس",
  },
};
