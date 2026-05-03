import mediaSourcesJson from '../shared/media-sources.json';

export interface MediaSource {
  id: string;
  country: string;
  countryCode: string;
  mediaName: string;
  language: string;
  homepageUrl: string;
  feedUrl: string;
  section: string;
  parserType: 'rss' | 'html';
  articleLimit: number;
  enabled: boolean;
  priority: number;
}

export function getEnabledSources(): MediaSource[] {
  return (mediaSourcesJson as MediaSource[]).filter(s => s.enabled);
}

export function getSourceById(id: string): MediaSource | undefined {
  return (mediaSourcesJson as MediaSource[]).find(s => s.id === id);
}
