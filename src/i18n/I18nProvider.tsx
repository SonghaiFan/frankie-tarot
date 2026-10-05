import { preferences } from "@/shared/storage";
import React, { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n, { LOCALE_STORAGE_KEY } from "@/i18n/config";

// Syncs localStorage, <html lang>, and <title> with the active language.
const I18nSideEffects: React.FC = () => {
  const { i18n: instance, t } = useTranslation();

  useEffect(() => {
    const lang = instance.language;
    preferences.setItem(LOCALE_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.title = t("appTitle");
  }, [instance.language, t]);

  return null;
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <I18nextProvider i18n={i18n}>
    <I18nSideEffects />
    {children}
  </I18nextProvider>
);
