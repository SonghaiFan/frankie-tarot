export interface PktReference { chapter: string; lineStart: number; lineEnd: number; }
export interface InterpretationProfile { id: string; templates: { en: string; 'zh-CN': string }; }
export interface SpreadSource { kind: 'pkt-adapted' | 'modern-extension'; label: string; references: PktReference[]; }
export interface CardSource {
  dataset: string; datasetVersion: string; note: string;
  pkt?: {
    id: string; title: string; author: string; illustrator: string; edition: string;
    url: string; sha256: string; translationNote: string; basis: string; modernExtensionSource: string;
    references: {upright: PktReference; reversed: PktReference};
  };
}
export interface LocalizedMeanings {
  upright: {en: string; 'zh-CN': string}; reversed: {en: string; 'zh-CN': string};
}
